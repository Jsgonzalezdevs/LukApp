# Publicación de la app Android nativa

Estado al **v10.56.0** (`versionCode` **1056000**). Rama local `android-nativo`: **64 commits** sobre `main`, todos con
`vX.Y.Z` en el mensaje, etiquetas `v10.14.1` … `v10.56.0`, **nada enviado al remoto** (la rama no tiene upstream).
Este documento no publica nada: dice en qué punto está, qué falta y qué decisiones son del dueño.

## 1. La decisión grande: reemplazar o no la app de Play

La app de Play hoy es el WebView de `apps/mobile`, que muestra la web completa. La nativa se publicaría con el mismo
`applicationId` (`lukApp.App`) y un `versionCode` mayor (`1056000` contra `1014000`), o sea **como actualización que la
reemplaza**.

**Paridad con la web:** ya están todos los paneles. Lo único de la web que **no** está en la nativa:

| Falta en la nativa | Dónde está en la web |
|---|---|
| Compra de Premium dentro de la app | Pago por Wompi en la web (la nativa lo dice y no vende; ver 4.4) |
| Registro automático (Apple Pay) | Solo iOS: no aplica a Android |

Pero paridad de pantallas **no es lo mismo que probado**: la versión de lanzamiento nunca se ha usado con sesión (3.1) y
varias escrituras nunca se ejercitaron (3.4). **Recomendación: pista de pruebas internas primero** y reemplazar la app de
producción solo después de pasar la lista de [`PRUEBAS_INTERNAS.md`](PRUEBAS_INTERNAS.md) en teléfonos reales. Opciones:
(a) pruebas internas o cerradas con el mismo paquete (los probadores la ven como actualización); (b) un `applicationId`
aparte para la nativa si se quiere dejar intacta la de Play; (c) reemplazar directamente (no recomendado aún). Es decisión
del dueño.

## 2. Qué está hecho y qué se comprobó

- **Hecho** (v10.14 → v10.55): Inicio, Dinero (cuentas, ahorros, tarjetas, deudas, crear/editar/transferir, **Metas de
  ahorro**, **Impuesto 4x1000**, **Dividir cuenta y propina**, **Vaquitas**, **Finanzas en Pareja / Compartidas**, **Importar
  extractos** desde PDF, foto, Excel y CSV, con el **buzón de comprobantes por correo**), Mes (período, topes, tendencias, resumen tipo historia, Proyección, Pagos fijos,
  Calendario, exportar a Excel), anotar (teclado, voz, varias cosas en una frase, órdenes por voz, escanear comprobante),
  Buscar, Asesor (chat, propuestas, voz, Premium, insights), Más (Período, Categorías, Revisar movimientos, Nombres
  repetidos, **Copia de seguridad con Excel e informe PDF**, Funciones solicitadas, Cuenta, recordatorio de racha, guía),
  Bienvenida y acceso (correo, Google en código, biometría).
- **Pruebas:** **539 de JUnit, todas pasan.** **Las pruebas de TypeScript no se pudieron correr** (no hay Node en esta
  máquina), incluida `version.test.ts`: sus tres reglas (versión en `version.ts`, `package.json` y la primera entrada de
  `novedades.ts` iguales; sin repetidas; en orden) se verificaron con un script y se cumplen.
- **Emulador** (con la cuenta demo, datos reales): se recorrieron los paneles nuevos contra el servidor real. Lo que sí se
  ejercitó con escrituras: Vaquitas (local), Compartidas (crear espacio, gasto, invitación, borrar, saldar, rechazo de la
  propia invitación), Importar extractos (PDF de Nequi sintético: leer, importar como historial, no duplicar al reimportar),
  borrar movimientos, descartar avisos. Detalle por versión en `MIGRACION.md`.
