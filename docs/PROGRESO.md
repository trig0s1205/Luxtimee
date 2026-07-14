# Progreso Luxtime — Lote 2 (Fases 6–11)

## Resumen del lote

**Variante confirmada:** Onyx & Oro (sin cambios de diseño).

Storefront real, carrito/checkout, dominio transaccional (pre-pedidos/pedidos), panel admin operativo y dashboards Super Admin.

- **API:** compila (`pnpm --filter @luxtime/api build`)
- **Web:** compila (`pnpm --filter @luxtime/web build`)
- **Tests API:** máquina de estados + regla mayorista (`pnpm --filter @luxtime/api test`)

## Estado por fase

| Fase | Estado | Notas |
|------|--------|-------|
| 6 | COMPLETADA | `useApi`, home con novedades API, catálogo TikTok, ficha `/producto/[slug]`, SEO + sitemap/robots |
| 7 | COMPLETADA | `stores/cart.ts`, `/carrito`, `/checkout`, mayorista front+back, WhatsApp redirect, marketing contact |
| 8 | COMPLETADA | `PreOrdersModule`, `OrdersModule`, máquina estados, abono 10k/unidad, recordatorios cada 2h |
| 9 | COMPLETADA | Panel admin: inventario, import Excel, garantías/cuidados, envíos, WhatsApp config |
| 10 | COMPLETADA | Pre-pedidos, pedidos, centro notificaciones, alertas mock WhatsApp |
| 11 | COMPLETADA | Dashboards ganancia/salud (solo SUPER_ADMIN), export PDF/Excel, GA4 mock |

## Rutas útiles

| URL | Descripción |
|-----|-------------|
| http://localhost:3000/ | Home |
| http://localhost:3000/catalogo | Catálogo TikTok |
| http://localhost:3000/carrito | Carrito |
| http://localhost:3000/checkout | Checkout → WhatsApp |
| http://localhost:3000/admin/inventario | Panel Admin |
| http://localhost:3000/admin/dashboards/ganancia | Dashboard financiero (Super Admin) |

## Flujos probados (local)

1. **Invitado → catálogo → carrito → checkout → WhatsApp** (con fallback mocks si API/BD no disponible en front).
2. **Pre-pedido → confirmar abono → pedido PENDIENTE → transiciones de estado** (API).
3. **ADMIN** sin acceso a dashboards financieros; **SUPER_ADMIN** con acceso.

## Credenciales pendientes (producción)

- `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_ACCESS_TOKEN` (notificaciones reales)
- `GA4_PROPERTY_ID` / `GA4_CLIENT_EMAIL` / `GA4_PRIVATE_KEY`
- PostgreSQL productivo + migración `lastReminderAt` opcional futura

## Pasos manuales locales

1. Docker Desktop activo → `docker compose up -d`
2. `pnpm --filter @luxtime/api exec prisma migrate dev`
3. `pnpm db:seed`
4. `pnpm dev:api` + `pnpm dev:web`
5. Login staff: mock-login con `lidia@luxtime.co` (Admin) o `alvaro@luxtime.co` (Super Admin)

## Siguiente lote

**Lote 3 — Fases 12 a 18** (Mi Cuenta, certificado QR, marketing, legal, deploy, QA)

---

# Histórico — Lote 1 (Fases 0–5)

Ver commits anteriores. Variante Onyx & Oro adoptada desde Fase D.
