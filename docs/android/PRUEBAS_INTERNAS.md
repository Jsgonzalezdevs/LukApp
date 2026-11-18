# Pista de pruebas internas — app Android nativa

Cómo llevar la nativa (v10.55.x) a un grupo pequeño **sin tocar la app que hoy usa el público**. La publicación en Play
Console solo la puede hacer el dueño; aquí está todo lo que se pudo dejar listo. Contexto y límites de la nativa:
[`PUBLICACION.md`](PUBLICACION.md).

## 0. Antes de subir (una sola vez)

1. **Firma.** Con la app ya en Play y *Play App Signing* activo, el AAB nuevo debe ir firmado con la **misma llave de subida**
   que usa EAS. Descargarla con `eas credentials` (Android → keystore) y poner en `apps/android/lukapp.properties`
   (no versionado): `UPLOAD_STORE_FILE`, `UPLOAD_STORE_PASSWORD`, `UPLOAD_KEY_ALIAS`, `UPLOAD_KEY_PASSWORD`.
   Sin ellas `bundleRelease` genera el AAB **sin firmar** y Play lo rechaza. (En la máquina donde se preparó esto no hay
   `eas` ni Node, por eso no se pudo hacer.)
2. **Compilar:** `cd apps/android && ./gradlew testDebugUnitTest bundleRelease` y comprobar que el código de salida sea 0.
   Resultado: `app/outputs/bundle/release/app-release.aab` (en `~/Library/Caches/lukapp-android/` en esta máquina).
3. **Prueba de humo en un teléfono propio** antes de subirlo (ver sección 4): la versión de lanzamiento (R8) solo se probó
   hasta la pantalla de acceso (arranca sin errores; con sesión no se ha usado).

## 1. Un aviso de versiones (importante)

El `versionCode` sale de `src/version.ts` (10.55.1 → `1055001`). Play **no deja subir un `versionCode` menor o igual a uno
ya subido en cualquier pista**. Al subir la nativa a pruebas internas, **cualquier actualización futura de la app WebView
de producción tendrá que salir con un `versionCode` mayor que `1055001`** (hoy la de EAS va en `1014000` y EAS puede
auto-incrementar de ahí). Si eso no se puede garantizar, usar un `applicationId` distinto para la nativa en pruebas
(p. ej. `lukApp.App.nativa`): cambia `applicationId` en `app/build.gradle.kts`, y habría que crear los client ids de Google
para ese paquete.

## 2. En Play Console

1. **Pruebas → Pruebas internas → Crear versión.** Subir `app-release.aab`.
2. **Probadores:** crear una lista con los correos de Google de quienes van a probar (hasta 100) y marcarla.
3. **Notas de la versión** (en español, máx. 500 caracteres) — sugerencia:

   > Primera versión nativa de LukApp para Android (sin WebView): más rápida, con voz, cámara, recordatorios, metas,
   > extractos, gastos compartidos y exportar a Excel/PDF. Aún no tiene el buzón de correo de comprobantes ni compra de
   > Premium. Cuéntanos qué falla: en Más → Cuenta, abajo, está el número de versión.

4. **Revisar y lanzar.** Las pruebas internas no pasan por revisión larga: suele estar disponible en minutos.
5. Compartir con los probadores el **enlace de aceptación** (Pruebas internas → pestaña Probadores → «Copiar enlace»). Solo
   quien lo abre con su cuenta de la lista puede instalarla.
6. **Ficha mínima que Play pide aunque sea interna:** declaración de **seguridad de datos** (borrador abajo), URL de
   **política de privacidad** y clasificación de contenido. Si la app ya existe en Play, normalmente ya están: revisarlas
   porque la nativa agrega cámara-foto y notificaciones.

### Borrador para «Seguridad de los datos»

| Dato | Se recopila | Para qué | Compartido |
|---|---|---|---|
| Correo y nombre de usuario | Sí | Cuenta y acceso | No |
| Información financiera (movimientos, cuentas, presupuestos) | Sí | Funcionamiento de la app; se guarda cifrada en tránsito en la cuenta del usuario | No |
| Audio (dictado) | Se envía para transcribir y no se guarda en el aparato | Funcionamiento (anotar por voz) | Con el proveedor de transcripción |
| Fotos (comprobantes y extractos) | **No sale del teléfono**: el texto se lee en el aparato con ML Kit | Funcionamiento | No |
| Excel y CSV de extractos | **No salen del teléfono**: se leen en el aparato | Funcionamiento | No |
| **PDF de extractos bancarios** | **Se envía al servidor de LukApp** para leerlo (y, si es un banco sin plantilla o para auditar la lectura, el texto puede pasar a un proveedor de IA: **confirmar con quien opera el servidor antes de declarar**) | Funcionamiento (importar extractos) | Posiblemente con el proveedor de IA |
| Consultas al Asesor (texto o voz) y perfil financiero | Se envían al servidor, que las pasa al proveedor de IA | Funcionamiento (Asesor) | Con el proveedor de IA (**confirmar**) |
| Espacios compartidos (nombre, gastos, invitación) | Sí, en la cuenta | Funcionamiento: se ven entre los integrantes del espacio | Con la persona invitada |
| Identificadores / diagnóstico | Revisar lo que ya declare la app actual | — | — |

