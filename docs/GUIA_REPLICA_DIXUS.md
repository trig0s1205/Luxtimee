# GUÍA DE RÉPLICA: DIXUS → LUXTIME

> **Objetivo del documento.** Este archivo es la especificación completa para que un modelo de IA replique al **100 %** el diseño, las animaciones y las funcionalidades del proyecto **DIXUS** dentro de **Luxtime**, adaptando marca/textos/productos a Luxtime (relojes de lujo, Bucaramanga) pero conservando **exactamente** el sistema visual y el comportamiento.
>
> **Fuente:** proyecto DIXUS (`C:\Users\xXZur\OneDrive\Escritorio\Programacion\DIXUS`), sitio estático HTML/CSS/JS vanilla.
> **Destino:** Luxtime, monorepo pnpm — `apps/web` (Nuxt 3 + Vue 3 + Tailwind + Pinia + GSAP) y `apps/api` (NestJS + Prisma).
>
> **Regla de oro para el modelo ejecutor:** DIXUS es HTML/CSS/JS plano; Luxtime es Nuxt/Vue con SSR y una API real. NO copies HTML/JS tal cual: **traduce** cada pantalla a componentes/páginas Vue y conecta la lógica a la API NestJS existente. Conserva valores CSS exactos (colores, tamaños, easings, keyframes).

---

## 0. Instrucciones de ejecución (para el modelo)

1. Lee este documento completo antes de tocar código.
2. Respeta el sistema de diseño de la sección 2 **al pie de la letra** (valores exactos).
3. Implementa las animaciones de la sección 4 con los mismos keyframes/durations/easings.
4. Construye las páginas de la sección 5 mapeadas a rutas Nuxt existentes de Luxtime.
5. Conecta la funcionalidad de la sección 6 a la API de Luxtime (no a globals ni localStorage salvo el carrito).
6. Aplica la adaptación de marca de la sección 7 (Luxtime, no DIXUS).
7. No inventes rutas/campos: usa el modelo de datos real de Luxtime (Prisma) y, donde DIXUS tenga campos que Luxtime no tiene, usa el mapping de la sección 8.

---

## 1. Comparativa de stacks

| Aspecto | DIXUS (origen) | Luxtime (destino) |
|---|---|---|
| Frontend | HTML estático + CSS + JS vanilla (globals/IIFE) | Nuxt 3 + Vue 3 SFC + Tailwind |
| Estado | `localStorage` + arrays globales | Pinia stores + `useAsyncData` |
| Animaciones | CSS `@keyframes` + IntersectionObserver + tilt manual | CSS + composable `useReveal` + GSAP |
| Datos catálogo | `js/manual/products.js` (array global) | API NestJS `/catalog` (Prisma/Postgres) |
| Carrito | `localStorage 'dixus_cart'` | Pinia `stores/cart.ts` (ya existe, `localStorage 'luxtime-cart'`) |
| Checkout | POST `/api/checkout/quote` → WhatsApp | API Luxtime + WhatsApp (ya existe integración) |
| Certificado | `vault.html?serial=` → `/api/vault/lookup` | `/certificado/[slug]` → `/certificates/public/:slug` (ya existe) |
| Admin | SPA inline + export `.js` manual | `apps/web/pages/admin/*` + API con persistencia real |
| Fuentes | Cormorant Garamond + Montserrat | **Iguales** (Luxtime ya las carga) |

> **Ventaja:** Luxtime ya usa Cormorant Garamond + Montserrat y ya tiene stores de carrito/wishlist, API de catálogo, certificados, checkout WhatsApp y panel admin. Esta réplica es sobre todo **capa visual + animaciones + estructura de páginas**, reutilizando el backend existente.

---

## 2. SISTEMA DE DISEÑO (valores exactos)

### 2.1 Tokens de color (CSS variables)

Definir en `apps/web/assets/css/tokens.css` (variante "Onyx & Oro" de Luxtime debe usar estos valores exactos):

