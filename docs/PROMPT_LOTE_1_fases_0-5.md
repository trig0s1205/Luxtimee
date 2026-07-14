# Prompt — LOTE 1 (Fases 0 → 5)

CONTEXTO
Vas a construir la plataforma e-commerce Luxtime (relojes de lujo) con calidad de producción. ANTES de escribir código, lee completos: `docs/PLAN_DESARROLLO_LUXTIME.md` (plan maestro; manda sobre todo) y `docs/PROMPT_COMPOSER.md` (reglas de trabajo). Aplican TODAS las reglas de ese prompt maestro: stack fijo, estructura de repo de §2, no inventar rutas/módulos/endpoints/keys, validar entradas y auditar mutaciones, respetar la identidad visual de DIXUS, cero secretos hardcodeados y trabajo autónomo sin pedir confirmación.
Referencia visual (solo UX, no framework): DIXUS en `C:\Users\xXZur\OneDrive\Escritorio\Programacion\DIXUS` (mira `css/style.css`). Detalle de negocio en los PDFs del Escritorio (`Stack_Tecnologico_Luxtime.pdf`, `Plan_Trabajo_Contrato_Luxtime.pdf`).

ALCANCE DE ESTE LOTE — FASES 0 A 5 (Cimientos + Núcleo). Ejecuta en orden, respetando dependencias del §3:
- Fase 0 — Fundaciones e infraestructura de desarrollo
- Fase 1 — Modelo de datos y esquema (Prisma/PostgreSQL)
- Fase 2 — Autenticación, roles, sesión y auditoría base
- Fase D — Exploración de diseño (SOLO front, 3 variantes navegables)
- Fase 3 — Design system (adopta la variante A "Onyx & Oro" como tema activo por defecto)
- Fase 4 — API núcleo: catálogo, productos, marcas, garantía/cuidado, inventario
- Fase 5 — Pipeline de imágenes (Python/FastAPI + Cloudinary)
DETENTE al terminar la Fase 5. NO empieces la Fase 6.

PROTOCOLO (por cada fase)
1. Relee la sección de la fase en el plan. 2. Anota su checklist en `docs/PROGRESO.md`. 3. Implementa en el orden indicado. 4. Cumple TODOS los criterios de aceptación. 5. Deja lint/typecheck/build/tests en verde. 6. Confirma que la app levanta en local (docker-compose + dev). 7. Marca la fase COMPLETADA en `docs/PROGRESO.md` (decisiones + credenciales pendientes). 8. Commit por fase: `feat(fase-N): ...`. 9. Sigue sin pedir confirmación.

AUTONOMÍA (no te detengas)
- Credenciales faltantes → integración tras adaptador + mock activable por env (`USE_MOCKS=true`) + placeholder en `.env.example`; anótalo en `docs/PROGRESO.md`.
- Gate de diseño (Fase D) → construye las 3 variantes y adopta "Onyx & Oro" por defecto; no esperes la elección del cliente.
- Ambigüedad → aplica "Supuestos y decisiones tomadas" del plan; si persiste, elige lo más estándar/seguro, anótalo y continúa.

AL TERMINAR EL LOTE
En `docs/PROGRESO.md`: resumen del estado, la ruta del showcase de diseño (`/design`) para que el cliente revise las 3 variantes, y la lista de credenciales reales que harán falta. Deja todo compilando y la app corriendo en local.

EMPIEZA AHORA por la Fase 0.
