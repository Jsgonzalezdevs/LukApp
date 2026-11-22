-- Incentivos para mantener la racha: protectores, ranking semanal, retos entre
-- amigos de un espacio compartido, premio Premium por hitos y aviso push antes
-- de perder la racha. Se apoya en 20261121120000_ranking_de_racha.sql.
--
-- Todo es SECURITY DEFINER con search_path fijo y solo devuelve lo mínimo
-- (apodo, días, rachas). Los montos y categorías nunca salen de aquí.

-- ---------------------------------------------------------------------------
-- 1. Tablas

-- Un protector cubre UN día perdido. Se gana uno por cada 7 días de racha y
-- se guardan máximo 2, para que sea una red de seguridad y no una licencia
-- para dejar de anotar.
create table if not exists public.racha_protectores (
  user_id      uuid primary key references public.perfiles (id) on delete cascade,
  disponibles  int not null default 0 check (disponibles between 0 and 2),
  -- Desde qué día corre la racha actual y cuántos protectores ya dio. Si la
  -- racha se rompe y vuelve a empezar, el contador se reinicia.
  inicio_racha date,
  otorgados    int not null default 0 check (otorgados >= 0)
);

create table if not exists public.racha_dias_protegidos (
  user_id uuid not null references public.perfiles (id) on delete cascade,
  dia     date not null,
  primary key (user_id, dia)
);

-- Cada hito de premio se reclama una sola vez por persona.
create table if not exists public.racha_premios (
  user_id     uuid not null references public.perfiles (id) on delete cascade,
  hito        int  not null,
  dias_premio int  not null check (dias_premio > 0),
  otorgado_en timestamptz not null default now(),
  primary key (user_id, hito)
);

-- Para no avisar dos veces el mismo día a la misma persona.
create table if not exists public.racha_avisos (
  user_id uuid not null references public.perfiles (id) on delete cascade,
  dia     date not null,
  primary key (user_id, dia)
);

alter table public.racha_protectores enable row level security;
alter table public.racha_dias_protegidos enable row level security;
alter table public.racha_premios enable row level security;
alter table public.racha_avisos enable row level security;

-- Lectura de lo propio; escribir solo pasa por las funciones de abajo.
drop policy if exists racha_protectores_leer on public.racha_protectores;
create policy racha_protectores_leer on public.racha_protectores
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists racha_dias_protegidos_leer on public.racha_dias_protegidos;
create policy racha_dias_protegidos_leer on public.racha_dias_protegidos
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists racha_premios_leer on public.racha_premios;
create policy racha_premios_leer on public.racha_premios
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 2. Rachas, ahora con días protegidos y bonos.
--
-- `p_user` limita el cálculo a una persona (barato); sin él se calcula para
-- todas. `p_solo_tiempo_real` solo cuenta movimientos anotados el mismo día o
-- al siguiente: se usa para premios, así nadie gana Premium rellenando 30
-- días atrasados de una sola sentada. `p_con_bonos` suma los días que el
-- equipo regaló (racha_bonos), igual que hace el cliente; se apaga para
-- premios y protectores, que se miden solo con días anotados de verdad.
drop function if exists public.calcular_rachas();
drop function if exists public.calcular_rachas(uuid, boolean);

create or replace function public.calcular_rachas(
  p_user uuid default null,
  p_solo_tiempo_real boolean default false,
  p_con_bonos boolean default true
)
returns table (user_id uuid, racha_actual int, racha_maxima int)
language sql
security definer
stable
set search_path = public
as $$
  with hoy as (
    select (now() at time zone 'America/Bogota')::date as dia
  ),
  dias as (
    select t.user_id, t.occurred_on as dia
    from public.transacciones t, hoy
    where t.occurred_on <= hoy.dia
      and (p_user is null or t.user_id = p_user)
      and (not p_solo_tiempo_real
           or (t.created_at at time zone 'America/Bogota')::date <= t.occurred_on + 1)
    union
    select p.user_id, p.dia
    from public.racha_dias_protegidos p, hoy
    where p.dia <= hoy.dia
      and (p_user is null or p.user_id = p_user)
  ),
  grupos as (
    select d.user_id, d.dia,
           d.dia - (row_number() over (partition by d.user_id order by d.dia))::int as grupo
    from dias d
  ),
  islas as (
    select g.user_id, count(*)::int as largo, min(g.dia) as inicio, max(g.dia) as ultimo
    from grupos g
    group by g.user_id, g.grupo
  ),
  -- Cada bono va pegado al día en que empezó la racha que lo recibió: si esa
  -- racha se corta, el bono se va con ella.
  totales as (
    select i.user_id, i.ultimo,
           i.largo + case when p_con_bonos
                          then coalesce((select sum(b.dias)::int from public.racha_bonos b
                                          where b.user_id = i.user_id and b.inicio_racha = i.inicio), 0)
                          else 0 end as total
    from islas i
  )
  select t.user_id,
         coalesce(max(t.total) filter (where t.ultimo >= h.dia - 1), 0)::int,
         max(t.total)::int
  from totales t, hoy h
  group by t.user_id;
