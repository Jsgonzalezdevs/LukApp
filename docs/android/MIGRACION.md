# Migración de LukApp a Android nativo: estado

Este es el resumen que se mantiene al día de una sesión a otra. El detalle está en
[auditoria-diseno.md](auditoria-diseno.md), [auditoria-datos.md](auditoria-datos.md) y
[inventario-pantallas.md](inventario-pantallas.md), cuya §11 es el checklist por funcionalidad.

- **Rama:** `android-nativo`. **Código:** `apps/android` (Kotlin, Compose, una sola actividad).
- **App publicada:** sigue siendo la de Expo con WebView (`apps/mobile`). No se toca ni se
  reemplaza hasta alcanzar la paridad.
- **Identidad:** la app nativa usa `applicationId` `lukApp.App`. El `versionCode` sale de
  `src/version.ts`, con el mismo esquema que Expo (10.14.1 → 1014001). La compilación de debug
  se llama `lukApp.App.nativa.debug`, así que convive con la de Play.

## Arquitectura

| Capa | Paquete | Qué hay |
|---|---|---|
| Dominio | `dominio/`, `dominio/voz/` | Reglas de `src/features/lukapp/lib` en Kotlin puro, con resultados idénticos a los de la web |
| Datos | `datos/` | `RepositorioFinanzas`: lee las 9 tablas de 500 en 500 y escribe solo por la RPC `aplicar_cambios_financieros` con `id_operacion`. Usa una cola en orden y una copia local cifrada. `PreferenciasCuenta` (`user_metadata`) y `Preferencias` (DataStore) |
| Seguridad | `seguridad/` | Sesión de Supabase cifrada (AES-GCM, Keystore), archivos cifrados, BiometricPrompt y Google con Credential Manager e ID token + nonce |
| Sesión | `sesion/` | `ServicioSesion`: entrar, registro, recuperación, nueva contraseña, apodo libre, enlaces `lukapp://auth/callback` |
| UI | `ui/` | Tema con los tokens `--fin-*` exactos, Poppins, íconos lucide con sus trazos reales (generados), acceso, shell e Inicio |
| Nativo | `nativo/` | Hápticos con los 7 patrones de `useHapticFeedback` |

No usa Hilt: la inyección es manual en `Contenedor.kt` (el porqué está en el archivo). Las
herramientas viven en `apps/android/herramientas/`: el generador de íconos y el corpus de
paridad del intérprete de voz.

## Verificado de verdad (2026-11-11)

- `./gradlew :app:testDebugUnitTest` → **269 pruebas, 0 fallos**: 109 de reglas financieras y 160
  del intérprete de voz. Entre las de voz, `ParidadWebTest` compara contra la salida real de la
  web sobre 167 frases.
- `./gradlew :app:assembleDebug` → genera el APK de debug.
- `./gradlew :app:bundleRelease` → genera el AAB con R8, **sin firmar**.

## Verificado en emulador (2026-11-11, Android 16, Pixel 7, AVD `LukAppPrueba`)

- La app abre sin cierres inesperados (`logcat -b crash` vacío). El splash da paso al acceso.
- Acceso en claro y en oscuro: tarjeta, pastilla Entrar/Crear cuenta, campos, «Recuérdame» y pie.
- Crear cuenta: el apodo consulta la RPC real `usuario_disponible` en Supabase y muestra
  «disponible». Con «Abc12», el checklist marca mayúscula y minúscula y deja pendientes largo y
  carácter especial, como la web.
- Recuperar contraseña: encabezado, «Volver» y botón deshabilitado sin correo válido.
- La preferencia de tema sobrevive al reinicio de la app. La barra de estado sigue al tema.
- Google, sin `GOOGLE_WEB_CLIENT_ID`, muestra «El acceso con Google todavía no está disponible
  en esta versión.» en lugar de fallar.

Defectos encontrados en el emulador y corregidos: sombras que se transparentaban debajo de
superficies translúcidas, el selector de tema fijo encima del formulario, los íconos de la barra
de estado oscuros en el tema oscuro y la tarjeta sin centrar en vertical.

### Con sesión real (el dueño entró en el emulador)

- Inicio carga los datos reales de Supabase, sin errores en el registro. Toma el período semanal
  guardado en `user_metadata` y muestra disponible, bancos/efectivo, gastos/ingresos, racha y
  movimientos agrupados por día.
