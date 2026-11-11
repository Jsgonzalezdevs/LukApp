# Inventario de pantallas y flujos — LukApp web → Android nativo (Kotlin + Compose)

> **Versión de referencia del código analizado: LukApp v10.14.0** (`src/version.ts`).
> Rama: `android-nativo`. Documento de solo inventario: no cambia código ni versión.
> Objetivo: paridad total con la app autenticada y el acceso. Cada fila es verificable
> contra el archivo citado (rutas relativas a `src/features/lukapp/` salvo que se diga otra cosa).

---

## 0. Alcance

| Incluido | Fuera de alcance |
|---|---|
| Acceso: login, registro, Google, recuperación y actualización de contraseña, onboarding | Portada pública: `components/landing/`, `LandingLukApp.tsx`, `SeoContenido.tsx` (`/blog`), `PortadaDeRespaldo` en `src/RaizAplicacion.tsx` |
| App autenticada completa (`LukAppApp.tsx`): 5 pestañas, calendario, 18 paneles, hojas, modales y capas | Panel superadmin de `src/apps-dashboard/` (ver §9: hoy **sí** se alcanza desde la app móvil, porque el cliente Android es una WebView) |
| Pantallas de sistema que ve el usuario: confirmación de pago Wompi, legal, eliminar datos, carga y error | Componentes muertos (no se importan en ningún sitio, ver §10) |

**Cómo es hoy el cliente Android** (`apps/mobile/src/App.tsx`): es Expo + `react-native-webview` y carga `https://mi.lukapp.app/app`. Le inyecta a la web `__LUKAPP_NATIVE__`, `__LUKAPP_AUDIO_NATIVE__` y `__LUKAPP_GOOGLE_NATIVO__`. Hace de puente para el micrófono (expo-audio), Google OAuth (`lukapp://auth/callback`), las descargas (FileSystem + Sharing) y `navigator.share`.

`apps/mobile/src/AppNativa.tsx` es un prototipo React Native que no es la entrada activa. Tenía login, Inicio, Movimientos, Dinero, Nuevo movimiento y bloqueo biométrico. Sirve como referencia, pero no cubre Mes, Asesor, Presupuestos ni Recurrentes.

---

## 1. Árbol de navegación

### 1.1 Raíz (antes de LukAppApp)
`src/RaizAplicacion.tsx` → `src/apps-dashboard/AppsRoot.tsx`:

```
RaizAplicacion
├─ /blog/*                → SeoContenido            (fuera de alcance)
├─ /eliminar-datos        → SolicitudEliminacionDatos (pública, sin sesión)
├─ portada pública        → LandingLukApp           (fuera de alcance)
└─ AppsRoot
   ├─ /legal | /terminos  → LegalLukApp
   ├─ sesión cargando     → PantallaCarga
   ├─ sesion.enRecuperacion → LoginPanel modo "actualizar"
   ├─ anónimo             → LoginPanel ("/registro" ⇒ registrarse; si no ⇒ entrar)
   ├─ /pago/confirmado o /ajustes/cuenta?id=… → ConfirmacionPagoWompi
   ├─ /superadmin, /estadisticas, /ecosistema → panel admin (§9)
   └─ resto (autenticado)  → LukAppMain (LukAppApp.tsx) + PWAInstall (invitación a instalar, a los 6 s, una vez)
```

### 1.2 Dentro de LukAppApp
`LukAppContenido` muestra `CargaSeccion` mientras la sesión carga, `LoginPanel` si no hay sesión y `LukAppPanel` (con `key=userId`) si la hay. `LukAppPanel` muestra `CargaSeccion` mientras migra y carga el almacén, y una pantalla de error "No pudimos cargar tus cuentas" si falla sin datos. Si todo va bien, monta el shell.

**Barra inferior** (`sections.ts` → `SECTIONS`, `LukAppShell.tsx`). Solo iconos; el texto queda en `sr-only` y `title`:

| Orden | id | Etiqueta | Icono (lucide) | Ruta |
|---|---|---|---|---|
| 1 | `inicio` | Inicio | Home | `/app` |
| 2 | `dinero` | Dinero | Wallet | `/dinero` |
| 3 | `mes` | Mes | BarChart3 | `/mes` |
| 4 | `asesor` | Asesor | UserCircle | `/asesor` |
| 5 | `ajustes` | Más | Menu | `/ajustes` |

- `calendario` es una 6.ª sección (`SectionId`) que **no** está en la barra. Se abre desde Mes e Inicio, su ruta es `/calendario` y, mientras está abierta, la pestaña Mes se ve activa.
- Al cambiar de pestaña hay háptica `selection` y un sonido.
- La transición entre secciones es un fade de 0,18 s, sin animación de salida.

**Paneles (`PANELES_AJUSTES`, 18)**. Cada uno se abre como `HojaPanel` a pantalla completa. Su ruta es `/<sección>/<panel>` según `lib/navegacionFunciones.ts → seccionDePanel`:

| Sección padre | Paneles |
|---|---|
| **Dinero** | `metas`, `extractos`, `compartido`, `dividir-cuenta`, `vaquitas`, `gmf` |
| **Mes** | `recurrentes` (o `/calendario/recurrentes` si se abre desde Calendario), `forecast`, `topes` |
| **Más (ajustes)** | `categorias`, `periodo`, `revisiones`, `atajos`, `nombres`, `contraseña`, `respaldo`, `funciones-solicitadas`, `cuenta` |

**Sub-secciones de "Más"** (`AjustesView.BLOQUES` + bloque "La app"), en el orden en que se ven:
1. Botón "Buscar una función de LukApp" (abre la capa Buscar).
2. **Preferencias**: Categorías · Período · Registro automático (`atajos`).
3. **Tus datos**: Revisar movimientos (`revisiones`) · Nombres repetidos (`nombres`) · Copia de seguridad (`respaldo`).
4. **Comunidad**: Funciones solicitadas.
5. **La app**: interruptores y filas (lista exhaustiva en §6).

Los paneles `contraseña`, `topes`, `forecast`, `recurrentes`, `metas`, `extractos`, `compartido`, `dividir-cuenta`, `vaquitas` y `gmf` **no tienen fila en Más**. Se llega a ellos desde Dinero, Mes, Calendario, la búsqueda de funciones o una ruta directa.

**Hojas de Dinero** (estado local `panelDinero`, **sin ruta**). Todas son `HojaPanel`:
- `cuenta` o `cajita` sin id → `CajitasView` ("Cuentas" / "Ahorros").
- `tarjeta` o `deuda` → `DeudasView` ("Tarjetas de crédito" / "Tarjetas y deudas").
- con id (cuenta o ahorro) → `DetalleCajita` (título = nombre de la cuenta).

### 1.3 Deep links / rutas que hay que respetar
| Ruta | Destino |
|---|---|
| `/app`, `/dinero`, `/mes`, `/asesor`, `/ajustes`, `/calendario` | Secciones |
| `/<seccion>/<panel>` (y alias heredado `/ajustes/<panel>`) | Panel (`panelDeSegmentos`) |
| `/dinero/extractos?cuenta=<id>` | Importar con la cuenta preseleccionada; al cerrar vuelve a `DetalleCajita` de esa cuenta |
| `/entrar`, `/registro` | Acceso |
| URL con `type=recovery` (hash o query) | LoginPanel en modo `actualizar` |
| `/pago/confirmado`, `/ajustes/cuenta?id=…` | ConfirmacionPagoWompi |
| `?invitacion=<token>` (dentro de compartido) | Aceptar invitación a un espacio compartido |
| `lukapp://auth/callback` | Retorno de Google OAuth (scheme ya registrado en `apps/mobile/app.json`) |
| `/legal`, `/terminos`, `/eliminar-datos` | Páginas legales |

Propuesta para Compose: un `NavHost` con estas rutas como `deepLinks`, más App Links para `mi.lukapp.app`.

### 1.4 Comportamiento del botón Atrás
- **Web hoy:**
  - La sección y el panel viven en la URL (`data/useRuta.ts`, `pushState`), así que el atrás del navegador cierra el panel o vuelve a la sección anterior.
  - `HojaPanel` se cierra también con **Escape**.
  - Las hojas de Dinero, Captura, ConfirmSheet, Detalle, Buscar y los modales son estado React: el atrás del navegador **no** los cierra; solo lo hacen su X, Esc o tocar el fondo.
- **Android WebView hoy:** `BackHandler` llama a `webView.goBack()` si hay historial y, si no, cierra la app. No avisa a la web, así que **no cierra** modales ni hojas de estado.
- **Objetivo Compose (paridad mejorada):** usar `BackHandler`/`PredictiveBack` por capas, en este orden de prioridad:
  1. Subdiálogo interno (p. ej. "¿De qué cuenta salió?" en Captura, calendario de SelectorFechaApp).
  2. Modal o hoja superior: Captura, MultiCaptura, ConfirmarComandoVoz, ConfirmSheet, DetalleMovimiento, AnalisisMovimiento, RachaModal, ResumenWrapped, InvitacionPremium, Reporte, GuiaApp (equivale a "Saltar"), DictadoOverlay (equivale a cancelar).
  3. Capa Buscar (además limpia el filtro).
  4. HojaPanel de panel o de Dinero. Caso especial: al cerrar `extractos` abierto con `?cuenta=`, se vuelve a `DetalleCajita`.
  5. Calendario → Mes.
  6. Sección ≠ Inicio → Inicio.
  7. Inicio → salir de la app.

  Onboarding no se puede cerrar con Atrás: es obligatorio hasta `terminar()`.