```css
:root {
  --black:      #0A0A0A;  /* body, hero, footer */
  --black-2:    #111111;  /* marquee, products, newsletter, modal, drawer */
  --black-3:    #1A1A1A;  /* product cards, contenedores de imagen */
  --gold:       #C8A96E;  /* acentos, CTAs, precios, bordes activos */
  --gold-light: #E2C98A;  /* hovers, títulos legales, stats hover */
  --gold-dark:  #9A7A45;  /* suffix stats, eyebrow de premio */
  --white:      #F5F0E8;  /* texto principal */
  --white-dim:  #B8B0A0;  /* texto secundario, nav links */

  --font-display: 'Cormorant Garamond', serif;
  --font-body:    'Montserrat', sans-serif;
}
```

**Colores funcionales** (no tokenizados en DIXUS, úsalos literales donde apliquen):
- WhatsApp: `#25D366`, hover `#1fbe5a`.
- Error: `#ff5555` / `#ff8888`.
- Garantía activa (vault): `#4CDF8B`.
- Gradiente bespoke: `#050505`.

**Oro translúcido** (patrón dominante para bordes/glows) — `rgba(200,169,110, α)` con α ∈ {0.03, 0.04, 0.06, 0.08, 0.1, 0.12, 0.15, 0.18, 0.2, 0.22, 0.25, 0.3, 0.35, 0.4, 0.55, 0.65, 0.75}.

### 2.2 Tipografía

Import (Luxtime ya lo tiene en `nuxt.config.ts`; verificar pesos):

```
Cormorant Garamond: 300, 400, 600 + italic 400
Montserrat: 200, 300, 400, 600
```

Roles:
- **Display / títulos / precios** → `--font-display` (Cormorant), pesos 300/400/600.
- **Body / UI / labels** → `--font-body` (Montserrat), pesos 200/300/400/600.

**Escala tipográfica exacta** (clase → tamaño / peso / letter-spacing / line-height):

| Clase | font | size | weight | letter-spacing | line-height |
|---|---|---|---|---|---|
| `.nav-logo` | display | 28px | 600 | 0.15em | — |
| `.nav-links a` | body | 11px | 400 | 0.2em | — (uppercase) |
| `.nav-wholesale a` | body | 11px | 600 | 0.2em | — (uppercase) |
| `.hero-eyebrow` | body | 10px | 400 | 0.4em | — (uppercase, gold) |
| `.hero-title` | display | clamp(80px,12vw,160px) | 300 | 0.05em | 0.9 |
| `.hero-title .gold` | display | inherit | 600 | — | — (color gold) |
| `.hero-subtitle` | display | clamp(16px,2.5vw,26px) | 300 italic | 0.1em | — (white-dim) |
| `.hero-tags` | body | 10px | — | 0.25em | — (uppercase) |
| `.hero-scroll` | body | 9px | — | 0.3em | — (uppercase) |
| `.btn-primary` / `.btn-ghost` | body | 11px | 600 / 400 | 0.25em | — (uppercase) |
| `.section-label` | body | 10px | 400 | 0.4em | — (uppercase, gold) |
| `.section-title` | display | clamp(36px,5vw,64px) | 300 | — | 1.1 |
| `.section-body` | body | 13px | — | 0.02em | 1.9 (max-width 480px) |
| `.marquee-item` | body | 11px | — | 0.3em | — (uppercase) |
| `.products-tag` | body | 9px | — | 0.3em | — (uppercase) |
| `.products-name` | display | 22px | 400 | — | — |
| `.products-ref` | body | 10px | — | 0.1em | — |
| `.products-price` | display | 26px | 300 | — | — (sup: 14px) |
| `.feature-num` | display | 80px | 300 | — | 1 |
| `.feature-title` | display | 28px | 400 | — | — |
| `.feature-text` | body | 13px | — | — | 1.9 |
| `.statement-text` | display | clamp(32px,5vw,64px) | 300 | — | 1.2 (max 900px) |
| `.footer-brand .brand-name` | display | 36px | 600 | 0.1em | — |
| `.footer-col h4` | body | 10px | — | 0.3em | — (uppercase) |
| `.footer-col a` | body | 12px | — | 0.05em | — |
| `.detail-title` | display | 36px (24px móvil) | 400 | — | 1.2 |
| `.detail-price` | display | 32px (24px móvil) | 600 | — | — |
| `.cart-title` | display | 28px | 300 | 0.05em | — |
| `.cdown-num` | display | clamp(32px,3.5vw,44px) | 300 | 0.02em | 1 (tabular-nums) |

