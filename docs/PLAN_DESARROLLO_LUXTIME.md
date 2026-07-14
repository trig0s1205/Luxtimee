# Plan de Desarrollo — Luxtime

> Documento maestro de ejecución. Se entrega al agente de código (Cursor Composer) **una fase a la vez**.
> Cada fase está cerrada: no requiere decisiones de arquitectura por parte del agente.

---

## 0. Cómo usar este documento

- Entrega cada fase por separado a Composer. No adelantes fases.
- Toda decisión de arquitectura ya está tomada aquí. Si algo no está definido, revisa **"Supuestos y decisiones tomadas"** al final antes de improvisar.
- El **stack es fijo y no negociable** (ver §1). No sustituir librerías por alternativas.
- La estética parte de **DIXUS** (dark luxury + oro, minimalismo, dinámica tipo TikTok). No rediseñar desde cero; reutilizar tokens, patrones y componentes ya definidos.
- Regla transversal obligatoria en TODA fase: entradas validadas (`class-validator`), errores manejados, nada de secretos en el código, y toda mutación de datos por staff queda en el **log de auditoría**.

---

## 1. Stack tecnológico fijo (resumen operativo)

| Capa | Tecnología |
|---|---|
| Front | Nuxt 3 (Vue 3 + TypeScript), Tailwind CSS, GSAP, Pinia — deploy en Vercel |
| Back | NestJS (Node + TypeScript), Prisma, class-validator/class-transformer, @nestjs/throttler — Docker en Google Cloud Run |
| BD | PostgreSQL en Google Cloud SQL |
| Auth | JWT + Google OAuth (Passport: `@nestjs/passport`, `passport-google-oauth20`) |
| Imágenes | Microservicio Python (FastAPI) en Cloud Run + `rembg` + `Pillow` |
| Media/CDN | Cloudinary |
| Correo | Resend (SDK Node) |
| Mensajería | WhatsApp Business Platform — Cloud API oficial de Meta (sin BSP) |
| Monitoreo | Sentry (`@sentry/node`), Google Cloud Monitoring, Google Analytics 4 (Data API) |
| DNS/CDN/WAF | Cloudflare |
| Librerías puntuales | `qrcode` (certificado QR), `exceljs` (import/export inventario), `pdfkit`/Puppeteer (reportes PDF) |
| CI/CD | GitHub · Vercel (front, auto) · GitHub Actions → Docker → Cloud Run (back) |
| Pruebas | Jest (unit/integración), Playwright (e2e) |
| Lenguajes | TypeScript (front+back), Python (microservicio imágenes), SQL (PostgreSQL) |

**Añadidos técnicos decididos (ver Supuestos):** `@nestjs/schedule` + **Google Cloud Scheduler** (crons reales pese al scale-to-zero de Cloud Run), `pnpm` workspaces (monorepo).

---

## 2. Estructura de repositorio asumida (monorepo pnpm)

```text
luxtime/
├─ apps/
│  ├─ web/                 # Nuxt 3 (storefront + panel admin en /admin)
│  │  ├─ assets/css/       # tokens.css, base.css
│  │  ├─ components/       # ui/, layout/, catalog/, checkout/, account/, admin/
│  │  ├─ composables/      # useApi, useAuth, useCart, useWishlist, useAnalytics
│  │  ├─ layouts/          # default.vue, account.vue, admin.vue
│  │  ├─ middleware/       # auth.ts, role.ts
│  │  ├─ pages/            # index, catalogo, producto/[slug], carrito, checkout, cuenta/*, admin/*, certificado/[slug], legal/*
│  │  ├─ plugins/          # gsap.client.ts, sentry.client.ts, analytics.client.ts
│  │  ├─ stores/           # cart.ts, auth.ts, wishlist.ts, ui.ts
│  │  ├─ nuxt.config.ts
│  │  └─ tailwind.config.ts
│  ├─ api/                 # NestJS
│  │  ├─ prisma/schema.prisma
│  │  └─ src/
│  │     ├─ common/        # guards, decorators, interceptors, filters, pipes
│  │     ├─ prisma/        # PrismaModule/Service
│  │     ├─ auth/ users/ catalog/ products/ brands/ inventory/
│  │     ├─ warranties/ care/ shipping/ orders/ pre-orders/
│  │     ├─ dashboards/ notifications/ marketing/ segmentation/
│  │     ├─ certificates/ reviews/ waitlist/ wishlist/ audit/ settings/ integrations/
│  │     ├─ app.module.ts
│  │     └─ main.ts
│  └─ image-service/       # Python FastAPI (rembg + Pillow)
│     ├─ app/main.py
│     ├─ requirements.txt
│     └─ Dockerfile
├─ packages/
│  └─ shared/              # contratos: tipos, enums, DTOs compartidos front↔back
├─ .github/workflows/      # ci.yml, deploy-api.yml
├─ docker/
└─ pnpm-workspace.yaml
```

**Convenciones para el agente:** contratos (tipos/enums/DTO) viven en `packages/shared` y son la fuente de verdad front↔back; dinero se almacena como **entero en COP** (sin decimales); fechas en UTC ISO; nombres de componentes Vue en PascalCase; módulos Nest siguen convención estándar (`*.module.ts`, `*.service.ts`, `*.controller.ts`, `dto/`).

---

## 3. Mapa de fases, dependencias y paralelización

Total: **20 fases** agrupadas en 6 etapas. La **Fase D (Diseño)** es una fase aislada de solo-front que produce varias propuestas visuales para que el cliente elija (es un *gate*), y corre **en paralelo** al backend inicial.

| # | Fase | Etapa | Depende de | Paralelizable con |
|---|---|---|---|---|
| 0 | Fundaciones e infraestructura de desarrollo | Cimientos | — | — |
| 1 | Modelo de datos y esquema (Prisma/PostgreSQL) | Cimientos | 0 | D |
| 2 | Autenticación, roles, sesión y auditoría base | Cimientos | 1 | D |
| **D** | **Exploración de diseño (SOLO front, N variantes) — GATE** | Cimientos | 0 | 1, 2 |
| 3 | Design system Luxtime aprobado (tokens, Tailwind, componentes, GSAP, Pinia) | Cimientos | D (aprobada), 0 | 4, 5 |
| 4 | API núcleo: catálogo, productos, marcas, garantía/cuidado, inventario | Núcleo | 1, 2 | 3 |
| 5 | Pipeline de imágenes (Python/FastAPI + Cloudinary) | Núcleo | 0, 4 | 3, 6 |
| 6 | Storefront público (home, catálogo TikTok, ficha, carruseles) | Tienda | 3, 4 | 5 |
| 7 | Carrito, precio mayorista, checkout de intención, WhatsApp, consentimiento | Tienda | 6, 4, 2 | 5 |
| 8 | Dominio Pedidos/Pre-Pedidos: máquina de estados, abono, recordatorios | Tienda | 7, 1 | 9 (backend) |
| 9 | Panel Admin: inventario, Excel, garantía/cuidado, envíos, WhatsApp config | Admin | 4, 3, 2 | 8 |
| 10 | Gestión de Pre-Pedidos/Pedidos + centro de notificaciones (Admin) | Admin | 8, 9 | — |
| 11 | Dashboards Super Admin (Ganancia, Salud del Negocio, exportes, parametrización) | Admin | 10, 8 | 12 |
| 12 | Portal "Mi Cuenta" (historial, checkout exprés, garantías digitales, wishlist) | Cliente | 2, 8, 6 | 11, 13 |
| 13 | Certificado de autenticidad digital (QR + página pública) | Cliente | 8, 5, 4 | 12, 14 |
| 14 | Marketing y engagement (reseñas, más vendidos, avisos, lista de espera, email, segmentación, GA) | Cliente | 4, 7, 8, 6 | 13 |
| 15 | Continuidad y cumplimiento (backups, log auditoría, política de datos, T&C) | Cierre | 2, 8 | 16 |
| 16 | Seguridad, hardening, rate limiting, Cloudflare, Sentry | Cierre | la mayoría | 15 |
| 17 | Despliegue productivo y CI/CD completo (Vercel + Cloud Run + Cloud SQL) | Cierre | 0, 5, 16 | — |
| 18 | QA, pruebas (Jest + Playwright), rendimiento, SEO y accesibilidad | Cierre | todas | — |