---

## 2. Acceso

### A1. LoginPanel — `components/LoginPanel.tsx` (+ `ChecklistContrasena.tsx`, `BotonGoogle.tsx`, `TemaToggle.tsx`)
- **Cómo se llega:** sin sesión (`/entrar`, `/registro`), o con `sesion.enRecuperacion` (modo `actualizar`).
- **Qué muestra:**
  - TemaToggle (claro, oscuro, sistema).
  - Marca con halo animado y "LukApp", y un subtítulo según el modo.
  - Tarjeta con: segmentado Entrar / Crear cuenta, "Continuar con Google", separador "o con tu correo", campos, alerta de error, botón principal y enlace para cambiar de modo.
  - Pie: "Tus datos son privados".
  - Fondo de auroras animadas (respeta movimiento reducido).
- **Modos:**
  - **entrar:** "Tu correo o demo" (el alias `demo` usa la cuenta demo), contraseña con ojo, "¿Olvidaste tu contraseña?" y checkbox "Recuérdame".
  - **registrarse:** apodo, que se comprueba en vivo con debounce de 450 ms (RPC `usuario_disponible`; estados vacío, mín. 3, comprobando, disponible, ya tomado). Además correo (regex) y contraseña con checklist. Al terminar, pantalla "¡Revisa tu correo!" con "Ya lo confirmé, quiero entrar".
  - **recuperar:** solo correo. Al terminar, "¡Enlace enviado!".
  - **actualizar:** nueva contraseña con checklist. Al terminar, "¡Contraseña actualizada!" y "Entrar a LukApp" (`finalizarRecuperacion`).
- **Regla de contraseña** (`src/lib/seguridad.ts`): mínimo 6 caracteres, 1 mayúscula, 1 minúscula y 1 especial. No puede ser igual al apodo ni al correo.
- **Datos que lee y escribe:**
  - Métodos de `data/useSesion.ts`: `entrar` (signInWithPassword), `registrarse` (signUp + `data.usuario`; el trigger `crear_perfil` crea el perfil), `recuperarPassword` (redirect `/entrar`), `actualizarPassword`, `entrarConGoogle` (en nativo: `skipBrowserRedirect` + `lukapp://auth/callback`), `usuarioDisponible`, `limpiarError`.
  - localStorage: `lukapp_recordar_usuario`, `lukapp_correo_guardado`.
  - Al entrar: `/api/registrar-ultimo-acceso`, `/api/mis-permisos` y sincronización de preferencias desde la `user_metadata`.
- **Estados:**
  - Textos de carga del botón: "Entrando…", "Creando tu cuenta…", "Enviando enlace…", "Guardando nueva contraseña…".
  - Errores traducidos: "Correo o contraseña incorrectos.", "Confirma tu correo antes de entrar.", "Ese correo ya tiene una cuenta.", "Demasiados intentos…".
  - Timeout de 12 s.
- **Gestos:** ninguno. **Premium:** no. **Complejidad:** **L** (4 modos, Google con Credential Manager o Custom Tab, deep link de recuperación).
- Nota: `loginValidation.ts` define bloqueo (5 intentos en 15 min) y una regla alfanumérica para el apodo, pero LoginPanel **no** las usa.

### A2. PasswordRecoveryView — `components/PasswordRecoveryView.tsx` (panel `contraseña`)
- **Cómo se llega:** solo por la ruta `/ajustes/contraseña` o la búsqueda de funciones; no tiene fila en Más.
- **Qué muestra:** "Recuperar contraseña", campo de correo (prellenado con el de la sesión), "Enviar enlace de recuperación" y caja de consejos.
- **Datos:** `supabase.auth.resetPasswordForEmail` con redirect `/auth/reset-password`. **Esto no coincide con useSesion, que usa `/entrar`.** Hay que unificarlo en la migración.
- **Estados:** inicial, enviando, éxito ("Correo enviado… a {email}") y error. **Complejidad:** S.

### A3. Onboarding — `components/Onboarding.tsx` (+ `TecladoNumerico.tsx`, `TypingText.tsx`)
- **Cómo se llega:** se monta mientras `useOnboarding().terminado === false`. Es un modal de pantalla completa (hoja inferior en móvil) y no se puede cerrar.
- **Pasos** (barra de progreso de 4 segmentos):
  0. "¿Cómo te llamas?" → nombre. Salida: "Prefiero no decirlo".
  1. "¿Dónde tienes tu plata?" → chips Bancolombia, Nu, Davivienda, Lulo Bank, BBVA, Falabella y Otro (banco), Nequi y Daviplata (billetera). Con "Otro" aparece un input libre; "efectivo" da error porque el efectivo ya viene incluido. Salida: "Ninguna por ahora".
  2. "¿Cuánto tienes en {banco}?" → teclado numérico propio (máx. 12 dígitos). Salida: "Empezar en $0".
  3. "Listo, {nombre}." → resumen, "Editar saldo inicial" y "Entrar a LukApp".
- **Datos:** `onboarding.guardarNombre`, `almacen.crearCajita({tipo:'cuenta', claseCuenta, saldoInicialCop})` y `onboarding.terminar()`. Se guarda en localStorage y en la user_metadata.
- **Estados:** "Guardando…" y error de guardado. **Complejidad:** M.

### A4. Pantallas de sistema del acceso
| Pantalla | Archivo | Qué hace | Compl. |
|---|---|---|---|
| PantallaCarga / CargaSeccion / LimiteErrorCarga | `components/PantallaCarga.tsx` | Spinner a partir de 350 ms. A los 22 s, "No terminó de abrir {sección}…" con "Volver a cargar LukApp". También hace de error boundary | S |
| Error de carga del almacén | `LukAppApp.tsx` (inline) | "No pudimos cargar tus cuentas…" con "Volver a cargar" | S |
| ConfirmacionPagoWompi | `components/ConfirmacionPagoWompi.tsx` | Consulta `GET /api/mi-plan` cada 5 s durante 60 s. Estados: consultando, esperando, confirmado, pendiente, error y sin-sesión. Botones "Ir al inicio", "Ver mi plan" y "Verificar de nuevo" | M |
| LegalLukApp | `components/LegalLukApp.tsx` | Términos y privacidad (Ley 1581). Intenta `GET /api/legal/terminos` y si no usa el texto del código | S |
| SolicitudEliminacionDatos | `components/SolicitudEliminacionDatos.tsx` | Formulario público que abre un `mailto:` (en Android: `ACTION_SENDTO`) | S |
| PWAInstall | `components/landing/PWAInstall.tsx` | Invitación a instalar la PWA. **No aplica en Android nativo** | — |

---

## 3. Pestañas principales

### P1. Inicio — `InicioView` · `components/InicioView.tsx` · id `inicio`
- **Cómo se llega:** pestaña 1, `/app`, o "Volver a ver la guía".
- **Qué muestra, en orden:**
  1. **Cabecera:**
     - Pastilla de período: menú con los últimos 13 períodos.
     - Botón de racha "N días · Activa", que abre RachaModal.
     - Ojo de privacidad.
     - Lupa (abre Buscar) y Ajustes (va a Más).
  2. **Saldo:**
     - "DINERO DISPONIBLE" (`liquidez.dineroLibreCop`), cifra animada de 44 px. Al tocarla va a Mes.
     - Subtítulo: "Saldo total menos ahorros reservados y obligaciones." o "Las cuentas sin saldo cuentan como $0…".
     - Desglose "Bancos • Efectivo" si `mostrarEfectivoSeparado`.
     - Pastilla compacta "↓gastos | ↑ingresos", que va a Mes.
  3. **ProximosPagosInicio** (si `mostrarProximosPagos`): hasta 3 obligaciones de los próximos 90 días, con fecha, "Vencido" y certeza. "Ver calendario" lleva a Calendario. Vacío: "No hay pagos con fecha registrada…".
  4. **Chip de filtro** "Mostrando solo: X · Ver todos ✕".
  5. **Movimientos:** TransactionList de todo el historial (agrupado por día), con lupa propia. Vacío: "Aquí aparecerán tus movimientos."
  6. **"+ Anotar nuevo gasto"** (punteado, solo cuando ya hay un primer movimiento).
  7. **Desplegable "Análisis y categorías del período":**
     - `DecisionFinanciera` (si `mostrarDecisiones`): "Puedes gastar hoy" y el simulador "¿Qué pasa si compro?" (`simularDecisiones`), más una anomalía si la hay.
     - Carrusel horizontal de categorías (barras proporcionales). Tocar una filtra la lista.
     - Tarjeta **Pulso Premium** (premium): "para usar hoy", días restantes y dinero libre. Al tocarla abre el Asesor con un prompt.
     - **Tira de insight** (local o IA): rota cada 45 s, se refresca si hay `insights_ia`, ✕ la descarta (`useDismissedInsights`) y tocarla abre el Asesor con un prompt.
  8. **Banner de novedad** "v{versión} {texto}" (`NOVEDADES[0]` si `useNovedades().hayNovedad`): se expande al tocarlo y ✕ lo marca como visto.
