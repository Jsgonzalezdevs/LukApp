# Auditoría del sistema de diseño — LukApp web → Android (Kotlin + Compose)

Fuente: código de **LukApp v10.14.0** (`src/version.ts:43`). Todos los valores están copiados
del código; cada fila lleva `ruta:línea`. Rutas relativas a la raíz del repo.
`L` = `src/features/lukapp/lukapp.css`, `C` = `src/features/lukapp/components/`.

---

## 1. Tokens de color

### 1.1 Dónde viven y cómo se elige el tema

| Pieza | Detalle | Fuente |
|---|---|---|
| Raíz de tokens | Clase `.fin-html` en `<html>` (fijada en `index.html:2`), `<body class="fin-page">` | `index.html:2`, `index.html:192` |
| Tema claro (base) | `.fin-html { … }` | `L:21-113` |
| Oscuro por sistema | `@media (prefers-color-scheme: dark) { .fin-html:not([data-tema='claro']) {…} }` | `L:196-261` |
| Oscuro explícito | `.fin-html[data-tema='oscuro'] {…}` (bloque idéntico al anterior; un test exige que coincidan: `lukapp.tema.test.ts`) | `L:270-320` |
| Estado | `Tema = 'sistema' \| 'claro' \| 'oscuro'`, por defecto `sistema`, persistido en `localStorage['finanzas:tema']` | `src/features/lukapp/data/useTema.ts:3,13,26` |
| Aplicación | `sistema` **quita** el atributo `data-tema` (sigue al SO en vivo); `claro`/`oscuro` lo escriben | `useTema.ts:46-47` |
| Transición de tema | Añade `html.theme-transitioning` 300 ms → `transition: background-color/color/border-color/box-shadow 0.3s ease` | `useTema.ts:44-52`, `styles/premium-effects.css:164-168` |
| Selector UI | `TemaToggle`: radiogroup Claro (`Sun`) / Oscuro (`Moon`) / Sistema (`Monitor`), botones 24×24, icono 14px, activo `bg --fin-accent` | `C/TemaToggle.tsx:7-11,40-46` |
| `theme-color` | claro `#fbf9f6`; oscuro `#2a0141` | `index.html:154-155` |
| Paleta de marca (Tailwind `@theme`) | purple `#772aea`, lavender `#735ac2`, lime `#b6f246`, pink `#d4025a`; `fin-in #b6f246`, `fin-out #d4025a`, `fin-warn #fbbf24` | `src/index.css:15-26` |
| WebView Android actual | Fondo nativo `#1a1817`; inyecta `data-native="true"` y `--lukapp-native-safe-area-bottom` | `apps/mobile/src/App.tsx:30,35,51-54` |

### 1.2 Tabla completa de tokens `--fin-*` de color