`html { scroll-behavior: smooth; }`

### 2.3 Layout

```css
*, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
html { overflow-x:hidden; width:100vw; }
section, footer { width:100%; max-width:100vw; overflow-x:hidden; }
```

- **Sección genérica:** `padding: 120px 60px;` → móvil `80px 24px`.
- **Nav fija:** `padding: 28px 60px` → scrolled `18px 60px` → móvil `20px 24px` / scrolled `14px 24px`.
- **Hero:** `height: 100vh`, flex centrado.

**Grids clave:**

| Grid | columnas (desktop→móvil) | gap |
|---|---|---|
| `.products-grid` / `.catalog-grid` | 6 → 4 (≤1200) → 3 (≤992) → 2 (≤768) | 2px |
| `.features-section` | 1fr 1fr → 1fr | 0 (bloques padding 100px 80px) |
| `.newsletter-section` | 1fr 1fr → 1fr | 80px → 40px |
| `.footer-grid` | 2fr 1fr 1fr 1fr → 1fr 1fr | 60px → 40px |
| `.nosotros-stats` | 4 → 2 → 2 | 0 |
| `.detail-wrapper` | 1fr 1fr → 1fr | 40px → 1.25rem |

**Anchos máximos:** section-body 480px · statement 900px · product-detail 900px · cart-drawer 420px (100vw móvil) · legal-page 820px · login-shell 420px.

**Z-index:** hero-grid/glow 0 · nav-menu-mobile 50 · nav/hamburger 100 · cart-overlay 900 · modal/cart-drawer 1000 · whatsapp-float 99999 · cookie-banner 100000.

**Breakpoints:** 480, 576, 768, 769 (min desktop), 992, 1024, 1200.

### 2.4 Componentes UI (resumen de estilos clave)

- **Navbar:** fondo `linear-gradient(to bottom, rgba(10,10,10,0.95), transparent)`; `.scrolled` (scrollY>60) → `rgba(10,10,10,0.97)` + `border-bottom:1px solid rgba(200,169,110,0.15)`. Links con underline animado `::after` (width 0→100%, height 1px, bottom -4px, gold). Gap 40px.
- **Botón WhatsApp navbar (Socios/Wholesale):** `padding:8px 18px`, `border:1px solid var(--gold)`, border-radius 0, transparente; hover → bg `--gold-light`, color `#0A0A0A`, `box-shadow:0 0 18px rgba(200,169,110,0.35)`, `translateY(-1px)`.
- **Botones:** `.btn-primary` `padding:16px 42px`, bg gold, hover gold-light + `translateY(-2px)` + shadow `0 12px 40px rgba(200,169,110,0.25)`. `.btn-ghost` transparente, border `1px rgba(245,240,232,0.25)`, hover border/color gold + `translateY(-2px)`.
- **Marquee:** section `padding:30px 0`, borders top/bottom gold 15%, bg black-2; track flex gap 60px, `animation: marquee 25s linear infinite`; separador dot 4×4px gold. **Requiere duplicar el contenido en el DOM** para loop seamless.
- **Product card:** `background: --black-3`, overflow hidden, cursor pointer; img container `aspect-ratio:3/4`, hover container `scale(1.02)`, img hover `translateY(-10px)` (home) / `-8px` (catálogo), `object-fit:contain`, drop-shadow `0 15px 30px rgba(0,0,0,0.6)`; info `padding:24px`, border-top gold 10%; `.badge-limited` absolute top/right 20px, bg gold, texto negro, `padding:6px 12px`, size 9px.
- **Modal producto:** overlay `rgba(0,0,0,0.85)` + `backdrop-filter: blur(8px)`, z 1000; content bg black-2, max-width 900px, border-radius 4px, `max-height: calc(100dvh - 40px)`; grid 2col gap 40px → 1col móvil; close 40×40px.
- **Carrito drawer:** overlay `rgba(0,0,0,0.65)` blur 3px, fade `opacity 0.4s`; drawer 420px, `translateX(100%→0)` en `0.45s cubic-bezier(0.25,0.46,0.45,0.94)`; item img 64×80px; qty btn 26×26px; WhatsApp btn `#25D366` hover `#1fbe5a` + `translateY(-1px)`.
- **Cookie banner:** fixed bottom, `padding:20px 24px`, `rgba(10,10,10,0.97)` blur 10px; hidden `translateY(100%)` opacity 0 (remover DOM tras 450ms).
- **WhatsApp float:** fixed `right:20px; bottom:clamp(100px,14vh,130px)`; size `clamp(58px,7vw,88px)`; `animation: whatsappPulse 3s infinite`; hover `translateY(-6px) scale(1.10)`.

