# Despliegue VPS (Ubuntu 24.04) — API Luxtimee

Guía en español de Colombia. La base de datos sigue en **Supabase** (Ohio / `us-east-2`).
VPS recomendado: Vultr High Frequency, **Atlanta**, 1 vCPU / **2 GB** / 64 GB NVMe.

**Documentos del sábado**

| Archivo | Para qué |
|---------|----------|
| [`CHECKLIST-PREVIA.md`](./CHECKLIST-PREVIA.md) | Viernes: qué reunir antes de pagar Vultr |
| [`RUNBOOK-SABADO.md`](./RUNBOOK-SABADO.md) | Paso a paso con tiempos el día del lanzamiento |
| Este README | Scripts, variables y alternativa manual |

Plan B (sin VPS): `deploy/render/` (arranque en frío, 512 MB).

---

## Archivos de esta carpeta

| Archivo | Quién / cuándo |
|---------|----------------|
| `bootstrap-server.sh` | root, **una vez** en Ubuntu 24.04 nuevo |
| `harden-ssh.sh` | root, **después** de probar `ssh deploy@IP` |
| `set-env.sh` | deploy, genera `~/luxtimee/.env` (600) |
| `.env.production.example` | plantilla (sin secretos reales) |
| `ghcr-login.sh` | deploy, login GHCR + verifica tag |
| `backup-supabase.sh` | deploy, **antes** de migrar |
| `migrate.sh` | deploy, `status` \| `deploy` |
| `deploy.sh` / `rollback.sh` | deploy, levanta / revierte tag `sha-…` |
| `smoke-test.sh` / `smoke-test-web.sh` | deploy o PC con bash |
| `ship-image.ps1` | PC (plan B si falla GHCR) |
| `docker-compose.yml` | api + caddy; `API_IMAGE` **obligatorio** (sin default `latest`) |
| `Caddyfile` | dominio vía `{$API_DOMAIN}` |
| `host-maintenance.cron` | ejemplo opcional (no instalado) |

Todos los scripts del servidor: `bash ./nombre.sh` (funciona aunque `scp` no conserve el bit de ejecución).
Antes de bootstrap desde Windows: `sed -i 's/\r$//' …/*.sh` (ver runbook).

Imagen: `ghcr.io/trig0s1205/luxtimee-api:sha-<completo>` (workflow `api-image.yml`).
`latest` solo existe tras push a `main`. Para código sin mergear: Actions → Run workflow en la rama → tag `sha-…`.

---

## Flujo rápido (resumen)

1. Bootstrap + harden (runbook).
2. `bash ./set-env.sh` → `bash ./ghcr-login.sh`.
3. `bash ./backup-supabase.sh` → `bash ./migrate.sh deploy`.
4. `bash ./deploy.sh sha-…` → `bash ./smoke-test.sh https://api.luxtimee.com`.
5. Cambiar variables en Vercel y redeploy (ver runbook).

Comando Prisma validado en la imagen:

```bash
./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma
```

(`migrate.sh` lo usa vía `docker compose run`).

Memoria: `NODE_OPTIONS=--max-old-space-size=1024`, `mem_limit: 1400m` (~600 MB para SO + Caddy + swap).

---

## Tabla de variables (quién las escribe)

