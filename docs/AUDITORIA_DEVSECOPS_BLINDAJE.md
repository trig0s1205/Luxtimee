# Auditoría DevSecOps Luxtime — Informe de blindaje

**Fecha:** 30 de julio de 2026  
**Alcance:** Plataforma Luxtime (NestJS API, Nuxt 3 web, FastAPI image-service, PostgreSQL/Prisma)  
**Objetivo:** Hardening OWASP, resiliencia multimedia, higiene de código y verificación E2E de flujos críticos  

Este documento describe **exactamente** qué se auditó, qué riesgos existían, qué se implementó y cómo verificarlo.

---

## 1. Contexto y arquitectura tocada

```
Browser (Nuxt 3)
    │  cookies httpOnly (auth / mayorista)
    ▼
API NestJS (:3001/api/v1)  ←── Throttle, JWT, Roles, AbuseGuard, Helmet
    │
    ├── PostgreSQL (Prisma)
    ├── Disco local /uploads/watches
    └── Image Service FastAPI (:8001)  ← rembg + canvas 80%
```

La API Nest es la fuente de verdad para inventario, catálogo, auth y uploads.  
El frontend Nuxt consume esa API; se eliminaron rutas Nitro admin legacy inseguras.

---

## 2. Resumen ejecutivo: qué se blindó

| Área OWASP / riesgo | Antes | Después |
|---------------------|-------|---------|
| Cron interno público | `@Public()` sin secreto | Header `x-cron-secret` / Bearer + env `CRON_SECRET` |
| Mock login en producción | Solo gated por `USE_MOCKS` | **Imposible** si `NODE_ENV=production` (404) |
| Nitro `/api/admin/*` | Upload sin auth (legacy Product) | **Eliminado** |
| Rate limiting | 120 req/min global | Global más estricto en prod + límites finos en login/upload/wholesale |
| Upload multimedia | MIME declarado, 50MB todo, sin rollback | Magic bytes, 10MB img / 50MB video, rollback de archivos |
| Image-service | CORS `*`, sin size/magic, errores con detalle | CORS por env, 10MB, magic bytes, error genérico |
| Headers seguridad | Helmet básico en API; Nuxt sin headers | Helmet afinado + middleware Nuxt CSP/HSTS/etc. |
| WAF ligero | No existía | Middleware anti-patrones + strikes por IP |
| Admin UI | Redirect filtraba path admin en query | Sin filtrar rutas; no-staff → `/` |
| XSS defense-in-depth | Sin `v-html` (bien); sin sanitize backend | Sanitize de texto libre en DTOs |
| Errores 500 | Mensaje genérico (OK) | En prod nunca detalle interno en 5xx |
| ValidationPipe bypass | Bodies tipados inline (shipping/settings) | DTOs con `class-validator` |
| Código muerto | design/, ui-kit, componentes huérfanos | Eliminado; sitemap limpio |

---

## 3. Fase 1 — Blindaje crítico (detalle)

### 3.1 Cron interno (`CRON_SECRET`)

**Archivo:** `apps/api/src/common/schedule/cron.controller.ts`

**Problema:** `POST /api/v1/internal/cron/pre-order-reminders` era `@Public()` y cualquiera podía disparar recordatorios.

**Solución:**
- Lee `CRON_SECRET` del entorno.
- Acepta el secreto por:
  - Header `x-cron-secret`, o
  - `Authorization: Bearer <secret>`
- Comparación **timing-safe** (`crypto.timingSafeEqual`).
- **Producción** sin `CRON_SECRET` → `503 Service Unavailable`.
- **Desarrollo** sin secreto → permite la llamada pero registra warning en logs.

**Configuración:**

```env
CRON_SECRET=change-me-cron-secret-in-production
```

Documentado en `apps/api/.env.example` y `.env.example` de la raíz.

**Uso ejemplo (scheduler / cron VPS):**

```bash
curl -X POST http://localhost:3001/api/v1/internal/cron/pre-order-reminders \
  -H "x-cron-secret: $CRON_SECRET"
```

---

### 3.2 Mock login bloqueado en producción

**Archivo:** `apps/api/src/auth/auth.controller.ts`

**Problema:** `POST /auth/mock-login` dependía solo de `USE_MOCKS=true`. Un misconfig en prod podía abrir backdoor de sesión admin.

**Solución:**
- Si `NODE_ENV === 'production'` → `404 Not Found` (no revela que existe el endpoint).
- `GET /auth/config` reporta `mockEnabled: false` siempre en producción.
- Además se aplicó throttle estricto (ver §3.4).

---

### 3.3 Eliminación de superficie Nitro admin legacy