### 2.5 Responsive (media queries a replicar)

- `≤1200`: products-grid 4 cols · `≤992`: 3 cols · `≤768`: 2 cols.
- `≤768`: nav padding 20/24; section 80/24; features 1col; newsletter 1col gap 40; footer 2col gap 40; hamburger visible + nav-links hidden.
- `≥769`: hamburger + menú móvil ocultos.
- Modal `≤768`: align start, 1col, title/price 24px, imagen 1/1 max 340px.
- Cart `≤768`: drawer 100vw.

---

## 3. NAVEGACIÓN Y LAYOUT COMPARTIDO

### 3.1 Navbar (mapear a `apps/web/components/layout/AppNav.vue`)
- Logo `LUXTIME ·` (Cormorant 28px, gold; el punto/último caracter puede ir en white).
- Links desktop (`.nav-links`, 11px uppercase, gap 40px). Home ancla a secciones: `#coleccion`, `#nosotros`, `#contacto`, `#sorteos`, y botón **Socios Élite** (`.nav-wholesale` → `/mayoristas`).
- Carrito `.nav-cart` con SVG bolsa + `Bolsa (N)`.
- Hamburguesa móvil (`.navbar-hamburger`, 3 barras 24×2px; active → X). Panel `.nav-menu-mobile` fullscreen, gradient `135deg var(--black)→var(--black-2)`, `animation: slideDown 0.3s ease`.
- `.scrolled` cuando `scrollY > 60`.

### 3.2 Footer (mapear a `apps/web/components/layout/AppFooter.vue`)
- Grid `2fr 1fr 1fr 1fr`. Columna marca + columnas: **Colección**, **Legal**, **Marca**, **Compra**.
- Bottom: `© 2026 LUXTIME. Todos los derechos reservados.` + legal (Privacidad · Cookies) + redes (Instagram · TikTok · Facebook).
- Texto marca: `LUXTIME` / `Luxury Timepieces` / *"Relojes de lujo para quienes viven con intensidad. Elegance · Presence · Estilo. Desde Bucaramanga para todo Colombia."*

### 3.3 Overlays globales (en `layouts/default.vue`)
- `<WhatsAppFloat />` (páginas públicas de venta/legales; NO en certificado/admin/checkout-limpio).
- `<CookieConsent />` (ya existe en Luxtime).
- Cart drawer (inyectado por el store/comp de carrito).

---

## 4. ANIMACIONES (keyframes exactos + comportamiento)

Definir keyframes en `assets/css/base.css` (o `variants.css`). Copiar textualmente:

```css
@keyframes whatsappPulse { 0%{transform:scale(1)} 50%{transform:scale(1.05)} 100%{transform:scale(1)} }
@keyframes scrollAnim { 0%,100%{transform:scaleY(0);transform-origin:top} 50%{transform:scaleY(1);transform-origin:top} }
@keyframes fadeUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
@keyframes marquee { from{transform:translateX(0)} to{transform:translateX(-50%)} }
@keyframes spinLoader { from{transform:rotate(0)} to{transform:rotate(360deg)} }
@keyframes sringPulse { 0%,100%{opacity:.4;transform:scale(1)} 50%{opacity:1;transform:scale(1.04)} }
@keyframes watchFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
@keyframes livePulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.8)} }
@keyframes floatWatch { 0%{transform:translateY(0) rotate(0)} 50%{transform:translateY(-20px) rotate(0)} 100%{transform:translateY(0) rotate(0)} }
@keyframes slideDown { from{opacity:0;transform:translateY(-20px)} to{opacity:1;transform:translateY(0)} }
@keyframes fadeIn { from{opacity:0} to{opacity:1} }
@keyframes fadeInUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
```