- El menú de período lista 13 períodos semanales. Se corrigió que ocupara todo el ancho.
- La barra inferior cambia de sección, y Atrás desde una sección vuelve a Inicio.
- Dinero y Mes, con los datos reales. Se corrigieron: la proporción de la fila de cuenta (60/40), el
  recorte del logo de Davivienda (`auto 80%`) y el contenido que pasaba por detrás de la barra de estado.
- Para comparar con la web: la racha de Dinero sale con todo el historial (366 días en esta cuenta) y
  la de Inicio solo con el período. Es igual en la web.

### Barra de anotar (v10.14.5)

- Probado en emulador: la barra aparece en Inicio, Dinero y Mes; Captura abre con la cuenta principal,
  el teclado propio escribe el monto, «almuerzo» detecta Comida y «taxi» Transporte, y al cerrar el
  teclado del sistema vuelve el de LukApp. El micrófono pide permiso solo al tocarlo y abre la capa
  de dictado grabando.
- Corregido de paso: con el token vencido al abrir, la app mostraba un instante el acceso; ahora
  entra con la copia local mientras renueva la sesión.
- Guardado verificado de punta a punta (con permiso del dueño): un gasto de $1 «PruebaAppNativa» se
  guardó por la RPC, la cola quedó vacía y, borrando la copia local, volvió a bajar desde Supabase.
  Ese movimiento de prueba sigue en la cuenta: hay que borrarlo desde la web.
- **No probado:** enviar audio a transcribir (gasta cupo de dictado y el emulador no tiene micrófono).

### Detalle, edición y borrado (v10.14.7)

- Probado en emulador con la cuenta real: tocar un movimiento abre su detalle; Editar abre la hoja con
  los datos; **Borrar** quitó el movimiento de prueba de $1 y las cifras volvieron exactas a las de antes
  (disponible $5.162.394, Bancos $3.674.544, racha 2). La cola quedó vacía. Cuenta limpia.
- Pruebas JUnit nuevas (6): editar o borrar una compra de tarjeta actualiza o borra también su
  movimiento de la tarjeta, y el detector de montos fuera de lo usual.
- No probado en pantalla: guardar una edición y el aviso con Deshacer (el aviso aparece tras guardar).
- **Pendiente a revisar en un teléfono real:** con el emulador recién arrancado, la pantalla de acceso se
  ve unos 10 s mientras la sesión cifrada termina de cargar. Hay que comprobar si pasa en un teléfono
  y, si pasa, mostrar la pantalla de carga en ese intervalo.

### Mes completo (v10.14.8)

- Probado en emulador con la cuenta real: «Cómo vienes» con la gráfica de líneas (6 meses), selector
  3M/6M/12M, lectura del mes, frase comparativa, «Promedio mensual», «Contra el mes pasado» y los topes
  con su barra y «Te quedan…». Corregido: la lectura del mes partía la cifra en 3 líneas.
- 8 pruebas JUnit nuevas de `lib/tendencias`. Los topes usan `estadoDeTodos`, ya probado.
- No probado en pantalla: tocar un mes en la gráfica y el aro de aviso (ningún tope está cerca del límite).
- Decisión: los dos «Otros» seguidos son categorías propias del usuario con el mismo nombre; igual en la web.

### Detalle de cuenta (v10.14.9)

- Probado en emulador con la cuenta real: al tocar Bancolombia abre su detalle (saldo $3.670.600, «Cuenta
  principal activa», historial con 2 ajustes); la edición del saldo abre con el teclado numérico y se
  cancela; «Eliminar cuenta» pregunta «¿Eliminar Bancolombia? Esta acción no se puede deshacer» y se
  canceló. Las filas de tarjetas y deudas no se pueden tocar todavía (su pantalla no está migrada).
- 3 pruebas JUnit nuevas: «mi saldo es X» mide contra el saldo efectivo y registra el ajuste, el primer
  cero de una cuenta cuenta como dato, y borrar una cuenta deja los movimientos, recurrentes y metas sin
  vínculo y se refleja igual en la copia local.
- **No probado a propósito (escriben o borran datos reales):** guardar un saldo nuevo, activar/desmarcar
  la cuenta principal y confirmar la eliminación.
- Diferencia: al eliminar la cuenta principal, la app nativa la desmarca; la web la deja apuntando a una
  cuenta que ya no existe.

