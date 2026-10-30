# Luxtime

Plataforma e-commerce de relojes de lujo — monorepo pnpm.

## Estructura

- `apps/web` — Nuxt 3 (storefront + admin)
- `apps/api` — NestJS + Prisma + PostgreSQL
- `apps/image-service` — FastAPI (rembg + Pillow)
- `packages/shared` — tipos y enums compartidos

## Requisitos

- Node.js 20+
- pnpm 9+
- Docker (PostgreSQL + image-service)

## Arranque en local

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
docker compose up -d
pnpm --filter @luxtime/api exec prisma migrate dev
pnpm db:seed
pnpm dev:api   # :3001
pnpm dev:web   # :3000
```

## Rutas útiles

| URL | Descripción |
|-----|-------------|
| http://localhost:3000/ | Home |
| http://localhost:3000/catalogo | Catálogo |
| http://localhost:3000/ingresar | Acceso admin |
| http://localhost:3000/admin | Panel staff |
| http://localhost:3001/api/v1/health | API health |

## Tests

```bash
pnpm --filter @luxtime/api test
pnpm --filter @luxtime/web test:e2e   # requiere dev:web activo
```

## Despliegue

Ver `.github/workflows/`. No se despliega automáticamente sin credenciales GCP/Vercel.

## Rendimiento del storefront

La tienda (`apps/web`) está en Vercel, detrás de Cloudflare. La API (`apps/api`) está en Cloud Run, región `southamerica-east1` (São Paulo).

### Antes

`routeRules` tenía `swr: false` en `/` y `/catalogo`. Cada visita, incluida la primera desde Google, generaba el HTML en el servidor y esperaba a la API. Con la función de Vercel en `iad1` (Virginia) y Cloud Run a escala cero, ese camino sumaba el salto de región y un arranque en frío de unos 2s. El TTFB observado era ~3,3s.

El home pedía la configuración con `cache: 'no-store'` y un query `_: Date.now()` en cada hidratación, así que ni el navegador ni la caché del API podían responder. El bloque de relojes del home pedía el catálogo solo en el cliente (`server: false`): esas fichas no iban en el HTML.

### Ahora

| Qué | Caché | Frescura de stock y precio |
| --- | --- | --- |
| `/`, `/catalogo`, `/producto/**` | SWR 60s (ISR en Vercel) | El HTML cacheado incluye el SSR. Al hidratar, el cliente vuelve a pedir el dato y pinta el stock y el precio actuales. |
| Páginas estáticas (`/sorteos`, `/relojeria-bucaramanga`, `/vigilancia`) | SWR 1h | No muestran stock ni precio. |
| Legal | SWR 24h | No muestran stock ni precio. |
| `/_nuxt/**` | 1 año, `immutable` | Assets con hash. |
| `/images/**`, favicon, iconos, `/uploads/**` | 30 días | En Cloud Run, `/uploads` usa `maxAge: 30d`. En producción las fotos van por Cloudinary. |
| Configuración del home | TTL de cliente 10 min, sin `no-store` ni query de cache-bust | No es stock ni precio. |
| Carrito, checkout, mayoristas, admin, certificados | Sin SWR | Sesión, envío o datos del cliente. |

En el navegador, home, catálogo y ficha no esperan al API: entra el shell y la grilla usa un esqueleto hasta que llegan los datos. En el servidor la misma petición sí espera, para que el HTML guardado por SWR lleve títulos, precios y fichas. El carrusel de relacionados de la ficha es solo cliente, para no sumar otro listado al TTFB.

Las funciones de Vercel quedan en `gru1` (`nitro.vercel.regions` y `apps/web/vercel.json`), al lado de `southamerica-east1`.

### Cloud Run

`.github/workflows/deploy-api.yml` despliega con `--min-instances 0`. La primera petición tras un silencio paga el arranque en frío aunque el HTML de Vercel esté caliente: el refetch de stock y un miss de SWR siguen yendo a la API.

Recomendación para producción:

```bash
gcloud run services update luxtime-api \
  --region southamerica-east1 \
  --min-instances 1
```

Una instancia mínima evita el arranque en frío. Tiene costo fijo. La API ya está en `southamerica-east1` y el SSR apunta a `gru1`.

### Cloudflare

La caché por defecto de Cloudflare no guarda HTML. El SWR lo resuelve Vercel: dentro de los 60s no vuelve a ejecutar el SSR. Si el HTML debe salir desde el edge de Cloudflare, una cache rule para `/`, `/catalogo` y `/producto/*` puede respetar el `Cache-Control` de origen y excluir `/api`, `/admin`, `/carrito`, `/checkout` y `/mayoristas`.

## Mocks

`USE_MOCKS=true` en API: OAuth mock, Cloudinary, Resend, WhatsApp, GA4 y el correo al cliente.

## Correo al cliente

Los cambios de pre-pedido y pedido (creado, abono confirmado, suspendido, cancelado, enviado) intentan un correo. Hace falta `EMAIL_FROM` y, en este orden, `SMTP_HOST` (más `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`) o `RESEND_API_KEY`. Si no hay proveedor, o `USE_MOCKS=true`, no se envía nada. El admin también ve un enlace de WhatsApp con el mensaje ya escrito.
