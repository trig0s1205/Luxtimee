# Seguridad pendiente — LuxTimee

**Cuándo ejecutar:** Después de conectar GCP, Cloud SQL (PostgreSQL) y desplegar la API en Cloud Run.  
**Objetivo:** Corregir los fallos detectados en la auditoría del 4 ago 2026.  
**Instrucción para el agente:** Lee este documento completo y ejecuta cada ítem en orden. No saltes pasos. Verifica con build/lint/tests antes de dar por terminado.

---

## Contexto técnico

- **Monorepo:** `apps/api` (NestJS + Prisma), `apps/web` (Nuxt 3), `apps/image-service` (FastAPI).
- **Base de datos:** PostgreSQL. Hoy local con Docker; en producción será Cloud SQL.
- **Auth:** JWT global (`JwtAuthGuard`) + `@Public()` en rutas abiertas + `RolesGuard` en admin.
- **No usamos Supabase.** No hay RLS hoy; el acceso a datos es solo vía API NestJS.

---

## Orden de ejecución

1. Bloquear secretos y contraseñas en código
2. Endurecer variables de entorno y despliegue
3. Proteger image-service
4. Completar validación/sanitización de inputs
5. Endurecer base de datos (sin depender solo de la API)
6. Revisar rutas públicas vs protegidas
7. Errores y logging de seguridad
8. Verificación final

---

## 1. Eliminar contraseñas y claves del repositorio

### 1.1 `apps/web/utils/local-auth.ts`
- **Problema:** Contraseñas hardcodeadas (`luxtime`) y cuentas dev en el cliente.
- **Acción:**
  - Eliminar `DEV_ACCOUNTS` con contraseñas en texto plano.
  - Eliminar `DEV_ACCOUNT_HINTS` que expone `password`.
  - Si se necesita login local en dev, leer credenciales **solo** desde variables de entorno del servidor (nunca embebidas en el bundle). Alternativa preferida: eliminar login local por completo y usar solo API + seed en dev.
  - Asegurar que `LOCAL_AUTH_ENABLED` sea `false` en cualquier build de producción (`import.meta.dev` ya lo limita; verificar que el build de Vercel no incluya este path activo).

### 1.2 `apps/web/components/auth/LoginPanel.vue`
- **Problema:** Botones "Acceso rápido" con email y contraseña en el template (`password: 'luxtime'`).
- **Acción:** Eliminar el bloque `auth-quick` completo o condicionarlo estrictamente a `import.meta.dev && process.env.NUXT_PUBLIC_ENABLE_DEV_LOGIN === 'true'`. Nunca desplegar con esa variable en producción.

### 1.3 `apps/api/prisma/seed.ts` (y `seed.js` si existe)
- **Problema:** Contraseña por defecto en código (`hashPassword('LUXTIMEE')`).
- **Acción:**
  - Leer `SEED_ADMIN_PASSWORD` desde variable de entorno.
  - Si no está definida, fallar con mensaje claro o generar una contraseña aleatoria y mostrarla **solo en consola** al ejecutar seed (nunca commitearla).
  - Documentar en `apps/api/.env.example` (sin valor real).

### 1.4 `docker-compose.yml`
- **Problema:** `POSTGRES_PASSWORD: luxtime_dev` en el repo.
- **Acción:**
  - Usar `${POSTGRES_PASSWORD:-luxtime_dev}` leyendo de `.env` local (gitignored).
  - Añadir `docker-compose.override.example.yml` o documentar en `.env.example` raíz.
  - En producción (Cloud SQL) no usar este compose para credenciales reales.

### 1.5 `.env.example` (raíz, `apps/api`, `apps/web`)
- **Problema:** Valores que parecen secretos (`JWT_SECRET=dev-jwt-...`, `DATABASE_URL` con user/pass).
- **Acción:**
  - Dejar solo placeholders vacíos o `changeme` con comentario "generar en producción".
  - **Quitar `DATABASE_URL` de `apps/web/.env.example`** — el frontend no debe conectar a la DB.
  - Añadir comentarios de qué variables van en Vercel vs Cloud Run vs Cloud SQL.

### 1.6 Búsqueda global
Ejecutar y corregir cualquier hallazgo restante:
```bash
rg -i "password:\s*['\"]|hashPassword\(['\"]|luxtime_dev|dev-jwt-secret" --glob "!node_modules" --glob "!dist" --glob "!.output"
```

---

## 2. Secretos solo en el servidor

