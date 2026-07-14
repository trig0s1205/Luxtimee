# Prompt — LOTE 3 (Fases 12 → 18)

CONTEXTO
Tramo final de Luxtime. ANTES de empezar, lee: `docs/PROGRESO.md` (estado actual), `docs/PLAN_DESARROLLO_LUXTIME.md` (plan maestro) y `docs/PROMPT_COMPOSER.md` (reglas). Aplican TODAS las reglas del prompt maestro. Las Fases 0–11 ya están completas.

ALCANCE DE ESTE LOTE — FASES 12 A 18 (Cliente + Certificado + Marketing + Cierre). Ejecuta en orden:
- Fase 12 — Portal "Mi Cuenta" (historial, checkout exprés, garantías digitales, wishlist)
- Fase 13 — Certificado de autenticidad digital (QR + página pública)
- Fase 14 — Marketing y engagement (reseñas, más vendidos, avisos de catálogo, lista de espera, email con validación, segmentación, GA vía API)
- Fase 15 — Continuidad y cumplimiento (backups, log de auditoría, política de datos, T&C)
- Fase 16 — Seguridad, hardening, rate limiting, Cloudflare, Sentry
- Fase 17 — Despliegue productivo y CI/CD completo
- Fase 18 — QA, pruebas (Jest + Playwright), rendimiento, SEO y accesibilidad
DETENTE al terminar la Fase 18: la app queda completa.

NOTAS ESPECÍFICAS
- Fase 17: NO despliegues a la nube (no hay credenciales). Deja LISTOS Dockerfiles, workflows de GitHub Actions y la configuración de Vercel/Cloud Run/Cloud SQL/Cloud Scheduler, y documenta en `docs/PROGRESO.md` los pasos manuales que requieren credenciales.
- Textos legales (T&C y política de datos): quedan tras un flag de publicación; NO los marques como publicados (requieren aprobación de Álvaro).
- Certificado (Fase 13): un QR único por unidad vendida, generado al llegar el pedido a PAGADO.

PROTOCOLO (por cada fase)
1. Relee la fase en el plan. 2. Checklist en `docs/PROGRESO.md`. 3. Implementa en orden. 4. Cumple TODOS los criterios de aceptación. 5. lint/typecheck/build/tests en verde. 6. App levanta en local. 7. Marca COMPLETADA. 8. Commit por fase. 9. Sigue sin pedir confirmación.

AUTONOMÍA (no te detengas)
- Credenciales faltantes → adaptador + mock (`USE_MOCKS=true`) + placeholder en `.env.example`; anótalo.
- Ambigüedad → "Supuestos" del plan; si persiste, opción más estándar/segura, anótala y sigue.

AL TERMINAR (definición de "hecho")
- Fases 0–18 marcadas como completas en `docs/PROGRESO.md`.
- `pnpm install` + `docker-compose up` + comandos dev levantan web, api e image-service sin errores.
- Suites Jest + Playwright en verde; lint y typecheck limpios.
- README raíz con setup, comandos y notas de despliegue.
- Checklist final de credenciales y pasos de deploy manuales en `docs/PROGRESO.md`.

EMPIEZA por la Fase 12.
