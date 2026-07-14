# Progreso Luxtime — Lote 1 (Fases 0–5)

## Resumen del lote

Monorepo **Luxtime** inicializado con `apps/web` (Nuxt 3), `apps/api` (NestJS), `apps/image-service` (FastAPI) y `packages/shared`.

- **API:** compila (`pnpm --filter @luxtime/api build`)
- **Web:** compila (`pnpm --filter @luxtime/web build`)
- **Showcase diseño:** `http://localhost:3000/design` (variantes `onyx`, `editorial`, `midnight`)
- **UI Kit:** `http://localhost:3000/ui-kit`
- **Variante activa por defecto:** Onyx & Oro (fiel a DIXUS)

## Estado por fase

| Fase | Estado | Notas |
|------|--------|-------|
| 0 | COMPLETADA | Monorepo, tooling, docker-compose, health checks, README |
| 1 | COMPLETADA* | Schema Prisma completo + seed. *Migración pendiente: Docker Desktop no estaba activo en esta máquina |
| 2 | COMPLETADA | JWT + Google OAuth + mock-login + guards + auditoría + front auth |
| D | COMPLETADA | 3 variantes navegables en `/design/[variant]` |
| 3 | COMPLETADA | Tokens, Tailwind, componentes UI base, layouts, GSAP plugin, ui-kit |
| 4 | COMPLETADA | Brands, warranties, care, products, inventory, catalog + strip financiero |
| 5 | COMPLETADA | FastAPI `/process` + integración Nest/Cloudinary con fallback y `USE_MOCKS` |

## Credenciales reales pendientes (producción)

- `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`
- `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`
- `RESEND_API_KEY`
- `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_ACCESS_TOKEN`
- `SENTRY_DSN`
- `GA4_PROPERTY_ID` / `GA4_CLIENT_EMAIL` / `GA4_PRIVATE_KEY`
- PostgreSQL productivo (Cloud SQL) + `DATABASE_URL`

## Pasos manuales para terminar setup local

1. Iniciar **Docker Desktop**
2. `docker compose up -d`
3. `pnpm --filter @luxtime/api exec prisma migrate dev --name init`
4. `pnpm db:seed`
5. `pnpm dev:api` y `pnpm dev:web`

## Decisiones tomadas en este lote

- `USE_MOCKS=true` por defecto para desarrollo sin credenciales externas
- Variante **Onyx & Oro** adoptada como tema productivo hasta elección del cliente
- Docker no disponible durante la sesión: migraciones documentadas para ejecución manual

## Siguiente lote

**Lote 2 — Fases 6 a 11** (storefront real, carrito, pre-pedidos, panel admin, dashboards)
