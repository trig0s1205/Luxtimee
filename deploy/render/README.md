# Plan B (arranque en frío, 512 MB) — Render

**Plan B** si el VPS no está disponible. Arranque en frío y ~512 MB de RAM.
El camino principal del sábado es Vultr: ver `deploy/vps/RUNBOOK-SABADO.md`.

Render construye `apps/api/Dockerfile` desde la raíz del repo
según `render.yaml` (región **ohio**, plan **free**).

La base de datos sigue en Supabase (Ohio). Render no sustituye a Postgres.

---

## 1. Crear el servicio desde el Blueprint

1. Entra a [https://dashboard.render.com](https://dashboard.render.com) y conecta el repo `trig0s1205/Luxtimee`.
2. Usa **Blueprint** / **New → Blueprint** e importa `render.yaml` de la raíz.
3. Confirma el servicio `luxtimee-api` (Docker, free, ohio).
4. `autoDeploy` está activo sobre `main`: cada push a `main` que afecte el build puede redesplegar.

---

## 2. Variables de entorno

En el panel del servicio → **Environment**:

- Las claves con `sync: false` en `render.yaml` aparecen vacías: **llénalas a mano**.
- Copia la lista desde `apps/api/.env.example`.
- Obligatorias en producción típica: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`, `CRON_SECRET`, `CLIENT_IP_SECRET`, Cloudinary, etc.
- `NODE_ENV=production`, `USE_MOCKS=false` ya vienen en el Blueprint.
- `PORT` lo asigna Render; no lo fijes a mano.
- `GOOGLE_OAUTH_CALLBACK_URL` debe ser `https://TU-SERVICIO.onrender.com/api/v1/auth/google/callback` (o tu dominio custom).

No pegues secretos en el repo ni en issues.

---

## 3. Migraciones Prisma

No corren al arrancar. Desde una máquina con acceso a la DB (o un one-off shell de Render, si lo tienes):

```bash
pnpm --filter @luxtime/api exec prisma migrate deploy
```

Usa `DIRECT_URL` (conexión directa / session pooler), no el transaction pooler.

---

## 4. Logs

En el dashboard del servicio → **Logs**. Ahí ves arranque, errores de Nest y respuestas 5xx.

Health esperado:

```text
GET /api/v1/health → 200 {"status":"ok",...}
```

---

## 5. Limitaciones del plan gratis (revisa la página actual de Render)

- Se **apaga** tras ~15 minutos sin tráfico (cold start al despertar).
- **512 MB** de RAM (por eso la imagen usa `NODE_OPTIONS=--max-old-space-size=384`).
- Tope de ~**750 horas/mes** de instancia.
- Políticas de “keep-alive” / pings externos **cambian**: lee los términos vigentes de Render antes de automatizar visitas.

---

## 6. Monitor opcional (UptimeRobot u otro)

1. Crea un monitor HTTP(S) gratuito que consulte `https://TU-SERVICIO.onrender.com/api/v1/health` cada **10 minutos**.
2. Configura alerta por correo si falla.
3. Esto avisa caídas; **no garantiza** que Render permita “calentar” la instancia gratis siempre. Si Render restringe keep-alive, el monitor sigue siendo útil como alerta, no como truco permanente.

---

## 7. Conectar la web (Vercel)

Cuando el servicio esté vivo, en Vercel actualiza:

- `NUXT_API_UPSTREAM_URL=https://TU-SERVICIO.onrender.com`
- `NUXT_API_INTERNAL_URL=https://TU-SERVICIO.onrender.com/api/v1` (si la usas para sitemap)

Detalles de archivo/línea en el monorepo: ver `docs/deploy.md`.