- **Acciones:** abrir un movimiento (DetalleMovimiento), swipe derecho para repetir, swipe izquierdo para editar, cambiar período, privacidad, buscar, anotar, abrir racha, consultar al asesor.
- **Datos:** `almacen.datos` (transacciones, cajitas, presupuestos…), `construirContextoFinanciero` (liquidez, obligaciones), `useAiInsights` (`GET /api/mi-plan`, `POST /api/finanzas-insights-ia`) y las preferencias.
- **Estados:**
  - Banners globales arriba del contenido: sin conexión ("Estás sin conexión…"), almacenamiento no persistente, "Tienes N cambios sin subir", error del almacén con ✕.
  - Vacíos por sección.
- **Gestos:**
  - **Pull-to-refresh:** solo en Inicio y sin modales. Umbral 70 px, tope 110 px; llama `almacen.recargar`. Se ignora dentro de scroll horizontal o con `data-no-pull-refresh`.
  - **Swipe en filas:** ±84 px.
  - Scroll horizontal del carrusel.
- **Premium:** Pulso Premium (`pulso_premium`), insights IA y refrescar (`insights_ia`).
- **Complejidad:** **L**.

### P2. Dinero — `DineroView` · `components/DineroView.tsx` · id `dinero`
- **Cómo se llega:** pestaña 2 o `/dinero`.
- **Qué muestra:**
  1. `CabeceraDinero`: select de período, botón de racha (RachaModal) y Ajustes.
  2. Cifra "Disponible" animada: patrimonio − inversiones − ahorros (si `!mostrarAhorro`) − deudas.
  3. `AccesosFunciones`: Metas, Importar extractos.
  4. Vacío: "Empieza por tu banco" con "Agregar una cuenta".
  5. Grupos ordenados por saldo:
     - **Cuentas** (`FilaCuenta` con color y logo de la entidad, favorita primero, "Por color").
     - 🐷 Ahorro disponible.
     - 📈 Inversiones.
     - **Tarjetas de crédito** ("Ver todas"; muestra "Pago mensual estimado").
     - **Deudas**.
  6. "🐷 Crear ahorro".
  7. Grid con "Agregar cuenta" y "Tarjetas de crédito".
  8. Desplegable "Compartir gastos e impuestos": compartido, vaquitas, dividir-cuenta, gmf.
- **Acciones:**
  - Tocar una fila: si es tarjeta abre DeudasView (tarjeta), si es deuda abre DeudasView (deuda), si es cuenta o ahorro abre DetalleCajita.
  - Los botones de crear abren CajitasView.
  - Las herramientas navegan a `/dinero/<panel>`.
- **Datos:** solo lectura (`saldosPorCajita`, `patrimonio`, `resumenTarjeta`), `cuentaFavoritaId` y `modoPrivacidad`.
- **Estados:** vacío sin cuentas. **Gestos:** ninguno. **Premium:** no. **Complejidad:** M.

### P3. Mes — `MesView` · `components/MesView.tsx` · id `mes`
- **Cómo se llega:** pestaña 3, `/mes`, o al tocar el saldo o los totales en Inicio.
- **Qué muestra:**
  1. Selector de período ‹ etiqueta [calendario] ›. › se desactiva en el período actual y ambos con la frecuencia `todo-el-tiempo`. El botón de calendario abre la sección Calendario.
  2. `AccesosFunciones`: Pagos fijos (`recurrentes`), Proyección financiera (`forecast`).
  3. Tarjeta "Tu resumen de {mes}": abre ResumenWrapped. Si está bloqueada, muestra "Próximamente · se habilita el {día}" (se abre 2 días antes de fin de mes; los meses pasados siempre).
  4. "Balance del período": cifra verde o roja y "Entró X · Salió Y".
  5. **Topes:** `PresupuestosView` embebido (ver H-topes).
  6. `CategoryBreakdown`: "En qué se te va" y "De dónde entra" (barras con %).
  7. `DetalleMes`:
     - "En qué días se fue": barras por día; tocar una lista los movimientos de ese día.
     - Estadísticas: días con gasto, promedio y día más caro.
     - "Tus gastos más grandes", "A quién le mandaste / Quién te mandó" y "Tus mayores entradas".
  8. `TendenciasView`:
     - "Cómo vienes": segmentado de rango, `GraficaLineas` con ingresos y gastos (tocar selecciona el mes), movimientos del mes (hasta 5) y una frase comparativa.
     - "Promedio mensual".
     - "Contra el mes pasado" por categoría.
     - Vacío: "Aún no hay suficientes meses para comparar."
  9. "Exportar {período} a Excel (.xls)" (si hay movimientos).
- **Datos:** todo por props (`forPeriod`, `byCategory`, `lib/detalle`, `lib/tendencias`, `lib/resumenMes`). Exportar usa `descargarExcel`.
- **Gestos:** toque en barras y gráfica; sin swipe. **Premium:** no. **Complejidad:** M (contenedor) + hijos M (gráficas en Canvas).

### P3b. Calendario financiero — `CalendarioFinancieroView` · `components/CalendarioFinancieroView.tsx` · id `calendario`
- **Cómo se llega:** botón de calendario en Mes, "Ver calendario" o los próximos pagos de Inicio, o `/calendario`.
- **Qué muestra:**
  - Título "Calendario financiero" con "Añadir" (abre el panel recurrentes en `/calendario/recurrentes`).
  - Segmentado Día / Semana / Mes. **Bug:** "Semana" agrupa igual que "Mes".
  - Tarjetas por grupo: concepto, "fecha · estado · precisión" y monto, o "Monto no determinado".
  - Bloque "Sin fecha exacta".
- **Datos:** `eventosDelContexto(contextoFinanciero, hoy)`. **Vacío:** "No hay eventos futuros conocidos…". **Complejidad:** S.

### P4. Asesor — `AsesorView` · `components/AsesorView.tsx` · id `asesor`
- **Cómo se llega:** pestaña 4, `/asesor`, al tocar un insight o el Pulso Premium (llega con `promptInicial`, que se envía solo al montar).
- **Personaje:** hoy el avatar es **Luki** (`MascotaLuki`, `/brand/luki-*.webp`, poses elegidas al azar con pesos). Las `Estrella*.tsx` (la "Estrella IA" de CLAUDE.md) ya no se importan; solo queda un comentario en AsesorView:227. **Decisión pendiente para Android:** Luki o Estrella.
- **Qué muestra:**
  1. **Cabecera fija:**
     - Píldora de conexión: en-línea, despertando o local. Al tocarla verifica de nuevo con `GET /api/asesor-ia/disponibilidad`.
     - Insignia "✨ Premium".
     - Historial y Nueva conversación.
  2. **Hoja lateral de Historial:** conversaciones guardadas. Vacío: "Todavía no tienes conversaciones guardadas."
  3. **Estado inicial:** Luki, saludo y 6 chips (Dime mi resumen, ¿Cuánto puedo gastar?, ¿Debo declarar renta?, ¿Pagaré 4x1000 este mes?, Mis suscripciones, Sorpréndeme).
  4. **Chat:** burbujas con `RespuestaAsesor`. Bajo cada respuesta pueden aparecer:
     - **Movimiento detectado:** muestra el efecto en el saldo y el tope, y "Revisar y editar movimiento", que va a Inicio y abre Captura. Nunca guarda directo.
     - **Propuesta accionable** (presupuesto o meta, editable): "Confirmar" → `onFijarPresupuesto` / `onCrearMeta`.
     - Chips de sugerencia.
     - Barra de acciones: Copiar, 👍/👎 (solo local), Leer en voz alta (TTS es-ES), Compartir, Regenerar.
  5. Indicador "pensando", barra de error con "Reintentar con IA", y el aviso "LukApp es una IA y puede cometer errores…".
  6. **Entrada:** texto y micrófono (`useDictation`). El texto dictado se añade al campo; no se envía solo.
- **Orden de resolución** (hay que portarlo tal cual):
  1. `responderAyudaLukApp`.
  2. `simularPregunta`.
  3. `responderAsesor` local.
  4. `POST /api/asesor-ia` `{prompt, history(5), finanzasContext, memoriaUsuario, idConsulta}`, timeout 60 s.
  5. Respaldo local + `POST /api/asesor-ia/respaldo-local`.
- **Persistencia:** `GET /api/asesor/memoria`, `GET/POST /api/asesor/conversaciones`, `GET /api/asesor/conversaciones/:id/mensajes` y `POST /api/asesor/mensajes`.
- **Errores:**
  - 401: "Tu sesión venció…"
  - 403: "Tu plan actual no incluye…"
  - 429: cupo agotado o límite de solicitudes
  - 5xx, timeout y red: vuelve al motor local
- **Premium:** se valida en el servidor (beneficio `asesor_ia`, `limite_asesor_ia_mensual`, rate limit de 12 por minuto). En el cliente solo se ve la insignia (`esPremium && tieneAsesorIa`).
- **Gestos:** ninguno. La BotonAnotar está oculta en esta sección. **Complejidad:** **L**.
- Nota: `VaquitasModal` está montado dentro de AsesorView, pero nada lo abre (código muerto).

### P5. Más — `AjustesView` · `components/AjustesView.tsx` · id `ajustes`
Ver la lista exhaustiva en §6. La BotonAnotar está oculta aquí. **Complejidad:** S (la lista) + paneles.

---

## 4. Hojas y paneles (HojaPanel)

`HojaPanel` (`components/HojaPanel.tsx`) es una pantalla completa con título grande pegado arriba y X para cerrar. Bloquea el scroll del fondo, atrapa el foco y se cierra con Esc. En Compose equivale a un destino de pantalla completa con TopAppBar y botón de cierre.

