-- Configuración opcional de tarjetas. No altera saldos ni historial.
alter table public.cajitas
  add column if not exists limite_credito_cop bigint,
  add column if not exists dia_corte smallint,
  add column if not exists dia_pago smallint,
  add column if not exists pago_minimo_cop bigint;

alter table public.cajitas
  drop constraint if exists cajitas_tarjeta_config_valida;

alter table public.cajitas
  add constraint cajitas_tarjeta_config_valida check (
    (tipo <> 'tarjeta') or (
      (limite_credito_cop is null or limite_credito_cop >= 0)
      and (dia_corte is null or dia_corte between 1 and 31)
      and (dia_pago is null or dia_pago between 1 and 31)
      and (pago_minimo_cop is null or pago_minimo_cop >= 0)
    )
  ) not valid;
