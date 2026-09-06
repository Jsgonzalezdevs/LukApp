-- Reparación segura para instalaciones donde las migraciones de cuentas,
-- tarjetas o clases de cuenta no llegaron a aplicarse. No borra ni modifica
-- los saldos existentes; solo completa la estructura que usa el cliente.

alter table public.cajitas
  add column if not exists tipo text not null default 'cajita',
  add column if not exists clase_cuenta text,
  add column if not exists limite_credito_cop bigint,
  add column if not exists dia_corte smallint,
  add column if not exists dia_pago smallint,
  add column if not exists pago_minimo_cop bigint;

alter table public.cajitas
  drop constraint if exists cajitas_tipo_check,
  drop constraint if exists cajitas_clase_cuenta_check,
  drop constraint if exists cajitas_tarjeta_config_valida;

alter table public.cajitas
  add constraint cajitas_tipo_check
    check (tipo in ('cuenta', 'cajita', 'deuda', 'tarjeta')),
  add constraint cajitas_clase_cuenta_check
    check (clase_cuenta is null or clase_cuenta in ('efectivo', 'banco', 'billetera')),
  add constraint cajitas_tarjeta_config_valida
    check (
      tipo <> 'tarjeta' or (
        (limite_credito_cop is null or limite_credito_cop >= 0)
        and (dia_corte is null or dia_corte between 1 and 31)
        and (dia_pago is null or dia_pago between 1 and 31)
        and (pago_minimo_cop is null or pago_minimo_cop >= 0)
      )
    ) not valid;

create index if not exists cajitas_user_tipo_idx
  on public.cajitas (user_id, tipo);

create index if not exists cajitas_user_clase_cuenta_idx
  on public.cajitas (user_id, clase_cuenta);

notify pgrst, 'reload schema';
