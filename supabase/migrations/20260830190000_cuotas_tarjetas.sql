-- Una compra diferida conserva la deuda total y la cuota mensual por separado.
alter table public.transacciones
  add column if not exists cuotas_total integer,
  add column if not exists cuota_cop bigint;

alter table public.transacciones
  add constraint transacciones_cuotas_validas
  check (
    (cuotas_total is null and cuota_cop is null)
    or (cuotas_total >= 2 and cuota_cop > 0)
  ) not valid;

alter table public.transacciones
  validate constraint transacciones_cuotas_validas;