| Token | Claro (`L:línea`) | Oscuro (`L:línea` en bloque explícito) |
|---|---|---|
| `--fin-bg` | `#fbf9f6` (26) | `#1a1817` (273) |
| `--fin-bg-blur` | `rgb(251 249 246 / 0.85)` (27) | `rgb(26 24 23 / 0.85)` (274) |
| `--fin-card` | `rgb(255 255 255 / 0.72)` (31) | `rgb(45 42 40 / 0.6)` (275) |
| `--fin-glass-bg` | `rgb(255 255 255 / 0.72)` (32) | `rgb(45 42 40 / 0.82)` (276) |
| `--fin-glass-border` | `rgb(255 255 255 / 0.55)` (33) | `rgb(255 255 255 / 0.12)` (277) |
| `--fin-soft` | `#f5f3f0` (34) | `#2c2a28` (278) |
| `--fin-line` | `#ede9e3` (35) | `#35322f` (279) |
| `--fin-scrim` | `rgb(28 25 23 / 0.4)` (36) | `rgb(0 0 0 / 0.6)` (280) |
| `--fin-bg-soft` | `#f7f5f2` (41) | `#221f1e` (281) |
| `--fin-surface` | `#ffffff` (42) | `#2d2a28` (282) |
| `--fin-resumen-superficie` | `#fffdfa` (43) | `#292624` (283) |
| `--fin-card-hover` | `#efece7` (44) | `#3a3734` (284) |
| `--fin-guia-card` | `rgb(255 255 255 / 0.92)` (49) | `rgb(24 22 21 / 0.94)` (285) |
| `--fin-glass-filter` | `blur(28px) saturate(180%)` (57) | (hereda) |
| `--fin-glass-highlight` | `rgb(255 255 255 / 0.55)` (58) | `rgb(255 255 255 / 0.12)` (287) |
| `--fin-glass-shadow` | `0 20px 45px -20px rgb(28 25 23 / 0.28)` (59) | `0 24px 50px -18px rgb(0 0 0 / 0.55)` (288) |
| `--fin-premium-lens-surface` | `rgb(255 255 255 / 16%)` (60) | `rgb(35 25 48 / 28%)` (289) |
| `--fin-premium-lens-fill` | `linear-gradient(140deg, rgb(255 255 255/16%), rgb(196 167 230/6%) 48%, rgb(139 92 246/3%))` (61) | `linear-gradient(140deg, rgb(255 255 255/8%), rgb(171 133 208/7%) 48%, rgb(38 24 54/12%))` (290) |
| `--fin-premium-lens-border` | `rgb(255 255 255 / 30%)` (62) | `rgb(255 255 255 / 23%)` (291) |
| `--fin-premium-lens-specular` | `rgb(255 255 255 / 18%)` (63) | `rgb(236 220 255 / 20%)` (292) |
| `--fin-premium-lens-rim` | `rgb(255 255 255 / 56%)` (64) | `rgb(255 255 255 / 45%)` (293) |
| `--fin-premium-lens-bottom-rim` | `rgb(84 48 121 / 14%)` (65) | `rgb(0 0 0 / 30%)` (294) |
| `--fin-premium-lens-glow` | `0 8px 28px -17px rgb(129 67 194 / 36%)` (66) | `0 8px 30px -17px rgb(145 92 211 / 46%)` (295) |
| `--fin-ink` | `#1c1917` (69) | `#f5f3f0` (297) |
| `--fin-ink-soft` | `#68615b` (70) | `#c2bbb4` (298) |
| `--fin-ink-faint` | `#706963` (71) | `#b2aba4` (299) |
| `--fin-ink-ghost` | `#706963` (72) | `#aaa39b` (300) |
| `--fin-accent` | `#772aea` (76) | `#f5f3f0` (302) — **neutro en oscuro, a propósito** |
| `--fin-accent-hover` | `#631fc9` (77) | `#ffffff` (303) |
| `--fin-on-accent` | `#ffffff` (78) | `#1a1817` (304) |
| `--fin-on-in` | `#ffffff` (79) | `#1a1817` (305) |
| `--fin-on-out` | `#ffffff` (80) | `#1a1817` (306) |
| `--fin-in` (entró) | `#547c09` (89) | `#c3eb89` (308) |
| `--fin-in-bg` | `#f2fce0` (90) | `rgb(195 235 137 / 0.14)` (309) |
| `--fin-out` (salió) | `#d4025a` (91) | `#e27a97` (310) |
| `--fin-out-bg` | `#fdeaf1` (92) | `rgb(226 122 151 / 0.14)` (311) |
| `--fin-out-ink` | `#a4013f` (93) | `#e89bb2` (312) |
| `--fin-warn` (ámbar) | `#945100` (101) | `#fbbf24` (313) |
| `--fin-warn-bg` | `#fef3c7` (102) | `rgb(251 191 36 / 0.12)` (314) |
| `--fin-warn-ink` | `#92400e` (103) | `#fcd34d` (315) |
| `--fin-media-bg` | `#fff7ed` (104) | `rgb(251 146 60 / 0.12)` (316) |
| `--fin-media-ink` | `#c2410c` (105) | `#fdba74` (317) |
| `--fin-baja-bg` | `#fefce8` (106) | `rgb(250 204 21 / 0.12)` (318) |
| `--fin-baja-ink` | `#a16207` (107) | `#fde047` (319) |

No existen en CSS (aparecen referenciados sin definir): `--fin-accent-rgb` (`styles/premium-effects.css:23`).

### 1.3 Colores derivados y de categoría

| Uso | Valor | Fuente |
|---|---|---|
| Pestaña activa (fondo) | `color-mix(in srgb, var(--fin-accent) 12%, var(--fin-soft))` | `L:392-394` |
| Pestaña activa (icono) | `var(--fin-accent)` (`!important`, gana al inline) | `L:396-399` |
| Foco teclado | `outline 2px solid --fin-accent; offset 2px; radius --fin-r-control` | `L:469-477` |
| Anillo de input con foco | `0 0 0 3px color-mix(accent 18%, transparent)` | `L:797-801` |
| Tip del asesor | borde `color-mix(#772aea 20%, --fin-line)`, fondo `color-mix(#772aea 7%, --fin-resumen-superficie)` | `L:322-325` |
| Banner novedades | fondo `color-mix(accent 6%, surface)`, borde `color-mix(accent 15%, line)`, sombra `0 5px 14px rgb(28 25 23/.045)` | `L:404-410` |
| Aurora login | radiales `#772aea` y `#b6f246`, blur 80px, opacidad .5 (claro) / .32 (oscuro); oculta con `data-native` | `L:527-569`, `L:866-867` |
| Fondo dictado | `radial-gradient(120% 90% at 25% 8%, #ff5c92 0%, #d4025a 32%, #9a4fc7 60%, #772aea 100%)`, anima 9s | `styles/premium-effects.css:127-131` |
| Botón dictado Premium | `linear-gradient(125deg, #48146f 0%, #772aea 34%, #a443f5 58%, #5c1ba5 82%, #48146f 100%)`, 260%, 14s; sombra `0 10px 28px -8px rgb(105 30 190/65%)` | `styles/premium-effects.css:135-149` |
| Estrella IA | cuerpo `#735AC2`, extremidades `#4A0182` | `C/EstrellaAvatar.tsx:66-67` |

