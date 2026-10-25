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

Ver `docs/PROGRESO.md` y `.github/workflows/`. No se despliega automáticamente sin credenciales GCP/Vercel.

## Mocks

`USE_MOCKS=true` en API: OAuth mock, Cloudinary, Resend, WhatsApp, GA4 y el correo al cliente.

## Correo al cliente

Los cambios de pre-pedido y pedido (creado, abono confirmado, suspendido, cancelado, enviado) intentan un correo. Hace falta `EMAIL_FROM` y, en este orden, `SMTP_HOST` (más `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`) o `RESEND_API_KEY`. Si no hay proveedor, o `USE_MOCKS=true`, no se envía nada. El admin también ve un enlace de WhatsApp con el mensaje ya escrito.