### Tarjetas y deudas (v10.14.10)

- Probado en emulador con la cuenta real: «Ver todas» abre la vista; NuBank muestra $320.459 usados,
  «Para pagar este mes $50.000», cupo disponible $1.679.541 · corte 10 · pago 18, y sus compras (incluida
  «Curso de inglés, 5 cuotas de $50.000»). El formulario de compra se ve completo y no deja guardar sin monto.
- 3 pruebas JUnit nuevas (12 en OperacionesLibro): abonar mueve la deuda y la cuenta sin crear un gasto;
  una compra con tarjeta guarda el movimiento y el gasto con el mismo id y cuenta una sola vez en el saldo;
  una sola cuota no es compra financiada.
- **No probado a propósito (escriben datos reales):** guardar una compra, un abono o un saldo, y eliminar.
- En la web el botón «Tarjetas de crédito» va junto a «Agregar cuenta» en una cuadrícula de dos; aquí va solo,
  a todo el ancho, hasta que exista crear cuenta.

### Más (v10.14.11)

- Probado en emulador con la cuenta de demo: «Ajustes» con Contar los ahorros (marcado), Desbloquear con
  huella (deshabilitado: el emulador no tiene huella, y lo dice), Apariencia, Cuenta y Premium con el correo
  y Cerrar sesión. No se tocó ningún interruptor, para no escribir en la cuenta.
- **Causa del «no tengo internet»:** el emulador había perdido el DNS (`unknown host google.com`) tras un
  cambio de red del Mac; la app no podía renovar la sesión y mostraba el acceso. No era una sesión caducada.
  Se arregló reiniciando el emulador con `-dns-server 8.8.8.8,1.1.1.1`.
- **Arranque sin red con token vencido (v10.14.14):** `RefreshFailure` llega sin usuario, así que la app
  guarda el último uid cifrado (`Contenedor.ultimoUsuario`, se borra al cerrar sesión) y, si no puede renovar,
  abre con la copia local del libro y el aviso «Sin conexión». Compila y pasa las pruebas, pero **no se
  verificó en emulador**: el token de la sesión de prueba fue revocado por el servidor
  (`refresh_token_not_found`, un 400 real, no un fallo de red) y el emulador mostró el acceso, que es lo
  correcto en ese caso. Falta probarlo entrando de nuevo, apagando la red y adelantando el reloj.

- **Calendario (v10.15.0):** capa `PantallaCalendario` desde el botón junto al período en Mes. Misma lista que la web
  (`eventosDelContexto` portado a `dominio/CalendarioFinanciero.kt`): Día/Semana/Mes, «Sin fecha exacta» y vacío.
  Compila; **no se vio en emulador ni tiene prueba unitaria** (la sesión de prueba fue revocada y no tengo la
  contraseña). Falta el botón «Añadir» (abre Pagos fijos, aún sin migrar).

- **Asesor, primer corte (v10.16.0):** pestaña Asesor con Luki (decisión: el avatar vigente en la web es Luki, no la
  Estrella), pose al azar con los pesos de la web, 6 chips, burbujas, «Analizando tus finanzas...», píldora de
  disponibilidad (`GET /api/asesor-ia/disponibilidad`), chat contra `POST /api/asesor-ia` (historial de 5, 60 s,
  mensajes de error de la web), «Reintentar con IA», Nueva conversación y el aviso de IA. Compila y pasa 2 pruebas
  nuevas (pose y limpieza de `<think>`); **no se vio en emulador ni se probó contra el servidor** (sin sesión).
  **Falta:** copiar/compartir/regenerar/leer en voz alta, insignia Premium, dictado y `promptInicial` desde
  Inicio.

- **Asesor, motor local (v10.17.0):** `dominio/AsesorBot.kt`, `AlcanceAsesor`, `ContextoProductoIA`, `ConversacionDeuda`,
  `SimulacionConversacional`, `SimuladorFinanciero` y `TributarioColombia` (solo `analizarTopesRenta`), portados de la web
  con 35 casos de `asesorBot.test.ts` uno a uno y el resto de sus pruebas (371 JUnit en total, todas verdes; sin Node no se
  pudieron correr las de TS). El chat resuelve como `handleSend`: guía → simulación → motor local si sabe → IA → respaldo
  local con «Reintentar con IA». Se replicaron a propósito dos rarezas de la web: el mes pasado desbordado
  (`setMonth(-1)` el día 31) y el mes UTC en la alerta de promedio. **No se vio en emulador** (sin sesión). Falta: telemetría
  `/respaldo-local`, `detectarPropuestaAsesor`, y que «Revisar y editar movimiento» abra Captura.