### 4.1 Hojas de Dinero (sin ruta)
| id / título | Componente · archivo | Cómo se llega | Qué muestra | Acciones y datos | Estados | Compl. |
|---|---|---|---|---|---|---|
| **Cuentas / Ahorros** | `CajitasView` · `components/CajitasView.tsx` (+ `CajitaCard.tsx`, `AvanzadoAhorro.tsx`) | "Agregar cuenta", "Crear ahorro" | Total; formulario de creación; grupos de Ahorro e Invertido con `CajitaCard` | **Crear:** nombre con autocompletado y reconocimiento de entidad (color automático); clase Banco, Billetera o Efectivo; Ahorro o Inversión con moneda (COP, USD, EUR, MXN, CAD, GBP); saldo inicial (vacío = pendiente); íconos; meta; rendimiento con tasa E.A. Todo va a `crearCajita`. **CajitaCard:** Actualizar saldo, Depositar, Retirar, Rendimiento, Valorar, Transferir (tasa de cambio y fecha en inversiones); historial colapsable; rendimiento estimado; borrar con confirmación inline | Vacío "Empieza…"; error de guardado | **L** |
| **{nombre de la cuenta}** | `DetalleCajita` · `components/DetalleCajita.tsx` | Tocar una cuenta o ahorro en Dinero | Cabecera; saldo grande que al tocarlo se edita; meta; "Importar extracto de esta cuenta"; cuenta principal ⭐; "Enviar dinero a otra cuenta"; historial de ajustes; Eliminar | `fijarSaldo`, `actualizarCajita` (nombre, meta, tarjeta, íconos, "bajo monto 4x1000"), `setCuentaFavorita`, `transferirEntreCuentas` (hoja "Enviar desde X"), `borrarCajita` (con `confirm`) | "Necesitas al menos 2 cuentas…" | M |
| **Tarjetas de crédito / Tarjetas y deudas** | `DeudasView` (+ `DeudaCard` interno) · `components/DeudasView.tsx` | "Ver todas", "Tarjetas de crédito", tocar una tarjeta o deuda | Total en rojo; "Agregar tarjeta/deuda"; tarjetas con "Para pagar este mes", cupo disponible, día de corte y de pago, historial manual y compras registradas | **Registrar compra** (cuotas, cuota mensual, interés, cuota de manejo, categoría) → `registrarMovimiento('compra')`; **Abonar** desde una cuenta → `abonarDeuda`; **Actualizar saldo**; **Editar** (cupo, mínimo, días); **Eliminar** con confirmación | Vacíos "Aún no tienes tarjetas…" / "No debes nada…" | **L** |

### 4.2 Paneles con ruta (`PANELES_AJUSTES`)
| id | Título | Componente · archivo | Cómo se llega | Qué muestra y acciones | Datos (lee/escribe) | Estados | Gestos | Premium | Compl. |
|---|---|---|---|---|---|---|---|---|---|
| `metas` | Metas de ahorro | `MetasView` · `components/MetasView.tsx` | Dinero > Accesos | Nueva meta (nombre, ícono, objetivo, fecha, enlace a cajita); tarjetas con progreso, "Falta X", "Aparta por quincena", estado inteligente; editar el ahorrado si no está enlazada; borrar (**sin confirmación**) | `crearMeta`, `actualizarMeta`, `borrarMeta`, `metasInteligentes` | Vacío; lograda; vencida | — | No | M |
| `extractos` | Importar extractos | `AnalistaView` (+ `AnalistaReporte.tsx`, `analista/useAnalista.ts`) | Dinero > Accesos; DetalleCajita (con `?cuenta`) | Bandeja de comprobantes por correo (dirección, copiar, adjuntos); zona para soltar archivos PDF, imagen, xlsx o csv (máx. 4 MB); cuenta destino; "historial antiguo"; trabajos (leyendo, contraseña del PDF, error, listo); planificación (nuevos, quizá repetidos, ya estaban, no cuentan); revisar duplicados; importar | `POST /api/analizar-extracto`, `GET /api/comprobantes-correo/destino`, tabla `comprobantes_correo`, `GET …/adjunto/:id`; OCR local (Tesseract → **ML Kit**); CSV y XLSX locales (→ Apache POI o similar); `importarTransacciones`, `actualizarTransaccion`; recibir archivos compartidos (intent `SEND`) | "Leyendo tu extracto…", contraseña requerida o inválida, 429 cupo agotado, 404 o red | Soltar archivos (solo escritorio) | Cupo `extracto` en servidor (solo PDF) | **L** |
| `compartido` | Finanzas en Pareja / Compartidas | `EspaciosCompartidosView` (+ `data/useEspaciosCompartidos.ts`) | Dinero > desplegable | Chips de espacios; estado de cuentas 50/50; "Anotar gasto compartido" (opcionalmente anota mi mitad, que abre Captura); "Vincular pareja" (crea invitación y la comparte); WhatsApp; "Saldar a $0"; lista de gastos con borrado (**sin confirmación**); crear espacio | Supabase: `espacios_integrantes`, `espacios_compartidos`, `gastos_compartidos`; RPC `crear_espacio_compartido`, `crear_invitacion_compartida`, `aceptar_invitacion_compartida`; **tiempo real** (`postgres_changes`); caché local | Error de RLS o red; vacío "No hay gastos pendientes" | — | RPC exige `espacios_compartidos` y su límite | **L** |
| `dividir-cuenta` | Dividir cuenta y propina | `DivisionCuentasModal` · `components/DivisionCuentasModal.tsx` | Dinero > desplegable | Total, lugar, propina (0, 10, 15, 20 %), personas (1–50), nombres con "Pagó", cuota por persona; "Enviar cobro" (share o WhatsApp); "Anotar mi parte" (abre Captura con comida) | Local, sin persistencia | Botones desactivados si la cuota es 0 o menos | — | No | S/M |
| `vaquitas` | Vaquitas y Gastos Compartidos | `VaquitasModal` · `components/VaquitasModal.tsx` | Dinero > desplegable | Crear vaca (propósito, meta, amigos); presupuesto, recolectado, gastado y disponible; gastos del proyecto; participantes ("Marcar pagado"); "Para quedar a mano" | **Solo localStorage** `lukapp_vaquitas_v1:<userId>` (→ DataStore/Room, o llevarlo a Supabase); `lib/vaquitasColombia.ts` | Vacío "Sin vaquitas activas" | — | No | M |
| `gmf` | Impuesto 4x1000 | `PanelGmf` · `components/PanelGmf.tsx` (+ `lib/gmf.ts`) | Dinero > desplegable | Advertencia; régimen (repartido o cuenta marcada); cupo exento del mes (350 UVT) con barra; qué cuentas están en entidad financiera; UVT editable con aviso si está desactualizada; notas legales | Preferencias `useAjustesGmf` (uvt, cuentas, régimen, cuenta exenta); cálculo local | Vacío sin cuentas | — | No | M |
| `recurrentes` | Pagos fijos | `RecurrentesView` · `components/RecurrentesView.tsx` | Mes > Accesos; Calendario "Añadir" | Total mensual; proyección anual; próximos cobros (60 días); patrones detectados ("Sí, añadir" / "Actualizar precio"); pendientes ("Sí pasó"); formulario (qué, cuánto, día 1–31, tipo, categoría, cuenta); lista con borrado (**sin confirmación**) | `crearRecurrente`, `actualizarRecurrente`, `borrarRecurrente`, `confirmarRecurrente` | Vacío "El arriendo, Netflix…" | — | No | M |
| `forecast` | Proyección financiera | `ForecastResumen` · `components/ForecastResumen.tsx` | Mes > Accesos | Por horizonte: liquidez, disponible diario, flujo neto, confianza, escenario conservador y favorable | `contextoFinanciero.forecast` | "Forecast no disponible." / "No disponible" | — | No | S |
| `topes` | Topes de gasto | `PresupuestosView` · `components/PresupuestosView.tsx` | Embebido en Mes; ruta `/mes/topes`; búsqueda | Alertas (switch y umbral 10–100 %); crear o editar tope ("Sueles gastar X"); lista con barra, proyección ("Te pasaste" / "A este ritmo…" / "Te quedan…"); menú por fila (Editar, Nueva transacción que abre Captura, Quitar **sin confirmación**); categorías sin tope | `fijarPresupuesto`, `quitarPresupuesto`; preferencias `useAjustesPresupuesto` | Vacío "Ponle un tope…" | — | No | M |
| `categorias` | Categorías | `CategoriasEditor` · `components/CategoriasEditor.tsx` | Más > Preferencias | "Nueva"; formulario (nombre ≤ 28, emoji, ícono alternativo, color, vista previa); lista de propias (editar, reactivar, borrar si no se usa, archivar si se usa); categorías del sistema bloqueadas | `crearCategoria`, `actualizarCategoria`, `archivarCategoria`, `borrarCategoria` | Vacío "Aún no tienes categorías propias…" | — | No | M |
| `periodo` | Período | `PanelPeriodo` · `components/PanelPeriodo.tsx` | Más > Preferencias | 6 frecuencias (semanal, cada 2 semanas, dos veces al mes, mensual con día de inicio 1–28, personalizado con duración 1–90 y fecha ancla, sin reinicio); vista previa del ciclo | `useAjustesPeriodo` (`finanzas:periodo`) | — | Slider | No | M |
| `atajos` | Registro automático | `PanelAtajos` · `components/PanelAtajos.tsx` | Más > Preferencias | Llave de conexión (crear, copiar, administrar, revocar); enlaces a Atajos de iOS (Nequi u otros); instrucciones; URL del endpoint | `GET/POST /api/atajos/llave`, `POST /api/atajos/revocar`; consumo `POST /api/atajo/movimiento` | Cargando | — | No | M — **en Android hay que rediseñarlo** (equivalente: lectura de notificaciones o Tasker) o mostrarlo solo como informativo |
| `revisiones` | Revisar movimientos | `BandejaRevision` · `components/BandejaRevision.tsx` | Más > Tus datos | "N avisos por revisar"; tarjetas paginadas de 5 en 5 (movimiento, documento o transferencia); "Ver movimiento" (abre DetalleMovimiento), "Marcar revisado", "Descartar aviso"; decisiones guardadas | `almacen.guardarRevision`, `construirBandejaRevision` | "✨ Todo revisado" | — | No | S/M |
| `nombres` | Nombres repetidos | `ContactosView` (+ `DetalleContacto.tsx`, `DudaContacto.tsx`) | Más > Tus datos | Contador; "Agregar persona"; "¿Son la misma persona?" (unir o separar); tarjetas de contactos (renombrar, deshacer la unión); **DetalleContacto** en hoja inferior: le mandaste / te mandó, apodos, movimientos | `unirContactos`, `separarContactos`, `actualizarContacto`, `borrarContacto`, `apodarParte` | Vacío "Todavía no hay contactos…" | DetalleContacto: **arrastrar hacia abajo para cerrar** (> 90 px) | No | M/L |
| `contraseña` | Cambiar contraseña | `PasswordRecoveryView` | Solo ruta o búsqueda | Ver A2 | — | — | — | No | S |
| `respaldo` | Copia de seguridad | `PanelRespaldo` · `components/PanelRespaldo.tsx` | Más > Tus datos | Resumen de datos; "Generar informe / PDF" (abre Reporte); "Descargar respaldo completo" (JSON); "Exportar a Excel (.xls)"; "Movimientos en CSV"; "Restaurar desde un respaldo" (reemplaza todo, con confirmación) | `armarRespaldo`, `leerRespaldo`, `almacen.restaurar`, `descargarExcel` → **SAF** (CreateDocument / OpenDocument) y Share | Error de lectura o de restauración | — | No | M |
| `funciones-solicitadas` | Funciones solicitadas | `FuncionesSolicitadasView` · `components/FuncionesSolicitadasView.tsx` | Más > Comunidad | Lista por votos con ▲ (optimista); "¿Otras ideas?" con formulario | Supabase `funciones_solicitadas`, `funciones_solicitadas_votos` | "Cargando…"; sin sesión | — | No | S/M |
| `cuenta` | Cuenta (fila "Cuenta y Premium") | `CuentaView` · `components/CuentaView.tsx` | Más > La app | Avatar (apodo y correo); ID de cuenta (hash, copiar); **Tu plan** (Premium hasta… o Normal, chips de beneficios, botones mensual y anual con precio del servidor, verificación tras pagar con Wompi); Sincronización ("Sincronizar"); Cerrar sesión; Restablecer contraseña inline (con confirmación); Zona de riesgo "Eliminar cuenta"; pie "LukApp v{VERSION}" | `GET /api/mi-plan` (cada 30 s, caché de 5 min), `POST /api/pagos/wompi/checkout` (Web Checkout → **Custom Tab** + retorno), `updateUser({password})`, `POST /api/mi-cuenta/contrasena-cambiada`, `POST /api/mi-cuenta/eliminar`, tabla `perfiles` | "Consultando tus beneficios…", verificando pago, errores | — | Muestra los planes | **L** |
| (sin id) | Planes y precios | `CuentaView soloPlan` | Desde InvitacionPremium "Ver planes y precios" | Solo la tarjeta del plan | Igual que `cuenta` | — | — | Sí | (incluido) |