**Aplicación de `animation:`**

| Elemento | animation | dur | delay | easing | iter |
|---|---|---|---|---|---|
| `.hero-eyebrow` | fadeUp | 1s | 0.3s | ease | forwards |
| `.hero-title` | fadeUp | 1s | 0.5s | ease | forwards |
| `.hero-subtitle` | fadeUp | 1s | 0.7s | ease | forwards |
| `.hero-divider` | fadeUp | 1s | 0.9s | ease | forwards |
| `.hero-tags` | fadeUp | 1s | 1.1s | ease | forwards |
| `.hero-cta` | fadeUp | 1s | 1.3s | ease | forwards |
| `.hero-scroll` | fadeUp | 1s | 1.5s | ease | forwards |
| `.scroll-line` | scrollAnim | 2s | — | ease-in-out | infinite |
| `.whatsapp-float` | whatsappPulse | 3s | — | — | infinite |
| `.marquee-track` | marquee | 25s | — | linear | infinite |
| `.sring-1/2/3` | sringPulse | 3s | 0/1s/2s | ease-in-out | infinite |
| `.sorteos-watch-float` | watchFloat | 4s | — | ease-in-out | infinite |
| `.live-dot` | livePulse | 1.5s | — | ease-in-out | infinite |
| `.nav-menu-mobile` | slideDown | 0.3s | — | ease | 1 |

**Transitions clave (mismos valores):**
- `nav` all 0.4s · `.nav-links a::after` width 0.3s · `.nav-wholesale a` all 0.4s cubic-bezier(0.16,1,0.3,1).
- `.btn-primary/.btn-ghost` all 0.3s · `.whatsapp-float` all 0.35s.
- `.products-img` transform 0.6s ease · `.products-img img` transform 0.5s cubic-bezier(0.25,1,0.5,1).
- `#cart-drawer` transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94) · `#cart-overlay` opacity 0.4s.
- `.pillar-body` max-height 0.55s cubic-bezier(0.25,0.46,0.45,0.94).
- `.nstat-bar-fill` width 1.4s cubic-bezier(0.25,0.46,0.45,0.94).
- `#dixus-cookie-banner` transform,opacity 0.4s.

**Scroll / reveal (usar `useReveal` de Luxtime, IntersectionObserver):**
- `.reveal` inicial `opacity:0; translateY(40px)` → `.visible` `opacity:1; translateY(0)` (transition 0.8s ease). En páginas tipo "sorteos" el offset es 30px, easing ease-out. Threshold 0.12 (0.1 en catálogo/sorteo).
- **Nav scroll:** `.scrolled` en scrollY>60.
- **Nosotros:** línea top `scaleX(0→1)` (threshold 0.5); stats con barras y **count-up** (interval 16ms, duración 1200ms si <50, 1800ms si ≥50); primer `.pillar` auto-activo tras 600ms; header pillar con tilt 3D `perspective(800px) rotateY(±2deg)` en mousemove.
- **Add to cart feedback:** botón `+` → `✓`, bg gold, revierte a los 1500ms.
- **Countdown:** actualiza `#days/#hours/#minutes/#seconds` cada 1s; al finalizar cambia el badge a "Sorteo finalizado".

**Easings del sistema:** `cubic-bezier(0.16,1,0.3,1)` (premium), `cubic-bezier(0.25,1,0.5,1)` (imágenes), `cubic-bezier(0.25,0.46,0.45,0.94)` (drawer/accordion/barras).

> **GSAP:** úsalo para el escalonado del hero y reveals complejos si se desea, pero los tiempos/curvas deben coincidir con la tabla anterior.

---

## 5. PÁGINAS (mapping DIXUS → rutas Nuxt de Luxtime)

