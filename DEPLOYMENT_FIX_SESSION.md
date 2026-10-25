# Sesión staff

Cadena real: navegador → Cloudflare → Vercel → Cloud Run.

El login guarda `LUXTIMEE_access` y `LUXTIMEE_refresh` en el host `www.luxtimee.com`. El panel llama a `/api/v1` en ese mismo origen. El handler Nitro `server/routes/api/v1/[...path].ts` reenvía `Cookie` y cada `Set-Cookie`. No uses un rewrite de Vercel hacia Cloud Run: ese rewrite no entrega la cookie y la API responde 401 `Sesión inválida o expirada`.

La subida de fotos y video sigue yendo directo a Cloud Run con `Authorization: Bearer` de `POST /api/v1/auth/upload-token`.

`trust proxy` se queda en 1. No lo subas: un cliente que pegue directo a Cloud Run podría meter un `X-Forwarded-For` falso. La IP del visitante viaja en `X-Luxtimee-Client-Ip` solo si el proxy la firma con el mismo secreto. Delante de Cloudflare, `CF-Connecting-IP` solo se acepta cuando el peer (`x-real-ip`) está en los rangos de Cloudflare.

## Variables

Vercel:

```bash
NUXT_API_UPSTREAM_URL=https://TU-SERVICIO.run.app
NUXT_PUBLIC_API_BASE_URL=/api/v1
NUXT_PUBLIC_API_UPLOAD_URL=https://TU-SERVICIO.run.app/api/v1
NUXT_PUBLIC_SITE_URL=https://www.luxtimee.com
NUXT_CLIENT_IP_SECRET=<secreto largo>
```

Cloud Run, el mismo secreto:

```bash
CLIENT_IP_SECRET=<secreto largo>
COOKIE_SAME_SITE=lax
JWT_REFRESH_EXPIRES=90d
FRONTEND_URL=https://www.luxtimee.com,https://luxtimee.com
NODE_ENV=production
```

Sin `NUXT_CLIENT_IP_SECRET` / `CLIENT_IP_SECRET`, el bloqueo y el rate limit ven la IP de salida de Vercel, no la del visitante.

## Vercel

- Dominio principal: `www.luxtimee.com`.
- No agregues un rewrite externo de `/api/v1/*` ni `/uploads/*` hacia Cloud Run.

## Cloudflare

El apex y `www` están en proxy (nube naranja). La respuesta de `/api/v1` sale `cf-cache-status: DYNAMIC`: Cloudflare no está cacheando esa ruta. Revisa igual:

- Cache Rule: Bypass cache para `/api/v1/*` y `/uploads/*`. Una regla Cache Everything puede guardar un 401 o tirar `Set-Cookie`.
- Transform Rules: no borres ni reescribas `Cookie`, `Set-Cookie`, `Authorization` ni `CF-Connecting-IP`.
- Bot Fight Mode / Super Bot Fight: excepción para `/api/v1/*`. Si el login recibe HTML de challenge, la sesión no se crea.
- SSL/TLS: Full (strict).
- Rocket Loader y ofuscación de correos: desactivados en `/api/*`.
- Redirect Rule de `luxtimee.com` → `https://www.luxtimee.com` (308). El middleware del servidor también redirige si el host es el apex, para que la cookie quede en `www`. Nitro 2.13 no vuelca ese redirect al `config.json` de Vercel: la regla de Cloudflare (o el dominio principal `www` en Vercel) tiene que existir para los estáticos.
