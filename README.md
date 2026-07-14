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
- Python 3.11+ (opcional si usas Docker para image-service)

## Arranque en local

```bash
# 1. Instalar dependencias
pnpm install

# 2. Variables de entorno
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 3. Infraestructura
docker compose up -d

# 4. Base de datos
pnpm --filter @luxtime/api prisma:generate
pnpm --filter @luxtime/api exec prisma migrate dev --name init
pnpm db:seed

# 5. Desarrollo
pnpm dev:api   # http://localhost:3001/api/v1/health
pnpm dev:web   # http://localhost:3000
```

## Rutas útiles

- API health: `GET /api/v1/health`
- Showcase diseño: `http://localhost:3000/design`
- UI Kit: `http://localhost:3000/ui-kit`

## Mocks de desarrollo

Con `USE_MOCKS=true` en `apps/api/.env`:

- Login demo: `POST /api/v1/auth/mock-login`
- Cloudinary e image-service devuelven URLs mock sin credenciales reales
