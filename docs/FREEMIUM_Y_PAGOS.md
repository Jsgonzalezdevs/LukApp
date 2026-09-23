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

Los pagos usan **Wompi Web Checkout**. La persona elige mensual o anual en
**Ajustes → Cuenta**, completa el pago en Wompi y el plan cambia a Premium solo
cuando llega un webhook firmado con estado `APPROVED`. Volver a LukApp desde la
pantalla de Wompi es informativo; no activa beneficios por sí mismo.

Esta primera integración cobra cada ciclo de forma individual. Premium se
activa automáticamente después de cada pago aprobado y vence al mes o al año;
no tokeniza tarjetas ni programa cargos recurrentes sin una autorización
adicional de la persona.

## Roles del panel

- **Superadmin fijo (`admin`)**: ve el panel de Planes, cambia precios y límites, otorga Premium de cortesía, ajusta la vigencia y puede retirar el acceso Premium de cualquier cuenta. Esa última acción no borra ni reembolsa el cobro de Wompi: conserva la transacción para conciliación.
- **Rol personalizado con `ver_facturacion`**: solo ve cifras agregadas. No recibe nombres, correos, vigencias individuales ni controles de cambios.
- Ningún rol personalizado puede modificar planes, dar Premium ni cancelar suscripciones. Esa separación evita que un permiso delegado se convierta en una vía para administrar dinero o elevar privilegios.

## Despliegue seguro, paso a paso

Hazlo primero en una rama o proyecto de prueba. No actives una pasarela en producción hasta completar la sección de sandbox.

1. En Supabase, crea una copia de seguridad desde **Database → Backups**.
2. En **SQL Editor**, abre y ejecuta completo [`../supabase/migrations/20260923151315_freemium_suscripciones_y_cupos.sql`](../supabase/migrations/20260923151315_freemium_suscripciones_y_cupos.sql). No ejecutes solo fragmentos: las tablas, restricciones, RLS y funciones forman una unidad.
3. Ejecuta después [`../supabase/migrations/20260923161824_wompi_checkout_y_webhooks.sql`](../supabase/migrations/20260923161824_wompi_checkout_y_webhooks.sql). Crea las intenciones de pago con RLS cerrado y el candado que evita dos checkouts abiertos para una misma cuenta.
4. Comprueba las dos filas de planes:

   ```sql
   select codigo, precio_mensual_cop, precio_anual_cop,
          limite_dictados_mensual, limite_asesor_ia_mensual,
          limite_extractos_mensual, limite_espacios_compartidos,
          limite_integrantes_por_espacio
     from public.planes_suscripcion
    order by codigo;
   ```

   Deben aparecer `normal` con precio `0` y `premium` con `9900` mensual y `79900` anual.

5. En Render, añade `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` como variables privadas del servicio que ejecuta `server.ts`.
6. En el mismo servicio de Render añade estas variables privadas de Wompi. Nunca las pegues en el código ni les pongas prefijo `VITE_`:

   ```dotenv
   WOMPI_AMBIENTE=sandbox
   WOMPI_PUBLIC_KEY=pub_test_...
   WOMPI_INTEGRITY_SECRET=test_integrity_...
   WOMPI_EVENTS_SECRET=test_events_...
   WOMPI_REDIRECT_URL=https://TU-DOMINIO/finanzas/ajustes/cuenta
   ```

   Las tres llaves se encuentran en **Wompi → Desarrolladores → Secretos para
   integración técnica**. `WOMPI_REDIRECT_URL` debe ser la URL pública HTTPS de
   tu frontend, no la de Render. Para producción cambia el ambiente a
   `produccion` y usa exclusivamente `pub_prod_`, `prod_integrity_` y
   `prod_events_`.
7. En Wompi Dashboard configura el evento `transaction.updated` para cada
   ambiente. La URL debe ser la API pública de Render seguida de:

   ```text
   https://TU-SERVICIO.onrender.com/api/pagos/wompi/webhook
   ```

   Configura una URL de sandbox y otra de producción. Wompi reintentará si no
   recibe HTTP 200; LukApp verifica el checksum antes de tocar la base.
8. En Vercel mantén en el cliente solamente `VITE_SUPABASE_URL`, la clave
   pública/anon de Supabase y `VITE_API_URL` apuntando a Render. Las variables
   privadas de Wompi **no van en Vercel** para este flujo, porque el checkout y
   el webhook los atiende `server.ts` en Render.
9. Despliega backend y frontend. Las migraciones se aplican antes del código.
10. En sandbox, prueba con una cuenta de ensayo: un pago aprobado debe cambiar
    la cuenta a Premium; uno rechazado no debe hacerlo; repetir el mismo
    webhook debe mantener una sola suscripción. Prueba también un webhook con
    firma alterada: debe ser rechazado y no escribir nada.
11. Solo después repite la configuración con las llaves `prod_*`, la URL de
    eventos de producción y un cobro real pequeño que puedas conciliar.

La tabla `suscripciones` guarda el valor efectivamente cobrado, ciclo, fechas y
el identificador de la transacción de Wompi. `intentos_pago_wompi` guarda la
referencia interna mínima para ligar ese pago a una cuenta. No se almacenan
tarjetas, documentos, comprobantes completos ni payloads crudos de la pasarela.

## Operación cotidiana

- Cambiar los precios o límites desde el panel afecta usos futuros; no reescribe cobros anteriores.
- Los botones de compra en la cuenta siempre muestran los precios de la fila **Premium**, incluso cuando la cuenta actual es Normal (cuyo precio propio es $0).
- Normal no se puede cobrar ni desactivar. Es el respaldo automático cuando Premium vence o se cancela.
- En **Planes → Premium vigente**, el superadmin puede cambiar la fecha de vencimiento o retirar Premium como acción de soporte. Si hace falta un reembolso, se gestiona en Wompi; LukApp solo cambia el acceso y deja trazabilidad.
- El botón de cortesía está pensado para soporte, alianzas y pruebas. Cada acción queda registrada con el superadmin que la hizo.
- Si falta `SUPABASE_SERVICE_ROLE_KEY` en un servidor, el dictado de ese despliegue falla cerrado: no usa la llave de IA sin poder validar la identidad y el cupo.