Colores de categoría base (`src/features/lukapp/types.ts:90-104`) + icono lucide (`types.ts:65-79`) + emoji (`categorias.ts:140-154`):

| Clave | Color | Icono lucide | Emoji |
|---|---|---|---|
| mercado | `#F59E0B` | ShoppingCart | 🥑 |
| comida | `#F97316` | Utensils | 🍔 |
| transporte | `#38BDF8` | Bus | 🚗 |
| servicios | `#A78BFA` | Lightbulb | 💡 |
| salud | `#EC4899` | Pill | 💊 |
| hogar | `#14B8A6` | Home | 🏠 |
| entretenimiento | `#C084FC` | Film | 💎 |
| ropa | `#6366F1` | Shirt | 👕 |
| educacion | `#3B82F6` | Book | 📚 |
| transferencia | `#94A3B8` | RefreshCw | 🔄 |
| ahorro | `#10B981` | PiggyBank | 🐷 |
| ingreso | `#22C55E` | DollarSign | 💰 |
| otros | `#A8A29E` | Package | 📦 |

Emoji por defecto/desconocida: `🏷️` (`categorias.ts:249,259,283`). Sugerencias por palabra clave (🐶🐱🐾🍕☕🍺🏋️🎮✂️👶🎁✈️🔧…): `categorias.ts:156-182`.
Render de emoji: familia `'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji','Android Emoji'`, peso 400, `line-height:1` (`L:517-522`) → en Android usar la fuente del sistema (Noto Color Emoji).

---

## 2. Tipografía

| Pieza | Valor | Fuente |
|---|---|---|
| Familia | `Poppins` (fallback `ui-sans-serif, system-ui, sans-serif`) — `--font-sans` y `--font-display` | `src/index.css:4-5` |
| Carga | Google Fonts: `Poppins:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=optional` (no hay archivos en `public/`, ni `@font-face`) | `index.html:169-171` |
| Pesos disponibles | 400, 500, 600, 700, 800, 400 itálica | `index.html:171` |
| Cifras | `tabular-nums` en montos (p.ej. `C/InicioView.tsx:325`, `C/Captura.tsx:700`) | — |

Escala tipográfica (tokens `font` shorthand, `L:148-161`):

| Token | Valor | Tracking | Oficio | Usos |
|---|---|---|---|---|
| `--fin-t-cifra` | `700 44px/1` | `-0.03em` | número grande, uno por pantalla | `C/InicioView.tsx:326`, `C/DineroView.tsx:81`, `C/MesView.tsx:190`, `C/Captura.tsx:700`, `C/DetalleMovimiento.tsx:96` (ResumenWrapped: `clamp(1.5rem,8vw,3.5rem)`) |
| `--fin-t-titulo-xl` | `600 28px/1.15` | `-0.02em` | título de pantalla | `C/HojaPanel.tsx:86`, `C/AjustesView.tsx:129` |
| `--fin-t-titulo` | `600 20px/1.2` | `-0.01em` | título de sección/tarjeta | `C/MesView.tsx:119` |
| `--fin-t-cuerpo-b` | `600 17px/1.3` | — | cuerpo destacado | — |
| `--fin-t-cuerpo` | `400 17px/1.4` | — | cuerpo por defecto | — |
| `--fin-t-secundario` | `400 15px/1.35` | — | texto explicativo | — |
| `--fin-t-pie` | `400 13px/1.3` | — | metadatos | — |

En la práctica las vistas usan Tailwind arbitrario (conteo en `*.tsx`): `text-[13px]`×580, `[15px]`×260, `[17px]`×179, `[20px]`×72, `[12px]`×31, `[28px]`×30, `[14px]`×27, `[44px]`×9. Además `.fin-page .text-xs` se fuerza a `13px/1.4` (`L:843`). Mínimo recomendado: 13px.
Ejemplo etiqueta: «Dinero disponible» `13px bold uppercase tracking-wider` en pastilla `--fin-soft/75` (`C/InicioView.tsx:286`).

---

## 3. Radios, sombras, espaciado y tamaños

| Token | Valor | Uso | Fuente |
|---|---|---|---|
| `--fin-r-control` | 12px | inputs, botones, cuadritos de icono (259 usos) | `L:166` |
| `--fin-r-card` | 20px | toda tarjeta y fila (275 usos) | `L:167` |
| `--fin-r-sheet` | 32px | hojas inferiores y modales (`rounded-t`) | `L:168` |
| `--fin-r-pill` | 9999px | pastillas, avatares, botones redondos | `L:169` |
| `--fin-e-1/2/3/4/6/8` | 4/8/12/16/24/32 px | rejilla de 4 | `L:175-180` |
| `--fin-tap` | 44px | mínimo táctil; aplicado a todo `button` (alto y ancho), `summary`, `input`, `select` | `L:184`, `L:835-841` |
| `--fin-nav-h` | 60px | alto de la barra inferior | `L:189` |