### Tracks para trabajo en paralelo (si hay más de un agente)

- **Track A — Datos/Backend:** 0 → 1 → 2 → 4 → 5 → 8 → 10 → 11.
- **Track B — Frontend/Diseño:** (tras 0) D → *aprobación cliente* → 3 → 6 → 7 → 12.
- **Convergencia:** 6 necesita 3+4; 7 necesita 6+4+2; 8 necesita 7+1; 10 necesita 8+9.
- **Fases transversales de cierre** (15, 16, 17, 18) se ejecutan al final, pero sus *hooks* (auditoría, validación, rate limiting) se instalan desde la Fase 2 y se usan en cada fase.
- **Cuello de botella clave:** el *gate* de la Fase D (elección de diseño por el cliente) bloquea 3, 6, 7 y todo el front visible. Mientras el cliente decide, avanzar Track A sin frenar.

---

# ETAPA I — CIMIENTOS

## FASE 0 — Fundaciones e infraestructura de desarrollo
**Objetivo:** dejar el monorepo, las tres apps y el tooling base funcionando en local para que cualquier fase posterior solo agregue features.

**Tareas (en orden):**
- [ ] Inicializar monorepo `pnpm` con `pnpm-workspace.yaml` (`apps/*`, `packages/*`).
- [ ] Scaffold `apps/web` con Nuxt 3 + TypeScript. Instalar y configurar Tailwind CSS, Pinia (`@pinia/nuxt`) y GSAP (plugin cliente `plugins/gsap.client.ts`).
- [ ] Scaffold `apps/api` con NestJS + TypeScript. Instalar Prisma, `class-validator`, `class-transformer`, `@nestjs/throttler`, `@nestjs/config`, `@nestjs/schedule`.
- [ ] Scaffold `apps/image-service` (FastAPI) con `requirements.txt` (`fastapi`, `uvicorn`, `rembg`, `pillow`, `python-multipart`) y `Dockerfile`.
- [ ] Crear `packages/shared` para tipos/enums/DTO compartidos; configurar alias TS en web y api.
- [ ] Configuración global de calidad: ESLint + Prettier + `tsconfig` base compartido; EditorConfig.
- [ ] Definir `.env.example` por app con TODAS las variables necesarias (sin valores reales): `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_OAUTH_*`, `CLOUDINARY_*`, `RESEND_API_KEY`, `WHATSAPP_*`, `SENTRY_DSN`, `GA4_*`, `IMAGE_SERVICE_URL`, `API_BASE_URL`.
- [ ] `docker-compose.yml` de desarrollo: PostgreSQL local + image-service, para no depender de la nube en local.
- [ ] Configurar Nest global: `ValidationPipe` (whitelist + transform), `AllExceptionsFilter`, prefijo `/api`, CORS al dominio del front, versionado `/v1`.
- [ ] Health checks: `GET /api/v1/health` (api) y `/health` (image-service).
- [ ] README raíz con comandos de arranque de cada app.

**Archivos/carpetas:** raíz del repo, `apps/web/*`, `apps/api/*`, `apps/image-service/*`, `packages/shared/*`, `docker/`, `pnpm-workspace.yaml`, `.env.example`.

**Criterios de aceptación:**
- `pnpm install` en la raíz instala las 3 apps.
- `pnpm --filter web dev`, `pnpm --filter api start:dev` y el image-service arrancan sin errores.
- `GET /api/v1/health` responde `200`.
- Lint y typecheck pasan en todo el monorepo.

**Dependencias:** ninguna.

---

## FASE 1 — Modelo de datos y esquema (Prisma / PostgreSQL)
**Objetivo:** modelar en Prisma TODAS las entidades del negocio y sus relaciones, ya que todo lo demás depende del esquema.

**Tareas (en orden):**
- [ ] Definir enums en `schema.prisma` y espejarlos en `packages/shared`:
  - `Role` = `SUPER_ADMIN | ADMIN | CUSTOMER`
  - `OrderStage` = `PRE_ORDER | ORDER`
  - `OrderStatus` = `PENDIENTE | PAGADO | ENVIADO | ENTREGADO | CANCELADO`
  - `OrderType` = `DETAL | MAYORISTA`
  - `MarketingContactStatus` = `PENDING_VALIDATION | VALIDATED | REJECTED`
  - `CustomerSegment` = `NUEVO | RECURRENTE | ALTO_VALOR`
  - `ReviewStatus` = `PENDING | PUBLISHED | REJECTED`
- [ ] Modelar entidades núcleo:
  - `User` (id, email, googleId?, name, phone?, role, segment?, createdAt) — staff y clientes.
  - `SavedShipping` (userId, address, phone) para checkout exprés (§3.8).
  - `Brand`.
  - `Watch` (marca, modelo, tipo de movimiento, specs JSON, `retailPrice`, `wholesalePrice`, `cost` [solo Super Admin], `profitPercent`, stock, `isActive`, `warrantyTemplateId?`, `careTemplateId?`, `frontImageUrl?`, `backImageUrl?`, slug, createdAt).
  - `WarrantyTemplate` (nombre, `durationMonths`, términos) y `CareTemplate` (nombre, instrucciones) — plantillas reutilizables (§3.2).
  - `ShippingZone` (nombre, `cost`, `isNational`).
- [ ] Modelar pedidos:
  - `Order` (id legible, `stage`, `status`, `type`, snapshot de cliente [nombre, dirección, email, phone], `userId?`, `shippingZoneId?`, `shippingCost`, `depositExpected`, `depositConfirmed`, `subtotal`, `total`, `whatsappMessage`, `assignedToId?`, timestamps por transición: `paidAt`, `shippedAt`, `deliveredAt`, `canceledAt`, createdAt).
  - `OrderItem` (orderId, watchId, snapshot [nombre/ref/imagen], `quantity`, `unitPrice`, `priceType`).
- [ ] Modelar módulos satélite:
  - `MarketingContact` (email, status, source, validatedById?).
  - `Review` (customerName, watchId?, rating, body, status).
  - `WaitlistEntry` (email, watchId, notified).
  - `WishlistItem` (userId, watchId).
  - `Certificate` (orderItemId, watchId, `slug` único, `qrPayload`, warranty snapshot, `issuedAt`).
  - `Notification` (type, payload JSON, targetRole, readAt?, createdAt).
  - `AuditLog` (userId, action, entity, entityId, `diff` JSON, createdAt).
  - `Setting` (key, value JSON) — enlace WhatsApp oficial, textos legales, `commissionPercent`, etc.