- **Compilación de lanzamiento (R8 activo), medida en v10.55.1 (no se reconstruyó para v10.56.0):** `testDebugUnitTest bundleRelease assembleRelease` con código de
  salida 0. **AAB 30,0 MB (sin firmar)**, **APK 48,1 MB (sin firmar)**. Firmado con la llave de depuración (solo para probar),
  **se instala, arranca y muestra el acceso sin errores en logcat**. **No se probó con sesión**: no hay credenciales en el
  código (el alias `demo` solo cambia el correo por el de la cuenta de demostración; la contraseña no está) y no se
  adivinó. Lo que R8 pueda haber roto en tiempo de ejecución con datos reales está sin comprobar.
- **Permisos que declara el APK de lanzamiento (leídos del APK):** `INTERNET`, `ACCESS_NETWORK_STATE`, `RECORD_AUDIO`,
  `VIBRATE`, `USE_BIOMETRIC`, `USE_FINGERPRINT` (la agrega la librería de biometría), `POST_NOTIFICATIONS`,
  `RECEIVE_BOOT_COMPLETED`, y un permiso interno de la propia app para receptores. **No** pide `CAMERA` ni almacenamiento:
  la foto usa la cámara y el selector del sistema, y exportar/importar archivos usa el selector de archivos del sistema.

## 3. Sin verificar todavía (requieren un teléfono, una cuenta o una segunda cuenta)

1. **Prueba de humo de la versión de lanzamiento con sesión**: entrar, ver Inicio, abrir Copia de seguridad (JSON, Excel y
   PDF), Cuenta (lee el plan), escanear una foto, importar un extracto y dictar. Es la prueba que cubre a R8; sobre todo las
   clases nuevas de lectura de JSON (vaquitas, espacios, extractos) y ML Kit.
2. **Compartidas con dos cuentas**: que la otra persona acepte la invitación (pegando el enlace en la app o abriéndolo en la
   web), vea los gastos, y que el balance «te debe / le debes» salga con dos integrantes. **No se comprobó que la web acepte
   `?invitacion=` si no tiene ese panel abierto.**
3. Voz y fotos **reales**. El emulador oye silencio y lee texto limpio sobre blanco; la prueba de foto de un extracto
   usó una imagen sintética y ML Kit leyó bien 1 de 3 filas: **no hay medida de qué tan bien lee una foto real**.
4. Escrituras que no se ejercitaron para no tocar la cuenta: restaurar un respaldo, **eliminar cuenta**, unir nombres, votar,
   crear categorías, crear/editar/borrar metas, cambiar régimen/cuentas/UVT del 4x1000, guardar un cambio de fecha, confirmar
   órdenes por voz y varios movimientos, importar desde CSV/Excel/foto (el PDF sí).
5. De los extractos: un PDF **con contraseña**, un banco que las plantillas no soportan (lo lee la IA), el **cupo agotado**,
   «Completar este movimiento» y la revisión de «quizá repetidos».
6. De exportar: **la segunda hoja del PDF** (se comprobó que existe, no se vio), abrir el `.xls` en Excel de verdad (solo se
   validó como XML) y el botón de Excel de Mes.
7. **Rendimiento** en un teléfono real: en el emulador de depuración el arranque en frío perdía ~330 fotogramas (5,5 s) y se
   redujo a ~90 con las tandas de Inicio; falta medir con la de lanzamiento en un aparato.
8. Telemetría del respaldo local del Asesor (solo compila), la primera lectura de extractos que falló una vez con «No se pudo
   contactar al servidor» (el servidor estaba vivo; no se diagnosticó, probablemente arranque en frío) y los correos de
   confirmación y recuperación con la redirección `lukapp://auth/callback`.

9. **El buzón de comprobantes por correo** (v10.56.0) se probó contra el servidor real solo hasta donde éste deja: contestó
   «La recepción por correo todavía no está configurada.», así que **nunca se vio una dirección, un correo recibido ni una
   descarga**. Lo que sí hay probado: la lectura de esas respuestas, la fecha, y que solo se abra un enlace `https` del CDN de
   Resend (8 pruebas).

## 4. Bloqueos que resuelve el dueño

1. **Google Sign-In:** `GOOGLE_WEB_CLIENT_ID` (el client id *web* del proveedor Google de Supabase) en
   `apps/android/lukapp.properties`, y client ids *Android* con SHA-1 para `lukApp.App` (llave de subida y firma de Play)
   y para `lukApp.App.nativa.debug`.
