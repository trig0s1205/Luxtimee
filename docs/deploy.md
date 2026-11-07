# Despliegue portable de la API (VPS o Render)

La API ya no depende de Google Cloud Run. El repo queda listo para **dos** opciones;
elige una cuando toque migrar. **No se despliega nada desde este documento.**

## Resumen de opciones

| Opción | Archivos | Cuándo |
|--------|----------|--------|
| **A — VPS + Docker + Caddy** | `deploy/vps/` (`docker-compose.yml`, `Caddyfile`, `README.md`), imagen `ghcr.io/trig0s1205/luxtimee-api` vía `.github/workflows/api-image.yml` | Quieres control, HTTPS propio y no apagar la API |
| **B — Render (free)** | `render.yaml`, `deploy/render/README.md` | Quieres cero servidor; aceptas cold starts y 512 MB |

Compartido:

- `apps/api/Dockerfile` — imagen de producción (VPS y Render)
- `apps/api/.env.example` — plantilla de variables
- `.github/workflows/db-backup.yml` + `docs/backups.md` — backup semanal de Supabase

Cloud Run queda en `.github/workflows/deploy-api.yml` solo con `workflow_dispatch` (obsoleto).

---

## Variables de entorno de la API

Lista completa (ver comentarios en `apps/api/.env.example`):

- `NODE_ENV`, `USE_MOCKS`, `PORT`, `HOST`
- `FRONTEND_URL`, `STAFF_LOGIN_SLUG`
- `DATABASE_URL`, `DIRECT_URL`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES`, `JWT_REFRESH_EXPIRES`
- `COOKIE_SAME_SITE`, `CLIENT_IP_SECRET`, `CRON_SECRET`
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_CALLBACK_URL`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`
- `SEED_ADMIN_PASSWORD` (solo seeds locales)
- `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_SECURE`, `RESEND_API_KEY`
- `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`
- `SENTRY_DSN`
- `GA4_PROPERTY_ID`, `GA4_CLIENT_EMAIL`, `GA4_PRIVATE_KEY`

Migraciones: **no** corren al arrancar el contenedor. Usa `prisma migrate deploy` a mano (ver README de VPS/Render).

---

## Paso común: apuntar la web (Vercel) a la API nueva

Hoy **no hay una URL de Cloud Run hardcodeada** en el código. La web lee:

1. Variable de entorno **`NUXT_API_UPSTREAM_URL`** (Vercel) — origen de la API sin path final.
2. Se consume en `apps/web/nuxt.config.ts` **línea 35** (`const apiUpstream = process.env.NUXT_API_UPSTREAM_URL...`).
3. Documentada como placeholder en `apps/web/.env.example` **línea 7** (`# NUXT_API_UPSTREAM_URL=https://TU-SERVICIO.run.app`).
4. Si usas sitemap interno: también `NUXT_API_INTERNAL_URL` (misma idea; ver `.env.example` de la web).

Cuando elijas VPS o Render, **cambia solo en el panel de Vercel** (y opcionalmente el comentario del `.env.example`) a la URL HTTPS nueva. No hace falta tocar `routeRules` de proxy: `/api/v1` lo atiende Nitro y reenvía cookies.

---

## CORS

En `apps/api/src/main.ts` (aprox. líneas 14–30 y 79–98):

- En producción, `FRONTEND_URL` (lista separada por comas) define los orígenes permitidos.
- Se añaden automáticamente variantes `www.` / sin `www.` del mismo host.
- Incluye el dominio real de la tienda (ej. `https://www.luxtimee.com`).

Tras migrar, confirma que `FRONTEND_URL` en la API coincida con el sitio en Vercel.

---

## Pruebas después del despliegue

1. `GET /api/v1/health` → 200.
2. Catálogo público carga productos.
3. Login admin (slug staff).
4. Inventario lista relojes.
5. Crear y cancelar un pedido de prueba.
6. Subir una imagen de reloj (directo a Cloudinary).

Backup: tras configurar secrets, lanza **Actions → Weekly DB backup → Run workflow** una vez y verifica el archivo en Drive.
