-- Wompi Web Checkout: cada referencia se genera en el servidor y vincula el
-- pago con una cuenta antes de redirigir a la pasarela. No guardamos tarjetas,
-- documentos ni el cuerpo crudo del webhook: solo el mínimo para conciliarlo.
create table public.intentos_pago_wompi (
  id                       bigint generated always as identity primary key,
  referencia               text not null unique check (referencia ~ '^[A-Za-z0-9_-]{12,100}$'),
  user_id                  uuid not null references public.perfiles(id) on delete cascade,
  ciclo                    text not null check (ciclo in ('mensual', 'anual')),
  monto_cop                bigint not null check (monto_cop > 0),
  moneda                   text not null default 'COP' check (moneda = 'COP'),
  ambiente                 text not null check (ambiente in ('test', 'prod')),
  estado                   text not null default 'creado'
                           check (estado in ('creado', 'pendiente', 'aprobado', 'rechazado', 'anulado', 'vencido', 'error')),
  checkout_vence_en        timestamptz not null,
  wompi_transaccion_id     text check (wompi_transaccion_id is null or char_length(wompi_transaccion_id) between 3 and 200),
  suscripcion_id           bigint references public.suscripciones(id) on delete set null,
  creado_en                timestamptz not null default now(),
  actualizado_en           timestamptz not null default now(),
  finalizado_en            timestamptz,
  check (checkout_vence_en > creado_en)
);

-- Sirven al perfil que vuelve a iniciar checkout, al cierre rápido de intentos
-- vencidos y a los borrados en cascada de perfil o suscripción.
create index intentos_pago_wompi_usuario_creado_idx
  on public.intentos_pago_wompi (user_id, creado_en desc);
create index intentos_pago_wompi_abiertos_vencimiento_idx
  on public.intentos_pago_wompi (checkout_vence_en)
  where estado in ('creado', 'pendiente');
create index intentos_pago_wompi_suscripcion_idx
  on public.intentos_pago_wompi (suscripcion_id)
  where suscripcion_id is not null;
create unique index intentos_pago_wompi_transaccion_unica_idx
  on public.intentos_pago_wompi (ambiente, wompi_transaccion_id)
  where wompi_transaccion_id is not null;

alter table public.intentos_pago_wompi enable row level security;
revoke all on table public.intentos_pago_wompi from public, anon, authenticated;

-- La fila de perfil funciona como candado por cuenta, igual que al otorgar
-- Premium: dos clics simultáneos no pueden abrir dos checkouts y terminar en
-- un doble cobro. Si la persona vuelve dentro de 30 minutos, reaprovecha la
-- misma referencia; cambiar mensual/anual requiere terminar o dejar vencer la
-- intención anterior para que el importe nunca sea ambiguo.
create or replace function public.crear_intento_pago_wompi(
  p_usuario uuid,
  p_ciclo text,
  p_monto_cop bigint,
  p_ambiente text,
  p_referencia text,
  p_checkout_vence_en timestamptz
)
returns public.intentos_pago_wompi
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_intento public.intentos_pago_wompi;
begin
  if p_usuario is null
    or p_ciclo not in ('mensual', 'anual')
    or p_monto_cop <= 0
    or p_ambiente not in ('test', 'prod')
    or p_referencia is null
    or p_referencia !~ '^[A-Za-z0-9_-]{12,100}$'
    or p_checkout_vence_en is null
    or p_checkout_vence_en <= now() then
    raise exception 'La intención de pago no tiene datos válidos.' using errcode = '22023';
  end if;

  perform 1 from public.perfiles where id = p_usuario for update;
  if not found then
    raise exception 'La cuenta asociada al pago no existe.' using errcode = 'P0001';
  end if;

  update public.intentos_pago_wompi
     set estado = 'vencido', finalizado_en = now(), actualizado_en = now()
   where user_id = p_usuario
     and estado in ('creado', 'pendiente')
     and checkout_vence_en <= now();

  select * into v_intento
    from public.intentos_pago_wompi
   where user_id = p_usuario
     and estado in ('creado', 'pendiente')
     and checkout_vence_en > now()
   order by creado_en desc
   limit 1
   for update;
  if found then
    return v_intento;
  end if;

  insert into public.intentos_pago_wompi (
    referencia, user_id, ciclo, monto_cop, ambiente, checkout_vence_en
  ) values (
    p_referencia, p_usuario, p_ciclo, p_monto_cop, p_ambiente, p_checkout_vence_en
  )
  returning * into v_intento;

  return v_intento;
end;
$$;

revoke all on function public.crear_intento_pago_wompi(uuid, text, bigint, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.crear_intento_pago_wompi(uuid, text, bigint, text, text, timestamptz) to service_role;