- **Asesor, historial (v10.18.0):** cada mensaje se guarda en la conversación del servidor (`/api/asesor/conversaciones` y
  `/mensajes`, con el primer mensaje como título de 70 caracteres y el mismo proveedor que la web: «Guía de LukApp», «Luki»
  o el de la IA), hoja lateral «Conversaciones» con abrir y «Nueva conversación», y la memoria autorizada
  (`/api/asesor/memoria`) viaja a la IA. Compila; **no se vio en emulador ni se probó contra el servidor** (sin sesión). La fecha
  de cada chat usa `d MMM yyyy, h:mm a` de Java, no `Intl`, así que el formato puede diferir en detalle. Falta: telemetría
  del respaldo local, olvidar datos de memoria desde la UI y el interruptor `recordar` por conversación.

- **Asesor, propuestas (v10.19.0):** `detectarPropuestaAsesor` portado con los 3 casos de `propuestasAsesor.test.ts`; tarjeta
  «💡 Propuesta para revisar» editable (categoría, tope, nombre, objetivo, fecha) que solo guarda al pulsar Confirmar,
  por `OperacionesLibro.fijarPresupuesto` (conserva la fecha original; ≤ 0 se rechaza) y `crearMeta`, con 2 pruebas nuevas.
  Compila; **no se vio en emulador** (sin sesión). Diferencia: la fecha objetivo se escribe como `AAAA-MM-DD` (la web usa un
  selector de fecha). Se muestra en respuestas de la IA y del respaldo local, no en guía ni simulación, como la web.

- **Asesor, movimiento detectado (v10.20.0):** las respuestas del motor local, del respaldo y de la IA (esta última pasando
  por `detectarMovimiento`, que corre el parser: si el modelo inventa un monto no hay botón) muestran «🧾 …», el saldo antes y
  después y el tope del período, y «Revisar y editar movimiento» lleva a Inicio con Captura abierta y el movimiento cargado
  (`ModeloAnotar.abrirMovimiento`); nunca guarda directo. Compila; **no se vio en emulador** (sin sesión) y no hay prueba
  propia de la tarjeta (la lógica de detección ya la cubren las 37 de `AsesorBotTest`).

## Sin verificar todavía

- Que las cifras de Inicio coincidan con la web para la misma cuenta (falta compararlas lado a lado).
- El candado biométrico (el emulador no tiene huella registrada), los hápticos y la cola sin conexión.

## Avance por área