Permisos que declara el APK de lanzamiento (leídos del APK, v10.55.1): `INTERNET`, `ACCESS_NETWORK_STATE`, `RECORD_AUDIO`,
`VIBRATE`, `USE_BIOMETRIC`, `USE_FINGERPRINT` (la agrega la librería de biometría), `POST_NOTIFICATIONS`,
`RECEIVE_BOOT_COMPLETED` y un permiso interno de la app para receptores. **No** pide `CAMERA` ni almacenamiento (la foto
usa la cámara y el selector de fotos del sistema; exportar e importar archivos usa el selector de archivos), así que Play no
filtra dispositivos por cámara.

## 3. Antes de invitar a alguien: avisos para probadores

- **Sincronizar antes de instalar.** Quien ya tenga la app actual de Play la va a ver reemplazada por la nativa (mismo
  paquete). Los datos están en la cuenta, pero lo que esté **pendiente de subir** en la app vieja (sin conexión) se
  perdería: abrirla con internet y esperar a que diga «Todo bien» en Cuenta antes de instalar.
- **Volver a la versión de Play:** salir del programa de pruebas desde el enlace de aceptación y desinstalar/reinstalar
  desde Play devuelve la versión pública.
- **Google Sign-In** no va a funcionar hasta que existan los client ids Android con el SHA-1 de la firma de Play (se ve en
  Play Console → Integridad de la app). Mientras tanto, entrar con correo y contraseña.
- La nativa **todavía no tiene**: el buzón de correo de comprobantes de Importar extractos ni compra de Premium dentro de la
  app. Decirlo para que no se reporten como fallos. Las **Vaquitas** viven solo en el teléfono (como en la web): no se
  sincronizan y se pierden al desinstalar.

## 4. Qué probar (30 minutos, en orden de riesgo)

Con la cuenta de siempre y una cuenta nueva si es posible:

1. **Entrar** (correo) y ver Inicio con el historial: ¿abre rápido? ¿se congela?
2. **Cuenta** (Más → Cuenta y Premium): plan, ID, estado de sincronización, versión al pie.
3. **Copia de seguridad**: descargar el respaldo y abrirlo; el CSV; (con una cuenta de prueba) restaurar.
4. **Anotar**: a mano, **hablando**, varias cosas en una frase («almuerzo 20 mil y taxi 12 mil»), una orden («pasa 50 mil de
   Nequi a mi ahorro») y **una foto de un comprobante o factura de verdad**.
5. **Editar** un movimiento, cambiarle la fecha y borrarlo (con Deshacer).
6. **Dinero**: crear una cuenta y un ahorro, transferir entre cuentas, abonar a una tarjeta.
7. **Mes**: topes, Pagos fijos, Proyección, y el resumen tipo historia (se desbloquea 2 días antes de fin de mes).
8. **Asesor**: una pregunta escrita y una hablada.
9. **Más**: Categorías, Período, Revisar movimientos, Nombres repetidos, **recordatorio de racha** (permiso y que llegue el
   aviso a la hora elegida; puede tardar unos minutos).
10. **Sin conexión:** abrir sin internet (modo avión) y anotar; al volver la red debe subir solo.
11. Dos veces: cerrar sesión y volver a entrar; y reiniciar el teléfono con el recordatorio activo.
12. **Lo nuevo de v10.48–v10.55** (con una cuenta de prueba, porque escriben):
    - **Metas de ahorro:** crear una (con y sin cajita enlazada), editarla y borrarla.
    - **Impuesto 4x1000:** el cupo del mes, cambiar el régimen y la UVT.
    - **Dividir cuenta y propina:** calcular, «Enviar cobro» y «Anotar mi parte».
    - **Vaquitas:** armar una, marcar pagos, anotar un gasto, ver «Para quedar a mano».
    - **Compartidas con DOS cuentas:** crear un espacio, invitar, aceptar con la otra cuenta (pegando el enlace), anotar un
      gasto de cada lado y comprobar que el balance sale igual en los dos teléfonos.
    - **Importar extractos:** un PDF real de tu banco (y uno con contraseña), un CSV o Excel exportado, y una **foto nítida**
      de un extracto; revisar los conteos y los «quizá repetidos» antes de importar. Ojo: el PDF descuenta del plan.
    - **Exportar:** Excel desde Copia de seguridad y desde Mes (abrirlo en Excel o Google Sheets) y el informe PDF (mirar la
      segunda hoja si hay muchas cuentas).

Reportar: qué se hizo, qué se esperaba, qué pasó, la **versión** (Cuenta, abajo) y el modelo del teléfono.

## 5. Después de la ronda

Si algo falla, cada arreglo sube la versión (`src/version.ts`, `package.json`, `novedades.ts`), se etiqueta y se vuelve a
subir el AAB a la misma pista (el `versionCode` sube solo con la versión). Cuando haya paridad con la app publicada, el
paso a producción es otra decisión (sección 1 de `PUBLICACION.md`).
