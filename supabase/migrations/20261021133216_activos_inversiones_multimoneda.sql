alter table public.cajitas
  add column if not exists es_inversion boolean not null default false,
  add column if not exists moneda text not null default 'COP';

alter table public.cajitas
  add constraint cajitas_moneda_codigo_check
  check (moneda ~ '^[A-Z]{3}$');

alter table public.cajita_movimientos
  add column if not exists monto_original numeric(20, 6),
  add column if not exists moneda_original text,
  add column if not exists tasa_cambio_cop numeric(20, 8);

alter table public.cajita_movimientos
  drop constraint if exists cajita_movimientos_kind_check;

alter table public.cajita_movimientos
  add constraint cajita_movimientos_kind_check
  check (kind in ('deposito', 'retiro', 'rendimiento', 'valoracion', 'ajuste', 'compra', 'abono'));
