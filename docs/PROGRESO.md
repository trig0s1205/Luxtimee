# Luxtime — Progreso final (Lote 3, Fases 12–18)

## Estado: COMPLETADO

| Fase | Estado |
|------|--------|
| 12 | Mi Cuenta: pedidos, recibos, garantías, wishlist, checkout exprés |
| 13 | Certificados QR al PAGADO + `/certificado/[slug]` |
| 14 | Top 3 ventas, reseñas, waitlist, marketing validación, segmentación |
| 15 | Legal, CookieConsent, visor auditoría Super Admin |
| 16 | Helmet, rate limit pre-pedidos, checklist seguridad |
| 17 | Dockerfile API, workflows CI/deploy (sin deploy real) |
| 18 | Jest + Playwright smoke, builds en verde |

## Deploy manual (requiere credenciales)

1. Vercel: conectar repo, `apps/web`, env `NUXT_PUBLIC_*`
2. GCP: Cloud SQL, Cloud Run (`apps/api/Dockerfile`), Cloud Scheduler → `POST /api/v1/internal/cron/pre-order-reminders`
3. Cloudflare: DNS + WAF
4. Variables: ver `.env.example`

## Credenciales pendientes

Google OAuth, Cloudinary, Resend, WhatsApp API, GA4, Sentry, GCP, Cloudflare