### 4.3 Capa Buscar
- **Componente:** `BuscadorMovimientos` + `ResultadosFunciones` + `TransactionList`, dentro de un HojaPanel "Buscar".
- **Cómo se llega:** lupa de Inicio, lupa de BotonAnotar, "Buscar una función" en Más.
- **Qué muestra:**
  - Campo "Movimiento o función…".
  - "Funciones de LukApp" según `buscarFunciones(texto)` (con alias; navega a la ruta del panel).
  - Filtros de tipo, categoría y cuenta. "N movimientos · sale X · entra Y", "Limpiar".
  - Resultados sobre **todo el historial**.
- **Estados:** vacío "No hay movimientos que coincidan…". **Gestos:** swipe en filas. **Complejidad:** M.

---

## 5. Modales y capas globales

| Modal | Componente · archivo | Cuándo aparece | Qué muestra y acciones | Datos | Gestos y teclas | Premium | Compl. |
|---|---|---|---|---|---|---|---|
| **BotonAnotar** (barra flotante) | `components/BotonAnotar.tsx` | Siempre en Inicio, Dinero, Mes y Calendario, si no hay ningún modal abierto. Oculta en Asesor y Más | Pastilla con ⌨ "Anotar a mano" (abre Captura en blanco), 📷 escanear comprobante (OCR), 🔍 Buscar; micrófono rojo de 64 px (Mic → escuchando → procesando; marca ✕ si el permiso está bloqueado); toast de OCR | `useDictation` → `POST /api/transcribir` (audio crudo, cabeceras de modo y vocabulario, Bearer, 18 s); `useImageOCR` (Tesseract local); `handleSubmit` reparte a ConfirmarComandoVoz, MultiCaptura o Captura | Háptica | Solo estética "cristal" (`esPremium`); cupo de dictados en servidor | M/L |
| **DictadoOverlay** | `components/DictadoOverlay.tsx` | Mientras se dicta desde BotonAnotar | Fases: escuchando ("Cuéntame qué gastaste…", barras de nivel, texto parcial), procesando, revelando ("Esto fue lo que entendí", palabra por palabra), error ("Escribir el movimiento"); botones Cancelar, "Terminé", "Revisar movimiento" | Ídem | — | — | M |
| **Captura** (alta rápida) | `components/Captura.tsx` (+ `TecladoNumerico.tsx`) | `pending`: dictado, OCR, "a mano", Repetir, Asesor, topes, compartido o dividir | Gasto/Ingreso; cámara; fecha; "Tu dictado" con avisos del parser y "Dictar otra vez"; "Como la última vez: Usar"; cuenta o tarjeta (o "Sin cuenta"); monto animado; descripción (vuelve a interpretar); 5 categorías frecuentes y "Ver todas"; teclado; **Guardar**; subdiálogo "¿De qué cuenta salió?" | `almacen.agregarTransaccion`; al guardar salta al período, cierra y muestra AvisoGuardado (con aviso de anomalía) | Esc; Enter guarda | No | **L** |
| **MultiCapturaModal** | `components/MultiCapturaModal.tsx` | El dictado produjo más de un movimiento | "N movimientos detectados", lista con 🗑, total, "Guardar los N" | `importarTransacciones` | — | No | M |
| **ConfirmarComandoVoz** | `components/ConfirmarComandoVoz.tsx` | `parseComandoVoz` detectó transferencia, abono, saldo o rendimiento | Campos según el tipo, fecha y validaciones (origen ≠ destino, abono ≤ deuda, saldo insuficiente avisa); Repetir, Cancelar, confirmar | `transferirEntreCuentas`, `abonarDeuda`, `fijarSaldo`, `registrarMovimiento('rendimiento')` | — | No | M |
| **ConfirmSheet** (editar) | `components/ConfirmSheet.tsx` (+ `SelectorFechaApp.tsx`) | Swipe izquierdo en una fila, o "Editar" en DetalleMovimiento | Monto, tipo, categoría (todas), cuenta, descripción, fecha (máx. hoy), "Escuché: …"; "Guardar cambios" | `actualizarTransaccion`; salta al período de la fecha nueva | Teclado en el calendario | No | M |
| **DetalleMovimiento** | `components/DetalleMovimiento.tsx` | Tocar una fila | Emoji, monto, descripción, categoría · día · cuenta, "Dijiste…"; Analizar, Editar, Borrar (**sin confirmación**); las transferencias no tienen acciones | `borrarTransaccion` | Tocar el fondo cierra | No | S |
| **AnalisisMovimiento** | `components/AnalisisMovimiento.tsx` | "Analizar" | Señales locales (inusual, recurrente, hormiga, duplicado…) o "Nada raro…" | `senalesDeMovimiento` (local, sin IA) | — | No | S |
| **AvisoGuardado** (toast) | `components/AvisoGuardado.tsx` | Tras guardar, operar por voz o fallar | Texto, detalle, estado de sincronización (local, pendiente, sincronizado, temporal), aviso; "Deshacer" (5 s) | `borrarTransaccion` | **Arrastrar hacia abajo para cerrar** (> 72 px o 520 px/s); se cierra solo a los 5 s | No | S/M |
| **Onboarding** | ver A3 | `!onboarding.terminado` | — | — | — | — | M |
| **GuiaApp** (guía) | `components/guia/GuiaApp.tsx`, `guia/pasos.ts` | La básica una vez tras el onboarding; la de cada sección la primera vez que se entra (dinero, mes, asesor, calendario, ajustes), si no hay capas abiertas | Velo con recorte sobre `[data-guia]`, globo, Saltar, Siguiente/Entendido, puntos | `useGuiaApp` | Esc | No | M (en Compose: `Modifier.onGloballyPositioned` + overlay). **Bug:** el ancla `saldo` (paso 1) no existe |
| **NovedadesCard** | — (`components/NovedadesCard.tsx` **no se usa**) | La novedad real es el banner dentro de InicioView (`NOVEDADES[0]`) | — | `useNovedades`, `novedades.ts` | — | — | S |
| **WelcomeTour** | — (`WelcomeTourLukApp.tsx` **no se usa**) | Reemplazado por Onboarding + GuiaApp | — | — | — | — | No migrar |
| **RachaModal** | `components/RachaModal.tsx` | Botón de racha en Inicio y en CabeceraDinero | Racha, récord y días del mes; estado de hoy; recordatorio diario (switch, hora, "Probar notificación"); medallas `HITOS_RACHA`; "Entendido" | `calcularRacha`, `useRecordatorioRacha`, `verificarRecordatorioRacha` (cada 15 min) → **WorkManager/AlarmManager + POST_NOTIFICATIONS** | — | No | M |
| **ResumenWrapped** | `components/ResumenWrapped.tsx` | Tarjeta "Tu resumen de {mes}" en Mes | Historias a pantalla completa (fondo `#0b0b12`): portada, balance, categoría estrella, cambio, gasto más caro, días activos, racha, comparación, cierre; Compartir, Cerrar | `resumenDelMes`, `textoParaCompartir` → Share | **Tocar el 30 % izquierdo retrocede, el resto avanza**; ←/→/Esc; sin swipe | No | M |
| **InvitacionPremium** | `components/InvitacionPremium.tsx` | En Inicio, con onboarding terminado, sin guía ni modales, a los 8 s, si el plan es `normal`, como máximo cada 14 días (`lukapp-proxima-invitacion-premium-v1:{userId}`). No se muestra a admins | "Más espacio para tus finanzas…", beneficios, "Desde $X/mes · Anual $Y", "Ver planes y precios" (abre la hoja Planes), "Seguir con Normal" | `GET /api/mi-plan` | Esc | Sí | M |
| **ReporteFinancieroModal** | `components/ReporteFinancieroModal.tsx` | Respaldo > "Generar informe / PDF" | Hero "Así cerraste {mes}", balance, ingresos y gastos, top 6 categorías, dinero hoy por cuenta; Excel, "Guardar PDF" (`window.print`) | `datos`, `cajitasBalances` → **PdfDocument/PrintManager** | — | No | M |
| Banners de estado | inline en `LukAppApp.tsx` | Sin conexión / almacenamiento no persistente / cambios pendientes / error del almacén | Textos de aviso; ✕ en el error | `navigator.onLine` → **ConnectivityManager**; `almacen.cambiosPendientes` | — | — | S |

