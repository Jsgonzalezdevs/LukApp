# Publicación de la app Android nativa

Estado al **v10.55.0** (ya existen en la nativa las **Metas de ahorro**, el **Impuesto 4x1000**, **Dividir cuenta y propina**, las **Vaquitas**, **Finanzas en Pareja / Compartidas** **Importar extractos** desde PDF, foto, Excel y CSV, y la exportación a **Excel (.xls)** y el **informe PDF**). Rama local `android-nativo`: 51 commits sobre `main`, todos con `vX.Y.Z`
en el mensaje, etiquetas `v10.14.1` … `v10.47.1`, **nada enviado al remoto** (la rama no tiene upstream).
Este documento no publica nada: dice en qué punto está, qué falta y qué decisiones son del dueño.

## 1. La decisión grande: la nativa todavía NO tiene todo lo que tiene la app publicada

La app de Play hoy es el WebView de `apps/mobile`, que muestra la web completa. La nativa se publicaría con el mismo
`applicationId` (`lukApp.App`) y un `versionCode` mayor (`1047001` contra `1014000`), o sea **como actualización que
la reemplaza**. Quien actualice perdería esto, que hoy sí puede hacer:

| Falta en la nativa | Dónde está en la web |
|---|---|
| El **buzón de correo de comprobantes** de Importar extractos | `BandejaCorreo` de `AnalistaView` |
| Registro automático (Apple Pay) | Solo iOS: no aplica a Android |

Además el plan Premium anuncia «Extractos PDF» y «Espacios compartidos» (se ven en Cuenta), y **ninguna de las dos
existe en la nativa**. **Recomendación: no reemplazar la app de Play con esta versión.** Opciones: (a) publicarla primero
en la pista de **pruebas internas o cerradas**, con un nombre de paquete aparte si se quiere conservar la de Play intacta;
(b) completar esos paneles antes de reemplazar; (c) reemplazar sabiendo que se pierden.

## 2. Qué está hecho y qué se comprobó

- **Hecho** (v10.14 → v10.47): Inicio, Dinero (cuentas, ahorros, tarjetas, deudas, crear/editar/transferir), Mes (período, topes,
  tendencias, resumen tipo historia, Proyección, Pagos fijos, Calendario), anotar (teclado, voz, varias cosas en una frase,
  órdenes por voz, escanear comprobante), Buscar, Asesor (chat, propuestas, voz, Premium, insights), Más (Período,
  Categorías, Revisar movimientos, Nombres repetidos, Copia de seguridad, Funciones solicitadas, Cuenta, recordatorio de
  racha, guía), Bienvenida y acceso (correo, Google en código, biometría).
- **Pruebas:** 473 de JUnit, todas pasan. **Las pruebas de TypeScript no se pudieron correr** (no hay Node en esta máquina),
  incluida `version.test.ts`: sus tres reglas (versión en `version.ts`, `package.json` y la primera entrada de `novedades.ts`
  iguales; sin repetidas; en orden) se verificaron con un script y se cumplen.
- **Emulador** (con la cuenta demo, datos reales): se recorrieron Más y sus paneles, Mes, Proyección, Cuenta, el Asesor con
  voz, la cámara/galería con un comprobante, el recordatorio (permiso, alarma, notificación) y la fecha al editar.
- **Compilación de lanzamiento (R8 activo):** arreglada en v10.47.1 (la tarea de lint de lanzamiento usaba los recursos de
  marca sin declarar la dependencia y la compilación fallaba desde antes). APK sin firmar **47,9 MB**, AAB **28,2 MB**.
  La de lanzamiento **arranca y muestra el acceso**, pero **no se probó con sesión**: lo que R8 pueda haber roto en
  tiempo de ejecución (lectura de JSON de respaldos y del plan, ML Kit) está sin comprobar.

## 3. Sin verificar todavía (requieren un teléfono o una cuenta)

1. **Prueba de humo de la versión de lanzamiento con sesión**: entrar, ver Inicio, abrir Copia de seguridad (genera el
   JSON), Cuenta (lee el plan), escanear una foto y dictar. Es la prueba que cubre a R8.