**Eliminados:**
- `apps/web/server/api/admin/watches/upload.post.ts`  
  - Creaba registros en modelo `Product` (flujo paralelo/obsoleto).  
  - **No tenía autenticación**.  
  - El inventario real usa Nest: `POST /watches/:id/upload-media`.
- `apps/web/server/api/admin/revenue.get.ts`  
  - Proxy sin callers en el frontend actual (ganancia usa `useApi` → Nest).

Con esto se cierra una puerta de escritura/lectura administrativa colateral en Nitro.

---

### 3.4 Rate limiting diferenciado

**Archivos:**
- `apps/api/src/app.module.ts` — default global
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/watches/watches.controller.ts`
- `apps/api/src/wholesale-access/wholesale-access.controller.ts`
- `apps/api/src/health/health.controller.ts`

| Endpoint / ámbito | Límite | Ventana |
|-------------------|--------|---------|
| Global (prod) | 80 | 60s |
| Global (dev) | 120 | 60s |
| `POST /auth/login` | 5 | 60s |
| `POST /auth/mock-login` | 5 | 60s |
| `POST /auth/refresh` | 10 | 60s |
| `POST /watches/:id/upload-media` | 15 | 60s |
| `POST /wholesale-access/session` | 20 | 60s |
| `POST /pre-orders` (ya existía) | 10 | 60s |
| `GET /health` | **sin throttle** (`@SkipThrottle`) | — |

Mitiga fuerza bruta de login y abuso de uploads / activación de enlaces mayoristas.

---

### 3.5 Magic bytes, límites de tamaño y rollback de uploads

**Archivos nuevos / tocados:**
- `apps/api/src/common/utils/file-magic.util.ts` *(nuevo)*
- `apps/api/src/watches/watches.controller.ts`
- `apps/api/src/watches/watches.service.ts` (`uploadMedia`)
- `apps/api/src/products/products.controller.ts` (mismo criterio MIME/size)

**Problema:**
1. Solo se confiaba en `file.mimetype` (spoofable).
2. Imágenes aceptaban cualquier `image/*` (p. ej. SVG).
3. Límite único 50MB para imagen y video.
4. Se escribía a disco y luego se actualizaba DB: si fallaba la DB, quedaban **archivos huérfanos**.

**Solución — validación de contenido:**

| Tipo | Magic bytes | MIME permitidos | Tamaño máx |
|------|-------------|-----------------|------------|
| Imagen | JPEG `FF D8 FF`, PNG firma, WEBP `RIFF….WEBP` | jpeg/jpg/png/webp | **10 MB** |
| Video | `ftyp` (MP4), EBML (WebM) | mp4/webm | **50 MB** |

Flujo `uploadMedia`:
1. Assert magic bytes + tamaño en buffers.
2. Procesar imágenes vía microservicio.
3. Escribir 2 WEBP + 1 video a disco.
4. Actualizar Prisma.
5. Si falla → `unlink` de los 3 archivos nuevos.
6. Si éxito → best-effort borrar media anterior (URLs `/uploads/...` previas).

Extensión de video forzada a `.mp4` / `.webm` (no se confía ciegamente en `originalname`).

---

### 3.6 Microservicio Python (image-service)

**Archivo:** `apps/image-service/app/main.py`

**Se mantuvo** el pipeline de negocio:
- rembg → crop bbox → escala proporcional al **80%** del lienzo 800×1200 → centrado → WEBP q90.

**Se endureció:**
- `MAX_UPLOAD_BYTES = 10MB` antes de rembg.
- Magic bytes reales (no solo `content_type`).
- Rechazo si MIME declarado ≠ contenido.
- CORS por env `IMAGE_SERVICE_CORS_ORIGINS` (default localhost:3000/3001), **ya no** `allow_origins=["*"]` con credentials.
- Errores al cliente: mensaje genérico `"Error al procesar la imagen"`; stack completo solo en logger servidor.

---

### 3.7 Headers de seguridad

#### Nest API — `apps/api/src/main.ts`
- Helmet con:
  - `frameguard: DENY`
  - `referrerPolicy: strict-origin-when-cross-origin`
  - HSTS en producción
  - CSP en producción (scripts/styles/fonts/img/media acotados)
  - `crossOriginResourcePolicy: cross-origin` (necesario para servir `/uploads` al frontend)
- CORS en producción: **solo** `FRONTEND_URL` (si falta → `false`, no abre a todos).
- CORS en desarrollo: reflect origin (DX local).

#### Nuxt — `apps/web/server/middleware/security-headers.ts` *(nuevo)*
En todas las respuestas Nitro:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` restrictiva
- En prod: `Strict-Transport-Security` + `Content-Security-Policy`

---

### 3.8 Middleware anti-abuso / IP strikes

**Archivo:** `apps/api/src/common/middleware/abuse-guard.middleware.ts`  
**Registro:** Express middleware en `main.ts` (antes de rutas Nest), para garantizar ejecución.

**Qué inspecciona:** URL (decodificada) + body JSON.

**Patrones bloqueados (403):**
- SQLi típico (`UNION SELECT`, `DROP TABLE`, `OR 1=1`, etc.)
- Path traversal (`../`, `..\`)
- XSS payload (`<script`, `javascript:`, `onerror=`, `onload=`, `eval(`)

**Strikes por IP:**
- Ventana 10 min, máx 8 strikes → bloqueo temporal 15 min.
- IP desde `cf-connecting-ip` o primer hop de `x-forwarded-for`.

> Nota: es WAF **en memoria por proceso**. En multi-instancia hace falta Redis/edge WAF; suficiente para VPS único.

---

### 3.9 Admin Nuxt sin filtrar estructura

**Archivos:** `apps/web/middleware/auth.ts`, `apps/web/middleware/role.ts`

**Antes:** no autenticado / no staff → `/ingresar?redirect=/admin/...` (filtraba rutas internas).

**Después:**
- Sin sesión → `/ingresar` (sin query de path admin).
- Sin rol staff → `/` (home), sin revelar el destino admin.

---

### 3.10 Sanitización de texto (XSS defense-in-depth)

**Archivo:** `apps/api/src/common/utils/sanitize-text.util.ts` *(nuevo)*

Ya no había sinks `v-html` en el frontend (riesgo XSS storefront bajo). Aun así se sanitiza en backend:

- Quita tags HTML
- Quita caracteres de control
- Neutraliza `javascript:` y atributos `on*=`
- Recorta longitud máxima

Aplicado vía `@Transform` en:
- Descripción de relojes (create/update)
- Notas mayoristas
- Nombres/notas shipping
- Prefijo WhatsApp / ciudad platform (settings)

---

### 3.11 AllExceptionsFilter

**Archivo:** `apps/api/src/common/filters/all-exceptions.filter.ts`

- Errores no-HTTP → mensaje fijo `"Error interno del servidor"`.
- Status ≥ 500 en **producción** → nunca se reenvía el objeto/detalle interno al cliente.
- Stack solo en logger del servidor.
- Se evitó registrar el filter dos veces (solo `APP_FILTER`).

---

## 4. Fase 2 — Higiene de código

### 4.1 Código muerto eliminado

| Ruta eliminada | Motivo |
|----------------|--------|
| `pages/design/*` | Design lab, no producto |
| `pages/ui-kit.vue` | Showcase interno |
| `components/layout/WholesaleNotice.vue` | No montado en layouts |
| `composables/useWholesaleNotice.ts` | Sin callers |
| `components/catalog/FeaturedCarousel.vue` | Reemplazado por `HomeFeaturedCarousel` |
| `components/catalog/TikTokFeed.vue` | Sin refs |
| `components/ui/Marquee.vue` | Sin refs |
| `components/admin/AdminSalesChart.vue` | Sin refs |
| `components/admin/AdminLineChart.vue` | Sin refs |
| `components/ui/WatchCard.vue` | Solo ui-kit |

**Conservado a propósito:** `apps/web/mocks/watches.ts` — fallback de catálogo en dev si la API cae (`useCatalogData`).

### 4.2 Sitemap

**Archivo:** `apps/web/server/routes/sitemap.xml.ts`

- Se quitó `/design`.
- Rutas estáticas: `/`, `/catalogo`, `/mayoristas`, `/sorteos` + productos por slug.

### 4.3 DTOs con validación runtime

Antes, ValidationPipe global **no validaba** bodies tipados como interfaces TypeScript.

**Nuevos DTOs:**
- `apps/api/src/shipping/dto/shipping-zone.dto.ts`
- `apps/api/src/settings/dto/settings-body.dto.ts`
- `apps/api/src/marketing/dto/validate-contact.dto.ts`

Controllers actualizados para usar esas clases.

### 4.4 Logs

- WhatsApp / Resend mocks: `console.log` → `Logger.debug` de Nest.
- Boot de API mantiene un `console.log` de arranque (aceptable).

### 4.5 Módulo Products

Sigue existiendo (Cloudinary path legacy) pero ahora exige MIME allowlist + magic bytes + límite 10MB. No se reescribió el dominio Product vs Watch en esta auditoría (fuera de alcance de seguridad inmediata).

---

## 5. Fase 3 — Verificación E2E (smoke)

Pruebas ejecutadas contra API local (`127.0.0.1:3001`):

| Test | Resultado esperado | Resultado |
|------|--------------------|-----------|
| `GET /health` | 200 ok | PASS |
| `GET /catalog` | Lista con total ≥ 1 | PASS |
| `GET /catalog/featured` | Array | PASS |
| `GET /catalog/wholesale` sin cookie | 401 | PASS |
| Activar sesión mayorista + listar wholesale | 201 + items con `wholesalePrice` | PASS |
| Catálogo público sin `cost` ni `wholesalePrice` | strip financiero | PASS |
| `GET /watches` sin JWT | 401 | PASS |
| Search `UNION SELECT…` | 403 abuse | PASS |
| Search `<script>…` | 403 | PASS |
| Search `../etc/passwd` | 403 | PASS |
| Search normal `patek` | 200 | PASS |
| `GET /settings/platform/public` | 200 | PASS |
| `GET /shipping-zones/public` | 200 | PASS |
| `GET /catalog/:slug` | 200 | PASS |
| Magic JPEG util | detecta `image/jpeg` | PASS |

**Resultado final smoke:** 9/9 checks principales PASS + flujo mayorista con cookie real OK.

---

## 6. Archivos clave creados o modificados

### Nuevos
- `apps/api/src/common/utils/file-magic.util.ts`
- `apps/api/src/common/utils/sanitize-text.util.ts`
- `apps/api/src/common/middleware/abuse-guard.middleware.ts`
- `apps/api/src/shipping/dto/shipping-zone.dto.ts`
- `apps/api/src/settings/dto/settings-body.dto.ts`
- `apps/api/src/marketing/dto/validate-contact.dto.ts`
- `apps/web/server/middleware/security-headers.ts`
- `docs/AUDITORIA_DEVSECOPS_BLINDAJE.md` (este archivo)

### Modificados (principales)
- `apps/api/src/main.ts`, `app.module.ts`
- `apps/api/src/auth/auth.controller.ts`
- `apps/api/src/common/schedule/cron.controller.ts`
- `apps/api/src/common/filters/all-exceptions.filter.ts`
- `apps/api/src/watches/watches.controller.ts`, `watches.service.ts`
- `apps/api/src/products/products.controller.ts`
- `apps/api/src/wholesale-access/*`
- `apps/api/src/shipping/shipping.controller.ts`
- `apps/api/src/settings/settings.controller.ts`
- `apps/api/src/marketing/marketing.controller.ts`
- `apps/api/src/health/health.controller.ts`
- `apps/image-service/app/main.py`
- `apps/web/middleware/auth.ts`, `role.ts`
- `apps/web/server/routes/sitemap.xml.ts`
- `.env.example`, `apps/api/.env.example`

### Eliminados
- Nitro admin upload + revenue proxy
- Páginas design/ui-kit y componentes/composables huérfanos listados en §4.1

---

## 7. Checklist operativo post-despliegue

1. Definir en prod:
   ```env
   NODE_ENV=production
   USE_MOCKS=false
   CRON_SECRET=<secreto largo aleatorio>
   FRONTEND_URL=https://tu-dominio.com
   JWT_SECRET=<secreto largo>
   IMAGE_SERVICE_CORS_ORIGINS=https://tu-dominio.com,https://api.tu-dominio.com
   ```
2. Proteger cron del VPS/Cloud Scheduler con `x-cron-secret`.
3. Confirmar que `mock-login` responde 404 en prod.
4. Confirmar headers en respuesta Nuxt (`X-Frame-Options`, CSP).
5. Probar upload de reloj (2 fotos + video) y verificar que un fallo de DB no deja archivos basura.
6. No exponer image-service públicamente a internet; solo red interna / localhost desde la API.

---

## 8. Limitaciones conscientes (no son bugs olvidados)

- Abuse guard **en memoria** (no compartido entre réplicas).
- CSP de Nuxt usa `'unsafe-inline'` en scripts/styles por compatibilidad con el stack actual; se puede endurecer más adelante con nonces.
- Soft-delete de reloj aún no borra ficheros históricos del disco (mejora futura de housekeeping).
- Rate limit no está en Redis.
- El módulo `products` + Cloudinary sigue como path legacy; el flujo activo de inventario es `watches`.

---

## 9. Conclusión

Se cerraron los agujeros de seguridad **críticos** encontrados en la auditoría (cron abierto, mock login, Nitro upload sin auth, uploads spoofables, falta de rate limit fino, ausencia de headers en Nuxt, WAF inexistente) y se acompañó con higiene de código + smoke E2E verificable.

La plataforma queda en un estado **defendible para producción en VPS único**, con controles OWASP alineados a autenticación, injection, XSS defense-in-depth, misconfiguration y rate limiting — sin romper el flujo de negocio de catálogo, mayoristas ni carga multimedia.
