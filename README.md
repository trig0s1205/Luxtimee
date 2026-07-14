# Luxtime

Plataforma e-commerce de relojes de lujo — monorepo pnpm.

## Estructura

- `apps/web` — Nuxt 3 (storefront + admin + cuenta)
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
| http://localhost:3000/catalogo | Catálogo TikTok |
| http://localhost:3000/cuenta | Mi cuenta |
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

`USE_MOCKS=true` en API: OAuth mock, Cloudinary, Resend, WhatsApp, GA4.
