# Sesión + uploads — configuración final

## Qué poner en Cloud Run

```bash
COOKIE_SAME_SITE=lax
JWT_REFRESH_EXPIRES=90d
FRONTEND_URL=https://luxtimee.com,https://www.luxtimee.com
NODE_ENV=production
```

## Cómo funciona

| Acción | Ruta | Auth |
|--------|------|------|
| Login, admin, refresh | `luxtimee.com/api/v1` (proxy) | Cookies `Lax` |
| Subir fotos/video | Cloud Run directo | Bearer token en header |

Las cookies **no van** al microservicio (cross-origin). El token se renueva por el proxy y se manda en el header solo para la subida.

## Después de desplegar

1. Cierra sesión
2. Vuelve a entrar (guarda token en localStorage)
3. Sube multimedia
