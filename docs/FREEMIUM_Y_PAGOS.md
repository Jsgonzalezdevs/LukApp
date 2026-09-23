# Freemium y pagos de LukApp

## Alcance de esta versión

LukApp tiene exactamente dos planes:

| Incluye | Normal | Premium |
| --- | --- | --- |
| Precio | Gratis para siempre | $9.900 COP/mes o $79.900 COP/año |
| Registro manual, texto, foto/OCR, finanzas, historial, exportación y modo offline | Ilimitado | Ilimitado |
| Finanzas compartidas | 1 espacio, hasta 4 personas | Espacios e integrantes ilimitados |
| Registro por voz | 60 al mes | 300 al mes |
| Asesor IA | 5 consultas al mes | 60 consultas al mes |
| Importar extractos PDF | 1 al mes | 12 al mes |

Los cupos se validan en PostgreSQL, de forma atómica y con el mes de Bogotá. No dependen de lo que el navegador muestre. Si IA, voz o el análisis de un PDF fallan antes de devolver un resultado, el cupo se devuelve.

No hay una pasarela de pago activada todavía. El sistema ya conserva suscripciones, ciclos, referencias externas, auditoría e idempotencia para conectarla de forma segura, pero no inicia cobros ni recibe webhooks hasta elegir un proveedor y configurar sus credenciales.

## Roles del panel

- **Superadmin fijo (`admin`)**: ve el panel de Planes, cambia precios y límites, otorga Premium de cortesía y cancela beneficios manuales.
- **Rol personalizado con `ver_facturacion`**: solo ve cifras agregadas. No recibe nombres, correos, vigencias individuales ni controles de cambios.
- Ningún rol personalizado puede modificar planes, dar Premium ni cancelar suscripciones. Esa separación evita que un permiso delegado se convierta en una vía para administrar dinero o elevar privilegios.

## Despliegue seguro, paso a paso

Hazlo primero en una rama o proyecto de prueba. No actives una pasarela en producción hasta completar la sección de sandbox.

1. En Supabase, crea una copia de seguridad desde **Database → Backups**.
2. En **SQL Editor**, abre y ejecuta completo [`../supabase/migrations/20260923151315_freemium_suscripciones_y_cupos.sql`](../supabase/migrations/20260923151315_freemium_suscripciones_y_cupos.sql). No ejecutes solo fragmentos: las tablas, restricciones, RLS y funciones forman una unidad.
3. Comprueba las dos filas de planes:

   ```sql
   select codigo, precio_mensual_cop, precio_anual_cop,
          limite_dictados_mensual, limite_asesor_ia_mensual,
          limite_extractos_mensual, limite_espacios_compartidos,
          limite_integrantes_por_espacio
     from public.planes_suscripcion
    order by codigo;
   ```

   Deben aparecer `normal` con precio `0` y `premium` con `9900` mensual y `79900` anual.

4. En Render, añade `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` como variables privadas del servicio que ejecuta `server.ts`.
5. En Vercel, añade las mismas dos variables **sin** prefijo `VITE_` para proteger `api/transcribir.ts`. Mantén en el cliente solamente `VITE_SUPABASE_URL` y la clave pública/anon de Supabase.
6. Despliega backend y frontend. La migración se aplica antes del código; mientras se despliega, las funciones financieras que no usan cupos siguen funcionando normalmente.
7. Inicia sesión como superadmin y abre **Superadmin → Planes**. Confirma que ves dos planes, no tres. Crea un rol de prueba con solo `ver_facturacion` y confirma que ve cifras, pero no el listado de personas ni botones para modificar beneficios.
8. Otorga Premium de cortesía a una cuenta de prueba por un día. Confirma que aparece en la lista, que la cuenta recibe los límites Premium y que al cancelar vuelve a Normal.
9. Prueba un límite Normal con una cuenta de ensayo: al exceder una consulta IA, un PDF o un dictado debe recibir un mensaje claro y no debe llamar al proveedor otra vez. Prueba también una caída simulada del proveedor: el contador debe volver al valor anterior.

## Antes de conectar la pasarela

La elección de proveedor es una decisión comercial y requiere sus credenciales, URL pública de webhook y pruebas de sandbox. No guardes llaves ni secretos en el repositorio, ni en variables `VITE_`.

Cuando se elija el proveedor, el flujo debe ser este:

1. El servidor crea la intención de pago con el precio leído de `planes_suscripcion`, nunca con un valor recibido del navegador.
2. El usuario completa el pago en la pasarela.
3. El webhook verifica la firma oficial del proveedor antes de escribir algo en la base.
4. El webhook usa su identificador de evento como `referencia_externa` y llama a `public.activar_premium_pasarela(...)` con la llave de servicio. La función y su restricción única hacen que un reintento no otorgue Premium dos veces.
5. Tras pago aprobado, la función crea una suscripción `activa` de ciclo `mensual` o `anual`; tras rechazo o reversión, registra un evento de auditoría sin conservar números de tarjeta, comprobantes completos ni payloads crudos.
6. Prueba en sandbox pago exitoso, pago rechazado, webhook duplicado, renovación, cancelación y webhook con firma inválida antes de habilitar producción.

La tabla `suscripciones` ya guarda el valor efectivamente cobrado, el ciclo, las fechas y la referencia externa. `eventos_facturacion` guarda solo trazabilidad mínima. No se almacenan datos de tarjeta ni contenido sensible de la pasarela.

## Operación cotidiana

- Cambiar los precios o límites desde el panel afecta usos futuros; no reescribe cobros anteriores.
- Normal no se puede cobrar ni desactivar. Es el respaldo automático cuando Premium vence o se cancela.
- El botón de cortesía está pensado para soporte, alianzas y pruebas. Cada acción queda registrada con el superadmin que la hizo.
- Si falta `SUPABASE_SERVICE_ROLE_KEY` en un servidor, el dictado de ese despliegue falla cerrado: no usa la llave de IA sin poder validar la identidad y el cupo.