| DIXUS | Ruta Nuxt Luxtime | Estado en Luxtime |
|---|---|---|
| `index.html` | `apps/web/pages/index.vue` | Existe → rediseñar a estructura DIXUS |
| `views/catalogo.html` | `apps/web/pages/catalogo/index.vue` | Existe → añadir filtros/búsqueda/sort/load-more + modal |
| Modal producto | Componente `components/catalog/ProductDetailModal.vue` **+** `pages/producto/[slug].vue` | Detalle ya existe como página; añadir modal rápido |
| `views/vault.html` | `apps/web/pages/certificado/[slug].vue` | Existe (`/certificates/public/:slug`) → aplicar UI vault |
| `views/mayoristas.html` | `apps/web/pages/mayoristas.vue` | Crear |
| `views/sorteos-info.html` | `apps/web/pages/sorteos.vue` | Crear (opcional según negocio) |
| `views/politica-cookies.html` | `apps/web/pages/legal/cookies.vue` | Crear (Luxtime tiene terminos/privacidad) |
| `views/politica-privacidad.html` | `apps/web/pages/legal/privacidad.vue` | Existe |
| `views/admin.html` | `apps/web/pages/admin/*` | Existe (más completo con API real) |
| `views/admin-login.html` | `apps/web/pages/admin/login.vue` (o auth existente) | Usar auth existente |

### 5.1 Home (`index.vue`) — secciones en orden
1. WhatsApp flotante.
2. Nav + menú móvil (5 anclas + Socios Élite).
3. **Hero:** eyebrow `Luxury Timepieces · Colombia`; H1 `LU``X``TIME` con la letra central en `.gold`; subtitle `Elegance · Presence · Style`; tags `Relojes de lujo ◆ Diseño exclusivo ◆ Envíos a todo Colombia`; CTA **Ver colección** → `/catalogo` (`.btn-primary`); divider; scroll indicator animado.
4. **Marquee** con términos de marca (duplicado para loop).
5. **Colección destacada** `#coleccion`: label `Colección 2026`, H2 `Nuestros relojes` (em en *relojes*), CTA **Ver todo**, grid de destacados (API `catalog/best-sellers` o `featured`).
6. **Modal detalle** (componente compartido).
7. **Nosotros** `#nosotros`: intro + stats (4 `.nstat` con count-up) + acordeón de 4 `.pillar`.
8. **Statement:** bloque dorado con frase de marca.
9. **Newsletter/Contacto** `#contacto`: form de suscripción (conectar a API marketing/waitlist o Resend de Luxtime, no Brevo).
10. **Sorteos** `#sorteos`: badge live + countdown + pasos + CTAs (si el negocio Luxtime lo mantiene; si no, omitir esta sección y su nav item).
11. Footer.

### 5.2 Catálogo (`catalogo/index.vue`)
- Hero catálogo (label, H1 `Nuestros relojes`, contador `N modelos disponibles`).
- **Filtros:** marca, clase/categoría, género, orden (Novedades / Precio ↓ / Precio ↑), búsqueda (debounce 250ms).
- **Grid** 6 cols con "Cargar más" (page size 24).
- **Banner encargo:** si búsqueda sin resultados → hero de encargo con CTA WhatsApp; si hay resultados → banner secundario.
- Modal producto.

### 5.3 Certificado (`certificado/[slug].vue`)
- Loader `LUXTIME VAULT` + barra.
- Card: badge **Certificado de Autenticidad**, `Pieza registrada exclusivamente para {owner}`, imagen, tabla (Modelo, Colección, Referencia, Código Serial en dorado, Fecha, Garantía con estado verde/gris).
- Datos desde `/certificates/public/:slug` (ya existe en Luxtime).

### 5.4 Mayoristas (`mayoristas.vue`)
- Header de marca simple.
- Manifiesto B2B.
- 3 planes (Esencial / Kit Corporativo / Solución Llave en Mano "Full Élite"), mín. 6 unidades, CTAs WhatsApp de cotización.
- Bloque bespoke + disclaimer de exclusividad VIP.