| Variable | Obligatoria | Dónde conseguirla | Quién |
|----------|-------------|-------------------|-------|
| `NODE_ENV` | sí | fijo `production` | set-env / Daniel |
| `USE_MOCKS` | sí | fijo `false` | set-env |
| `PORT` / `HOST` | sí | `3000` / `0.0.0.0` | set-env |
| `FRONTEND_URL` | sí | sitio Vercel | Daniel |
| `STAFF_LOGIN_SLUG` | sí | igual a `NUXT_PUBLIC_STAFF_LOGIN_SLUG` | Daniel |
| `DATABASE_URL` | sí | Supabase → Transaction pooler + `?pgbouncer=true` | Daniel |
| `DIRECT_URL` | sí | Supabase → Direct o Session (5432), IPv4 | Daniel |
| `JWT_*` / `CRON_SECRET` | sí | generar (`set-env` / openssl) | Daniel |
| `CLIENT_IP_SECRET` | sí | **mismo** que `NUXT_CLIENT_IP_SECRET` en Vercel | Daniel |
| `COOKIE_SAME_SITE` | sí | fijo `lax` | set-env |
| `GOOGLE_OAUTH_*` | si usas Google | Google Cloud Console | Daniel |
| `CLOUDINARY_*` | sí (prod) | Cloudinary dashboard | Daniel |
| `CLOUDINARY_FOLDER` | sí | confirmar valor real de prod (no inventar) | Daniel |
| `IMAGE_SERVICE_*` | no sábado | vacíos | — |
| `EMAIL_*` / `SMTP_*` / `RESEND_*` | opcional | SMTP o Resend | Daniel |
| `WHATSAPP_*` | opcional | Meta WhatsApp Cloud | Daniel |
| `SENTRY_DSN` | opcional | Sentry | Daniel |
| `GA4_*` | opcional | Google Cloud / GA4 | Daniel |
| `API_DOMAIN` | sí (compose) | ej. `api.luxtimee.com` | Daniel |
| `ACME_EMAIL` | sí (Caddy) | correo Let's Encrypt | Daniel |
| `API_IMAGE` | sí | GHCR tag `sha-…` | Daniel |
| `NODE_OPTIONS` | sí | `--max-old-space-size=1024` | set-env |
| `SEED_ADMIN_PASSWORD` | **NO** en prod | — | — |

Sin comillas en `.env`. Evita `$` sin codificar (Compose lo interpola). `GA4_PRIVATE_KEY` en una línea con `\n` literales.

---

## Vercel (web)

Tras la API sana:

| Variable | Notas |
|----------|--------|
| `NUXT_API_UPSTREAM_URL` | origen **sin** `/api/v1` (ej. `https://api.luxtimee.com`) |
| `NUXT_API_INTERNAL_URL` | si existe hoy: **con** `/api/v1` |
| `NUXT_PUBLIC_API_UPLOAD_URL` | si existe hoy: **con** `/api/v1` (subidas del navegador) |
| `NUXT_PUBLIC_API_ASSETS_URL` | confirmar si aplica |
| `NUXT_CLIENT_IP_SECRET` / `NUXT_PUBLIC_STAFF_LOGIN_SLUG` | **no cambian** |

Un cambio de variables solo aplica con **Redeploy**.

DNS Cloudflare: registro `api` en **solo DNS** (nube gris) para que Caddy obtenga el certificado.

---

## Secrets de GitHub Actions (despliegue automático opcional)

| Tipo | Nombre | Uso |
|------|--------|-----|
| Variable | `DEPLOY_TARGET=vps` | Activa job `deploy-vps` en `api-image.yml` |
| Secret | `VPS_HOST` / `VPS_USER` / `VPS_SSH_KEY` | SSH post-push a `main` |

El sábado el despliegue es **manual** con los scripts (más control).

---

## Alternativa manual (sin scripts)

Si no puedes usar los `.sh`, los pasos clásicos siguen siendo:

1. Usuario `deploy` + SSH keys + ufw 22/80/443.
2. Docker CE + compose plugin; `usermod -aG docker deploy`.
3. Carpeta `~/luxtimee` con `docker-compose.yml`, `Caddyfile`, `.env` (600).
4. `API_IMAGE=ghcr.io/trig0s1205/luxtimee-api:sha-…` (obligatorio; sin default `latest`).
5. `API_DOMAIN` / `ACME_EMAIL` en `.env`; el Caddyfile usa `{$API_DOMAIN}` (no editar a mano el dominio).
6. `docker login ghcr.io` → `docker compose pull` → `docker compose up -d`.
7. Migraciones:

```bash
docker compose run --rm --no-deps --entrypoint sh api -c \
  './node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma'
```

8. Salud: `curl -fsS https://api.TU-DOMINIO.com/api/v1/health`

Limpieza semanal opcional: ver `host-maintenance.cron`.

---

## Probar Caddy sin DNS público

```bash
curl -k --resolve api.luxtimee.com:443:127.0.0.1 https://api.luxtimee.com/api/v1/health
```

En local de desarrollo con `API_DOMAIN=localhost`, Caddy usa CA interna (`curl -k`).