---

## 6. Ajustes disponibles (AjustesView — lista exhaustiva, en orden)

| # | Bloque | Opción | Tipo | Efecto / destino | Persistencia |
|---|---|---|---|---|---|
| 1 | — | Buscar una función de LukApp | Botón | Capa Buscar | — |
| 2 | Preferencias | 🏷️ Categorías | Fila | Panel `categorias` | Supabase (categorías) |
| 3 | Preferencias | 🗓️ Período | Fila | Panel `periodo` | `finanzas:periodo` |
| 4 | Preferencias | 💳 Registro automático | Fila | Panel `atajos` | API de llaves |
| 5 | Tus datos | 🧭 Revisar movimientos | Fila | Panel `revisiones` | Supabase (revisiones) |
| 6 | Tus datos | 👥 Nombres repetidos | Fila | Panel `nombres` | Supabase (contactos) |
| 7 | Tus datos | 💾 Copia de seguridad | Fila | Panel `respaldo` | — |
| 8 | Comunidad | 🔧 Funciones solicitadas | Fila | Panel `funciones-solicitadas` | Supabase |
| 9 | La app | Próximos pagos en Inicio | Interruptor | Muestra u oculta ProximosPagosInicio | `finanzas:inicio:proximos-pagos` (por defecto sí) |
| 10 | La app | Contar los ahorros | Interruptor | Suma los ahorros al total de arriba | `finanzas:resumen:ahorro` (por defecto sí) |
| 11 | La app | Mostrar decisiones financieras | Interruptor | DecisionFinanciera en Inicio | `finanzas:resumen:decisiones` (por defecto sí) |
| 12 | La app | Mostrar efectivo por separado | Interruptor | Desglose Bancos / Efectivo | `finanzas:resumen:efectivo-separado` (por defecto no) |
| 13 | La app | Recordatorio diario de racha | Interruptor + **hora** (`time`, por defecto 20:30) | Pide permiso y programa la notificación | `finanzas:recordatorio-racha:activo` / `:hora` |
| 14 | La app | Volver a ver la guía | Botón (oculto mientras la guía está abierta) | `guia.reiniciar()` y va a Inicio | `finanzas:guia:*` |
| 15 | La app | Ecosistema / Superadmin | Botón (**solo `esAdmin`**) | `window.location.href='/ecosistema'` | — |
| 16 | La app | Apariencia | TemaToggle (claro, oscuro, sistema) | `useTema` | localStorage |
| 17 | La app | Cuenta y Premium (muestra el correo) | Fila | Panel `cuenta` | — |

Preferencias que existen pero **no están en Más**:
- Modo privacidad: ojo en Inicio, `finanzas:modo-privacidad`.
- Cuenta favorita: DetalleCajita, `finanzas:cuenta-favorita`.
- Alertas y umbral de topes: PresupuestosView, `finanzas:presupuestos:*`.
- GMF: PanelGmf, `finanzas:gmf:*`.
- Onboarding y nombre: `finanzas:onboarding:*`.
- Novedad vista: `finanzas:novedades:version-vista`.

**Sincronización:** cada `set` escribe en localStorage **y** en `supabase.auth.updateUser({data})` (la user_metadata). Al iniciar sesión se bajan con `sincronizarDesdeSupabase`. Excepción: privacidad, decisiones y recordatorio no se bajan desde la nube.

En Android: **DataStore** para lo local, y la misma escritura en la user_metadata para mantener la paridad entre aparatos.

---

## 7. Datos transversales (para la capa de datos Kotlin)

### Almacén (`data/useAlmacen.ts`, `RepositorioConCola`)
- **Colecciones:** transacciones, cajitas, cajitaMovimientos, categorías, presupuestos, metas, recurrentes, contactos y revisiones.
- **Modo offline:** se escribe primero en IndexedDB por usuario (`finanzas-nube-<userId>`), con una cola de cambios hacia Supabase.
- **Equivalente en Android:** Room + WorkManager.
- **Recarga:** al volver a la app (`useSincronizacion`) y con pull-to-refresh.

### Operaciones del almacén
`agregarTransaccion`, `actualizarTransaccion`, `borrarTransaccion`, `importarTransacciones`, `crearCajita`, `actualizarCajita`, `borrarCajita`, `fijarSaldo`, `registrarMovimiento`, `transferirEntreCuentas`, `abonarDeuda`, `fijarPresupuesto`, `quitarPresupuesto`, `crearMeta`, `actualizarMeta`, `borrarMeta`, `crearRecurrente`, `actualizarRecurrente`, `borrarRecurrente`, `confirmarRecurrente`, `crearCategoria`, `actualizarCategoria`, `archivarCategoria`, `borrarCategoria`, `unirContactos`, `separarContactos`, `actualizarContacto`, `borrarContacto`, `apodarParte`, `guardarRevision`, `restaurar`, `recargar`.

### Motores locales que hay que portar o compartir
- **Parsers:** `parseTransaction`, `parseMultipleTransactions`, `parseComandoVoz`, `aprendizaje`.
- **Agregados y cálculo:** `aggregate`, `periodo`, `motorFinanciero`, `centroInteligenciaFinanciera`, `insights`, `senales*`, `racha`, `resumenMes`, `tendencias`, `detalle`, `gmf`, `recurrentes`, `metasInteligentes`, `cajitas`, `tarjetas`, `cuotasTarjeta`.
- **Asesor:** `asesorBot`, `simulacionConversacional`, `propuestasAsesor`.
- **Utilidades:** `formatCop`, `localDate` (zona horaria de Bogotá), `festivosColombia`.

Recomendación: fijar el comportamiento con los tests de vitest existentes (`*.test.ts`) y portarlos a JUnit.

### Endpoints
- **Plan y extractos:** `/api/mi-plan`, `/api/analizar-extracto`.
- **IA y voz:** `/api/transcribir`, `/api/finanzas-insights-ia`, `/api/asesor-ia` (+ `/disponibilidad`, `/respaldo-local`), `/api/asesor/memoria`, `/api/asesor/conversaciones`, `/api/asesor/conversaciones/:id/mensajes`, `/api/asesor/mensajes`.
- **Comprobantes por correo:** `/api/comprobantes-correo/*`.
- **Atajos:** `/api/atajos/llave`, `/api/atajos/revocar`.
- **Pagos:** `/api/pagos/wompi/checkout`.
- **Cuenta:** `/api/mi-cuenta/contrasena-cambiada`, `/api/mi-cuenta/eliminar`.
- **Sesión y permisos:** `/api/mis-permisos`, `/api/registrar-ultimo-acceso`.
- **Legal:** `/api/legal/terminos`.