| Área | Estado |
|---|---|
| Reglas financieras (saldos, 4x1000, períodos, festivos, presupuestos, recurrentes, tarjetas, cuotas, metas, motor financiero, racha) | Hecho y probado |
| Intérprete de voz/texto → movimientos | Hecho y probado (texto). Falta la grabación y `/api/transcribir` |
| Acceso: entrar, crear cuenta, recuperar, nueva contraseña, checklist, apodo | Hecho en código |
| Google nativo | Hecho en código. Bloqueado por configuración externa (ver abajo) |
| Desbloqueo biométrico | Hecho en código (provisional en Más) |
| Shell: barra inferior, fundido, Atrás, pull to refresh en Inicio | Hecho en código |
| Inicio | Parcial, probado con datos reales: falta BotonAnotar/Captura, próximos pagos, análisis/categorías, Pulso Premium, insights, novedades y modal de racha |
| Dinero | Parcial, probado con datos reales: cabecera, Disponible, cuentas con marca y logo real (public/bancos), efectivo, ahorros con meta, inversiones, tarjetas con pago mensual y deudas. Detalle de cuenta/ahorro al tocar una fila (saldo editable, meta, cuenta principal, historial, eliminar). Tarjetas y deudas (tocar una fila, «Ver todas» o el botón «Tarjetas de crédito»): total, saldo, «Para pagar este mes», cupo, registrar compra con cuotas, abonar, actualizar saldo, historial, compras y eliminar. Falta: crear tarjeta o deuda y editar su cupo/corte/pago, crear cuenta o ahorro, metas, extractos, herramientas compartidas y, dentro del detalle, editar la cuenta, enviar dinero a otra cuenta e importar extracto |
| Mes | Parcial, probado con datos reales: período ‹ ›, balance, «En qué se te va» / «De dónde entra», días, gastos más grandes, contrapartes y entradas. «Cómo vienes» (gráfica 3M/6M/12M, promedio y comparativo con el mes pasado) y los topes de gasto (lectura). Falta: resumen tipo Wrapped, crear/editar/quitar topes y sus alertas, botón de calendario, Pagos fijos, Proyección y exportar a Excel |
| Barra de anotar, Captura y dictado | Parcial. Hecho: barra flotante (teclado + micrófono), Captura completa (tipo, cuenta, monto con teclado propio, descripción que detecta categoría, «Como la última vez», pregunta de cuenta, guardado por la RPC) y dictado (permiso al tocar, grabación AAC, `/api/transcribir`, intérprete). Además: detalle de un movimiento (tocar la fila), Editar, Borrar y aviso de guardado con Deshacer. Falta: escanear con cámara (OCR), Buscar, Analizar con IA, selector de fecha al editar, deslizar para repetir/editar, varios movimientos en un dictado y comandos de voz (transferir, abonar, saldo, rendimiento) |
| Más | Parcial, probado en emulador: título «Ajustes» y el bloque «La app» con Contar los ahorros (lo guarda en `user_metadata` y cambia el total de Dinero), Desbloquear con huella o rostro (propio de Android), Apariencia, Cuenta (correo) y Cerrar sesión. Falta: Preferencias, Tus datos y Comunidad (abren paneles sin migrar), Próximos pagos, decisiones, efectivo por separado, recordatorio de racha, guía y Premium |
| Captura/BotonAnotar, dictado, paneles (18), onboarding, buscar, modales | **Pendiente** |
| Notificaciones, archivos/respaldo/Excel, compartir, OCR | **Pendiente** |
| Firma de publicación | **Bloqueado** (ver abajo) |

Las secciones que faltan se ven en la compilación de debug con un aviso que dice que todavía no
están migradas. No hay datos simulados ni botones que finjan funcionar: los que llevan a pantallas
sin migrar (Buscar, BotonAnotar, abrir un movimiento) no se muestran.

## Bloqueos externos (los resuelve el dueño)

1. **Google Sign-In:** falta `GOOGLE_WEB_CLIENT_ID`, el client id **web** que ya usa el proveedor
   Google de Supabase, en `apps/android/lukapp.properties` (no versionado). En Google Cloud hay que
   crear también un client id **Android** para `lukApp.App` con el SHA-1 de la llave de subida y
   el de la firma de Play (y otro para `lukApp.App.nativa.debug` con el SHA-1 de debug). Sin esto,
   el botón dice que Google no está disponible en esta versión.
2. **Firma:** la llave de subida de Play la administra EAS. Para firmar el AAB nativo hay que
   descargarla (`eas credentials`) y poner `UPLOAD_STORE_FILE`, `UPLOAD_STORE_PASSWORD`,
   `UPLOAD_KEY_ALIAS` y `UPLOAD_KEY_PASSWORD` en `lukapp.properties`.
3. **Probar con sesión:** hace falta una cuenta para entrar (ver «Sin verificar todavía»).
4. **Supabase → Auth → URL Configuration:** `lukapp://auth/callback` ya está permitido para Google.
   Los correos de confirmación y de recuperación ahora vuelven ahí: hay que confirmar que
   funcione con las plantillas de correo.

## Diferencias conocidas frente a la web

- La web dice «Integración con iOS» en el pie del acceso, también dentro de Android. Se conservó
  porque cambiar textos no está autorizado.
- Bugs de la web copiados a propósito para tener los mismos resultados (hay que decidir si se
  corrigen en las dos plataformas): el fin de período `NaN-NaN-NaN` en el motor con mensual puro
  (cuenta todas las obligaciones de los 90 días), «meta atrasada» que nunca salta, y el
  `/\\s+/` de `parteNormalizada` en recurrentes.
- Voz: «ayer», «hoy» y «hace N días» después de las 19:00 en Bogotá. La web usa UTC y corre un
  día; Kotlin usa la fecha local, que es la intención.
- Al borrar una cajita, la copia local no borra en cascada sus movimientos hasta la siguiente
  sincronización (en la base sí se borran).
