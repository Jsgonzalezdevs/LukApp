# Mejoras de LukApp: ejecución secuencial

Solicitud: implementar los 16 puntos acordados, revisar cada uno, corregir lo que falte y avanzar únicamente cuando el anterior esté verificado. El objetivo completo sigue activo. Una prueba verde de una parte no cierra un paso entero.

| Paso | Alcance y criterio de aceptación | Estado |
| --- | --- | --- |
| 1 | Guardado completo, cola durable, estados de sincronización, errores visibles y deshacer seguro; probar fallos, reapertura y operaciones seguidas. | Verificado, V5.0.0 |
| 2 | Primera cuenta y primer registro guiados; distinguir datos incompletos de saldo cero; revisar el inicio vacío. | Verificado, V5.1.0 |
| 3 | Inicio centrado en disponible, próximos pagos y movimientos; detalles desplegables sin saltos. | Verificado, V6.0.0 |
| 4 | Voz, foto y escritura claras; categorías frecuentes; formulario y teclado adecuados para móvil y escritorio. | Verificado, V7.0.0 |
| 5 | Metas en Dinero, pagos/calendario en Mes e importación en cuentas; Más para ajustes; búsqueda de funciones y navegación que conserva contexto. | Verificado, V8.0.0 |
| 6 | Emojis de identidad, iconos de acción, tipografía, espacios, tarjetas, botones y colores coherentes con CLAUDE.md; comprobar legibilidad y estados. | Verificado, V8.0.2 |
| 7 | Animaciones comunes y breves para interacción, paneles y cambios; respetar movimiento reducido y conservar estabilidad. | Verificado, V8.0.3 |
| 8 | Importación PDF/imagen/Excel/CSV; revisión de duplicados y efecto en saldo; modo histórico que conserva saldo actual. | Pendiente |
| 9 | Bandeja de movimientos/documentos/transferencias dudosos con resolución clara y trazable. | Pendiente |
| 10 | Proponer suscripciones desde patrones; confirmar; próximos cobros, cambios de precio y costo mensual/anual. | Pendiente |
| 11 | Asesor con propuestas editables y efectos visibles antes de confirmar presupuestos, metas y movimientos. | Pendiente |
| 12 | Cifras y gráficas conectadas con sus movimientos; comparaciones y distinción entre real, programado y estimado. | Pendiente |
| 13 | Invitaciones, reparto y recarga fiables; proyectos con presupuesto y resultado; contexto y pagador visibles. | Pendiente |
| 14 | Aportes/retiros/valoraciones/rendimientos y multimoneda con importe original, tasa y fecha; separar disponible e invertido. | Pendiente |
| 15 | Recepción de comprobantes por correo con procedencia y deduplicación; evaluar e implementar la vía bancaria viable. | Pendiente |
| 16 | Modo opcional para independientes/negocios: cuentas por cobrar/pagar, abonos, devengo/caja, cotizaciones y facturas. | Pendiente |

## Evidencia del paso 1