### Capacidades nativas necesarias
| Capacidad | Para qué |
|---|---|
| RECORD_AUDIO y grabación | Dictado |
| Cámara o selector de imágenes + ML Kit OCR | Escanear comprobantes |
| SAF | Respaldo, Excel, CSV y PDF |
| Share | Compartir textos y archivos |
| Intent SEND | Recibir extractos compartidos |
| Custom Tabs | Wompi y Google |
| Credential Manager | Entrar con Google |
| POST_NOTIFICATIONS + WorkManager | Recordatorio de racha |
| TTS | Leer respuestas del Asesor en voz alta |
| Supabase Realtime | Espacios compartidos |
| Háptica | Respuesta táctil en botones y gestos |

---

## 8. Gestos (resumen verificable)

| Gesto | Dónde | Detalle |
|---|---|---|
| Pull-to-refresh | Solo Inicio, sin modales | `hooks/usePullToRefresh.ts`: umbral 70 px, tope 110 px, resistencia 0,45 |
| Swipe derecho en fila | TransactionList (Inicio, Buscar) | ≥ 84 px: **Repetir** (abre Captura con los datos copiados) |
| Swipe izquierdo en fila | TransactionList | ≥ 84 px: **Editar** (abre ConfirmSheet) |
| Arrastrar abajo para cerrar | AvisoGuardado, DetalleContacto | > 72 px o 520 px/s; > 90 px o 500 |
| Tocar por zonas | ResumenWrapped | 30 % izquierdo retrocede; el resto avanza |
| Scroll horizontal | Carrusel de categorías, chips de Captura y de espacios | Desactiva el pull-to-refresh |
| Long press | **Ninguno** | `useLongPress` y `useSwipeGesture` existen pero no se usan |

---

## 9. Panel superadmin (`src/apps-dashboard/`) — fuera de alcance

- **Cómo se accede:**
  - En Más, la fila "Ecosistema / Superadmin" solo aparece si `esAdmin`; navega a `/ecosistema` (`AppLauncher`).
  - Rutas: `/superadmin` (pestañas usuarios, roles, legal, facturación, ia-tokens, visitantes, auditoría) y `/estadisticas`.
  - El rol sale de `/api/mis-permisos`.
  - También incluye el modo "asesoría" (suplantación), que muestra un banner "Volver a mi cuenta".
- **¿Se alcanza desde la app móvil?** **Sí, hoy sí**: el cliente Android es una WebView de `mi.lukapp.app`, así que un admin puede abrirlo desde Más.
- **Recomendación para Compose:** no reescribirlo. Si `esAdmin`, mostrar la fila y abrir `https://mi.lukapp.app/ecosistema` en una Custom Tab, o no mostrarla en móvil.
- **Banner de suplantación:** si se mantiene la suplantación en móvil, hace falta replicar ese banner.

---

## 10. Código muerto o inconsistencias detectadas (a decidir antes de migrar)

1. **Componentes que no se importan en ningún sitio:**
   - `NovedadesCard.tsx`, `PrimerosPasos.tsx`, `WelcomeTourLukApp.tsx` (`WelcomeTourFinanzas`).
   - `Estrella.tsx`, `EstrellaAnimada.tsx`, `EstrellaAvatar.tsx`, `EstrellaSecuencia.tsx`.
   - Los hooks `useSwipeGesture` y `useLongPress`.
2. **Estrella IA frente a Luki:** CLAUDE.md dice que la Estrella IA es el personaje de la IA, pero AsesorView usa **Luki**. Hay que definir cuál va en Android.
3. `VaquitasModal` está montado dentro de AsesorView, pero nada lo abre.
4. El ancla de la guía `saldo` (PASOS_BASICOS[0]) no existe en el DOM.
5. Calendario: la vista "Semana" agrupa igual que "Mes".
6. El redirect de recuperación es distinto en `PasswordRecoveryView` (`/auth/reset-password`) y en `useSesion` (`/entrar`).
7. Borrados sin confirmación: metas, gastos compartidos, recurrentes, quitar tope y borrar movimiento (DetalleMovimiento; queda Deshacer solo al crear).
8. El toggle "Contar las cajitas en el resumen" de CajitasView nunca se ve, porque no se le pasa `onMostrarEnResumen`.
9. 👍/👎 del Asesor no se guardan en ningún lado.
10. Premium no se valida en el cliente; solo lo hace el servidor (403 o 429 `cupo-agotado`). En Android conviene mapear esos errores a un aviso de mejora de plan.
11. Vaquitas vive solo en el dispositivo y se pierde al cambiar de aparato.
12. `loginValidation.ts` (bloqueo por intentos y regla alfanumérica del apodo) no se aplica en LoginPanel.
13. En DetalleCajita, el input de monto de "Enviar desde X" tiene el placeholder y el aria-label del campo de saldo.

---

## 11. Matriz de migración

Prioridad: **1** = núcleo (acceso, Inicio, captura de movimientos, Dinero, Mes) · **2** = uso frecuente · **3** = complementario · **4** = baja, opcional o rediseño.

