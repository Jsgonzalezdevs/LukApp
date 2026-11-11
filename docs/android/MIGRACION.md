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
| Dinero | Parcial, probado con datos reales: cabecera, Disponible, cuentas con marca y logo real (public/bancos), efectivo, ahorros con meta, inversiones, tarjetas con pago mensual y deudas. Falta lo que abre otras pantallas: detalle de cuenta, tarjetas, crear cuenta o ahorro, metas, extractos y herramientas compartidas |
| Mes | Parcial, probado con datos reales: período ‹ ›, balance, «En qué se te va» / «De dónde entra», días, gastos más grandes, contrapartes y entradas. Falta: resumen tipo Wrapped, topes, tendencias («Cómo vienes»), calendario y exportar a Excel |
| Barra de anotar, Captura y dictado | Parcial. Hecho: barra flotante (teclado + micrófono), Captura completa (tipo, cuenta, monto con teclado propio, descripción que detecta categoría, «Como la última vez», pregunta de cuenta, guardado por la RPC) y dictado (permiso al tocar, grabación AAC, `/api/transcribir`, intérprete). Falta: escanear con cámara (OCR), Buscar, varios movimientos en un dictado, comandos de voz (transferir, abonar, saldo, rendimiento), aviso de guardado con Deshacer y editar un movimiento |
| Calendario, Asesor, Más completo, Captura/BotonAnotar, dictado, paneles (18), onboarding, buscar, modales | **Pendiente** |
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