- Rama: `codex/mejoras-financieras-secuenciales`. Paso revisado y cerrado localmente; frontend pendiente de publicación.
- Se corrigió la instantánea obsoleta de `useAlmacen`: la prueba que fallaba al crear cuentas seguidas y transferir todo el saldo vuelve a pasar.
- `aplicarCambios` confirma lotes completos en memoria, IndexedDB y PostgreSQL; transferencias, compra de tarjeta, creación con apertura, unión de contactos y restauración usan ese camino cuando abarcan varios registros.
- IndexedDB confirma la copia local y su pendiente en una sola transacción; un rechazo explícito del servidor revierte ambos. Las operaciones se serializan y usan Web Locks cuando el navegador los ofrece.
- Un identificador persistente evita repetir una restauración si se pierde la respuesta. La RPC usa SECURITY INVOKER, RLS y comprobación de propiedad de las referencias; solo admite las ocho tablas financieras.
- La migración `20261020163602_guardado_financiero_atomico.sql` está aplicada en el proyecto `trrlknwvplhbntxzprud`, identificado desde el código público de lukapp.app. Añade además persistencia de campos de cuotas/intereses y depósito de bajo monto que el modelo local ya tenía.
- `supabase/tests/guardado_financiero_atomico.sql` pasó tras aplicar la migración: guardado, rollback, aislamiento, rechazo de tablas ajenas, idempotencia y restauración repetida conservando registros posteriores. Sus identidades son ficticias y toda la prueba se revierte.
- Suite final: 123 archivos y 1.421 pruebas aprobadas (`vitest run --pool=threads --maxWorkers=2`). Los intentos anteriores con procesos separados agotaron el tiempo de arranque; la ejecución final completa termina sin errores.
- Build TypeScript/Vite aprobado. Lint mantiene únicamente las seis advertencias preexistentes, ninguna nueva en los archivos modificados.
- Las pruebas nuevas cubren reapertura sin conexión, cuota local fallida, rechazo de permisos, escrituras/sincronizaciones simultáneas, paginación con páginas menores que las pedidas y rechazo visible del guardado.
- Se revisaron los asesores de seguridad de Supabase: la RPC y tabla nuevas no figuran en los hallazgos; existen avisos previos en funciones/tablas ajenas a este cambio. No cambiar sus permisos sin revisar sus consumidores. Referencia: https://supabase.com/docs/guides/database/database-linter.

## Cierre del paso 1

- Revisión visual en `http://127.0.0.1:5173/app`: registro manual de prueba, aviso de guardado local, deshacer y recarga confirmando libro vacío. Evidencias: `/tmp/lukapp-v5-guardado.png` y `/tmp/lukapp-v5-deshacer-reapertura.png`.
- Los formularios financieros esperan su propio resultado y conservan el borrador al fallar; captura múltiple y restauración son lotes completos. Ningún booleano global decide si una operación concurrente tuvo éxito.
- Las peticiones tienen límite de espera; si el resultado remoto es incierto, conservan el envío pendiente para reintentar sin duplicar los lotes.
- Borrar una cuenta conserva transacciones y recurrentes con referencia nula, igual que PostgreSQL; pruebas comunes verifican memoria e IndexedDB.
- El error de deshacer se limita al aviso correspondiente; una respuesta remota vacía conserva la copia local y explica la discrepancia.
- TypeScript, compilación Vite y `git diff --check` aprobados; lint conserva seis advertencias previas.

## Siguiente paso

Implementar y revisar el paso 7 con su propia versión; el objetivo completo de 16 pasos continúa activo.

## Cierre del paso 2: V5.1.0

- El inicio muestra una guía con dos avances reales: confirmar los saldos de las cuentas y guardar el primer movimiento. Los accesos abren la cuenta pendiente o la captura real.
- Saldo omitido y saldo cero son distintos: la apertura admite `null`; confirmar cero deja un movimiento de referencia durable sin modificar el saldo. Los registros previos se conservan; una cuenta antigua sin referencia pide confirmación.
- Se ocultan las recomendaciones, simulaciones y gráficos vacíos mientras faltan saldos o el primer registro. Un período sin movimientos se distingue de un libro sin historial.
- La bienvenida conserva saldos omitidos como pendientes y descarta la fuente o los dígitos cuando se elige omitirlos. No solicita saldo sin una cuenta de destino.
- Revisión visual local: confirmar $0 en Efectivo, recargar, comprobar avance 1 de 2 y abrir la captura desde la guía. Evidencia `/tmp/lukapp-v5-1-primeros-pasos.png`.
- Suite final: 124 archivos y 1.429 pruebas aprobadas. TypeScript y Vite aprobados; lint conserva seis advertencias previas y diff sin errores.

## Cierre del paso 3: V6.0.0