Sombras:

| Nombre | Valor | Fuente |
|---|---|---|
| `--fin-glass-shadow` | ver tabla 1.2 | `L:59/288` |
| `.fin-glass` | `background --fin-glass-bg; border 1px --fin-glass-border; box-shadow inset 0 1px 0 0 --fin-glass-highlight, --fin-glass-shadow`; **sin blur** | `L:339-349` |
| Barra inferior | `0 10px 28px rgb(0 0 0 / 0.12)` | `L:383` |
| Botón micrófono (no Premium) | `0 10px 28px -8px rgb(190 18 60 / 0.6)` | `C/BotonAnotar.tsx:368` |
| Hover tarjeta `rounded-3xl` | `0 12px 28px rgb(0 0 0 / 0.08)` | `L:781-784` |
| Hoja división | `0 -16px 44px rgb(20 16 12/0.18), --fin-glass-shadow` | `L:604` |
| Utilidades | `.shadow-soft 0 8px 32px rgba(0,0,0,.08)`, `.shadow-medium 0 12px 48px …12`, `.shadow-large 0 20px 64px …16` | `styles/premium-effects.css:4-14` |

Nota: todo `backdrop-blur` está anulado dentro de `.fin-root` salvo `.fin-premium-lens` (`L:353-357`). En Compose: superficies opacas/translúcidas sin blur.

Componentes frecuentes:

| Componente | Medidas | Fuente |
|---|---|---|
| Columna de contenido | `max-w 720px`, `px-4` (16), `pt = safe-top + 12px`, `pb = safe-bottom + 136px` (Ajustes: +80px) | `C/LukAppShell.tsx:83` |
| Hoja de pantalla completa (HojaPanel) | fondo `--fin-bg`, cabecera sticky con título `titulo-xl` y botón cerrar 36×36 pill `--fin-soft`, icono X 20px | `C/HojaPanel.tsx:68-100` |
| Hoja inferior (ConfirmSheet) | `max-h 92dvh`, `max-w-md` (448), `rounded-t 32px`, fondo `--fin-card`, `px-4 pt-4` | `C/ConfirmSheet.tsx:202` |
| Input de formulario | `rounded 20px`, `border-2 --fin-line`, `bg --fin-card`, `px-4 py-3`, 17px | `C/ConfirmSheet.tsx:78` |
| Aviso (offline/error) | `rounded 20px`, `bg --fin-warn-bg`, `px-4 py-3`, icono 16px, texto 13px | `src/features/lukapp/LukAppApp.tsx:997-1000` |
| Botones de cabecera Inicio | 34×34 (`h-8.5`), redondos, `bg --fin-soft`, icono 16px stroke 2.2 | `C/InicioView.tsx:294-308` |
| Selector de periodo | pastilla `px-4 py-2`, 15px semibold, `bg --fin-soft` | `C/InicioView.tsx:227` |
| Botón primario | `bg --fin-accent`, texto `--fin-on-accent`, pill, `px-6 py-3` semibold | `C/PantallaCarga.tsx:48` |
| Botón destructivo | `bg --fin-out`, texto `--fin-on-out`, pill, `px-4 py-2`, 15px semibold | `C/CajitaCard.tsx:268` |
| Deshabilitado | `opacity .55` (botón) / `.65` (input) | `L:846-849` |
| Iconos lucide | `stroke-width: 1.8` por defecto en `.fin-page .lucide` | `L:851` |

---

## 4. Shell de la app (`C/LukAppShell.tsx`)

- Raíz: `div.fin-root min-h-[100dvh] bg --fin-bg text --fin-ink` (`:72`).
- **No hay cabecera global**: cada vista pinta la suya (p.ej. `C/InicioView.tsx:225-310`: pastilla de periodo a la izquierda; racha, buscar (`Search`) y ajustes (`Settings2`) a la derecha). Si existe `onBack`, botón «Cambiar de app» (chevron SVG 18px, stroke 2.5, texto 12/13px semibold) (`:89-113`).
- Anuncio accesible `aria-live="polite"`: «Sección actual: …» (`:116`).

### 4.1 Barra de navegación inferior

