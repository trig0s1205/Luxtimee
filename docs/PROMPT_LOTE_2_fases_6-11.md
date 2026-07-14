# Prompt — LOTE 2 (Fases 6 → 11)

CONTEXTO
Continúas la construcción de Luxtime. ANTES de empezar, lee: `docs/PROGRESO.md` (estado actual), `docs/PLAN_DESARROLLO_LUXTIME.md` (plan maestro) y `docs/PROMPT_COMPOSER.md` (reglas). Aplican TODAS las reglas del prompt maestro. Las Fases 0–5 ya están completas.

PASO PREVIO (diseño)
Si el cliente eligió una variante de diseño distinta a "Onyx & Oro", tu PRIMER paso es re-aplicar esa variante en el design system (Fase 3): actualiza tokens, `tailwind.config.ts` y tipografías al tema elegido, SIN tocar lógica ni estructura. Si el cliente confirmó "Onyx & Oro", continúa directo.

ALCANCE DE ESTE LOTE — FASES 6 A 11 (Tienda + Admin completo). Ejecuta en orden:
- Fase 6 — Storefront público (home, catálogo TikTok, ficha, carruseles)
- Fase 7 — Carrito, precio mayorista, checkout de intención, WhatsApp, consentimiento legal
- Fase 8 — Dominio Pedidos/Pre-Pedidos: máquina de estados, abono de 10.000 COP, recordatorios cada 2h
- Fase 9 — Panel Admin: inventario, importación Excel, garantía/cuidado, envíos, config WhatsApp
- Fase 10 — Gestión de Pre-Pedidos/Pedidos + centro de notificaciones
- Fase 11 — Dashboards Super Admin (Ganancia, Salud del Negocio, exportes PDF/Excel)
DETENTE al terminar la Fase 11. NO empieces la Fase 12.

PROTOCOLO (por cada fase)
1. Relee la fase en el plan. 2. Checklist en `docs/PROGRESO.md`. 3. Implementa en orden. 4. Cumple TODOS los criterios de aceptación. 5. lint/typecheck/build/tests en verde. 6. App levanta en local. 7. Marca COMPLETADA con decisiones/keys pendientes. 8. Commit por fase. 9. Sigue sin pedir confirmación.

AUTONOMÍA (no te detengas)
- Credenciales faltantes → adaptador + mock (`USE_MOCKS=true`) + placeholder en `.env.example`; anótalo.
- Reglas críticas de negocio a respetar sí o sí: mayorista automático desde 4 unidades (revalidado en servidor), abono de 10.000 COP por reloj como único filtro pre-pedido→pedido, máquina de estados exacta, y el rol ADMIN nunca ve datos financieros.
- Ambigüedad → "Supuestos" del plan; si persiste, opción más estándar/segura, anótala y sigue.

AL TERMINAR EL LOTE
En `docs/PROGRESO.md`: resumen del estado, flujos probados (compra invitado→WhatsApp, pre-pedido→abono→PAGADO, panel admin) y credenciales pendientes. Todo compilando y corriendo en local.

EMPIEZA por el paso previo de diseño (si aplica) y luego la Fase 6.