- El disponible aparece antes de avisos y recomendaciones; saldos e ingresos/gastos quedan en un desplegable nativo. El análisis y las categorías son otro desplegable cerrado inicialmente, después de la información diaria.
- Próximos pagos muestra hasta tres obligaciones por fecha, excluye confirmadas, distingue programado/estimado y señala fechas pendientes. No crea pagos; abre directamente el calendario financiero.
- Movimientos recientes ordena una copia y muestra los cinco últimos del período, con acceso al historial completo. Filtrar una categoría enfoca el listado; los controles de categorías ahora son botones accesibles por teclado.
- Se conserva espacio al final para evitar que las barras flotantes impidan alcanzar el último contenido. Los desplegables permanecen en el flujo del documento, sin superponer listas o remonte de la página.
- Revisión visual local: jerarquía del inicio, abrir/cerrar el desglose y navegación efectiva al calendario. Evidencia `/tmp/lukapp-v6-inicio.png`.
- Suite completa: 125 archivos y 1.433 pruebas aprobadas. Tras el ajuste final de accesibilidad, las seis pruebas de inicio/pagos y la compilación volvieron a pasar. TypeScript y diff aprobados; lint conserva seis advertencias previas.

## Cierre del paso 4: V7.0.0

- La barra identifica Escribir, Foto, Buscar y Voz con texto visible; el micrófono usa el color de acción en vez del color de salida de dinero. El dictado fallido ofrece pasar a escritura.
- Captura usa un formulario con ancho limitado en escritorio y campos para monto y descripción; Enter valida el guardado. En móvil conserva el teclado de LukApp y permite alternar con escritura directa del monto sin perder el valor.
- Cinco categorías frecuentes del mismo tipo de movimiento aparecen primero, junto con la seleccionada; todas siguen accesibles. Los chips conservan orden al elegir y usan iconos del catálogo en vez de emojis.
- Se mantiene el foco dentro del diálogo y se devuelve al botón de entrada al cerrar; Escape respeta la selección de cuenta y no cierra durante el guardado. Se corrigió la pérdida de foco al alternar teclados, detectada en la revisión visual.
- Revisión visual local: abrir escritura, escribir 2.500 con el teclado del dispositivo, volver al teclado de LukApp conservando el monto, pulsar Escape y comprobar regreso al inicio sin guardar el dato de prueba. Evidencia `/tmp/lukapp-v7-captura.png`.
- Suite completa: 125 archivos y 1.437 pruebas aprobadas. Después del ajuste final de foco, las 12 pruebas de captura/dictado y TypeScript/Vite volvieron a pasar. Lint conserva únicamente las seis advertencias previas y diff aprobado.
- La transcripción y el OCR se verifican con las pruebas existentes y sus dobles; esta revisión visual no grabó audio del usuario ni envió documentos personales.

## Cierre del paso 5: V8.0.0

- Dinero incluye Metas e Importar extractos junto a las cuentas; las herramientas compartidas y el 4x1000 quedan agrupadas. Mes incluye Pagos fijos, Proyección y el acceso al calendario. Más conserva preferencias, datos, cuenta y comunidad.
- La búsqueda encuentra funciones por nombre y usos, sin depender de tildes; muestra su sección y abre el destino real. Los movimientos se buscan en todo el historial incluso sin filtros, corrigiendo el acceso al historial completo del inicio.
- Las herramientas usan rutas dentro de su sección (`/dinero/metas`, `/mes/recurrentes`); las rutas anteriores siguen válidas. Añadir un pago desde el calendario conserva `/calendario` al volver.
- Desde el detalle de una cuenta se puede abrir importación con esa cuenta preseleccionada. Cerrar y Atrás recuperan el detalle de origen, incluso si se recargó la pantalla de importación con su parámetro de cuenta.
- Escape afecta solo a la capa superior y el foco vuelve al diálogo que permanece abierto; una prueba reproduce el cierre de importación sobre una cuenta.
- Revisión visual local: abrir/cerrar metas, importar desde Efectivo sin enviar archivos, comprobar selección y regreso por cerrar/Atrás, buscar metas y abrirlas, revisar Mes/calendario/pagos y la nueva lista de Más. Evidencia `/tmp/lukapp-v8-buscar-funciones.png`.
- Suite final: 128 archivos y 1.443 pruebas aprobadas. TypeScript, Vite y diff aprobados; lint conserva seis advertencias previas.