| Propiedad | Valor | Fuente |
|---|---|---|
| Montaje | Portal a `document.body`, `<nav aria-label="Secciones" class="fin-navigation">` | `C/LukAppShell.tsx:126-161` |
| Forma | Cápsula flotante centrada: `position fixed; bottom: var(--fin-safe-area-bottom); left 50%; translateX(-50%); width min(320px, 100% − 32px); radius 999px; bg --fin-soft; sin borde; sombra 0 10px 28px rgb(0 0 0/.12); z-index 20; overflow hidden` | `L:367-385`, `L:361-363` |
| Contenido | fila `h = 60px`, `gap 8px`, `px 12px`, centrada | `C/LukAppShell.tsx:135` |
| Botón pestaña | 48×48, circular, sólo icono (etiqueta `sr-only` + `aria-label` + `title`) | `C/LukAppShell.tsx:148,156` |
| Icono | 24×24; stroke **2.5 activa / 2 inactiva**; color inline `--fin-ink` / `--fin-ink-faint` (el CSS fuerza `--fin-accent` en activa) | `C/LukAppShell.tsx:150-154`, `L:396-399` |
| Activa | `aria-current="page"`; fondo `color-mix(accent 12%, soft)`; `calendario` marca activa a `mes` | `C/LukAppShell.tsx:138`, `L:392-394` |
| Al tocar | `haptic 'selection'` + `audio 'selection'` | `C/LukAppShell.tsx:53-57` |
| Safe area | `--fin-safe-area-bottom = max(env(safe-area-inset-bottom), var(--lukapp-native-safe-area-bottom, 0px))`; con `data-native="true"` se fuerza a `0px` (el WebView ya lo descuenta) | `L:23`, `L:861` |
| `data-native` | además: `main` con `padding-top: clamp(1.25rem, 3vh, 1.75rem)`; oculta aurora/puntos/halo del login | `L:862-868` |

Orden exacto de pestañas (`src/features/lukapp/sections.ts:4-13`, lucide-react `^1.24.0`):

| # | id | Icono lucide | Etiqueta |
|---|---|---|---|
| 1 | `inicio` | `Home` | Inicio |
| 2 | `dinero` | `Wallet` | Dinero |
| 3 | `mes` | `BarChart3` | Mes |
| 4 | `asesor` | `UserCircle` | Asesor |
| 5 | `ajustes` | `Menu` | Más |

Sección extra fuera de la barra: `calendario` («Calendario financiero») (`sections.ts:15-18`).

### 4.2 Botón central / barra de anotar (`C/BotonAnotar.tsx`)

No hay botón central dentro de la nav; es una barra flotante aparte (portal), **oculta en `asesor` y `ajustes` y con cualquier modal abierto** (`LukAppApp.tsx:978-979`).

| Propiedad | Valor | Fuente |
|---|---|---|
| Posición | `fixed inset-x-0 z-30`, `bottom: calc(--fin-safe-area-bottom + --fin-nav-h + 0.75rem)` (= 12px sobre la nav), centrada, `gap 8px` | `C/BotonAnotar.tsx:228-230` |
| Grupo rápido | cápsula `.fin-glass` pill `bg --fin-card` (Premium: `.fin-premium-lens` con blur 26px saturate 1.8 y capas de brillo) con 3 botones 56×48 pill, iconos 20px stroke 2.5: `Keyboard` «Anotar a mano», `Camera` «Escanear comprobante o foto», `Search` «Buscar movimientos y funciones»; `active:scale-90` | `C/BotonAnotar.tsx:178-224,282-347` |
| Micrófono | `RippleButton` 64×64 pill, fondo `--fin-out` (Premium: gradiente animado), icono `Mic` 28px / `Square` 24px (escuchando, `animate-pulse`) / `Loader2` 24px giratorio; `active:scale-95`; ripple `rgba(255,255,255,0.55)`; opacidad .5 si procesando/bloqueado; insignia ✕ 20px `--fin-warn` si permiso denegado | `C/BotonAnotar.tsx:350-381` |

### 4.3 Transiciones entre pestañas

| Transición | Valor | Fuente |
|---|---|---|
| Cambio de sección | `AnimatePresence initial={false}` + `motion.div key={section}`: `opacity 0→1`, `0.18s easeOut`, **sin animación de salida** | `LukAppApp.tsx:1058-1066` |
| Hoja de pantalla (HojaPanel) | `opacity 0→1, y 16→0`, salida inversa, `0.2s easeOut` | `C/HojaPanel.tsx:68-72` |
| Hoja inferior (ConfirmSheet) | velo `opacity 0→1 0.15s`; hoja `y 24→0, opacity 0→1, 0.2s easeOut` | `C/ConfirmSheet.tsx:185-198` |
| Menú de periodo | spring `stiffness 720, damping 32, mass 0.42`, `scaleY .72→1, y -5→0`, origen arriba | `C/InicioView.tsx:236` |
| Al cerrar captura | `scrollTo top 0` (sin animación) | `LukAppApp.tsx:440-443` |

---

## 5. Iconografía

- Librería: **lucide-react `^1.24.0`** (`package.json:27`); animaciones con **framer-motion `^12.42.2`** (`package.json:26`). Stroke por defecto 1.8 (`L:851`); en controles se usa 2–2.5.
- El único SVG a mano del shell es el chevron «Cambiar de app» (`path d="m15 18-6-6 6-6"`, `C/LukAppShell.tsx:97-110`, equivale a `ChevronLeft`).