- [ ] Escribir migración inicial y `seed.ts`: 6 `ShippingZone` con valores exactos (Bucaramanga 10.000, Floridablanca 10.000, La Cumbre 12.000, Norte de Bucaramanga 14.000, Girón 14.000, Nacional 17.000), usuarios Super Admin (Álvaro) y Admin (Lidia), y `Setting` base.
- [ ] Generar Prisma Client y `PrismaModule/Service` en Nest.

**Archivos/carpetas:** `apps/api/prisma/schema.prisma`, `apps/api/prisma/seed.ts`, `apps/api/src/prisma/*`, `packages/shared` (enums/tipos).

**Criterios de aceptación:**
- `prisma migrate dev` corre sin errores y crea todas las tablas.
- `prisma db seed` inserta zonas, roles base y settings.
- El diagrama de relaciones cubre el 100% de entidades del §3 del Plan de Trabajo.
- Los enums de `schema.prisma` coinciden 1:1 con `packages/shared`.

**Dependencias:** Fase 0.

---

## FASE 2 — Autenticación, roles, sesión y auditoría base
**Objetivo:** habilitar login con Google (OAuth) + JWT, guards por rol, y el interceptor de auditoría que usarán todas las fases con mutaciones.

**Tareas (en orden):**
- [ ] `AuthModule` en Nest con Passport: `passport-google-oauth20` (`@nestjs/passport`) + estrategia JWT. Endpoints: `GET /auth/google`, `GET /auth/google/callback`, `POST /auth/refresh`, `GET /auth/me`, `POST /auth/logout`.
- [ ] Emisión de JWT (access + refresh); almacenamiento de sesión en cookie httpOnly segura para el front Nuxt (SSR-friendly).
- [ ] `@Roles()` decorator + `RolesGuard` + `JwtAuthGuard`. Regla dura: el rol **ADMIN no accede a datos financieros** (costos, precios de compra, márgenes, comisiones); estos solo `SUPER_ADMIN`.
- [ ] Alta manual de staff (Super Admin/Admin) vía seed/endpoint protegido; clientes se crean automáticamente al primer login Google.
- [ ] Interceptor global `AuditInterceptor` + `AuditModule`: registra en `AuditLog` toda mutación hecha por staff (quién, acción, entidad, diff). Exponer `@Audit()` para marcar handlers.
- [ ] Front: `stores/auth.ts` (Pinia), `composables/useAuth`, `middleware/auth.ts` (rutas privadas) y `middleware/role.ts` (rutas admin/super admin). Botón "Continuar con Google" reutilizable.
- [ ] Manejo de "comprar como invitado": el front nunca obliga a iniciar sesión para navegar o comprar.

**Archivos/carpetas:** `apps/api/src/auth/*`, `apps/api/src/users/*`, `apps/api/src/audit/*`, `apps/api/src/common/{guards,decorators,interceptors}/*`, `apps/web/stores/auth.ts`, `apps/web/composables/useAuth.ts`, `apps/web/middleware/*`, `apps/web/components/auth/*`.

**Criterios de aceptación:**
- Flujo Google OAuth completo: login crea/actualiza `User CUSTOMER` y devuelve sesión válida.
- Un `ADMIN` recibe `403` al pedir endpoints financieros; un `SUPER_ADMIN` accede.
- Rutas `/admin/*` y `/cuenta/*` protegidas por middleware; invitado navega y compra sin sesión.
- Cualquier mutación de prueba por staff genera un registro en `AuditLog`.

**Dependencias:** Fase 1. (Paralelizable con Fase D.)

---

## FASE D — Exploración de diseño (SOLO front, múltiples variantes) · GATE
**Objetivo:** producir **3 direcciones visuales navegables** de las pantallas clave, con datos mock y sin backend, para que Álvaro elija una antes de construir el front real.

> Esta fase es **aislada y desechable**: solo diseño (colores, tipografía, layout, componentes, animación). No conecta API, no maneja lógica de negocio, no persiste nada. Su único entregable es la decisión del cliente.

**Las 3 direcciones (todas dark-luxury base DIXUS, con dinámica tipo TikTok en el catálogo):**
- **A · "Onyx & Oro"** — fiel a DIXUS: negros `#0A0A0A/#111/#1A1A1A`, oro `#C8A96E`, display `Cormorant Garamond` + body `Montserrat`. La referencia segura.
- **B · "Editorial Blanco"** — lujo claro/alto contraste invertido: fondos marfil/blanco, tinta negra, oro como acento mínimo; tipografía editorial. Sensación "revista de alta relojería".
- **C · "Midnight Contrast"** — azul-negro profundo + acento metálico frío (plata/platino), más "tech-lux"; microinteracciones GSAP más marcadas.

**Tareas (en orden):**
- [ ] Crear ruta showcase `pages/design/[variant].vue` + `pages/design/index.vue` (selector de variantes) con datos mock en `apps/web/mocks/`.
- [ ] Por cada variante, maquetar las pantallas clave con GSAP y responsive real:
  - Home (hero + carruseles de enganche + más vendidos + banner mayoristas).
  - Catálogo **tipo TikTok** (scroll vertical inmersivo full-screen, snap, transiciones GSAP).
  - Ficha de producto (galería, specs, disponibilidad, garantía/cuidado, CTA WhatsApp).
  - Carrito + checkout (captura de datos + checkbox de consentimiento).
  - Portal "Mi Cuenta" (esqueleto).
  - Login/estructura del panel admin (esqueleto).
- [ ] Definir para cada variante su set de tokens (paleta, tipografías, spacing, radios, sombras) en un archivo aparte por variante, sin tocar el resto.
- [ ] Publicar el showcase en un preview de Vercel para revisión del cliente.
- [ ] **GATE:** registrar la variante elegida por Álvaro (y ajustes de color/logo/tipografía finales) en una nota que consumirá la Fase 3.

**Archivos/carpetas:** `apps/web/pages/design/*`, `apps/web/mocks/*`, `apps/web/assets/css/variants/{onyx,editorial,midnight}.css`, componentes de showcase aislados en `apps/web/components/design/*`.

**Criterios de aceptación:**
- Las 3 variantes se navegan de punta a punta en desktop y móvil, con la dinámica TikTok funcionando.
- Ninguna variante depende de la API ni rompe el arranque del proyecto.
- Álvaro elige **una** dirección y quedan fijados color, logo y tipografía definitivos de Luxtime.

**Dependencias:** Fase 0. Corre **en paralelo** con Fases 1 y 2. Bloquea (gate) las Fases 3, 6, 7.

---

## FASE 3 — Design system Luxtime aprobado
**Objetivo:** convertir la dirección elegida en un sistema de diseño productivo (tokens + Tailwind theme + librería de componentes + layouts) reutilizable por todo el front real.

