-- Una transferencia propia tiene que ser visible en el historial sin que los
-- cálculos de gasto e ingreso la traten como consumo o ganancia.
alter table public.transacciones
  drop constraint if exists transacciones_kind_check;

alter table public.transacciones
  add constraint transacciones_kind_check
  check (kind in ('gasto', 'ingreso', 'transferencia')) not valid;

alter table public.transacciones
  validate constraint transacciones_kind_check;
