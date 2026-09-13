# Decisiones financieras visibles en LukApp

Este documento mantiene el significado de las cifras que se muestran en la
interfaz. La app no debe presentar una proyección como si fuera un movimiento
real ni mezclar saldos de cuentas con dinero reservado.

## Nombres que deben conservarse

- **Saldo:** dinero reconstruido desde los movimientos de una cuenta o cajita.
- **Liquidez:** dinero disponible para responder a obligaciones próximas.
- **Dinero libre:** máximo gastable después de reservas y obligaciones del
  periodo; nunca debe ocultar un déficit real.
- **Patrimonio:** valor neto de activos y pasivos, no necesariamente dinero que
  pueda gastarse hoy.
- **Reserva:** dinero separado en cajitas o metas y no disponible para gasto
  ordinario.
- **Obligación:** salida futura conocida, programada, estimada o desconocida.

## Niveles de certeza

Las cifras deben conservar su origen visible cuando sea relevante:

- **Real:** movimiento confirmado por el usuario o importado.
- **Programada:** recurrente o pago configurado para una fecha futura.
- **Estimada:** cálculo basado en el historial o en una proyección.
- **Desconocida:** existe una obligación, pero falta fecha, monto o ambos.

Cuando una cifra no sea real, la pantalla debe acompañarla con una etiqueta,
una explicación breve o la evidencia que la produjo.

## Reglas de interpretación

- Una transferencia interna no es ingreso ni gasto.
- Una cajita no se descuenta dos veces: es reserva, no gasto.
- Una compra con tarjeta aumenta el pasivo; el pago posterior reduce la deuda.
- Las cuotas explican el pago proyectado, pero no se suman como otra salida.
- El día faltante no se inventa para una serie diaria.
- El valor bruto conserva el déficit; el valor disponible nunca debe mostrar una
  disponibilidad positiva falsa.

## Revisión antes de cambiar el motor

Todo cambio financiero debe revisar simultáneamente Inicio, Dinero, Mes,
Calendario, Asesor y las pruebas del motor. La interfaz consume el contexto
central y no debe recalcular estas reglas por separado.