### 2.1 API Nest (`apps/api`)
- Confirmar que **ningún** secreto se expone en respuestas JSON ni en logs.
- Variables que deben existir **solo** en Cloud Run / `.env` local (nunca `NUXT_PUBLIC_*`):
  - `JWT_SECRET`, `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`
  - `DATABASE_URL`
  - `CRON_SECRET`
  - `GOOGLE_OAUTH_CLIENT_SECRET`
  - `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
  - `RESEND_API_KEY`
  - `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`
  - `GA4_PRIVATE_KEY`, `GA4_CLIENT_EMAIL`
  - `SENTRY_DSN`
  - `SEED_ADMIN_PASSWORD` (solo para seed manual)

### 2.2 Web Nuxt (`apps/web`)
- `runtimeConfig` en `nuxt.config.ts`: solo URLs públicas (`NUXT_PUBLIC_API_BASE_URL`, `NUXT_PUBLIC_API_ASSETS_URL`, `NUXT_PUBLIC_SITE_URL`).
- Verificar que no haya `DATABASE_URL` ni secretos en `nuxt.config.ts` ni en composables del cliente.

### 2.3 Vercel / GCP
- Documentar en este repo (sección al final) dónde va cada variable cuando esté desplegado.
- Rotar `JWT_SECRET` y `CRON_SECRET` al pasar a producción (no reutilizar valores de `.env.example`).

---

## 3. Proteger image-service

**Archivo:** `apps/image-service/app/main.py`

### Problema
- Endpoint `POST /api/v1/process-watch` (y `/process`) **sin autenticación**.
- Puerto `8001` expuesto en `docker-compose.yml`.

### Acción
1. Añadir variable `IMAGE_SERVICE_API_KEY` (o similar).
2. Middleware o dependencia FastAPI que exija header `X-API-Key` (o `Authorization: Bearer ...`) en rutas de procesamiento.
3. La API Nest (`apps/api/src/integrations/image-processing.service.ts`) debe enviar esa clave en cada request.
4. En Cloud Run: no exponer image-service públicamente si solo lo usa la API; usar red interna o IAM + invoker restringido.
5. Mantener validación existente (tamaño, magic bytes, MIME).
6. Health (`GET /health`) puede quedar público para probes.

---

## 4. Validación y sanitización de inputs

### Ya existe
- `ValidationPipe` global en `apps/api/src/main.ts` (`whitelist`, `forbidNonWhitelisted`, `transform`).
- `sanitizePlainText` / `sanitizePlainTextOptional` en `apps/api/src/common/utils/sanitize-text.util.ts`.
- Usado en: pre-pedidos, watches, shipping, wholesale, settings (parcial).

### Pendiente
Aplicar `sanitizePlainText` (o `sanitizePlainTextOptional`) en **todos** los DTOs con texto libre del usuario:

| Archivo / endpoint | Campos |
|--------------------|--------|
| `apps/api/src/reviews/reviews.controller.ts` | `customerName`, `body` (mover a DTO en archivo separado con `@Transform`) |
| `apps/api/src/brands/dto/brand.dto.ts` | `name`, etc. |
| `apps/api/src/categories/dto/category.dto.ts` | `name` |
| `apps/api/src/care/dto/care.dto.ts` | campos de texto |
| `apps/api/src/warranties/dto/warranty.dto.ts` | campos de texto |
| `apps/api/src/waitlist/waitlist.controller.ts` | email ya validado; revisar otros campos si los hay |
| Cualquier otro DTO con `@IsString()` sin `@Transform` sanitize |

### Regla
Todo string que venga del cliente y se guarde en BD o se reenvíe (WhatsApp, email) debe pasar por `sanitizePlainText` con `maxLength` acorde al campo.

---

## 5. Base de datos — acceso y RLS

### Situación actual
- PostgreSQL sin Row Level Security.
- Docker expone `5432:5432` en desarrollo.
- Prisma tiene acceso total con `DATABASE_URL`.

### Acción en GCP (Cloud SQL)
1. **No** exponer Cloud SQL a internet público; solo IP privada / Cloud SQL Auth Proxy / conector desde Cloud Run.
2. Usuario de aplicación con permisos mínimos (no `postgres` superuser en prod).
3. Contraseña fuerte generada en Secret Manager, referenciada en Cloud Run.

### RLS (opcional pero recomendado)
Si se quiere defensa en profundidad:
- Crear migración Prisma/SQL con `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` y políticas por rol de aplicación.
- **Nota:** Prisma usa una sola conexión; RLS con un solo rol de app suele ser "todo o nada" a menos que se use `SET LOCAL role` por request. Valorar si conviene RLS o confiar en API + red privada. Si no se implementa RLS, documentar que la seguridad es **solo capa API + red**.

### Docker local
- Cambiar `ports` de postgres a `127.0.0.1:5432:5432` para no escuchar en todas las interfaces.
- O quitar `ports` si la API corre en la misma red Docker.

---

## 6. Autenticación en rutas protegidas

### Ya correcto
- `JwtAuthGuard` global en `apps/api/src/app.module.ts`.
- Admin: `RolesGuard` en controllers de orders, watches, dashboards, inventory, etc.

### Revisar / mantener
Rutas **públicas intencionales** (no quitar `@Public()` sin producto):
- `GET /health`
- `POST /auth/login`, Google OAuth, `GET /auth/config`
- `GET /catalog/*`, `GET /settings/*/public`
- `POST /pre-orders` (checkout)
- `GET /certificates/public/:slug`
- `GET /reviews/published`, `POST /reviews`
- `POST /waitlist`
- Wholesale: solicitud de acceso (según diseño actual)
- `POST /internal/cron/pre-order-reminders` — debe exigir `CRON_SECRET` en producción (ya implementado en `cron.controller.ts`; verificar env en Cloud Run)

### Verificación
```bash
rg "@Public\(\)" apps/api/src --glob "*.controller.ts"
```
Para cada ruta pública, confirmar que no filtra datos financieros ni PII de otros usuarios.

### Mock login
- `USE_MOCKS=true` y `mockLogin` deben estar **imposibles** con `NODE_ENV=production` (ya parcialmente; re-verificar `auth.controller.ts`).

---

## 7. Mensajes de error

**Archivo:** `apps/api/src/common/filters/all-exceptions.filter.ts`

### Ya correcto
- Errores 5xx en producción → mensaje genérico.

### Mejorar
- Asegurar que errores de Prisma (ej. columna inexistente) nunca lleguen al cliente en prod aunque el status no sea 500.
- Revisar que `ValidationPipe` no devuelva stack traces.
- En logs del servidor: sí registrar detalle; nunca incluir `password`, tokens ni `DATABASE_URL` en logs.

---

## 8. Logging y detección de ataques

### Ya existe
- `AbuseGuardMiddleware` — patrones SQLi/XSS, strikes por IP (`apps/api/src/common/middleware/abuse-guard.middleware.ts`).
- `ThrottlerGuard` — rate limit global.
- `AuditInterceptor` — acciones de staff en `auditLog` (no ataques).

### Pendiente
1. **Log de intentos de login fallidos** en `auth.service.ts` / `auth.controller.ts` (IP, email hash o email parcial, timestamp). Sin guardar contraseña.
2. **Log de 401/403** repetidos por IP (opcional: tabla `security_event` o solo logger estructurado).
3. **Sentry** (`SENTRY_DSN`): configurar en Cloud Run si se usa monitoreo.
4. **Alertas:** documentar revisión manual de logs de `AbuseGuardMiddleware` o exportar a Cloud Logging en GCP.

### No implementar aún (fuera de alcance)
- WAF de terceros, SIEM completo, honeypots.

---

## 9. Checklist de verificación final

Ejecutar antes de cerrar el trabajo:

- [ ] `rg` sin contraseñas ni secretos reales en código fuente
- [ ] `apps/web/.env.example` sin `DATABASE_URL`
- [ ] Image-service rechaza requests sin API key
- [ ] Cloud SQL no accesible desde internet público
- [ ] `JWT_SECRET` y `CRON_SECRET` rotados en producción
- [ ] Login dev / mock deshabilitado en build de producción
- [ ] DTOs de reseñas y resto con sanitize
- [ ] Postgres Docker solo en `127.0.0.1` (dev)
- [ ] `pnpm --filter @luxtime/api build` OK
- [ ] `pnpm --filter @luxtime/web build` OK
- [ ] Probar login admin, checkout, upload imagen, dashboard admin

---

## 10. Variables de entorno — referencia post-GCP

| Variable | Dónde | Notas |
|----------|-------|-------|
| `DATABASE_URL` | Cloud Run (API) | Cloud SQL, red privada |
| `JWT_SECRET` | Cloud Run (API) | ≥32 chars aleatorios |
| `CRON_SECRET` | Cloud Run (API) + Cloud Scheduler header | Rotar |
| `FRONTEND_URL` | Cloud Run (API) | URL Vercel |
| `NUXT_PUBLIC_API_BASE_URL` | Vercel | URL Cloud Run |
| `NUXT_PUBLIC_API_ASSETS_URL` | Vercel | Misma API o CDN uploads |
| `NUXT_PUBLIC_SITE_URL` | Vercel | Dominio final |
| `IMAGE_SERVICE_URL` | Cloud Run (API) | URL interna o privada |
| `IMAGE_SERVICE_API_KEY` | Cloud Run (API + image-service) | Nuevo — ver sección 3 |
| Resto de integraciones | Cloud Run (API) | Secret Manager recomendado |

---

## Archivos clave a tocar

```
apps/web/utils/local-auth.ts
apps/web/components/auth/LoginPanel.vue
apps/api/prisma/seed.ts
docker-compose.yml
apps/api/.env.example
apps/web/.env.example
apps/image-service/app/main.py
apps/api/src/integrations/image-processing.service.ts
apps/api/src/reviews/reviews.controller.ts
apps/api/src/common/filters/all-exceptions.filter.ts
apps/api/src/auth/auth.service.ts
apps/api/src/common/middleware/abuse-guard.middleware.ts (revisar, no reescribir sin necesidad)
```

---

*Generado: 4 ago 2026 — Auditoría previa a despliegue GCP.*
