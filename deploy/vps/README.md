# Despliegue VPS (Ubuntu 24.04) — API Luxtimee

Guía para alguien no experto. La base de datos sigue en Supabase (Ohio / `us-east-2`).
**Recomendación:** crea el VPS en una región cercana a Ohio (por ejemplo Virginia / `us-east`) para menor latencia.

Archivos de esta carpeta (`deploy/vps/`):

- `docker-compose.yml` — servicios `api` (GHCR) + `caddy` (HTTPS)
- `Caddyfile` — reverse proxy al contenedor `api`
- Este README

La imagen se publica con el workflow `.github/workflows/api-image.yml` como `ghcr.io/trig0s1205/luxtimee-api:latest`.

---

## 1. Crear un usuario no root con sudo y llave SSH

Entra al VPS como root (solo la primera vez) y crea un usuario:

```bash
adduser deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
nano /home/deploy/.ssh/authorized_keys
# Pega tu clave pública (id_rsa.pub o id_ed25519.pub) y guarda
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
```

Desactiva login root por contraseña:

```bash
nano /etc/ssh/sshd_config
```

Asegura estas líneas:

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

Reinicia SSH:

```bash
systemctl restart ssh
```

Cierra la sesión y vuelve a entrar como `deploy` con tu llave.

---

## 2. Firewall (solo 22, 80 y 443)

```bash
sudo apt update
sudo apt install -y ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

---

## 3. Instalar Docker y el plugin Compose

Comandos oficiales (Ubuntu):

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker deploy
```

Cierra sesión y vuelve a entrar para que el grupo `docker` aplique. Prueba:

```bash
docker run --rm hello-world
docker compose version
```

---

## 4. Actualizaciones de seguridad automáticas

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

Elige “Yes” / sí cuando pregunte por actualizaciones automáticas.

---

## 5. Carpeta de la app, .env y levantar servicios

```bash
mkdir -p ~/luxtimee
cd ~/luxtimee
```

Copia desde tu PC (o clona el repo) estos archivos a `~/luxtimee`:

- `docker-compose.yml` (de `deploy/vps/`)
- `Caddyfile` (de `deploy/vps/`)
- `.env` (creado a partir de `apps/api/.env.example`)

Edita el `Caddyfile` y cambia `api.TU-DOMINIO.com` por tu subdominio real.

Crea el `.env` en el servidor (nunca lo subas a git):

```bash
nano ~/luxtimee/.env
```

Pega las variables de `apps/api/.env.example` con valores reales de producción
(`NODE_ENV=production`, `USE_MOCKS=false`, `PORT=3000`, `FRONTEND_URL=https://www.tu-dominio.com`, etc.).

Login en GitHub Container Registry (necesitas un Personal Access Token con `read:packages`):

```bash
echo TU_GITHUB_PAT | docker login ghcr.io -u TU_USUARIO_GITHUB --password-stdin
docker compose pull
docker compose up -d
docker compose ps
```

Comprueba salud (desde el VPS; el puerto 3000 no está publicado al exterior):

```bash
docker compose exec api node -e "fetch('http://127.0.0.1:3000/api/v1/health').then(async (r)=>{console.log(await r.text()); process.exit(r.ok?0:1)})"
```

Cuando el DNS ya apunte al VPS:

```bash
curl -fsS https://api.TU-DOMINIO.com/api/v1/health
```


---

## 6. DNS

En tu proveedor de DNS crea un registro **A**:

- Nombre: `api` (o el subdominio que pusiste en el Caddyfile)
- Valor: IP pública del VPS

Espera la propagación. Caddy pedirá el certificado solo cuando el DNS ya apunte al VPS.

---

## 7. Logs, reinicio y actualización manual

```bash
cd ~/luxtimee
docker compose logs -f api
docker compose restart api
docker compose pull api
docker compose up -d api
```

Migraciones Prisma (solo cuando haya migraciones nuevas; no corren al arrancar):

```bash
docker compose run --rm --entrypoint sh api -c \
  'node ../../node_modules/prisma/build/index.js migrate deploy --schema prisma/schema.prisma'
```

Si la ruta del CLI cambia en la imagen, usa:

```bash
docker compose run --rm --entrypoint sh api -c \
  'PRISMA=$(find /app/node_modules -path "*/prisma/build/index.js" | head -n 1); node "$PRISMA" migrate deploy --schema prisma/schema.prisma'
```

---

## 8. Limpieza semanal de imágenes viejas

```bash
crontab -e
```

Añade (domingos 04:00 hora del servidor):

```
0 4 * * 0 docker image prune -af --filter "until=168h" >> /home/deploy/docker-prune.log 2>&1
```

---

## 9. Secrets y variables de GitHub Actions (despliegue automático)

En el repo: **Settings → Secrets and variables → Actions**.

### Variables (Variables)

| Nombre | Valor | Uso |
|--------|-------|-----|
| `DEPLOY_TARGET` | `vps` | Activa el job `deploy-vps` del workflow `api-image.yml`. Si no existe o no es `vps`, ese job se salta. |

### Secrets

| Nombre | Contenido |
|--------|-----------|
| `VPS_HOST` | IP o hostname del VPS |
| `VPS_USER` | Usuario SSH (ej. `deploy`) |
| `VPS_SSH_KEY` | Clave privada SSH completa (incluye `-----BEGIN...-----`) |

El workflow entra por SSH y ejecuta:

```bash
cd ~/luxtimee && docker compose pull api && docker compose up -d api && docker image prune -f
```

Render no usa estos secrets (se despliega solo con `render.yaml`).

---

## 10. Proxy de la web (Vercel)

Cuando la API ya responda en tu dominio, cambia en Vercel la variable
`NUXT_API_UPSTREAM_URL` (y si aplica `NUXT_API_INTERNAL_URL`) a la URL HTTPS nueva
(ej. `https://api.tu-dominio.com`). No dejes la URL antigua de Cloud Run.
Ver `docs/deploy.md` para el archivo del monorepo donde se lee esa variable.