| Pantalla | Iconos lucide importados | Fuente |
|---|---|---|
| Barra | Home, Wallet, BarChart3, UserCircle, Menu | `sections.ts:4` |
| Barra anotar | Camera, Loader2, Mic, Keyboard, Search, Square | `C/BotonAnotar.tsx:2` |
| Inicio | ChevronDown, Eye, EyeOff, Plus, RefreshCw, Search, Settings2, Sparkles, X (+ `IconoSimbolo "CalendarDays"`) | `C/InicioView.tsx` imports, `:228` |
| Dinero | Star | `C/DineroView.tsx` |
| Mes | CalendarDays, ChevronLeft, ChevronRight, Download, Lock, Sparkles | `C/MesView.tsx` |
| Asesor | Send, User, ThumbsUp, ThumbsDown, Copy, Check, RotateCcw, Volume2, VolumeX, Share2, History, Plus, X, MessageSquareText, Mic, Sparkles, Square, Loader2 | `C/AsesorView.tsx` |
| Más (Ajustes) | ChevronRight, Clock | `C/AjustesView.tsx` |
| Tema | Sun, Moon, Monitor | `C/TemaToggle.tsx:2` |
| Avisos globales | CloudOff, AlertTriangle, X | `LukAppApp.tsx:997-1046` |
| Carga / refresco | LoaderCircle; Loader2, RefreshCw | `C/PantallaCarga.tsx:2`, `C/PullToRefreshIndicator.tsx:2` |
| Categorías | ver tabla 1.3 | `types.ts:65-79` |

Emojis de categorías: tabla 1.3 y `categorias.ts:140-182`.

---

## 6. Activos de marca

| Activo | Archivo / implementación | Fuente |
|---|---|---|
| Isotipo «U» (`BrandMark`) | `<img src="/brand/lukapp-isotipo.png">` 2040×2040, `object-fit: contain`; respaldo `/lukapp-isotipo.png`. Usado en login a 32×32 | `C/BrandMark.tsx:15-29`, `C/LoginPanel.tsx:176` |
| Logotipo horizontal (`BrandWordmark`) | `<img src="/brand/lukapp-wordmark-160.webp">` 160×76; respaldo `/lukapp-wordmark.png` | `C/BrandWordmark.tsx:12-27` |
| Otros en `public/brand/` | `lukapp-estrella.png`, `lukapp-icono-original.png`, `lukapp-logo-fondo.png`, `lukapp-wordmark.png`, `manual-de-marca.png`, `luki-mascot.svg` | `public/brand/` |
| Iconos de app | `public/lukapp-icon-{32,180,192,512}.png`, `lukapp-icon-maskable-512.png`; generados por `python3 scripts/generar-iconos-marca.py` (no editar a mano) | `public/`, `CLAUDE.md` |
| **Estrella IA** | **SVG vectorial en código**, no imagen: `viewBox="-5 -5 210 218"`, trazados `CUERPO_ESTRELLA`, `BRAZO_DERECHO/IZQUIERDO`, `PIERNA_*` (calcados del PNG oficial con Moore-neighbor + RDP), máscara para extremidades; cuerpo `#735AC2`, extremidades `#4A0182`; 10 emociones (happy, thinking, surprised, sad, excited, sleepy, wink, confused, love, dizzy) | `C/EstrellaAvatar.tsx:3-13,32-67,160,201-290` |
| Estrella animada | 18 gestos; frames de **50 ms** (`setInterval`), ciclos de 30–90 frames; transiciones de partes `transform 0.3s ease-out`; reducido → `idle` | `C/EstrellaAnimada.tsx:7-25,59-78,103-119`, `C/EstrellaAvatar.tsx:216,227` |
| `Estrella` (envoltorio) | estados quieta/pensando/contenta → idle/thinking/celebrating; tamaño cara 120, cuerpo 200 | `C/Estrella.tsx:24-33` |
| `EstrellaSecuencia` | carrusel de gestos con respiro `idle` 2200 ms, tamaño 240 | `C/EstrellaSecuencia.tsx:17-57,61` |
| Observación | Por `grep`, `<Estrella…>` no se instancia fuera de su propia familia de componentes (y tests) en v10.14.0; el Asesor muestra hoy a **Luki** | — |
| **Luki** (nutria mascota) | PNG/WebP con transparencia en `public/brand/`: saludo, leyendo, escribiendo, abierto, gesto-chistoso, durmiendo, sorprendida, pensando, saltando, timida, easter-egg-lengua (prob. 0,001 %) | `C/AsesorView.tsx:104-120,1341`; `C/landing/MascotaLuki.tsx:18` |
| Animaciones Luki (CSS) | `.luki-saludo` 1.8s, `.luki-balanceo` 2.6s, `.luki-curiosa` 2.2s, `.luki-rebote` 1.7s ease-out, `.luki-inclinacion` 2s, `.luki-pasitos` 2.4s, `.luki-estiramiento` 2.1s, `.luki-saludo-largo` 3.2s (ease-in-out, origen 50% 100%, rotaciones ±3–7°) | `L:673-746` |
| Pantalla de carga | `PantallaCarga`: fondo `--fin-bg` (respaldo `#1a1817`), **sin logo**; tras **350 ms** muestra `LoaderCircle` 28×28 stroke 2.25 `animate-spin` opacidad .7 color `--fin-ink-soft`. A los **22 s** pasa a «No terminó de abrir {sección}» con botón «Volver a cargar LukApp» | `C/PantallaCarga.tsx:6-7,14-31,43-66` |