2. **Firma:** la llave de subida la administra EAS (`eas credentials`); poner `UPLOAD_STORE_FILE`, `UPLOAD_STORE_PASSWORD`,
   `UPLOAD_KEY_ALIAS` y `UPLOAD_KEY_PASSWORD` en `lukapp.properties`. Sin eso el AAB sale sin firmar.
3. **Cuenta de Play Console y ficha:** declaración de seguridad de datos (ver el borrador, con **flujos nuevos** que hay que
   confirmar con quien opera el servidor), política de privacidad vigente, clasificación de contenido.
4. **Compra de Premium:** la nativa NO tiene botones de compra (Wompi se paga en la web) y lo dice. Si se quisiera vender
   Premium dentro de la app, Play exige su facturación para bienes digitales: decisión de negocio y legal, no técnica.
5. **Eliminar cuenta** está dentro de la app (Cuenta → Zona de riesgo), como pide Play, pero **nunca se ejecutó**: probarlo con
   una cuenta de prueba antes de publicar.
7. **Buzón de comprobantes por correo:** el servidor necesita `COMPROBANTES_EMAIL_DOMINIO` (el dominio de las direcciones),
   `RESEND_API_KEY` (para descargar adjuntos), el webhook `/api/comprobantes-correo/webhook` apuntado desde Resend y la
   migración `20261021145000_comprobantes_correo.sql`. Hoy producción dice que no está configurado, y la web recibe el mismo
   aviso. Sin eso, la nativa solo enseña ese aviso.
6. **Servidor y migraciones:** la nativa depende del mismo servidor que la web (`API_URL`, hoy `focus-62nt.onrender.com`,
   que arrancó en frío al menos una vez con lentitud) y de las migraciones de Supabase ya aplicadas (p. ej.
   `0020_espacios_compartidos_reales.sql`). Confirmar que producción las tiene todas.

## 5. Pasos cuando se decida publicar

Para la pista de pruebas internas hay una guía propia, con las notas de la versión, el borrador de seguridad de datos y la lista de pruebas: [`PRUEBAS_INTERNAS.md`](PRUEBAS_INTERNAS.md).

1. Decidir la sección 1 (pista de pruebas o reemplazo) y, si es una app aparte, cambiar `applicationId`.
2. Resolver los bloqueos 1, 2 y 6 de la sección 4.
3. `cd apps/android && ./gradlew testDebugUnitTest bundleRelease` y revisar que el código de salida sea 0
   (en zsh no usar `PIPESTATUS`; ver la nota del repositorio).
4. Instalar la versión de lanzamiento **firmada** y hacer la prueba de humo de la sección 3.1.
5. Revisar los commits que se van a enviar (`git log $(git merge-base HEAD origin/main)..HEAD`): hoy los 62 llevan versión.
6. **Solo con visto bueno del dueño:** `git push -u origin android-nativo` y `git push origin --tags` (las etiquetas
   `v10.14.1`…`v10.56.0`). No se ha empujado nada.
7. Subir el AAB a la pista elegida; `versionCode` actual `1056000` (sale de `src/version.ts`: mayor·100000 + menor·1000 + parche).

## 6. Deuda técnica conocida

- Inicio compone todo de golpe salvo la lista de movimientos (que va por tandas de 60): próximos pagos, análisis y demás
  podrían medirse y, si hace falta, ir perezosos.
- Sin tiempo real ni copia local en Compartidas (la web escucha cambios y guarda una copia); sin lectura de CSV/Excel/foto con
  otros formatos de banco más allá de lo probado.
- El `.gitignore` está modificado (junto con `apps/mobile/README.md`) y hay 22 archivos sin seguimiento (`* 2.*`, APK/AAB
  de prueba, `pnpm-lock.yaml`…) que no son de este trabajo y **no se incluyeron en ningún commit**; conviene revisarlos
  antes de empujar.
- Bugs de la web copiados a propósito para tener los mismos resultados, y diferencias que se decidieron a propósito: ver
  «Diferencias conocidas» y cada versión en `MIGRACION.md`.
