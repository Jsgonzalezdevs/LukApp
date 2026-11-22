-- Los días de racha regalados pasan de fechas sueltas a un bono pegado a la
-- racha que lo recibió. Con fechas, el relleno saltaba los días ya anotados y
-- tapaba huecos viejos: pedir 67 días unía rachas pasadas y daba muchos más.
create table if not exists public.racha_bonos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Día en que empezó la racha que recibe el bono. Si esa racha se corta, la
  -- nueva empieza otro día y el bono deja de sumar, igual que los días reales.
  inicio_racha date not null,
  dias integer not null check (dias between 1 and 365),
  otorgado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists racha_bonos_usuario_idx on public.racha_bonos (user_id);

alter table public.racha_bonos enable row level security;

create policy "Cada persona ve los días de racha que le regalaron"
  on public.racha_bonos for select to authenticated
  using ((select auth.uid()) = user_id);

-- Solo el servidor (service-role) los escribe: si el navegador pudiera,
-- cualquiera se fabricaría la racha que quisiera.
grant select on public.racha_bonos to authenticated;
revoke insert, update, delete on public.racha_bonos from anon, authenticated;

-- Lo ya regalado se convierte en lo que se pidió: tantos días como fechas se
-- regalaron, sumados a la racha viva de hoy (contando solo días anotados de
-- verdad). Sin racha viva, el bono queda para hoy y se conserva si anota hoy.
do $$
begin
  if to_regclass('public.racha_dias_regalados') is null then return; end if;

  with hoy as (
    select (now() at time zone 'America/Bogota')::date as d
  ),
  fechas as (
    select distinct t.user_id, t.occurred_on as f
    from public.transacciones t
    where t.user_id in (select distinct user_id from public.racha_dias_regalados)
  ),
  tramos as (
    select user_id, min(f) as inicio, max(f) as fin
    from (
      select user_id, f, f - (row_number() over (partition by user_id order by f))::int as grupo
      from fechas
    ) islas
    group by user_id, grupo
  ),
  vivas as (
    select tr.user_id, tr.inicio
    from tramos tr, hoy
    where tr.fin >= hoy.d - 1
  ),
  regalados as (
    select user_id, count(*)::int as dias, (array_agg(otorgado_por order by created_at desc))[1] as otorgado_por
    from public.racha_dias_regalados
    group by user_id
  )
  insert into public.racha_bonos (user_id, inicio_racha, dias, otorgado_por)
  select r.user_id, coalesce(v.inicio, (select d from hoy)), least(r.dias, 365), r.otorgado_por
  from regalados r
  left join vivas v on v.user_id = r.user_id;

  drop table public.racha_dias_regalados;
end $$;