---

## 7. Animaciones

| Elemento | Duración / curva | Fuente |
|---|---|---|
| Transición global de controles | `transform 160ms cubic-bezier(0.2,0.8,0.2,1)`; color/fondo/borde/sombra/opacidad 160ms ease | `L:750-763` |
| Hover botón | `translateY(-1px)` | `L:765-767` |
| Press botón | `scale(0.97)`, 80 ms | `L:769-772` |
| Tarjeta `rounded-3xl` hover | `translateY(-2px)`, 220 ms | `L:774-784` |
| Entrada `.fin-glass` | `fin-superficie-entrada` 220ms `cubic-bezier(.2,.8,.2,1)`: opacity .86→1, y 3→0 | `L:803-811` |
| `AnimatedNumber` | **no interpola**: re-monta por `key=value`, `y 2→0`, `0.16s easeOut` | `C/AnimatedNumber.tsx:23-26` |
| `RippleButton` | círculo 8px, `scale 0→4`, `opacity .6→0`, 0.22s; color por defecto `rgba(255,255,255,0.4)`; se borra a los 220 ms | `C/RippleButton.tsx:16,45-48,64-77` |
| Pull to refresh | umbral **70px**, tope **110px**, resistencia **0.45**; sólo en `inicio` sin modales; indicador círculo 32px `--fin-card` + sombra glass, `RefreshCw` 16px rota `progreso*220°`, al refrescar `Loader2` giratorio color `--fin-accent`; retorno `transform/height 0.2s ease-out`; hápticos `light` al soltar y `selection` al terminar | `src/features/lukapp/hooks/usePullToRefresh.ts:3-7,138,170-171`, `C/PullToRefreshIndicator.tsx:24-43`, `C/LukAppShell.tsx:60-69,84-87` |
| Cambio de pestaña / hojas | ver 4.3 | — |
| Rotación chevron periodo | 0.16s easeOut, 0→180° | `C/InicioView.tsx:246` |
| Selección en ConfirmSheet | `scale 1.02` activo, 0.15s easeOut | `C/ConfirmSheet.tsx:308-309` |
| Premium lens | `transform 260ms cubic-bezier(.2,.8,.2,1)`; brillo deriva 22s; press `scale(.985)` | `styles/premium-glass.css:17,27,55-60` |
| Utilidades | `fadeInUp` / `fadeInScale` 0.3s `cubic-bezier(0.25,0.46,0.45,0.94)` | `styles/premium-effects.css:93-121` |
| Movimiento reducido | todas las animaciones/transiciones a 0.01ms; Estrella → idle; ripple desactivado | `L:582-596`, `C/RippleButton.tsx:38`, `C/EstrellaAnimada.tsx:101` |

---

## 8. Vibración háptica

Implementación: `src/features/lukapp/hooks/useHapticFeedback.ts`. `trigger(tipo)` llama siempre a `pulsarSwitchIOS()` (truco del `<input type=checkbox switch>` para iOS 18+, `src/features/lukapp/lib/iosHapticSwitch.ts:44-77`) y luego `navigator.vibrate(patrón)` si existe (`useHapticFeedback.ts:45-65`). **No hay ningún ajuste para activar/desactivar la vibración** (búsqueda de «vibraci/haptic» en Ajustes/Cuenta/lib sin resultados); tampoco respeta movimiento reducido. En paralelo suele sonar `useAudioFeedback` (tonos Web Audio, volumen 0.22, `src/features/lukapp/hooks/useAudioFeedback.ts:34-35`), también sin ajuste.

Patrones (`useHapticFeedback.ts:25-33`), en ms (vibra, pausa, vibra…):

| Tipo | Patrón | Sugerencia Android (`HapticFeedbackConstants` / `VibrationEffect`) |
|---|---|---|
| `light` | `10` | `createOneShot(10)` / `CLOCK_TICK` |
| `medium` | `30` | `createOneShot(30)` / `CONTEXT_CLICK` |
| `heavy` | `50` | `createOneShot(50)` / `LONG_PRESS` |
| `success` | `[30, 20, 30]` | `createWaveform(longArrayOf(0,30,20,30), -1)` / `CONFIRM` |
| `error` | `[80, 30, 80]` | `createWaveform(longArrayOf(0,80,30,80), -1)` / `REJECT` |
| `warning` | `[40, 30, 40, 30, 40]` | `createWaveform(longArrayOf(0,40,30,40,30,40), -1)` |
| `selection` | `[15, 10, 15]` | `createWaveform(longArrayOf(0,15,10,15), -1)` |