**Tareas (en orden):**
- [ ] Portar la variante aprobada a `assets/css/tokens.css` (variables CSS canónicas) y mapearlas en `tailwind.config.ts` (colores, fuentes, spacing, sombras, breakpoints).
- [ ] Cargar tipografías definitivas y logo de Luxtime; configurar `@nuxt/fonts` o `<link>` optimizado.
- [ ] Construir `components/ui/` productivos: `LuxButton` (primary/ghost), `LuxBadge` (incl. "edición limitada" y etiquetas Mayorista/Detal), `LuxCard`, `LuxInput`, `LuxSelect`, `LuxCheckbox`, `LuxModal`, `LuxToast`, `WatchCard`, `SectionHeader`, `Marquee`.
- [ ] Construir `components/layout/`: `AppNav` (fija, se encoge en scroll), `AppFooter`, `WhatsappFloat`, `CookieConsent`.
- [ ] Configurar animaciones base con GSAP + ScrollTrigger (reveal on-scroll, `fadeUp`, levitación de tarjetas, marquee) como composable `useReveal`/directivas reutilizables.
- [ ] Definir layouts `default.vue`, `account.vue`, `admin.vue`.
- [ ] Documentar el sistema en una ruta interna `pages/ui-kit.vue` (galería de componentes) para QA visual.

**Archivos/carpetas:** `apps/web/assets/css/*`, `apps/web/tailwind.config.ts`, `apps/web/components/ui/*`, `apps/web/components/layout/*`, `apps/web/composables/useReveal.ts`, `apps/web/layouts/*`, `apps/web/pages/ui-kit.vue`.

**Criterios de aceptación:**
- El `ui-kit` renderiza todos los componentes con la identidad aprobada, responsive y accesibles (focus visible, contraste AA).
- Cualquier pantalla nueva puede construirse solo componiendo `components/ui` + `layout` sin CSS ad-hoc.
- Las animaciones GSAP corren a 60fps y respetan `prefers-reduced-motion`.

**Dependencias:** Fase D (aprobada) + Fase 0. Paralelizable con Fases 4 y 5.

---

# ETAPA II — NÚCLEO

## FASE 4 — API núcleo: catálogo, productos, marcas, garantía/cuidado, inventario
**Objetivo:** exponer las entidades núcleo por API (CRUD staff + lectura pública) sobre las que se construye toda la lógica de negocio.

**Tareas (en orden):**
- [ ] `BrandsModule`: CRUD de marcas (protegido) + listado público.
- [ ] `WarrantiesModule` y `CareModule`: CRUD de plantillas reutilizables (§3.2).
- [ ] `ProductsModule` (Watch): CRUD staff con DTOs validados; campos financieros (`cost`, `profitPercent`, márgenes) solo visibles/editables por `SUPER_ADMIN`. Asignación de plantilla de garantía y cuidado por reloj.
- [ ] `InventoryModule`: control de stock, activar/desactivar (soft), parametrización; hook que emite evento "nuevo reloj" (para avisos §3.1) y "vuelve a stock" (para lista de espera §3.1).
- [ ] `CatalogModule` (lectura pública): listado con filtros (marca, movimiento, disponibilidad, orden), detalle por `slug`, y endpoint de "novedades" por `createdAt`.
- [ ] Serialización por rol: el catálogo público y el rol ADMIN **nunca** reciben `cost`/márgenes (interceptor de exclusión).
- [ ] Contratos DTO en `packages/shared` para que el front consuma tipado.

**Archivos/carpetas:** `apps/api/src/{brands,warranties,care,products,inventory,catalog}/*`, `packages/shared/*`.

**Criterios de aceptación:**
- CRUD completo de marcas, plantillas, relojes e inventario con validación y auditoría.
- Endpoints públicos de catálogo/ficha responden sin exponer datos financieros.
- Cambiar stock a 0 y de vuelta a >0 dispara los eventos correspondientes (verificable en logs).

**Dependencias:** Fases 1 y 2. Paralelizable con Fase 3.

---

## FASE 5 — Pipeline de imágenes (microservicio Python + Cloudinary)
**Objetivo:** automatizar el flujo de foto frontal y trasera de cada reloj (fondo blanco → sin fondo → normalizada → Cloudinary).

**Tareas (en orden):**
- [ ] `image-service` (FastAPI): endpoint `POST /process` que recibe imagen, remueve fondo con `rembg`, normaliza/redimensiona con `Pillow` y devuelve el binario procesado (front y trasera). Endpoint `/health`.
- [ ] Dockerfile del microservicio y prueba local vía `docker-compose`.
- [ ] En Nest, `IntegrationsModule` (Cloudinary): recibe las 2 imágenes del admin → las envía al microservicio → sube el resultado a Cloudinary → guarda `frontImageUrl`/`backImageUrl` en el `Watch`.
- [ ] Manejo de errores/timeout del microservicio (retry + fallback a imagen sin procesar marcada para revisión).
- [ ] Endpoint de carga asociado al producto (`POST /products/:id/images`) protegido por rol staff.

**Archivos/carpetas:** `apps/image-service/app/main.py`, `apps/image-service/{requirements.txt,Dockerfile}`, `apps/api/src/integrations/cloudinary.*`, `apps/api/src/products/*` (endpoint imágenes), `docker/`.

**Criterios de aceptación:**
- Subir dos fotos sobre fondo blanco devuelve dos URLs de Cloudinary con fondo removido y tamaño normalizado.
- Un fallo del microservicio no rompe la carga: el reloj queda con imagen provisional marcada.
- Las credenciales de Cloudinary solo viven en el backend (nunca en el microservicio ni en el front).

**Dependencias:** Fases 0 y 4. Paralelizable con Fases 3 y 6.

---

# ETAPA III — TIENDA (STOREFRONT + COMPRA)

## FASE 6 — Storefront público (home, catálogo TikTok, ficha, carruseles)
**Objetivo:** construir la tienda pública real con la identidad aprobada, consumiendo el catálogo del API.

**Tareas (en orden):**
- [ ] `composables/useApi` (cliente HTTP con SSR y manejo de sesión) y consumo tipado desde `packages/shared`.
- [ ] Home (`pages/index.vue`): hero, **carruseles de enganche** con relojes destacados (GSAP), sección de más vendidos (placeholder de Top 3 hasta Fase 14), banner mayoristas ("¡Lleva 4 o más relojes y tu precio cambia a por mayor automáticamente!") visible para todos.
- [ ] Catálogo `pages/catalogo/index.vue` con **dinámica tipo TikTok** (scroll vertical inmersivo + snap + transiciones), filtros y disponibilidad.
- [ ] Ficha `pages/producto/[slug].vue`: galería front/trasera, specs técnicas (marca, modelo, movimiento), disponibilidad, módulo de garantía y de cuidado asignados, CTA a carrito/WhatsApp.
- [ ] SEO/SSR: meta tags dinámicos, Open Graph, `sitemap`, `robots`, datos estructurados de producto (schema.org).
- [ ] Estados vacíos y de carga con esqueletos; imágenes vía Cloudinary con `loading`/tamaños responsivos.

**Archivos/carpetas:** `apps/web/pages/{index,catalogo,producto}/*`, `apps/web/components/catalog/*`, `apps/web/composables/useApi.ts`, `apps/web/composables/useAnalytics.ts`.

**Criterios de aceptación:**
- Catálogo y ficha consumen datos reales del API con SSR (buen SEO).
- La navegación tipo TikTok funciona fluida en móvil y desktop.
- Lighthouse: Performance y SEO ≥ 90 en home, catálogo y ficha.

**Dependencias:** Fases 3 y 4. Paralelizable con Fase 5.

---

## FASE 7 — Carrito, precio mayorista, checkout de intención, WhatsApp, consentimiento
**Objetivo:** implementar el carrito con lógica de mayoreo automática y el checkout que genera la intención de compra vía WhatsApp, con consentimiento legal.

