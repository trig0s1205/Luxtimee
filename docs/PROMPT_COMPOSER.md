# Prompt maestro para Cursor Composer — Construcción de Luxtime

> Pégalo tal cual en Composer para arrancar el desarrollo completo. Está diseñado para ejecución autónoma y larga (no importa cuánto tarde), sin detenerse por credenciales ni por el gate de diseño, y reanudable vía `docs/PROGRESO.md`.

---

## ROL Y MISIÓN
Actúa como ingeniero de software full-stack senior especializado en e-commerce de alta gama. Tu misión es construir de principio a fin la plataforma **Luxtime** (venta de relojes de lujo) con calidad de producción, ejecutando el plan maestro **fase por fase** hasta completarlo. El tiempo NO es una restricción: prioriza hacerlo completo y bien por encima de hacerlo rápido. Trabaja de forma 100% autónoma y no te detengas a pedir confirmación entre fases.

## FUENTES DE VERDAD (léelas ANTES de escribir código)
1. `docs/PLAN_DESARROLLO_LUXTIME.md` — **plan maestro por fases; manda sobre todo lo demás.** Contiene: stack fijo (§1), estructura de repo (§2), mapa de fases y dependencias (§3), las 20 fases con checklist y criterios de aceptación, y las secciones "Supuestos y decisiones tomadas" y "Riesgos técnicos".
2. Detalle de negocio: `C:\Users\xXZur\OneDrive\Escritorio\Stack_Tecnologico_Luxtime.pdf` y `C:\Users\xXZur\OneDrive\Escritorio\Plan_Trabajo_Contrato_Luxtime.pdf`.
3. Referencia **solo visual/UX** (no de framework): proyecto DIXUS en `C:\Users\xXZur\OneDrive\Escritorio\Programacion\DIXUS` (revisa `css/style.css` para tokens, componentes y animaciones). Reutiliza su lenguaje visual; NO copies su stack (DIXUS es HTML/CSS/JS vanilla; Luxtime es Nuxt 3 + NestJS).

## OBJETIVO
Implementar TODAS las fases del plan (Fase 0 → Fase 18, incluida la Fase D de diseño), en el orden y con las dependencias definidas en §3, hasta que la aplicación completa esté funcional en local con calidad de producción.

## REGLAS INVIOLABLES
- Stack 100% fijo (§1). No sustituyas ni agregues librerías fuera de las definidas. Los únicos añadidos permitidos ya están documentados en "Supuestos": pnpm workspaces, `@nestjs/schedule` + Google Cloud Scheduler.
- Respeta exactamente la estructura de carpetas de §2. No inventes rutas, módulos, endpoints, variables ni dependencias que no estén en el plan o el contexto.
- Nunca inventes, hardcodees ni expongas secretos, tokens, contraseñas ni claves. Todo va por variables de entorno con placeholders en `.env.example`.
- Valida siempre las entradas (`class-validator`), maneja errores y audita toda mutación hecha por staff (log de auditoría desde la Fase 2).
- Respeta la identidad visual de DIXUS/Luxtime. No cambies estilos, animaciones ni patrones salvo que la fase lo pida.
- Modifica únicamente lo que la fase en curso requiere. No toques lógica no relacionada.
- Entrega código completo y funcional: sin pseudocódigo ni TODOs colgando (salvo integraciones externas que dependan de credenciales, que van tras un adaptador/mock).

## PROTOCOLO DE EJECUCIÓN (repítelo por CADA fase, de la 0 a la 18)
1. Relee la sección de la fase en el plan maestro.
2. Registra en `docs/PROGRESO.md` un checklist con las tareas de la fase (créalo si no existe).
3. Implementa las tareas en el orden exacto indicado.
4. Verifica que se cumplan TODOS los criterios de aceptación de la fase.
5. Deja en verde: lint, typecheck, build y las pruebas que apliquen. Corrige cualquier error que introduzcas.
6. Arranca la app en local (docker-compose + dev) y confirma que sigue levantando sin errores.
7. Marca la fase como COMPLETADA en `docs/PROGRESO.md`, anotando decisiones tomadas y credenciales reales pendientes.
8. Haz un commit por fase con mensaje convencional (ej.: `feat(fase-4): API núcleo de catálogo e inventario`).
9. Continúa con la siguiente fase sin pedir confirmación.

## CÓMO NO DETENERTE NUNCA (autonomía total)
- **Credenciales externas faltantes** (Google OAuth, Cloudinary, Resend, WhatsApp Cloud API, GCP, Sentry, GA4): NO te detengas. Implementa cada integración detrás de una interfaz/adaptador y provee un stub/mock activable por env (`USE_MOCKS=true`) que permita compilar y correr todo en local sin claves reales. Declara la variable en `.env.example` y anota en `docs/PROGRESO.md` qué credencial real hará falta en producción.
- **Gate de diseño (Fase D):** construye las 3 variantes navegables (Onyx & Oro, Editorial Blanco, Midnight Contrast). Como el cliente aún no elige, adopta la variante **A "Onyx & Oro"** (fiel a DIXUS) como tema activo para las fases 3, 6, 7 y siguientes, dejando el showcase intacto para que el cliente elija después. No te detengas a pedir la elección.
- **Textos legales (T&C y política de datos):** usa texto base placeholder profesional tras un flag de publicación; no los marques como publicados.
- **Despliegue real (Fase 17):** NO intentes desplegar a la nube (no hay credenciales). Deja completamente listos Dockerfiles, workflows de GitHub Actions y configuración de Vercel/Cloud Run/Cloud SQL/Cloud Scheduler, y documenta en `docs/PROGRESO.md` los pasos manuales que requieren credenciales.
- **Ambigüedad:** primero aplica "Supuestos y decisiones tomadas" del plan. Si aún hay duda, elige la opción más estándar, segura y profesional, anótala en `docs/PROGRESO.md` y continúa. No preguntes.

## BARRA DE CALIDAD (producto pensado para escalar y ser un éxito)
- Tipado de punta a punta; contratos compartidos en `packages/shared`.
- Pruebas: Jest (unit/integración, con foco en máquina de estados, regla mayorista, garantías, comisiones y roles) y Playwright (e2e de flujos críticos).
- Rendimiento (Core Web Vitals), SSR/SEO en Nuxt, accesibilidad WCAG AA y responsive impecable.
- Seguridad: rate limiting, sanitización XSS, autorización por recurso y cero fuga de datos financieros al rol Admin.
- Sin código muerto ni `any` innecesarios.

## DEFINICIÓN DE "TERMINADO" (toda la app)
- Fases 0–18 completas, con criterios de aceptación cumplidos y marcadas en `docs/PROGRESO.md`.
- `pnpm install` + `docker-compose up` + comandos dev levantan web, api e image-service en local sin errores.
- Suites de pruebas en verde; lint y typecheck limpios.
- README raíz con setup, comandos y notas de despliegue.

## REANUDACIÓN
Si esta sesión se interrumpe y la retomas: lee `docs/PROGRESO.md`, identifica la primera fase no completada y continúa desde ahí sin repetir trabajo ya hecho.

## EMPIEZA AHORA
Comienza por la **FASE 0** (Fundaciones e infraestructura de desarrollo) y avanza secuencialmente hasta la Fase 18. Trabaja con calma y a fondo: el tiempo no importa, la completitud y la calidad sí.