El siguiente paso son las animaciones comunes (7); los pasos 7 a 16 continúan pendientes. Estos cambios del frontend están cerrados localmente, sin publicación.

## Cierre del paso 6: V8.0.1

- Las pantallas financieras comparten iconos de trazo, radios de tarjeta/control/hoja, separación en múltiplos de 4 y textos de al menos 13 px. Se conserva Poppins y el arte de `public/brand/`, revisado contra su manual.
- Se reemplazaron emojis visibles de registros, categorías, ajustes, racha y herramientas compartidas por iconos del catálogo. Los campos antiguos se interpretan al pintar y se preservan para mantener compatibles registros y exportaciones; no se migró información financiera.
- Categorías usa un solo selector visual de iconos; las opciones tienen nombres en español. No se eliminó la personalización de color ni los valores antiguos.
- Los controles tienen objetivo táctil mínimo de 44 px, foco visible, estado deshabilitado distinguible y selección de tema con contraste. Los avisos, entradas y salidas usan tokens del tema; conexión y valoración del asesor no reutilizan verde/rojo decorativo.
- El cálculo sobre los tokens reales de claro/oscuro comprobó 52 combinaciones de texto/fondo con mínimo 4,58:1 (`/tmp/lukapp-paso6-contrastes.json`). La comprobación cubre la paleta compartida; no pretende certificar colores que el usuario elija para sus categorías.
- La revisión visual encontró y corrigió un solapamiento al aumentar texto/controles: Captura ahora conserva la altura natural del contenido, permite desplazarlo completo y mantiene Cerrar en el encabezado. Las leyendas pequeñas del monto no heredan el espaciado de la cifra grande.
- Se revisaron Ajustes en claro y oscuro, Captura con desplazamiento hasta Guardar y el editor de categorías con foco/selección. La preferencia de tema local volvió a Sistema; no se guardaron datos de prueba. Evidencias: `/tmp/lukapp-v8-0-1-captura-claro.png` y `/tmp/lukapp-v8-0-1-categorias-oscuro.png`.
- Verificación final: 128 archivos y 1.443 pruebas aprobadas; TypeScript/Vite y diff aprobados. Lint conserva seis advertencias previas. Frontend cerrado localmente, sin publicación.

## Corrección de identidad, V8.0.2

- Por indicación del usuario, los emojis forman parte de la identidad juvenil: se recuperan en categorías, captura, movimientos, inicio, ajustes, rachas y espacios compartidos.
- Se restaura el selector de emojis y se conservan los emojis personalizados guardados, junto con las mejoras de contraste, tipografía y controles del paso 6.
- Verificación: 21 pruebas aprobadas (categorías, captura y versión), TypeScript y compilación Vite correctos; lint conserva seis advertencias anteriores. Revisión visual en Ajustes y selección de emoji en Categorías sin guardar datos de prueba.

## Evidencia del paso 7

- Las transiciones de interacción que no declaran duración heredan una curva común de 180 ms; paneles, dictado y acceso usan entradas de 200 ms y el ripple dura 220 ms.
- `useMovimientoReducido` escucha los cambios de `prefers-reduced-motion` en vivo y alimenta `MotionConfig` en la raíz de la app; una prueba confirma la actualización inmediata y que el listener se retira al desmontar.
- Con movimiento reducido, la Estrella queda quieta, se detienen los carruseles decorativos y los pulsos dejan de repetirse; los registros, saldos y el texto transcrito se muestran completos sin esperar animación.
- El valor de `AnimatedNumber` aparece inmediatamente: solo anima su entrada breve al cambiar y nunca muestra un saldo viejo mientras espera.
- En modo reducido, `MotionConfig` omite todas las animaciones de Framer Motion y el CSS acorta transiciones; las escenas decorativas repetidas se detienen y los textos se muestran completos.
- Suite completa: 129 archivos y 1.444 pruebas aprobadas, incluida la actualización en vivo del ajuste y el retiro del listener; compilación TypeScript/Vite correcta y lint con las seis advertencias ya existentes.
- En la revisión visual del inicio, los estados iniciales y los saldos conservan su jerarquía; no se interactuó con movimientos financieros.