**Tareas (en orden):**
- [ ] `stores/cart.ts` (Pinia): agregar/quitar/editar cantidades, persistencia local, disponible para invitado y con sesión.
- [ ] **Regla mayorista:** si la suma total de unidades del pedido ≥ 4, aplicar automáticamente `wholesalePrice` a todos los ítems y etiquetar el pedido como **MAYORISTA** (si <4, `retailPrice`/DETAL). Cálculo en front y **revalidado en backend** al crear el pre-pedido.
- [ ] Checkout (`pages/checkout.vue`): captura nombre, dirección y correo; **autocompletado** si hay sesión con `SavedShipping` (§3.8). Selección de zona de envío y cálculo del costo (tarifas Fase 1); aclaración de pago total+envío para envíos nacionales.
- [ ] **Checkbox de consentimiento legal obligatorio** (T&C + política de datos, Ley 1581 de 2012) — bloquea el checkout si no se acepta. Igual en registro de cuenta.
- [ ] Al confirmar: crear registro en backend (Fase 8) y **redirigir a WhatsApp** con mensaje preconfigurado que adjunta nombre y dirección; guardar el correo como `MarketingContact` en estado `PENDING_VALIDATION`.
- [ ] Enlace WhatsApp tomado de `Setting` (configurable en admin, Fase 9).

**Archivos/carpetas:** `apps/web/stores/cart.ts`, `apps/web/pages/{carrito,checkout}.vue`, `apps/web/components/checkout/*`, `apps/api/src/pre-orders/*` (endpoint de creación), `apps/api/src/marketing/*` (captura de contacto).

**Criterios de aceptación:**
- Con 4+ unidades el precio cambia automáticamente a mayorista y el pedido queda etiquetado MAYORISTA (verificado también en servidor).
- El checkout no continúa sin aceptar el consentimiento.
- Al finalizar se crea el pre-pedido, se abre WhatsApp con nombre+dirección en el mensaje y el correo queda pendiente de validación.

**Dependencias:** Fases 6, 4 y 2. Paralelizable con Fase 5.

---

## FASE 8 — Dominio Pedidos/Pre-Pedidos: máquina de estados, abono, recordatorios
**Objetivo:** implementar el corazón transaccional del negocio (backend): pre-pedidos editables, confirmación manual del abono, máquina de estados y recordatorios automáticos.

**Tareas (en orden):**
- [ ] `PreOrdersModule`/`OrdersModule`: creación como **PRE_ORDER**; edición libre de cualquier campo (cantidad, modelo, dirección, etc.) mientras siga en pre-pedido, **sin descuadrar inventario**.
- [ ] Confirmación manual del **abono de 10.000 COP por reloj** (`depositExpected = 10.000 × unidades`): único filtro para pasar PRE_ORDER → ORDER (aplica a metropolitano y nacional).
- [ ] Anulación de pre-pedido (cliente no confirma o no continúa).
- [ ] **Máquina de estados** con transiciones válidas y efectos:
  - `PENDIENTE` (abono pagado, apartado confirmado, sin entrega).
  - `PAGADO` (abono + resto + envío; estado final de pago; **dispara conteo de garantía** §3.8 y generación de certificado §3.6).
  - `ENVIADO` (despachado, sin confirmación de recepción).
  - `ENTREGADO` (recepción confirmada).
  - `CANCELADO` (pagó abono, no continúa; **el abono sigue contando como ingreso real**).
  - Cada registro conserva etiqueta **MAYORISTA/DETAL** visible en todos los estados.
- [ ] Descuento/reserva de inventario en la transición correcta (definir en PAGADO/ENVIADO) evitando sobreventa.
- [ ] **Recordatorios automáticos cada 2h** para pre-pedidos sin gestionar: `@nestjs/schedule` + endpoint seguro disparado por **Google Cloud Scheduler** (por el scale-to-zero de Cloud Run). Emite `Notification` + notificación al celular vía WhatsApp API (Fase 10/16).
- [ ] Auditar toda transición de estado y edición (usa `AuditInterceptor`).

**Archivos/carpetas:** `apps/api/src/{pre-orders,orders}/*`, `apps/api/src/orders/state-machine.ts`, `apps/api/src/notifications/*` (emisión), `apps/api/src/common/schedule/*`.

**Criterios de aceptación:**
- Un pre-pedido se edita sin afectar stock; al confirmar el abono pasa a ORDER/PENDIENTE.
- Transiciones inválidas se rechazan; `PAGADO` marca `paidAt` e inicia garantía + certificado.
- `CANCELADO` mantiene el abono como ingreso contabilizado.
- Un pre-pedido sin gestionar >2h genera recordatorio y se repite cada 2h.

**Dependencias:** Fases 7 y 1. Paralelizable con la parte backend de la Fase 9.

---

# ETAPA IV — PANEL DE ADMINISTRACIÓN

## FASE 9 — Panel Admin: inventario, Excel, garantía/cuidado, envíos, WhatsApp config
**Objetivo:** construir el panel operativo del rol Admin (Lidia) para gestionar catálogo, inventario, plantillas, envíos y la conexión de WhatsApp.

**Tareas (en orden):**
- [ ] Shell del panel bajo `pages/admin/*` con layout `admin.vue`, navegación lateral (Sidebar) y guard de rol (`ADMIN`/`SUPER_ADMIN`).
- [ ] Gestión de inventario (UI): crear, editar, parametrizar y desactivar relojes; carga de imágenes frontal/trasera (consume Fase 5). **Sin campos financieros para ADMIN.**
- [ ] **Importación masiva vía Excel** (`exceljs`): plantilla descargable, carga de archivo, validación fila a fila, reporte de errores y sincronización con la BD.
- [ ] Gestión de **plantillas de garantía y cuidado** (crear/editar/asignar).
- [ ] Configuración de **tarifas de envío por zona** (editar valores; las 6 zonas seed de Fase 1).
- [ ] **Pestaña de conexión WhatsApp**: editar el enlace oficial de Luxtime (`Setting`) al que se redirigen intención de compra y soporte de garantía.
- [ ] Estados de carga, validaciones y toasts de éxito/error.

**Archivos/carpetas:** `apps/web/pages/admin/{inventario,importar,garantias,cuidados,envios,whatsapp}.vue`, `apps/web/components/admin/*`, `apps/web/layouts/admin.vue`, `apps/api/src/inventory/import.*` (parser Excel), `apps/api/src/{shipping,settings}/*`.

**Criterios de aceptación:**
- El Admin crea/edita/desactiva relojes y sube imágenes sin ver datos financieros.
- Una carga Excel válida sincroniza N relojes; una inválida muestra errores por fila y no corrompe la BD.
- Tarifas de envío y enlace WhatsApp se editan y persisten.

**Dependencias:** Fases 4, 3 y 2. Paralelizable con Fase 8.

---

## FASE 10 — Gestión de Pre-Pedidos/Pedidos + centro de notificaciones (Admin)
**Objetivo:** dar a la secretaria la interfaz para trabajar el flujo síncrono de ventas y recibir alertas en tiempo real.

