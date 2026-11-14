# Runbook del sábado — API Luxtimee en Vultr

Tiempos estimados si todo sale bien. Asume la checklist del viernes completa
(`CHECKLIST-PREVIA.md`). Comandos del PC en **PowerShell**; del servidor en **bash**.
Todos los scripts: `bash ./nombre.sh` (no `./nombre.sh`).

## Antes de empezar

- Checklist de viernes hecha.
- Tag de imagen listo (`sha-…` o plan B con `ship-image.ps1`).
- Secretos en un gestor de contraseñas (nunca en el chat).

## T+0:00 — Álvaro paga (10–15 min)

Álvaro crea/activa la cuenta Vultr e invita a Daniel. Daniel **no** maneja la tarjeta.

## T+0:15 — Crear el servidor (5 min)

Products → Deploy → Cloud Compute – High Frequency (o High Performance), **Atlanta**,
Ubuntu **24.04** x64, **1 vCPU / 2 GB / 64 GB**, IPv4+IPv6, Auto Backups **off**,
SSH Key = llave pública de Daniel, hostname `luxtimee-api`. Anotar la **IP**.

## T+0:20 — DNS (3 min + propagación)

Registro **A**: nombre `api`, valor = IP del VPS, TTL 300.
Si Cloudflare: **nube gris** (solo DNS). Comprobar: `nslookup api.luxtimee.com`.

## T+0:25 — Bootstrap (8–10 min)

Desde la raíz del repo (PowerShell):

```powershell
scp -r .\deploy\vps root@<IP>:/root/luxtimee-deploy
ssh -t root@<IP> "sed -i 's/\r$//' /root/luxtimee-deploy/*.sh && bash /root/luxtimee-deploy/bootstrap-server.sh"
```

`-t` es obligatorio si el script pide teclado. El `sed` quita CRLF de Windows.

Abrir **otra** terminal: `ssh deploy@<IP>`. Solo cuando entre bien, en la primera:

```bash
ssh -t root@<IP> "bash /home/deploy/luxtimee/harden-ssh.sh"
```

Desde ahora solo `deploy`.

## T+0:40 — Secretos (10–15 min)

```bash
ssh deploy@<IP>
cd ~/luxtimee
bash ./set-env.sh
```

`API_DOMAIN=api.luxtimee.com`, `API_IMAGE=ghcr.io/trig0s1205/luxtimee-api:sha-…`.

## T+0:55 — Imagen (3–5 min)

```bash
bash ./ghcr-login.sh
```

Si falla GHCR (plan B, ~10–15 min extra desde el PC):

```powershell
.\deploy\vps\ship-image.ps1 -ServerIp <IP>
```

## T+1:00 — Respaldo (2–5 min)

```bash
bash ./backup-supabase.sh
```

Baja la copia al PC con el `scp` que imprime el script.

## T+1:05 — Migraciones (2–4 min)

```bash
bash ./migrate.sh status
bash ./migrate.sh deploy   # escribe MIGRAR
```

Solo aplica lo que trae la imagen elegida.

## T+1:10 — Levantar (3 min)

```bash
bash ./deploy.sh sha-<completo>
docker compose ps
docker compose logs -f caddy   # certificado tras DNS
```

## T+1:15 — Smoke API (3 min)

```bash
bash ./smoke-test.sh https://api.luxtimee.com
```

Todo debe ser ✓.

## T+1:20 — Vercel (5–8 min)

Settings → Environment Variables (Production):

| Variable | Valor |
|----------|--------|
| `NUXT_API_UPSTREAM_URL` | `https://api.luxtimee.com` (sin `/api/v1`) |
| `NUXT_API_INTERNAL_URL` (si existe hoy) | `https://api.luxtimee.com/api/v1` |
| `NUXT_PUBLIC_API_UPLOAD_URL` (si existe hoy) | `https://api.luxtimee.com/api/v1` |
| `NUXT_PUBLIC_API_ASSETS_URL` | confirmar si hace falta |

`NUXT_CLIENT_IP_SECRET` y `NUXT_PUBLIC_STAFF_LOGIN_SLUG` **no cambian**.
Redeploy **sin caché de build**. Ahí empieza el tráfico real al VPS.

## T+1:30 — Smoke completo (10–15 min)

```bash
bash ./smoke-test-web.sh https://www.luxtimee.com
```

Manual:

1. Login: https://www.luxtimee.com/acceso/dev-portal-lx9k2
2. Catálogo `/catalogo` con fotos.
3. Subir 2 fotos de prueba → Cloudinary.
4. POS (solo si PR #31 desplegado+migrado).
5. `docker compose logs --tail=100 api`

## T+1:45–2:15 — Margen

Si falla, ver **Reversa**. Si todo OK: cargar relojes el resto del día.

## Reversa (barata primero)

1. Solo API mala: `bash ./rollback.sh`
2. Web no conecta: restaurar variables de Vercel del viernes + redeploy
3. Migración: no deshacer a mano (aditiva). Dump solo con corrupción y decisión de Daniel
4. VPS muerto: `deploy/render/` (plan B, cold start)

## Después

Backup manual al final del día; confirmar workflow semanal; si #31 quedó sin mergear, decidir cuándo mergear y redesplegar.