$$;

revoke all on function public.calcular_rachas(uuid, boolean, boolean) from public, anon, authenticated;

-- ¿Ese día cuenta para la racha (movimiento o protector)?
create or replace function public.dia_cuenta_para_racha(p_user uuid, p_dia date)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.transacciones t where t.user_id = p_user and t.occurred_on = p_dia)
      or exists (select 1 from public.racha_dias_protegidos d where d.user_id = p_user and d.dia = p_dia);
$$;

revoke all on function public.dia_cuenta_para_racha(uuid, date) from public, anon, authenticated;

-- Días con anotación en lo que va de la semana (lunes a hoy, hora de Bogotá).
create or replace function public.dias_de_la_semana(p_user uuid)
returns int
language sql
security definer
stable
set search_path = public
as $$
  with hoy as (select (now() at time zone 'America/Bogota')::date as dia),
  sem as (select date_trunc('week', hoy.dia::timestamp)::date as inicio, hoy.dia from hoy)
  select count(*)::int from (
    select t.occurred_on as dia from public.transacciones t, sem
    where t.user_id = p_user and t.occurred_on between sem.inicio and sem.dia
    union
    select d.dia from public.racha_dias_protegidos d, sem
    where d.user_id = p_user and d.dia between sem.inicio and sem.dia
  ) x;
$$;