| Funcionalidad | Componente web | Pantalla Compose propuesta | Dependencias | Prioridad | Estado |
|---|---|---|---|---|---|
| Armazón, barra inferior, navegación y Atrás | `LukAppShell.tsx`, `sections.ts`, `data/useRuta.ts`, `lib/navegacionFunciones.ts` | `ArmazonLukApp` + `NavegacionLukApp` (NavHost) | Navigation Compose, deep links, BackHandler | 1 | Parcial: barra, fundido y Atrás por secciones; sin paneles ni deep links de rutas |
| Sesión y auth | `data/useSesion.ts` | `RepositorioSesion` (capa de datos) | supabase-kt Auth, deep link de recuperación | 1 | Parcial: correo, registro, recuperación, Google (Credential Manager), sesión cifrada; sin verificar en dispositivo |
| Login, registro y recuperación | `LoginPanel.tsx`, `ChecklistContrasena.tsx`, `BotonGoogle.tsx` | `PantallaAcceso` (entrar, registrarse, recuperar, actualizar) | useSesion, RPC `usuario_disponible`, Credential Manager / Custom Tab | 1 | Hecho en código (variante data-native); sin verificar en dispositivo |
| Nueva contraseña (enlace de recuperación) | `LoginPanel` modo actualizar | `PantallaNuevaContrasena` | Deep link `type=recovery` | 1 | Hecho en código (modo actualizar); sin verificar en dispositivo |
| Onboarding | `Onboarding.tsx`, `TecladoNumerico.tsx` | `PantallaBienvenida` | `crearCajita`, preferencias de onboarding | 1 | Pendiente |
| Carga y errores | `PantallaCarga.tsx`, error inline | `PantallaCarga`, `PantallaErrorCarga` | — | 1 | Parcial: PantallaCarga (350 ms); falta mensaje a los 22 s y error sin datos |
| Almacén offline y sincronización | `useAlmacen`, `RepositorioConCola`, `colaCambios`, `useSincronizacion` | `RepositorioFinanzas` (Room + cola + WorkManager) | Supabase Postgrest | 1 | Parcial: copia cifrada + cola + RPC idempotente; sin WorkManager |
| Motores de cálculo | `lib/*` (aggregate, periodo, motorFinanciero, cajitas, racha…) | Módulo Kotlin `motor` (puro) | Tests portados desde vitest | 1 | Hecho: 17 módulos, 109 pruebas JUnit en verde |
| Banners de estado | inline en `LukAppApp.tsx` | `AvisosEstado` | ConnectivityManager, cola | 1 | Parcial: sin conexión / error de sincronización |
| Inicio | `InicioView.tsx` | `PantallaInicio` | contextoFinanciero, preferencias, TransactionList | 1 | Parcial: cabecera, disponible, desglose, gastos/ingresos, movimientos; faltan próximos pagos, análisis, Pulso, insights, novedades, modal de racha |
| Próximos pagos en Inicio | `ProximosPagosInicio.tsx` | `TarjetaProximosPagos` | obligaciones | 1 | Pendiente |
| Decisiones financieras | `DecisionFinanciera.tsx` | `TarjetaDecisionFinanciera` | `simularDecisiones` | 2 | Pendiente |
| Lista de movimientos con swipe | `TransactionList.tsx` | `ListaMovimientos` (SwipeToDismissBox) | Catálogo de categorías | 1 | Parcial: lista agrupada; sin swipe ni señales |
| Botón anotar flotante | `BotonAnotar.tsx` | `BarraAnotar` | Dictado, OCR, Buscar | 1 | Pendiente |
| Dictado por voz | `DictadoOverlay.tsx`, `useDictation`, `useAudioCapture` | `PantallaDictado` + `GrabadorAudio` | RECORD_AUDIO, `POST /api/transcribir` | 1 | Parcial: intérprete de texto portado (160 pruebas, paridad con la web); falta grabación, /api/transcribir y pantalla |
| Captura rápida | `Captura.tsx` | `PantallaCaptura` (ModalBottomSheet a pantalla completa) | Parsers, `agregarTransaccion`, `TecladoNumerico` | 1 | Pendiente |
| Escanear comprobante (OCR) | `useImageOCR.ts` | `LectorComprobante` | ML Kit Text Recognition, cámara o selector | 2 | Pendiente |
| Varios movimientos dictados | `MultiCapturaModal.tsx` | `HojaVariosMovimientos` | `importarTransacciones` | 1 | Pendiente |
| Comandos de voz (transferir, abonar, saldo, rendimiento) | `ConfirmarComandoVoz.tsx` | `HojaComandoVoz` | `parseComandoVoz`, almacén | 2 | Pendiente |
| Editar movimiento | `ConfirmSheet.tsx`, `SelectorFechaApp.tsx` | `HojaEditarMovimiento` + `SelectorFecha` (DatePicker) | `actualizarTransaccion` | 1 | Pendiente |
| Detalle de movimiento | `DetalleMovimiento.tsx` | `HojaDetalleMovimiento` | `borrarTransaccion` | 1 | Pendiente |
| Análisis de movimiento | `AnalisisMovimiento.tsx` | `HojaAnalisisMovimiento` | `senalesDeMovimiento` | 3 | Pendiente |
| Aviso de guardado y Deshacer | `AvisoGuardado.tsx` | `AvisoGuardado` (Snackbar personalizado) | `borrarTransaccion` | 1 | Pendiente |
| Buscar movimientos y funciones | `BuscadorMovimientos.tsx`, `ResultadosFunciones.tsx` | `PantallaBuscar` | `filtros`, `buscarFunciones` | 2 | Pendiente |
| Dinero (resumen) | `DineroView.tsx`, `CabeceraDinero.tsx`, `FilaCuenta.tsx`, `IconoCuenta.tsx`, `AccesosFunciones.tsx` | `PantallaDinero` | Saldos, entidades financieras (logos) | 1 | Parcial (ver MIGRACION.md) |
| Cuentas y ahorros (crear y operar) | `CajitasView.tsx`, `CajitaCard.tsx`, `AvanzadoAhorro.tsx` | `PantallaCuentas` + `TarjetaCuenta` | `crearCajita`, `fijarSaldo`, `registrarMovimiento`, `transferir`; multimoneda | 1 | Pendiente |
| Detalle de cuenta | `DetalleCajita.tsx` | `PantallaDetalleCuenta` | Almacén, cuenta favorita | 1 | Pendiente |
| Tarjetas y deudas | `DeudasView.tsx` | `PantallaTarjetasDeudas` | `abonarDeuda`, compras a cuotas, `resumenTarjeta` | 1 | Pendiente |
| Mes | `MesView.tsx` | `PantallaMes` | Período, agregados | 1 | Parcial (ver MIGRACION.md) |
| Desglose por categoría | `CategoryBreakdown.tsx` | `DesgloseCategorias` | Catálogo | 1 | Pendiente |
| Detalle del mes (días, mayores, contrapartes) | `DetalleMes.tsx` | `DetalleDelMes` (Canvas) | `lib/detalle` | 1 | Pendiente |
| Tendencias | `TendenciasView.tsx`, `GraficaLineas.tsx` | `SeccionTendencias` + `GraficaLineas` (Canvas) | `lib/tendencias` | 2 | Pendiente |
| Topes de gasto | `PresupuestosView.tsx` | `PantallaTopes` (embebible en Mes) | `fijarPresupuesto`, preferencias de alertas | 1 | Pendiente |
| Exportar mes a Excel | `lib/exportarExcel.ts` | `ExportadorExcel` | SAF / Share | 3 | Pendiente |
| Resumen tipo Wrapped | `ResumenWrapped.tsx` | `PantallaResumenWrapped` | `resumenMes`, Share | 2 | Pendiente |
| Calendario financiero | `CalendarioFinancieroView.tsx` | `PantallaCalendario` | `eventosDelContexto` | 2 | Pendiente |
| Pagos fijos | `RecurrentesView.tsx` | `PantallaPagosFijos` | `recurrentes`, almacén | 2 | Pendiente |
| Proyección financiera | `ForecastResumen.tsx` | `PantallaProyeccion` | `contextoFinanciero.forecast` | 3 | Pendiente |
| Asesor IA (chat) | `AsesorView.tsx` | `PantallaAsesor` | `/api/asesor-ia*`, motores locales, TTS, dictado, Luki/Estrella | 2 | Pendiente |
| Historial de conversaciones del asesor | `AsesorView` (hoja lateral) | `HojaConversaciones` | `/api/asesor/conversaciones` | 2 | Pendiente |
| Insights IA y Pulso Premium | `useAiInsights.ts`, InicioView | `RepositorioInsights` + `TarjetaPulsoPremium` | `/api/mi-plan`, `/api/finanzas-insights-ia` | 2 | Pendiente |
| Más (lista de ajustes) | `AjustesView.tsx`, `TemaToggle.tsx` | `PantallaMas` | DataStore, preferencias | 1 | Pendiente |
| Preferencias sincronizadas | `data/usePreferencias.ts`, `useTema.ts` | `RepositorioPreferencias` (DataStore + user_metadata) | supabase-kt Auth | 1 | Pendiente |
| Cuenta, plan y Premium | `CuentaView.tsx` | `PantallaCuenta` + `HojaPlanes` | `/api/mi-plan`, Wompi en Custom Tab, eliminar cuenta | 2 | Pendiente |
| Confirmación de pago | `ConfirmacionPagoWompi.tsx` | `PantallaConfirmacionPago` | Deep link de retorno, polling de `/api/mi-plan` | 2 | Pendiente |
| Invitación Premium | `InvitacionPremium.tsx` | `DialogoInvitacionPremium` | `/api/mi-plan`, DataStore (14 días) | 3 | Pendiente |
| Cambiar contraseña (enlace) | `PasswordRecoveryView.tsx` | `PantallaCambiarContrasena` | useSesion (redirect unificado) | 2 | Pendiente |
| Categorías | `CategoriasEditor.tsx` | `PantallaCategorias` | Almacén de categorías | 2 | Pendiente |
| Período | `PanelPeriodo.tsx` | `PantallaPeriodo` | `useAjustesPeriodo` | 2 | Pendiente |
| Metas de ahorro | `MetasView.tsx` | `PantallaMetas` | `metas`, `metasInteligentes` | 2 | Pendiente |
| Importar extractos | `AnalistaView.tsx`, `AnalistaReporte.tsx`, `analista/*` | `PantallaImportarExtractos` + `ReporteExtracto` | `/api/analizar-extracto`, comprobantes por correo, ML Kit, POI, intent SEND | 3 | Pendiente |
| Revisar movimientos | `BandejaRevision.tsx` | `PantallaRevisiones` | `guardarRevision` | 3 | Pendiente |
| Nombres repetidos y contactos | `ContactosView.tsx`, `DetalleContacto.tsx`, `DudaContacto.tsx` | `PantallaContactos` + `HojaDetalleContacto` | `lib/contactos` | 3 | Pendiente |
| Copia de seguridad | `PanelRespaldo.tsx`, `lib/respaldo.ts` | `PantallaRespaldo` | SAF, `restaurar` | 2 | Pendiente |
| Informe mensual PDF | `ReporteFinancieroModal.tsx` | `PantallaInformeMensual` | PdfDocument / PrintManager | 3 | Pendiente |
| Impuesto 4x1000 | `PanelGmf.tsx`, `lib/gmf.ts` | `PantallaCuatroPorMil` | `useAjustesGmf` | 3 | Pendiente |
| Finanzas compartidas | `EspaciosCompartidosView.tsx`, `useEspaciosCompartidos.ts` | `PantallaEspaciosCompartidos` | Supabase Realtime, RPC, deep link `?invitacion=` | 3 | Pendiente |
| Dividir cuenta y propina | `DivisionCuentasModal.tsx` | `PantallaDividirCuenta` | Share, Captura | 3 | Pendiente |
| Vaquitas | `VaquitasModal.tsx`, `lib/vaquitasColombia.ts` | `PantallaVaquitas` | DataStore/Room (decidir si pasa a Supabase) | 3 | Pendiente |
| Racha y recordatorio | `RachaModal.tsx`, `lib/racha.ts`, `recordatorioRacha.ts` | `HojaRacha` + `TrabajoRecordatorioRacha` | WorkManager, POST_NOTIFICATIONS | 2 | Pendiente |
| Guía de la app | `guia/GuiaApp.tsx`, `guia/pasos.ts` | `GuiaSuperpuesta` | `useGuiaApp`, anclas por `onGloballyPositioned` | 3 | Pendiente |
| Banner de novedades | InicioView + `novedades.ts` | `BannerNovedad` | `useNovedades` | 2 | Pendiente |
| Funciones solicitadas | `FuncionesSolicitadasView.tsx` | `PantallaFuncionesSolicitadas` | Supabase | 4 | Pendiente |
| Registro automático (Atajos iOS) | `PanelAtajos.tsx` | `PantallaRegistroAutomatico` (rediseño Android) | `/api/atajos/*` | 4 | Pendiente |
| Legal | `LegalLukApp.tsx` | `PantallaLegal` | `/api/legal/terminos` | 3 | Pendiente |
| Eliminar datos (solicitud) | `SolicitudEliminacionDatos.tsx` | `PantallaSolicitarEliminacion` | Intent ACTION_SENDTO | 3 | Pendiente |
| Acceso a superadmin | `AjustesView` (fila `esAdmin`), `apps-dashboard/*` | `FilaEcosistema` → Custom Tab | `/api/mis-permisos` | 4 | Pendiente |
| Modo privacidad | `usePrivacyMode`, InicioView | `EstadoPrivacidad` (global) | DataStore | 1 | Pendiente |
| Háptica y sonidos | `useHapticFeedback`, `useAudioFeedback` | `RetroalimentacionTactil` | HapticFeedback / VibrationEffect | 2 | Pendiente |