- El candado biométrico es nuevo (la PWA no lo tenía). Se pide al abrir y al volver después de
  más de 30 s fuera.

## Cómo compilar

**Importante:** el repo está en `~/Documents`, que iCloud sincroniza, y eso duplicaba archivos
dentro de `build/` (`Clase$1 2.class`, que hacía fallar D8). Por eso la salida de compilación va
a `~/Library/Caches/lukapp-android/` (configurable con `-Plukapp.dirCompilacion=…`). El APK queda
en `~/Library/Caches/lukapp-android/app/outputs/apk/debug/app-debug.apk`. Los archivos « 2»
sueltos que ya hay en el repo (`apps/mobile/* 2.*`, `netlify 2.toml`…) tienen el mismo origen.

```bash
cd apps/android
./gradlew :app:testDebugUnitTest   # reglas + voz
./gradlew :app:assembleDebug       # APK de prueba
./gradlew :app:bundleRelease       # AAB (se firma si lukapp.properties tiene la llave)
python3 herramientas/generar-iconos-lucide.py   # desde la raíz del repo, si la web agrega íconos
```

La URL y la clave publishable de Supabase se leen de `apps/mobile/.env`, o de
`apps/android/lukapp.properties` si existe. La API sale de `API_URL`, que por defecto es
`https://focus-62nt.onrender.com`, la misma de la web en producción.

## Siguiente paso sugerido

Entrar con una cuenta en el emulador y comparar Inicio contra la WebView. Después, Captura
y BotonAnotar (con el intérprete ya portado), Dinero y Mes, en ese orden de prioridad.


### v10.21.0 — Copiar y compartir en el Asesor

Debajo de cada respuesta de Luki hay dos botones: copiar al portapapeles (con confirmación «Copiado») y compartir por la hoja del sistema (solo el texto). Sin prueba propia ni verificación en emulador (sin sesión). Siguen pendientes 👍👎, leer en voz alta y regenerar.


### v10.22.0 — Regenerar y 👍👎 en el Asesor

Cada respuesta de Luki suma 👍, 👎 y regenerar. Igual que en la web, la valoración solo vive en pantalla (no se guarda ni se envía) y regenerar vuelve a mandar la pregunta anterior como un mensaje nuevo (no reemplaza la respuesta). Sin prueba propia ni verificación en emulador. Pendiente: leer en voz alta.


### v10.23.0 — Leer en voz alta en el Asesor

Botón de parlante en cada respuesta de Luki con `TextToSpeech` de Android (voz es-ES), una lectura a la vez; tocar la que suena la detiene. Lee, copia y comparte el texto limpio (`limpiarTextoChat`), como la web (antes copiar/compartir mandaban el texto crudo). Sin prueba propia ni verificación en emulador/teléfono: depende de que el equipo tenga voz en español instalada, y si no, avisa. Diferencia: la web comparte con formato de LukApp; aquí va solo el texto.


### v10.24.0 — Insignia Premium en el Asesor

El encabezado del Asesor muestra «✦ Premium» cuando `GET /api/mi-plan` (con la sesión) devuelve `codigo == "premium"` y el beneficio `asesor_ia` activo, igual que `esPremium && tieneAsesorIa` en la web. Se consulta al abrir la pestaña y al tocar el indicador de conexión; la web además sondea cada 30 s y al volver a enfocar, aquí no. Cualquier fallo oculta la insignia. Sin prueba propia ni verificación con una cuenta Premium real.


### v10.25.0 — Insights «Para ti», Pulso Premium y paso al Asesor

- `dominio/Insights.kt` porta `lib/insights.ts` (los seis detectores, umbrales y redacción de la web; máximo tres, lo «atento» primero) con 8 pruebas JUnit de cifras calculadas a mano.
- Inicio estrena el desplegable «Análisis y categorías del período» (cerrado por defecto, solo si ya hay un movimiento). Dentro, por ahora, solo el Pulso Premium y la franja de insights; faltan la decisión financiera y el carrusel de categorías.
- Con plan que incluye `insights_ia` se piden los de IA (`POST /api/finanzas-insights-ia`, cuerpo vacío, una vez por mes + cantidad de movimientos); si fallan quedan los locales. El Pulso sale con `pulso_premium`. Todo se lee de `GET /api/mi-plan`.
- Descartar oculta un insight 24 h (misma clave y formato que la web, en DataStore). Rota cada 45 s si hay varios.
- Tocar un insight o el Pulso abre el Asesor y envía la pregunta de la web (`handleConsultarTipEnAsesor`).
- Sin verificar en emulador ni con cuenta Premium. Diferencias: el plan se lee al abrir Inicio (la web además cada 30 s y al enfocar); la banda de «novedad» de la web, que cede su lugar al insight, aún no existe.