Inventario de llamadas (`C/` = componentes):

| Archivo:línea | Tipo | Cuándo |
|---|---|---|
| `C/LukAppShell.tsx:54` | selection | Tocar pestaña de la barra |
| `C/LukAppShell.tsx:65` | light | Pull-to-refresh disparado |
| `C/LukAppShell.tsx:67` | selection | Pull-to-refresh terminó |
| `C/BotonAnotar.tsx:73` | medium | OCR de foto devolvió texto |
| `C/BotonAnotar.tsx:111` | heavy | Inicio de dictado por disparo automático (si no escuchaba) |
| `C/BotonAnotar.tsx:123` | light | Micrófono tocado pero dictado no soportado |
| `C/BotonAnotar.tsx:130` | light | Detener dictado |
| `C/BotonAnotar.tsx:134` | heavy | Empezar dictado |
| `C/BotonAnotar.tsx:142` | light | Cancelar dictado |
| `C/BotonAnotar.tsx:153` | medium | Confirmar dictado |
| `C/BotonAnotar.tsx:182` | light | «Anotar a mano» |
| `C/BotonAnotar.tsx:195` | light | «Escanear comprobante» (abre selector) |
| `C/BotonAnotar.tsx:217` | light | «Buscar» |
| `C/BotonAnotar.tsx:257` | medium | Foto elegida, empieza escaneo |
| `C/Captura.tsx:224` | medium | OCR devolvió texto (formulario) |
| `C/Captura.tsx:315` | success / error | Guardado terminado (error si `correcto === false`) |
| `C/Captura.tsx:320` | error | Excepción al guardar |
| `C/Captura.tsx:330` | error | Guardar sin monto (o monto 0) |
| `C/Captura.tsx:337` | selection | Falta elegir cuenta, se pide confirmar |
| `C/Captura.tsx:412` / `:429` | selection | Tipo «gasto» / «ingreso» |
| `C/Captura.tsx:455` | medium | Foto elegida en formulario |
| `C/Captura.tsx:583` | selection | Aplicar sugerencia contextual |
| `C/Captura.tsx:645` / `:677` | selection | Elegir cuenta / quitar cuenta |
| `C/Captura.tsx:767` | selection | Elegir categoría |
| `C/ConfirmSheet.tsx:173` | success / error | Guardado terminado |
| `C/ConfirmSheet.tsx:177` | error | Excepción al guardar |
| `C/ConfirmSheet.tsx:223` | light | Cancelar hoja |
| `C/ConfirmSheet.tsx:302` | selection | Elegir tipo (gasto/ingreso) |
| `C/ConfirmSheet.tsx:341` | selection | Elegir categoría |
| `C/AsesorView.tsx:394` | light / heavy | Micrófono del asesor (light si ya escuchaba, heavy al empezar) |
| `C/AsesorView.tsx:416` | selection | Me gusta / no me gusta |
| `C/AsesorView.tsx:434` | light | Copiado al portapapeles |
| `C/AsesorView.tsx:493` | light | Empieza lectura en voz alta |
| `C/AsesorView.tsx:498` | medium | Compartir respuesta |
| `C/AsesorView.tsx:532` | medium | Regenerar respuesta |
| `C/CajitaCard.tsx:120` | light / medium | Abrir acción de cajita (light si es la misma) |
| `C/CajitaCard.tsx:198` | warning | Pedir confirmación de borrado |
| `C/CajitaCard.tsx:267` | heavy | Confirmar borrado |
| `C/CajitaCard.tsx:278` | light | Cancelar borrado |
| `C/CajitaCard.tsx:413` | light | Desplegar/plegar detalle |
| `C/TransactionList.tsx:183` | selection | Deslizar fila a la derecha ≥ umbral → repetir |
| `C/TransactionList.tsx:186` | selection | Deslizar fila a la izquierda ≥ umbral → editar |
| `C/MultiCapturaModal.tsx:38` | light | Quitar ítem |
| `C/MultiCapturaModal.tsx:52` | medium | Guardar todos |
| `C/EspaciosCompartidosView.tsx:130` | medium | Crear espacio |
| `C/EspaciosCompartidosView.tsx:148` | medium | Agregar gasto compartido |
| `C/EspaciosCompartidosView.tsx:171` | medium | Compartir por WhatsApp |
| `C/DivisionCuentasModal.tsx:42` | light | Cambiar nº de personas |
| `C/DivisionCuentasModal.tsx:58` | light | Marcar pago de una persona |
| `C/DivisionCuentasModal.tsx:66` | medium | Copiar mensaje |
| `C/DivisionCuentasModal.tsx:97` | medium | Anotar mi parte |
| `C/DivisionCuentasModal.tsx:187` | light | Elegir % de propina |

No hay otras llamadas directas a `navigator.vibrate` fuera del hook (`useHapticFeedback.ts:60`).
