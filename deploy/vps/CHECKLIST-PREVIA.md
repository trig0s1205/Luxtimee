# Checklist de viernes (Daniel, ~45 min, sin servidor)

Marca cada ítem. No pegues secretos en el chat.

## PC

- [ ] `ssh -V` funciona (viene con Windows 10/11).
- [ ] Llave SSH: si no hay, `ssh-keygen -t ed25519 -C "daniel-luxtimee"`.
- [ ] Copiar **solo** el contenido de `~\.ssh\id_ed25519.pub` para pegarlo en Vultr (nunca la privada).

## GitHub

- [ ] Token clásico con permiso **solo** `read:packages` (Settings → Developer settings → Personal access tokens).
- [ ] Guardado en gestor de contraseñas. No pegarlo en el chat.

## Secretos de producción (gestor de contraseñas)

- [ ] `DATABASE_URL` (pooler transacciones + `?pgbouncer=true`)
- [ ] `DIRECT_URL` (directa o Session pooler, puerto 5432, IPv4)
- [ ] Cloudinary (cloud name, API key, API secret) + confirmar `CLOUDINARY_FOLDER` real
- [ ] Google OAuth (client id, secret, callback)
- [ ] SMTP o Resend
- [ ] WhatsApp (3 valores) si aplica
- [ ] Sentry / GA4 si aplica
- [ ] `CLIENT_IP_SECRET` = mismo valor que `NUXT_CLIENT_IP_SECRET` en Vercel

## Vercel (anotar valores actuales = plan de reversa)

- [ ] `NUXT_API_UPSTREAM_URL` (existencia y valor)
- [ ] `NUXT_API_INTERNAL_URL` (¿existe?)
- [ ] `NUXT_PUBLIC_API_UPLOAD_URL` (¿existe?)
- [ ] `NUXT_PUBLIC_API_ASSETS_URL` (¿existe?)
- [ ] `NUXT_CLIENT_IP_SECRET` (existe; valor solo en gestor)
- [ ] `NUXT_PUBLIC_STAFF_LOGIN_SLUG` (no cambia)

## DNS

- [ ] Saber dónde está el dominio (Cloudflare u otro) y tener acceso.
- [ ] El sábado: A `api` → IP VPS, nube gris si Cloudflare.

## Imagen de la API

- [ ] Decidir con Álvaro qué código sube (tabla abajo).
- [ ] Si la rama **no** está en `main`: Actions → **API image (GHCR)** → Run workflow → copiar tag `sha-…`.
- [ ] Workflow en verde.

## Respaldo extra

- [ ] Actions → **Weekly DB backup** → Run workflow → confirmar archivo en Drive.

## Carga de relojes

- [ ] Llenar `plantilla-relojes.xlsx` (sin fotos).
- [ ] Renombrar fotos: `001_1_frente.jpg` / `001_2_dorso.jpg` (hoja Instrucciones).

## POS (si va PR #31)

- [ ] Prueba manual de venta en local hecha.

---

## Tabla de decisiones (solo Daniel decide; nadie mergea por ti)

| Decisión | Opción 1 | Opción 2 | Recomendación |
|----------|----------|----------|---------------|
| PR #31 (POS, comprobantes) | Mergear a `main` cuando lo digas → `latest` + `migrate.sh deploy` | No mergear: workflow desde `feat/comprobantes-pos` y tag `sha-…` | Si el POS se usa el sábado, el código y su migración deben estar en la imagen. **Mergear NO migra.** |
| PR #30 (quitar image-service) | Mergear antes | No mergear: falla rembg, sube original y marca `imageNeedsReview` | Con rembg apagado, #30 evita ruido. Combinable con #31 (merge-tree OK). |
| Origen de imagen | GHCR (A) | PC + `ship-image.ps1` (B) | A; B solo si Actions falla. |
| Producción sin mergear | Tag `sha-…` desde la rama | — | Válido; luego mergear y redesplegar. |
