# Mejoras de LukApp: ejecución secuencial

Solicitud: implementar los 16 puntos acordados, revisar cada uno, corregir lo que falte y avanzar únicamente cuando el anterior esté verificado. El objetivo completo sigue activo. Una prueba verde de una parte no cierra un paso entero.

| Paso | Alcance y criterio de aceptación | Estado |
| --- | --- | --- |
| 1 | Guardado completo, cola durable, estados de sincronización, errores visibles y deshacer seguro; probar fallos, reapertura y operaciones seguidas. | Verificado, V5.0.0 |
| 2 | Primera cuenta y primer registro guiados; distinguir datos incompletos de saldo cero; revisar el inicio vacío. | Pendiente |
| 3 | Inicio centrado en disponible, próximos pagos y movimientos; detalles desplegables sin saltos. | Pendiente |
| 4 | Voz, foto y escritura claras; categorías frecuentes; formulario y teclado adecuados para móvil y escritorio. | Pendiente |
| 5 | Metas en Dinero, pagos/calendario en Mes e importación en cuentas; Más para ajustes; búsqueda de funciones y navegación que conserva contexto. | Pendiente |
| 6 | Iconos, tipografía, espacios, tarjetas, botones y colores coherentes con CLAUDE.md; comprobar legibilidad y estados. | Pendiente |
| 7 | Animaciones comunes y breves para interacción, paneles y cambios; respetar movimiento reducido y conservar estabilidad. | Pendiente |
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

Implementar y revisar el paso 2 con su propia versión; el objetivo completo de 16 pasos continúa activo.