revoke all on function public.dias_de_la_semana(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Sincronizar: aplicar un protector si ayer se perdió y regalar los que se
-- hayan ganado. La app la llama al abrir y al anotar el primer movimiento del
-- día. Solo actúa sobre quien llama.
--
-- Un protector solo salva el día de ayer, y solo si había una racha de al
-- menos 3 días: no se gasta en días sueltos.
create or replace function public.sincronizar_racha()
returns table (
  protectores int,
  dias_protegidos date[],
  protector_usado date,
  protector_ganado boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_hoy date := (now() at time zone 'America/Bogota')::date;
  v_estado public.racha_protectores%rowtype;
  v_usado date;
  v_ganado boolean := false;
  v_racha int;
  v_inicio date;
  v_derecho int;
begin
  if v_uid is null then
    return;
  end if;

  insert into public.racha_protectores (user_id) values (v_uid) on conflict do nothing;
  select * into v_estado from public.racha_protectores where user_id = v_uid for update;

  if v_estado.disponibles > 0
     and not public.dia_cuenta_para_racha(v_uid, v_hoy - 1)
     and public.dia_cuenta_para_racha(v_uid, v_hoy - 2)
     and public.dia_cuenta_para_racha(v_uid, v_hoy - 3)
     and public.dia_cuenta_para_racha(v_uid, v_hoy - 4)
  then
    insert into public.racha_dias_protegidos (user_id, dia) values (v_uid, v_hoy - 1)
    on conflict do nothing;
    v_estado.disponibles := v_estado.disponibles - 1;
    v_usado := v_hoy - 1;
  end if;

  select r.racha_actual into v_racha from public.calcular_rachas(v_uid, false, false) r;
  v_racha := coalesce(v_racha, 0);

  if v_racha = 0 then
    v_inicio := null;
  else
    v_inicio := (case when public.dia_cuenta_para_racha(v_uid, v_hoy) then v_hoy else v_hoy - 1 end)
                - v_racha + 1;
  end if;

  if v_inicio is distinct from v_estado.inicio_racha then
    v_estado.inicio_racha := v_inicio;
    v_estado.otorgados := 0;
  end if;

  v_derecho := v_racha / 7;
  if v_derecho > v_estado.otorgados then
    v_estado.disponibles := least(2, v_estado.disponibles + (v_derecho - v_estado.otorgados));
    v_estado.otorgados := v_derecho;
    v_ganado := true;
  end if;

  update public.racha_protectores
     set disponibles = v_estado.disponibles,
         inicio_racha = v_estado.inicio_racha,
         otorgados = v_estado.otorgados
   where user_id = v_uid;

  return query
    select v_estado.disponibles,
           coalesce((select array_agg(d.dia order by d.dia)
                       from public.racha_dias_protegidos d
                      where d.user_id = v_uid and d.dia >= v_hoy - 60), '{}'::date[]),
           v_usado,
           v_ganado;
end;
$$;

revoke all on function public.sincronizar_racha() from public, anon;
grant execute on function public.sincronizar_racha() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Premio Premium por hitos de racha.
--
-- 30 días → 7 de Premium, 100 → 30, 365 → 90. Cada hito se reclama una vez.
-- No se regala si ya hay un Premium vigente (pagado o cortesía): así nunca se
-- pisa ni se acorta un beneficio que otra persona o un pago ya dieron.
create or replace function public.reclamar_premios_racha()
returns table (
  premio_hito int,
  premio_dias int,
  premio_otorgado boolean,
  premio_motivo text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_racha int;
  r record;
begin
  if v_uid is null then
    return;
  end if;

  -- Serializa reclamos simultáneos de la misma persona (dos pestañas).
  perform 1 from public.perfiles where id = v_uid for update;
  if not found then
    return;
  end if;

  select c.racha_actual into v_racha from public.calcular_rachas(v_uid, true, false) c;
  v_racha := coalesce(v_racha, 0);

  for r in select * from (values (30, 7), (100, 30), (365, 90)) as p(hito, dias) order by hito loop
    continue when v_racha < r.hito;
    continue when exists (
      select 1 from public.racha_premios x where x.user_id = v_uid and x.hito = r.hito
    );

    if exists (
      select 1 from public.suscripciones s
      where s.user_id = v_uid and s.estado = 'activa' and s.vence_en > now()
    ) then
      return query select r.hito, r.dias, false, 'ya_tiene_premium'::text;
      continue;
    end if;

    perform public.otorgar_premium_manual(
      v_uid,
      now() + make_interval(days => r.dias),
      v_uid,
      format('Premio por %s días de racha', r.hito)
    );
    insert into public.racha_premios (user_id, hito, dias_premio)
    values (v_uid, r.hito, r.dias);

    return query select r.hito, r.dias, true, null::text;
  end loop;
end;
$$;

revoke all on function public.reclamar_premios_racha() from public, anon;
grant execute on function public.reclamar_premios_racha() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Ranking semanal: gana quien más días anotó de lunes a hoy. Se reinicia
-- solo cada lunes, así quien llega tarde también puede ganar.
create or replace function public.ranking_semanal(limite int default 20)
returns table (
  posicion bigint,
  user_id uuid,
  apodo text,
  dias_semana int,
  racha_actual int,
  soy_yo boolean,
  visible boolean,
  total_participantes bigint,
  inicio_semana date
)
language sql
security definer
stable
set search_path = public
as $$
  with hoy as (
    select (now() at time zone 'America/Bogota')::date as dia
  ),
  sem as (
    select date_trunc('week', hoy.dia::timestamp)::date as inicio, hoy.dia from hoy
  ),
  yo as (
    select (select auth.uid()) as id
  ),
  dias as (
    select t.user_id, t.occurred_on as dia
    from public.transacciones t, sem
    where t.occurred_on between sem.inicio and sem.dia
    union
    select p.user_id, p.dia
    from public.racha_dias_protegidos p, sem
    where p.dia between sem.inicio and sem.dia
  ),
  cuenta as (
    select d.user_id, count(*)::int as n from dias d group by d.user_id
  ),
  base as (
    select p.id,
           p.ranking_visible as visible,
           nullif(trim(p.usuario), '') as apodo,
           c.n,
           coalesce(r.racha_actual, 0) as racha,
           p.created_at
    from public.perfiles p
    join cuenta c on c.user_id = p.id
    left join public.calcular_rachas() r on r.user_id = p.id
  ),
  ordenado as (
    select b.*,
           row_number() over (order by b.n desc, b.racha desc, b.created_at asc) as pos
    from base b
    where b.visible or b.id = (select id from yo)
  ),
  participantes as (
    select count(*) as n from ordenado o where o.visible
  )
  select o.pos,
         o.id,
         case when o.visible or o.id = (select id from yo)
              then coalesce(o.apodo, 'Lukero anónimo') end,
         o.n,
         o.racha,
         o.id = (select id from yo),
         o.visible,
         (select n from participantes),
         (select inicio from sem)
  from ordenado o
  where (select id from yo) is not null
    and (o.pos <= greatest(1, least(coalesce(limite, 20), 100))
         or o.id = (select id from yo))
  order by o.pos;
$$;

revoke all on function public.ranking_semanal(int) from public, anon;
grant execute on function public.ranking_semanal(int) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Reto entre amigos: la racha de cada integrante de un espacio compartido.
-- Solo la ve quien es integrante, con el nombre que cada quien eligió en el
-- espacio; no depende de que participe en el ranking global.
create or replace function public.ranking_racha_espacio(p_espacio uuid)
returns table (
  posicion bigint,
  user_id uuid,
  nombre text,
  emoji text,
  racha_actual int,
  racha_maxima int,
  dias_semana int,
  soy_yo boolean
)
language sql
security definer
stable
set search_path = public
as $$
  with miembros as (
    select m.user_id, m.nombre, m.emoji
    from public.espacios_integrantes m
    where m.espacio_id = p_espacio
      and exists (
        select 1 from public.espacios_integrantes yo
        where yo.espacio_id = p_espacio and yo.user_id = (select auth.uid())
      )
  ),
  datos as (
    select mi.user_id, mi.nombre, mi.emoji,
           coalesce(r.racha_actual, 0) as actual,
           coalesce(r.racha_maxima, 0) as maxima,
           public.dias_de_la_semana(mi.user_id) as semana
    from miembros mi
    left join lateral public.calcular_rachas(mi.user_id) r on true
  )
  select row_number() over (order by d.actual desc, d.maxima desc, d.semana desc, d.nombre),
         d.user_id,
         coalesce(nullif(trim(d.nombre), ''), 'Integrante'),
         coalesce(d.emoji, '🙂'),
         d.actual,
         d.maxima,
         d.semana,
         d.user_id = (select auth.uid())
  from datos d
  order by 1;
$$;

revoke all on function public.ranking_racha_espacio(uuid) from public, anon;
grant execute on function public.ranking_racha_espacio(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Aviso push antes de perder la racha. Solo la service role (el servidor,
-- disparado por un cron hacia las 7 pm) puede llamarla. Marca el aviso del día
-- al devolverlo: si el envío falla no se reintenta, porque un duplicado molesta
-- más que un aviso perdido.
create or replace function public.usuarios_racha_en_riesgo()
returns table (user_id uuid, racha_actual int, endpoint text, suscripcion jsonb)
language sql
security definer
set search_path = public
as $$
  with hoy as (
    select (now() at time zone 'America/Bogota')::date as dia
  ),
  riesgo as (
    select r.user_id, r.racha_actual
    from public.calcular_rachas() r, hoy
    where r.racha_actual >= 2
      and exists (select 1 from public.suscripciones_push sp where sp.user_id = r.user_id)
      and not public.dia_cuenta_para_racha(r.user_id, hoy.dia)
      and not exists (
        select 1 from public.racha_avisos a where a.user_id = r.user_id and a.dia = hoy.dia
      )
  ),
  nuevos as (
    insert into public.racha_avisos (user_id, dia)
    select ri.user_id, h.dia from riesgo ri, hoy h
    on conflict do nothing
    returning racha_avisos.user_id
  )
  select ri.user_id, ri.racha_actual, s.endpoint, s.suscripcion
  from riesgo ri
  join nuevos n on n.user_id = ri.user_id
  join public.suscripciones_push s on s.user_id = ri.user_id;
$$;

revoke all on function public.usuarios_racha_en_riesgo() from public, anon, authenticated;
grant execute on function public.usuarios_racha_en_riesgo() to service_role;