### v10.25.1 — Cierre al abrir sin sesión

Al probar en emulador, la app se cerraba al abrir sin sesión (NPE en `ModeloAsesor`): `premium`, añadida en v10.24.0, estaba declarada después del `init`, y sin sesión la consulta de plan termina sin suspender y la escribe antes de existir. Se movió antes del `init`. Estuvo así de v10.24.0 a v10.25.0; con sesión no se notaba. Verificado: abre y muestra el acceso, 0 `FATAL EXCEPTION`. Lección: en los ViewModels, todo `StateFlow` va antes del `init`.


### v10.26.0 — Topes: crear, editar, quitar y alertas

En Mes, el bloque de topes ya escribe: interruptor de alertas y umbral (10–100 de 5 en 5, se guarda al soltar, en `user_metadata` con las mismas claves de la web), crear un tope tocando una categoría sin tope («Sueles gastar…»), editar y quitar desde el menú de cada fila. Quitar usa `borrar: {presupuestos: [categoria]}` (la tabla se clava por categoría en la RPC). Una prueba nueva de `quitarPresupuesto`. Sin ver en emulador. Falta el atajo «Nueva transacción» del menú.


### v10.27.0 — Pagos fijos y botón «Añadir» del Calendario

`PantallaPagosFijos` porta `RecurrentesView`: total «Cada mes» y proyección anual, próximos cobros a 60 días, patrones detectados (añadir o actualizar precio), «Ya pasó la fecha de…» con «Sí pasó» (crea el movimiento con la fecha que le tocaba), formulario de nuevo recurrente (día acotado a 1..31) y lista con eliminar. Se abre desde «Añadir» del Calendario (que ya no falta). Escritura por la RPC: crear/actualizar guardan en `recurrentes`, borrar usa `borrar.recurrentes`, confirmar guarda una transacción. Pruebas nuevas en `OperacionesLibroTest`. Sin ver en emulador. Falta: editar un recurrente (la web tampoco lo permite aparte de «Actualizar precio») y un acceso desde Más/Mes (la web lo abre desde Preferencias).


### v10.28.0 — Crear cuenta y ahorro, y transferir entre cuentas

- Dinero: «Agregar cuenta» (también en el estado vacío) y «🐷 Crear ahorro». El formulario sigue a `CajitasView`: la clase de cuenta se ajusta sola al reconocer el banco, ahorro o inversión (con moneda), saldo inicial, ícono, meta y tasa de rendimientos (la coma vale como decimal). El nombre se vuelve único sin importar mayúsculas («Nequi (2)»); el saldo inicial es un movimiento de apertura (una cuenta con saldo en blanco queda pendiente de confirmar; un ahorro en 0 no abre movimiento).
- Detalle de cuenta: «Enviar dinero a otra cuenta» → par de movimientos (retiro/depósito) y una fila de transferencia neutral (ni gasto ni ingreso). Con menos de dos cuentas muestra el aviso de la web.
- 5 pruebas nuevas (22 en `OperacionesLibroTest`). Sin ver en emulador. Falta: editar nombre/tipo de una cuenta, tarjetas de crédito (cupo, corte, pago) y deudas, cuyo formulario es el de «Tarjetas y deudas».


### v10.29.0 — Crear y editar tarjetas y deudas

En el panel de tarjetas y deudas: «Agregar tarjeta de crédito» / «Agregar deuda» (nombre, «¿Cuánto debes ahora?» e ícono; la deuda actual entra como movimiento de apertura, como en la web) y un lápiz en cada tarjeta para editar nombre y, en tarjetas, cupo, pago mínimo y días de corte y pago (fuera de 1..31 queda «no configurado»). Misma `crearCajita`/`actualizarCajita` de las cuentas. 2 pruebas nuevas. Sin ver en emulador. Con esto queda cerrado el bloque «Tarjetas y deudas»; falta solo editar nombre/tipo de una cuenta normal.
