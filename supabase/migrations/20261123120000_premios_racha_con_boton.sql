-- Los premios de racha ya no se entregan solos al abrir la app: quedan
-- esperando y la persona los activa con un botón cuando quiera. Así no se
-- gastan días de Premium que alguien no sabía que tenía, y puede guardarlos
-- mientras le dura un Premium pagado.
--
-- Se apoya en 20261122170000_incentivos_de_racha.sql.

-- ---------------------------------------------------------------------------
-- 1. Qué premios hay y en qué estado está cada uno. La racha se mide igual que
-- antes (solo días anotados a tiempo, sin bonos), así lo que ve el cliente es
-- exactamente lo que el servidor dejará reclamar.
create or replace function public.estado_premios_racha()
returns table (
  premio_hito int,
  premio_dias int,
  alcanzado boolean,
  reclamado boolean,
  -- Con Premium pagado vigente no se puede activar: el premio espera.
  bloqueado_por_pago boolean,
  racha_valida int
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_racha int;
  v_pago boolean;
begin
  if v_uid is null then
    return;
  end if;

  select c.racha_actual into v_racha from public.calcular_rachas(v_uid, true, false) c;
  v_racha := coalesce(v_racha, 0);

  v_pago := exists (
    select 1 from public.suscripciones s
    where s.user_id = v_uid and s.estado = 'activa' and s.origen = 'pasarela' and s.vence_en > now()
  );

  return query
    select p.hito,
           p.dias,
           -- Un premio ya alcanzado no se pierde porque la racha se corte
           -- después: si existe la fila sigue contando como alcanzado.
           v_racha >= p.hito or x.hito is not null,
           x.hito is not null,
           v_pago,
           v_racha
    from (values (30, 7), (100, 30), (365, 90)) as p(hito, dias)
    left join public.racha_premios x on x.user_id = v_uid and x.hito = p.hito
    order by p.hito;
end;
$$;

revoke all on function public.estado_premios_racha() from public, anon;
grant execute on function public.estado_premios_racha() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Reclamar UN premio, a pedido de la persona.
--
-- Si ya tiene una cortesía activa, los días se suman al final de esa en vez
-- de pisarla. Con Premium pagado no se toca nada: el premio sigue disponible.
create or replace function public.reclamar_premio_racha(p_hito int)
returns table (
  otorgado boolean,
  motivo text,
  vence_en timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_racha int;
  v_dias int;
  v_desde timestamptz;
  v_suscripcion public.suscripciones;
begin
  if v_uid is null then
    return query select false, 'sin_sesion'::text, null::timestamptz;
    return;
  end if;

  select p.dias into v_dias
  from (values (30, 7), (100, 30), (365, 90)) as p(hito, dias)
  where p.hito = p_hito;
  if v_dias is null then
    return query select false, 'hito_invalido'::text, null::timestamptz;
    return;
  end if;

  -- Serializa reclamos simultáneos de la misma persona (dos pestañas, doble toque).
  perform 1 from public.perfiles where id = v_uid for update;
  if not found then
    return query select false, 'sin_perfil'::text, null::timestamptz;
    return;
  end if;

  if exists (select 1 from public.racha_premios x where x.user_id = v_uid and x.hito = p_hito) then
    return query select false, 'ya_reclamado'::text, null::timestamptz;
    return;
  end if;

  select c.racha_actual into v_racha from public.calcular_rachas(v_uid, true, false) c;
  if coalesce(v_racha, 0) < p_hito then
    return query select false, 'no_alcanzado'::text, null::timestamptz;
    return;
  end if;

  if exists (
    select 1 from public.suscripciones s
    where s.user_id = v_uid and s.estado = 'activa' and s.origen = 'pasarela' and s.vence_en > now()
  ) then
    return query select false, 'tiene_premium_pagado'::text, null::timestamptz;
    return;
  end if;

  select greatest(now(), coalesce(max(s.vence_en), now())) into v_desde
  from public.suscripciones s
  where s.user_id = v_uid and s.estado = 'activa' and s.origen = 'manual' and s.vence_en > now();

  v_suscripcion := public.otorgar_premium_manual(
    v_uid,
    v_desde + make_interval(days => v_dias),
    v_uid,
    format('Premio por %s días de racha', p_hito)
  );

  insert into public.racha_premios (user_id, hito, dias_premio)
  values (v_uid, p_hito, v_dias);

  return query select true, null::text, v_suscripcion.vence_en;
end;
$$;

revoke all on function public.reclamar_premio_racha(int) from public, anon;
grant execute on function public.reclamar_premio_racha(int) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. La función vieja se queda vacía en vez de borrarse: las versiones de la
-- app que ya están instaladas la siguen llamando al abrir, y si desapareciera
-- verían un error; si siguiera viva, regalaría el premio sin preguntar.
create or replace function public.reclamar_premios_racha()
returns table (
  premio_hito int,
  premio_dias int,
  premio_otorgado boolean,
  premio_motivo text
)
language sql
security definer
stable
set search_path = public
as $$
  select null::int, null::int, false, null::text where false;
$$;

revoke all on function public.reclamar_premios_racha() from public, anon;
grant execute on function public.reclamar_premios_racha() to authenticated;