### 5.5 Legales
- `.legal-page` max 820px, H1 + fecha de actualización + secciones h2. Adaptar textos a Luxtime (responsable, Habeas Data Colombia/SIC).

---

## 6. FUNCIONALIDAD (mapear a API/stores de Luxtime)

### 6.1 Catálogo
- Cargar productos vía `useCatalogData()` → API `/catalog` (ya existe). NO usar arrays globales.
- Filtros por marca/categoría/género + orden (`price-asc`/`price-desc`/`newest`) + búsqueda (name/ref/tag) + paginación client-side por `visibleLimit` (24, +24 por click).
- Card: imagen optimizada (Cloudinary/servicio de imágenes de Luxtime), precio `toLocaleString('es-CO')`, badge opcional.

### 6.2 Detalle de producto
- Página `producto/[slug].vue` (SSR + SEO) **y** modal rápido desde las cards.
- Mostrar: nombre, tag/colección, ref, género, precio COP, badge, imagen.
- Bloque fijo "Tu Experiencia Luxtime incluye": estuche luxury, tarjeta de autenticidad PVC QR, paño microfibra, solución limpiadora, batería de repuesto.
- CTAs: **Agregar al carrito** y **Consultar por WhatsApp**.
- Deep link `?id=`/slug abre modal al cargar.

### 6.3 Carrito (usar `stores/cart.ts` existente)
- Persistencia localStorage (`luxtime-cart` ya definido).
- Añadir/quitar/cantidades (1–99), total, contador en nav `Bolsa (N)`.
- Drawer lateral con animación (sección 2.4/4).
- Checkout → WhatsApp (usar integración WhatsApp de Luxtime; construir mensaje en servidor con items + total).
- Feedback visual `animateAddBtn` (+ → ✓, 1500ms).

### 6.4 Certificado / Vault
- Lookup por serial/slug → API certificados de Luxtime. Cálculo de vigencia de garantía (fecha compra + meses → "Vigente" verde / "Expirada" gris).

### 6.5 WhatsApp
- Número y mensajes por config (Luxtime usa settings/whatsapp). Enlaces `wa.me/<num>?text=<encoded>`. Elementos con `data-wa-message` reciben href.
- Mensajes: consulta de producto (SKU, ref, precio) y carrito (items + subtotales + total). El "ticket de sorteo" es opcional según negocio.

### 6.6 Cookie consent
- Ya existe (`components/layout/CookieConsent.vue`). Comportamiento: persistir preferencia (`essential`/`all`), ocultar con transición, no activar analytics en cliente sin consentimiento.

### 6.7 Nav/menú
- Menú móvil toggle; `.scrolled` en scroll; smooth scroll a anclas; reveal global.

### 6.8 Admin
- Usar panel admin existente de Luxtime (con API y persistencia real en Postgres). NO replicar el flujo "exportar .js" de DIXUS. Mantener secciones equivalentes: catálogo/productos, marcas, categorías, certificados (bóveda), mayoristas, y adicionales de Luxtime (reseñas, correo, segmentos, auditoría).

---

## 7. ADAPTACIÓN DE MARCA (DIXUS → LUXTIME)

| DIXUS | Luxtime |
|---|---|
| DIXUS / `DI[X]US` | LUXTIME / `LU[X]TIME` (letra central en gold) |
| dixustime (redes) | usar handles reales de Luxtime |
| `wa.me/573112461526` | número WhatsApp de Luxtime (desde settings) |
| Cloudinary `dgfrpksb4` | servicio de imágenes de Luxtime |
| "Luxury Timepieces" | mantener (encaja con Luxtime) |
| Bucaramanga / Colombia | mantener |
| localStorage `dixus_cart` / `dixus_cookie_consent` | `luxtime-cart` / clave equivalente Luxtime |
| Vercel + `/api/*` serverless | API NestJS de Luxtime |

**Mantener idéntico:** paleta, tipografía, tamaños, keyframes, easings, estructura de secciones, microinteracciones.

---

## 8. MAPPING DE MODELO DE DATOS (DIXUS → Prisma Luxtime)

