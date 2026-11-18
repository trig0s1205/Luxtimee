# Despliegue portable de la API (VPS o Render)

La API ya no depende de Google Cloud Run. El repo queda listo para **dos** opciones;
elige una cuando toque migrar. **No se despliega nada desde este documento.**

## Documentos del lanzamiento VPS (sábado)

| Documento | Contenido |
|-----------|-----------|
| [`deploy/vps/CHECKLIST-PREVIA.md`](../deploy/vps/CHECKLIST-PREVIA.md) | Checklist del viernes |
| [`deploy/vps/RUNBOOK-SABADO.md`](../deploy/vps/RUNBOOK-SABADO.md) | Paso a paso el día del pago Vultr |
| [`deploy/vps/README.md`](../deploy/vps/README.md) | Scripts, variables, alternativa manual |

**Importante:** mergear un PR a `main` **no** migra producción. Las migraciones se aplican a mano con `bash ./migrate.sh deploy` en el VPS (tras backup).

## Resumen de opciones

| Opción | Archivos | Cuándo |
|--------|----------|--------|
| **A — VPS + Docker + Caddy** | `deploy/vps/` (compose, Caddy, scripts, runbook), imagen `ghcr.io/trig0s1205/luxtimee-api` vía `.github/workflows/api-image.yml` | Control, HTTPS propio, API siempre encendida |
| **B — Render (plan B, arranque en frío, 512 MB)** | `render.yaml`, `deploy/render/README.md` | Sin servidor; aceptas cold starts |

Compartido:

- `apps/api/Dockerfile` — imagen de producción (VPS y Render)
- `apps/api/.env.example` — plantilla de variables
- `deploy/vps/.env.production.example` — plantilla del VPS (incluye `API_DOMAIN`, `API_IMAGE`, …)
- `.github/workflows/db-backup.yml` + `docs/backups.md` — backup semanal de Supabase

Cloud Run queda en `.github/workflows/deploy-api.yml` solo con `workflow_dispatch` (obsoleto).

---

## Variables de entorno de la API

Lista completa (ver comentarios en `apps/api/.env.example` y `deploy/vps/.env.production.example`):

- `NODE_ENV`, `USE_MOCKS`, `PORT`, `HOST`
- `FRONTEND_URL`, `STAFF_LOGIN_SLUG`
- `DATABASE_URL`, `DIRECT_URL`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`
- `COOKIE_SAME_SITE`, `CLIENT_IP_SECRET`, `CRON_SECRET`
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_CALLBACK_URL`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`
- `IMAGE_SERVICE_URL`, `IMAGE_SERVICE_API_KEY`, `REMBG_MODEL` (vacíos el sábado; no se despliega rembg)
- `SEED_ADMIN_PASSWORD` (solo seeds locales; **no** en producción)
- `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `RESEND_API_KEY`
- `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`
- `SENTRY_DSN`
- `GA4_PROPERTY_ID`, `GA4_CLIENT_EMAIL`, `GA4_PRIVATE_KEY`
- `NODE_OPTIONS` (prod VPS: `--max-old-space-size=1024`)

Migraciones: **no** corren al arrancar el contenedor. Usa `prisma migrate deploy` a mano (ver `migrate.sh` / README de VPS).

---

## Variables de Vercel (web)

| Variable | Notas |
|----------|--------|
| `NUXT_API_UPSTREAM_URL` | Origen de la API **sin** `/api/v1` (ej. `https://api.luxtimee.com`) |
| `NUXT_API_INTERNAL_URL` | Si existe: **con** `/api/v1` |
| `NUXT_PUBLIC_API_UPLOAD_URL` | Si existe: **con** `/api/v1` (subidas directas del navegador) |
| `NUXT_PUBLIC_API_ASSETS_URL` | Si aplica |
| `NUXT_CLIENT_IP_SECRET` | Debe coincidir con `CLIENT_IP_SECRET` de la API; **no** cambiar al mover la API |
| `NUXT_PUBLIC_STAFF_LOGIN_SLUG` | Debe coincidir con `STAFF_LOGIN_SLUG`; **no** cambiar |

Se leen en `apps/web/nuxt.config.ts` (`runtimeConfig`) y el proxy Nitro (`server/routes/api/v1/[...path].ts`).
Un cambio de variables solo aplica tras **Redeploy**.

---

## CORS

En `apps/api/src/main.ts`:

- En producción, `FRONTEND_URL` (lista separada por comas) define los orígenes permitidos.
- Se añaden automáticamente variantes `www.` / sin `www.` del mismo host.
- Incluye el dominio real de la tienda (ej. `https://www.luxtimee.com`).

---

## Pruebas después del despliegue

Automatizadas: `bash ./smoke-test.sh` y `bash ./smoke-test-web.sh` (ver runbook).

Manual:

1. Login admin: `/acceso/dev-portal-lx9k2`
2. Catálogo `/catalogo`
3. Subir imagen de reloj (Cloudinary)
4. Venta POS si el PR #31 está en la imagen y migrado
5. Logs: `docker compose logs --tail=100 api`

Backup: Actions → **Weekly DB backup** → Run workflow y verifica Drive.