2. Voz y fotos **reales** (el emulador oye silencio y lee texto limpio sobre blanco).
3. **Rendimiento** en un teléfono real: en el emulador de depuración el arranque en frío perdía ~330 fotogramas (5,5 s) y
   se redujo a ~90 con las tandas de Inicio; falta medir con la de lanzamiento en un aparato.
4. Escrituras que no se ejercitaron para no tocar la cuenta: restaurar un respaldo, eliminar cuenta, unir nombres, votar,
   crear categorías, guardar un cambio de fecha, confirmar órdenes por voz y varios movimientos.
5. Telemetría del respaldo local del Asesor (solo compila) y el viaje de la fecha editada.
6. Correos de confirmación y de recuperación con la redirección `lukapp://auth/callback`.

## 4. Bloqueos que resuelve el dueño

1. **Google Sign-In:** `GOOGLE_WEB_CLIENT_ID` (el client id *web* del proveedor Google de Supabase) en
   `apps/android/lukapp.properties`, y client ids *Android* con SHA-1 para `lukApp.App` (llave de subida y firma de Play)
   y para `lukApp.App.nativa.debug`.
2. **Firma:** la llave de subida la administra EAS (`eas credentials`); poner `UPLOAD_STORE_FILE`, `UPLOAD_STORE_PASSWORD`,
   `UPLOAD_KEY_ALIAS` y `UPLOAD_KEY_PASSWORD` en `lukapp.properties`. Sin eso el AAB sale sin firmar.
3. **Cuenta de Play Console y ficha:** declaración de seguridad de datos (micrófono, notificaciones, cámara por la foto del
   comprobante, correo, datos financieros), política de privacidad vigente, clasificación de contenido.
4. **Compra de Premium:** la nativa NO tiene botones de compra (Wompi se paga en la web) y lo dice. Si se quisiera vender
   Premium dentro de la app, Play exige su facturación para bienes digitales: decisión de negocio y legal, no técnica.
5. **Eliminar cuenta** está dentro de la app (Cuenta → Zona de riesgo), como pide Play, pero **nunca se ejecutó**: probarlo con
   una cuenta de prueba antes de publicar.

## 5. Pasos cuando se decida publicar

Para la pista de pruebas internas hay una guía propia, con las notas de la versión, el borrador de seguridad de datos y la lista de pruebas: [`PRUEBAS_INTERNAS.md`](PRUEBAS_INTERNAS.md).

1. Decidir la sección 1 (pista de pruebas o reemplazo) y, si es una app aparte, cambiar `applicationId`.
2. Resolver los bloqueos 1 y 2 de la sección 4.
3. `cd apps/android && ./gradlew testDebugUnitTest bundleRelease` y revisar que el código de salida sea 0
   (en zsh no usar `PIPESTATUS`; ver la nota del repositorio).
4. Instalar la versión de lanzamiento firmada y hacer la prueba de humo de la sección 3.1.
5. Revisar los commits que se van a enviar (`git log $(git merge-base HEAD origin/main)..HEAD`): hoy los 51 llevan versión.
6. **Solo con visto bueno del dueño:** `git push -u origin android-nativo` y `git push origin --tags` (las etiquetas
   `v10.14.1`…`v10.47.1`). No se ha empujado nada.
7. Subir el AAB a la pista elegida; `versionCode` actual `1047001` (sale de `src/version.ts`).

## 6. Deuda técnica conocida

- Inicio compone todo de golpe salvo la lista de movimientos (que va por tandas de 60): próximos pagos, análisis y demás
  podrían medirse y, si hace falta, ir perezosos.
- El `.gitignore` está modificado y hay 22 archivos sin seguimiento (`* 2.*`, APK/AAB de prueba, `pnpm-lock.yaml`…) que no
  son de este trabajo y **no se incluyeron en ningún commit**; conviene revisarlos antes de empujar.
- Bugs de la web copiados a propósito para tener los mismos resultados: ver «Diferencias conocidas» en `MIGRACION.md`.