DIXUS producto (array global) → Luxtime `Watch` (Prisma). Correspondencias:

| Campo DIXUS | Equivalente Luxtime |
|---|---|
| `id` (`DX-NNN`) | `id` / `slug` |
| `name` | `model` (+ `brand.name`) |
| `tag` | colección/categoría o campo `tag` |
| `brand` (id) | relación `brand` |
| `price` (COP) | `retailPrice` (y `wholesalePrice` para mayorista) |
| `ref` | `reference`/`slug` |
| `image` | `frontImageUrl` (+ `backImageUrl`) |
| `bgColor` | opcional (no presente en Luxtime; omitir o añadir si se desea) |
| `visible` | `isActive` |
| `featured` | destacado/best-seller |
| `category` | categoría/clase |
| `genero` | género (Hombre/Mujer/Unisex) — añadir si no existe |
| `badge` `{text,style}` | badge opcional (añadir si no existe) |

**Certificado/Vault** DIXUS → Luxtime `Certificate`: `owner`, `watchName`(model), `tag`, `ref`, `serial`(→slug/código), `purchaseDate`, `warrantyMonths`, `image`. Luxtime ya genera QR por ítem al pasar la orden a `PAGADO`.

**Diferencias a respetar:** DIXUS no tiene stock, galería múltiple, variantes ni specs JSON (cada variante es un producto). Luxtime **sí** tiene stock y más campos: no los elimines; solo asegúrate de que la UI replicada muestre lo que DIXUS muestra y aproveche lo extra de Luxtime donde tenga sentido (p.ej. estado de stock, waitlist).

---

## 9. CHECKLIST DE RÉPLICA (para el modelo ejecutor)

- [ ] Tokens de color/tipografía exactos en `tokens.css`.
- [ ] Fuentes con los pesos correctos cargadas.
- [ ] Keyframes (sección 4) en CSS global.
- [ ] `AppNav` con underline animado, scrolled, menú móvil slideDown, carrito.
- [ ] `AppFooter` con grid 2fr/1fr/1fr/1fr y contenido de marca Luxtime.
- [ ] Home: hero escalonado, marquee, colección, nosotros (stats count-up + acordeón), statement, newsletter, (sorteos), footer.
- [ ] Catálogo: filtros + búsqueda debounce + sort + load-more(24) + modal + banner encargo.
- [ ] Modal producto + página `producto/[slug]` con bloque "Experiencia Luxtime".
- [ ] Carrito drawer con animación y checkout WhatsApp.
- [ ] Certificado con UI vault (loader + card + tabla + garantía).
- [ ] Mayoristas (3 planes + bespoke + disclaimer).
- [ ] Legales con `.legal-page`.
- [ ] WhatsApp float + cookie consent en layout.
- [ ] Reveal on scroll (`useReveal`) en todas las secciones.
- [ ] Responsive según media queries (sección 2.5).
- [ ] Toda la data desde la API de Luxtime (no globals; carrito en localStorage).
- [ ] Marca adaptada a Luxtime (sección 7).

---

## 10. REFERENCIAS DE ARCHIVOS FUENTE DIXUS (por si se necesita revisar el original)

- CSS: `css/style.css` (global), `product-detail.css`, `cart.css`, `cookie-consent.css`, `sorteo.css`, `admin-login.css`.
- HTML: `index.html`, `views/catalogo.html`, `views/vault.html`, `views/mayoristas.html`, `views/sorteos-info.html`, `views/politica-*.html`, `views/admin*.html`.
- JS: `js/script.js`, `nav-menu.js`, `render.js`, `catalogo-page.js`, `product-detail.js`, `cart.js`, `vault.js`, `sorteo.js`, `countdown.js`, `cookie-consent.js`, `whatsapp-links.js`, `dixus-config.js`, `dixus-utils.js`, `admin-controller.js`, `admin-auth.js`, `manual/*.js`, `lib/*.js`.

> Nota: DIXUS resuelve checkout/vault/admin con funciones serverless propias. En Luxtime, el equivalente ya existe en `apps/api` (NestJS). No portar el backend de DIXUS: conectar la UI replicada a la API de Luxtime.