**Tareas (en orden):**
- [ ] Pestaña **Pre-Pedidos** en el Sidebar con **contador de alertas en tiempo real** y edición de cualquier campo (consume Fase 8).
- [ ] Acción de **confirmar abono** (10.000 COP/reloj) → convierte a Pedido; acción de **anular** pre-pedido.
- [ ] Tablero de **Pedidos** con la máquina de estados (PENDIENTE→PAGADO→ENVIADO→ENTREGADO / CANCELADO) y etiqueta MAYORISTA/DETAL siempre visible.
- [ ] **Centro de notificaciones** en el panel: nuevas ventas, nuevos registros, inventario bajo, y recordatorios de pre-pedidos >2h (consume Fase 8).
- [ ] Notificación al celular vía **WhatsApp Business API** para eventos relevantes (integración en `IntegrationsModule`).
- [ ] Cada acción (editar, confirmar abono, cambiar estado) queda en el **log de auditoría**.

**Archivos/carpetas:** `apps/web/pages/admin/{pre-pedidos,pedidos,notificaciones}.vue`, `apps/web/components/admin/orders/*`, `apps/api/src/{orders,pre-orders,notifications}/*`, `apps/api/src/integrations/whatsapp.*`.

**Criterios de aceptación:**
- La secretaria edita, confirma abono, anula y avanza estados desde el panel, todo auditado.
- El contador de pre-pedidos se actualiza en tiempo real y las alertas de >2h aparecen.
- Los eventos relevantes generan notificación en panel y por WhatsApp al celular.

**Dependencias:** Fases 8 y 9.

---

## FASE 11 — Dashboards Super Admin (Ganancia, Salud del Negocio, exportes)
**Objetivo:** entregar a Álvaro los dashboards financieros y de desempeño, invisibles para el rol Admin.

**Tareas (en orden):**
- [ ] Guard estricto `SUPER_ADMIN` en todos los endpoints y rutas de esta fase.
- [ ] **Parametrización financiera**: configurar porcentajes de ganancia y comisión (`Setting`); el sistema calcula automáticamente precios, márgenes y comisiones a partir de ahí.
- [ ] **Dashboard de Ganancia**: ganancia con % exacto por reloj, desglose por día/semana/mes/total; cálculo automático de la **comisión de la secretaria** por reloj vendido.
- [ ] **Panel de Salud del Negocio**: comparativos automáticos (% aumento/disminución) de ventas, visualizaciones y métricas de Google Analytics (Data API), junto con pre-pedidos, ventas confirmadas e inventario. Lectura frente al periodo anterior.
- [ ] **Exportación de reportes** en PDF (`pdfkit`/Puppeteer) y Excel (`exceljs`) desde el Dashboard de Ganancia.
- [ ] Integración GA4 vía Data API en `IntegrationsModule` (server-side) alimentando el panel.
- [ ] (Fuera de alcance, dejar documentado como no incluido: **Dashboard de Proveedor**.)

**Archivos/carpetas:** `apps/web/pages/admin/dashboards/{ganancia,salud}.vue`, `apps/web/components/admin/dashboards/*`, `apps/api/src/dashboards/*`, `apps/api/src/integrations/{ga4,reports}.*`, `apps/api/src/settings/*`.

**Criterios de aceptación:**
- Solo `SUPER_ADMIN` accede; `ADMIN` recibe 403 y no ve rutas ni datos financieros.
- Cambiar el % de ganancia recalcula márgenes y comisiones automáticamente.
- Se exportan reportes válidos en PDF y Excel; el Panel de Salud muestra comparativos con datos de GA.

**Dependencias:** Fases 10 y 8. Paralelizable con Fase 12.

---

# ETAPA V — CLIENTE, CERTIFICADO Y MARKETING

## FASE 12 — Portal "Mi Cuenta"
**Objetivo:** entregar el portal del cliente registrado (opcional), que centraliza su información y reduce fricción en compras futuras.

**Tareas (en orden):**
- [ ] Layout `account.vue` y rutas `pages/cuenta/*` protegidas (`CUSTOMER`).
- [ ] **Historial de Pedidos**: compras anteriores con fechas, cantidades, totales y **recibo digital básico** por pedido.
- [ ] **Datos de Envío Guardados (Checkout Exprés)**: guardar dirección y teléfono predeterminados (`SavedShipping`) que autocompletan el checkout (Fase 7).
- [ ] **Módulo de Garantías Digitales**: listado de referencias adquiridas con **tiempo de garantía restante** calculado desde `paidAt` (estado PAGADO) según la plantilla de garantía del modelo; botón **"Soporte de Garantía"** que abre WhatsApp con mensaje preconstruido que incluye ID de pedido y modelo.
- [ ] **Wishlist**: relojes marcados con corazón desde el catálogo (requiere cuenta) se guardan y listan aquí.
- [ ] Endpoints backend: `WishlistModule`, garantías del cliente (deriva de `orders`), recibo por pedido.

**Archivos/carpetas:** `apps/web/pages/cuenta/{index,pedidos,garantias,deseos,datos}.vue`, `apps/web/components/account/*`, `apps/web/stores/wishlist.ts`, `apps/api/src/{wishlist,orders}/*`.

**Criterios de aceptación:**
- El cliente ve su historial con recibo por pedido y sus garantías con el tiempo restante correcto.
- El botón de soporte abre WhatsApp con ID de pedido + modelo prellenados.
- La wishlist persiste por usuario y el checkout exprés autocompleta datos guardados.

**Dependencias:** Fases 2, 8 y 6. Paralelizable con Fases 11 y 13.

---

## FASE 13 — Certificado de autenticidad digital (QR + página pública)
**Objetivo:** generar un QR único por reloj vendido al llegar a PAGADO y una página pública de certificado.

**Tareas (en orden):**
- [ ] Al transicionar un pedido a **PAGADO** (Fase 8), generar por cada unidad vendida un `Certificate` con `slug` único y QR (`qrcode`), y persistirlo.
- [ ] Página pública `pages/certificado/[slug].vue`: muestra info del cliente, foto del reloj (Cloudinary), fecha de venta y garantía otorgada (plantilla asignada).
- [ ] `CertificatesModule` en Nest: generación, almacenamiento del QR y endpoint público de lectura por `slug`.
- [ ] El QR codifica la URL pública del certificado; validar que sea inmutable y no exponga datos sensibles de más.

**Archivos/carpetas:** `apps/api/src/certificates/*`, `apps/web/pages/certificado/[slug].vue`, integración con Cloudinary (imagen) y garantías.

**Criterios de aceptación:**
- Un pedido que llega a PAGADO genera 1 certificado por unidad con QR único.
- Escanear el QR abre la página del certificado con cliente, foto, fecha y garantía correctas.
- La página es pública, cacheable e imposible de alterar por el cliente.

**Dependencias:** Fases 8, 5 y 4. Paralelizable con Fases 12 y 14.

---

## FASE 14 — Marketing y engagement
**Objetivo:** completar las funcionalidades de captación y fidelización que empujan la conversión y el éxito comercial.

**Tareas (en orden):**
- [ ] **Más vendidos (Top 3)**: cálculo automático sobre ventas confirmadas (pedidos en PAGADO/ENVIADO/ENTREGADO); reemplaza el placeholder de la home.
- [ ] **Reseñas de clientes**: envío público + moderación por Admin (`ReviewStatus`) + render en storefront (testimonios y calificaciones).
- [ ] **Notificaciones emergentes de catálogo**: aviso (toast) automático cuando ingresa un reloj nuevo al inventario (consume evento de Fase 4).
- [ ] **Lista de espera**: en relojes agotados, capturar correo y **notificar automáticamente** (Resend) cuando el modelo vuelve a stock (consume evento de Fase 4).
- [ ] **Módulo de correo (email marketing)** con Resend: envío de campañas; cada contacto capturado en checkout debe ser **validado manualmente por la secretaria** antes de registrarse (`MarketingContact`: PENDING→VALIDATED).
- [ ] **Segmentación automática de clientes**: analizar historial de compras y sugerir etiqueta (`NUEVO`/`RECURRENTE`/`ALTO_VALOR`), visible en el panel para priorizar.
- [ ] **Google Analytics vía API**: además del tracking estándar (plugin cliente), traer productos estrella, más vistos, duración de sesión y abandono de carrito al dashboard (ya cableado en Fase 11).

**Archivos/carpetas:** `apps/api/src/{reviews,waitlist,marketing,segmentation}/*`, `apps/web/components/{catalog,marketing}/*`, `apps/web/pages/admin/{correo,segmentos,reseñas}.vue`, `apps/web/plugins/analytics.client.ts`.

**Criterios de aceptación:**
- El Top 3 refleja ventas confirmadas reales; las reseñas moderadas se publican.
- Un reloj nuevo dispara toast; un reloj que vuelve a stock notifica por correo a la lista de espera.
- La secretaria valida correos antes de que entren a marketing; los clientes muestran su segmento sugerido.

**Dependencias:** Fases 4, 7, 8 y 6. Paralelizable con Fase 13.

---

# ETAPA VI — CONTINUIDAD, SEGURIDAD, DESPLIEGUE Y CALIDAD

## FASE 15 — Continuidad y cumplimiento (backups, auditoría, legal)
**Objetivo:** cerrar la trazabilidad, la protección de datos y el cumplimiento legal (Habeas Data).

**Tareas (en orden):**
- [ ] **Respaldo automático diario** de la BD (activar backups automáticos de Google Cloud SQL) y documentar el procedimiento de restauración.
- [ ] **Visor de log de auditoría** en el panel (Super Admin): quién hizo qué (edición de pre-pedido, cambio de estado, cambios de inventario), con filtros. Consume el `AuditLog` alimentado desde Fase 2.
- [ ] **Aviso de privacidad + checkbox de consentimiento** verificado en registro y checkout de invitado (Ley 1581 de 2012).
- [ ] Páginas legales `pages/legal/{terminos,privacidad}.vue` con el **texto base redactado por el desarrollador**; flujo para publicar solo tras aprobación 100% de Álvaro (feature flag / `Setting`).
- [ ] `CookieConsent` operativo y enlazado a las políticas.

**Archivos/carpetas:** `apps/web/pages/legal/*`, `apps/web/pages/admin/auditoria.vue`, `apps/api/src/audit/*`, configuración de Cloud SQL (infra), `apps/web/components/layout/CookieConsent.vue`.

**Criterios de aceptación:**
- Backup diario activo y restauración probada al menos una vez.
- El visor de auditoría muestra acciones reales de staff con trazabilidad Admin/Super Admin.
- No se capturan datos personales sin consentimiento; las políticas solo se publican tras aprobación.

**Dependencias:** Fases 2 y 8. Paralelizable con Fase 16.

---

## FASE 16 — Seguridad, hardening, rate limiting, Cloudflare, Sentry
**Objetivo:** blindar la plataforma antes de producción según la Sección 5 del Plan de Trabajo.

**Tareas (en orden):**
- [ ] **Rate limiting** con `@nestjs/throttler`, con límites estrictos en acciones ligadas a **WhatsApp** y creación de pre-pedidos.
- [ ] Sanitización y prevención **XSS** (validación de entrada, escape de salida) y protección contra manipulación de URLs / IDOR (autorización por recurso).
- [ ] Headers de seguridad (Helmet), CORS restringido, cookies httpOnly/SameSite, secretos solo por variables de entorno.
- [ ] **Cloudflare** delante del front y del API (WAF, protección de borde, DNS).
- [ ] **Sentry** (`@sentry/node` en API + SDK en Nuxt) para monitoreo de errores en producción; **Google Cloud Monitoring** para infraestructura.
- [ ] Hardening del backend en GCP y del microservicio serverless (mínimos privilegios, imágenes base actualizadas).
- [ ] Checklist de "revisión de seguridad integral antes de cada despliegue".

**Archivos/carpetas:** `apps/api/src/common/{filters,guards}/*`, `apps/api/src/main.ts` (Helmet/CORS/throttler), `apps/web/plugins/sentry.client.ts`, configuración Cloudflare (infra), `docs/security-checklist.md`.

**Criterios de aceptación:**
- Exceder el rate limit devuelve 429; endpoints sensibles protegidos.
- Sentry recibe errores de front y back; Cloudflare activo con WAF.
- Checklist de seguridad ejecutable y aprobado antes de deploy.

**Dependencias:** la mayoría de fases previas. Paralelizable con Fase 15.

---

## FASE 17 — Despliegue productivo y CI/CD completo
**Objetivo:** dejar el pipeline y la infraestructura productiva operando (Vercel + Cloud Run + Cloud SQL + microservicio).

**Tareas (en orden):**
- [ ] **Front → Vercel**: despliegue automático en cada push (integración nativa GitHub↔Vercel); variables de entorno de producción.
- [ ] **API → Cloud Run**: `deploy-api.yml` (GitHub Actions) que construye imagen Docker y despliega a Cloud Run en cada push a `main`.
- [ ] **image-service → Cloud Run**: pipeline análogo.
- [ ] **BD → Cloud SQL (PostgreSQL)**: instancia productiva, `prisma migrate deploy` en el pipeline, conexión segura desde Cloud Run.
- [ ] **Google Cloud Scheduler**: jobs para recordatorios de pre-pedidos (cada 2h) y verificación de respaldos, pegando a endpoints seguros del API.
- [ ] Dominio en **Cloudflare** apuntando a Vercel/Cloud Run; certificados TLS.
- [ ] `ci.yml`: lint + typecheck + tests en cada PR.

**Archivos/carpetas:** `.github/workflows/{ci,deploy-api,deploy-image}.yml`, `apps/api/Dockerfile`, `apps/image-service/Dockerfile`, configuración de Vercel/GCP/Cloudflare (infra), `docker/`.

**Criterios de aceptación:**
- Un push a `main` despliega front, API y microservicio automáticamente y sin downtime perceptible.
- Migraciones corren en el deploy; los crons de Cloud Scheduler ejecutan correctamente.
- El sitio responde en el dominio productivo con TLS y detrás de Cloudflare.

**Dependencias:** Fases 0, 5 y 16.

---

## FASE 18 — QA, pruebas, rendimiento, SEO y accesibilidad (pulido final)
**Objetivo:** garantizar que la plataforma soporta el pico decembrino y la calidad de un producto "de éxito en internet".

**Tareas (en orden):**
- [ ] **Jest**: pruebas unitarias/integración del backend, con foco en máquina de estados, regla mayorista, cálculo de garantías, comisiones y roles/permisos.
- [ ] **Playwright** (e2e): flujos críticos — compra invitado→WhatsApp, pre-pedido→abono→PAGADO, login Google, panel admin, certificado QR, checkout exprés.
- [ ] Pruebas de **seguridad y autenticación** (Playwright) y verificación de que ADMIN no accede a finanzas.
- [ ] **Rendimiento**: optimización de Core Web Vitals, imágenes Cloudinary responsivas, SSR/caché; prueba de carga básica pensando en el +500% de diciembre y hasta 1.000 relojes/mes.
- [ ] **SEO**: metadatos, sitemap, datos estructurados, OG en catálogo y fichas.
- [ ] **Accesibilidad** WCAG AA: contraste, foco, navegación por teclado, `prefers-reduced-motion`, textos alternativos.
- [ ] Revisión responsive integral y pase de QA visual contra el design system aprobado.

**Archivos/carpetas:** `apps/api/**/*.spec.ts`, `apps/web/tests/e2e/*`, `playwright.config.ts`, ajustes en `nuxt.config.ts` (SEO/perf), reportes de Lighthouse.

**Criterios de aceptación:**
- Suite Jest y Playwright verdes en CI; flujos críticos cubiertos.
- Lighthouse: Performance, SEO, Best Practices y Accessibility ≥ 90 en páginas clave.
- Prueba de carga sin degradación funcional en escenario de pico simulado.

**Dependencias:** todas las fases anteriores.

---

# Supuestos y decisiones tomadas

Decisiones que tomé para cerrar ambigüedades de los documentos, para que Álvaro las revise sin frenar el plan:

1. **Monorepo pnpm.** Los documentos no especifican la topología del repo. Decidí un monorepo con `apps/web`, `apps/api`, `apps/image-service` y `packages/shared` (contratos compartidos). Alternativa: repos separados; recomiendo el monorepo por velocidad de build y contratos tipados.
2. **Panel admin dentro del mismo front Nuxt** (rutas `/admin` protegidas por rol) en lugar de una app separada, para un solo deploy en Vercel y máxima reutilización del design system. Reevaluable si se quiere aislar por seguridad.
3. **Dinero como entero en COP** (sin decimales), acorde a la moneda local. Evita errores de redondeo en ganancias y comisiones.
4. **`Order` unificado con `stage` (PRE_ORDER/ORDER) + `status`** en vez de dos tablas separadas; simplifica la conversión pre-pedido→pedido sin perder trazabilidad ni la etiqueta MAYORISTA/DETAL.
5. **Abono = 10.000 COP × número de unidades** del pedido (interpretación de "10.000 COP por reloj"). Si el negocio cobra un abono plano por pedido, es un cambio de una línea.
6. **Certificado por unidad vendida** (si un ítem tiene cantidad 3, se generan 3 certificados con QR únicos), por "cada reloj vendido genera un código QR único".
7. **Crons reales con Google Cloud Scheduler** además de `@nestjs/schedule`: como Cloud Run escala a cero, un cron in-process no dispararía sin tráfico. Cloud Scheduler pega a un endpoint seguro para los recordatorios de 2h y verificación de respaldos. `@nestjs/schedule` no está listado en el stack pero es complementario y estándar.
8. **Reparto de responsabilidades del pipeline de imágenes:** el microservicio Python remueve fondo y normaliza y **devuelve el binario**; NestJS es quien sube a Cloudinary. Así las credenciales de Cloudinary viven solo en el backend.
9. **Notificaciones "al celular" vía WhatsApp Business API** (a los números de staff), dado que la API oficial ya está en el stack; no se integra un proveedor de push nativo salvo que se pida.
10. **Reseñas moderadas antes de publicarse** (estado `PENDING`→`PUBLISHED`), ya que el documento no define quién puede reseñar; se permite envío público con aprobación del Admin.
11. **Notificaciones emergentes de catálogo** implementadas como toast basado en "novedades por `createdAt`" (con marca de última visita), evitando WebSockets salvo que se requiera tiempo real estricto.
12. **Reserva/descuento de inventario en la transición a PAGADO/ENVIADO** (no en pre-pedido), coherente con que el pre-pedido es editable "sin generar descuadres de inventario".
13. **Segmento del cliente como sugerencia automática** almacenada/derivada, mostrada al staff; no dispara acciones automáticas por sí sola.
14. **Textos legales (T&C y política de datos):** se maquetan y quedan tras un flag de publicación; **no se publican hasta la aprobación 100% de Álvaro** (Sección 7.1 del contrato).
15. **Fase D produce 3 direcciones** (Onyx & Oro / Editorial Blanco / Midnight Contrast). Si prefieres otro número o direcciones concretas, se ajusta el alcance de esa única fase sin afectar las demás.
16. **Dashboard de Proveedor: explícitamente fuera de alcance** (Nota §3.3). Se documenta como no incluido.

---

# Riesgos técnicos a vigilar durante la construcción

1. **Scale-to-zero de Cloud Run vs. tareas programadas.** Los recordatorios de 2h y respaldos NO deben depender de un proceso in-memory; usar Cloud Scheduler (Fase 8/17). Riesgo alto si se ignora: pre-pedidos sin recordatorio.
2. **Arranque en frío (cold start)** del API y del microservicio Python en el pico decembrino (+500%). Vigilar `min-instances`, tamaño de imagen Docker y latencia del pipeline de imágenes.
3. **WhatsApp Business Platform (Cloud API oficial):** plantillas de mensajes deben ser pre-aprobadas por Meta, hay límites de tasa y ventana de 24h. La redirección de "intención de compra" (link `wa.me`) es distinta del envío programático de notificaciones a staff; no confundir ambos usos.
4. **Consistencia de inventario** ante edición de pre-pedidos, mayoreo automático y concurrencia; usar transacciones Prisma para evitar sobreventa en el pico.
5. **Regla mayorista revalidada en servidor:** nunca confiar solo en el precio calculado en el front; recalcular al crear el pre-pedido para evitar manipulación de precios.
6. **Fuga de datos financieros al rol Admin.** El filtrado de `cost`/márgenes/comisiones debe estar en el serializador del backend, no solo ocultarse en el front.
7. **rembg en serverless:** modelos pesados y tiempo de procesamiento; verificar límites de memoria/tiempo de Cloud Run y tener fallback (imagen provisional) para no bloquear la carga de inventario.
8. **Google Analytics Data API:** cuotas, latencia y desfase de datos; el Panel de Salud debe cachear y tolerar datos parciales del periodo actual.
9. **Costos en la cuenta del cliente:** todos los servicios (Cloud Run, Cloud SQL, Cloudinary, Resend, WhatsApp) se cargan a Álvaro; vigilar que la configuración por defecto no dispare gastos (p. ej. `min-instances` altos, resoluciones de imagen excesivas).
10. **SEO con SSR + contenido dinámico:** asegurar que catálogo y fichas se renderizan del lado servidor y que la "dinámica TikTok" no rompe el indexado ni el rendimiento móvil.
11. **Habeas Data (Ley 1581 de 2012):** capturar correo/dirección sin consentimiento explícito es un riesgo legal; el checkbox debe bloquear efectivamente el flujo y quedar auditado.
12. **Cumplimiento del cronograma (25–40 días):** el *gate* de diseño (Fase D) es el mayor riesgo de bloqueo; mantener el Track A (backend/datos) avanzando en paralelo mientras el cliente decide.
13. **Certificados y QR inmutables:** el QR es una prueba de autenticidad frente al cliente; su URL/estado no debe poder alterarse tras emitirse en PAGADO.
14. **Migraciones en producción:** `prisma migrate deploy` en el pipeline debe ser seguro (sin pérdidas) con datos reales del pico decembrino.

---

*Fin del plan. Este documento es el puente único entre planeación y ejecución: entregar a Composer una fase a la vez, respetando dependencias y el gate de diseño.*
