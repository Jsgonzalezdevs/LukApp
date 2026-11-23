-- Ranking de racha entre todas las personas de LukApp.
--
-- La racha se calcula en el cliente a partir de las transacciones propias, y
-- RLS impide leer las de otra persona. Para un ranking hace falta calcularla en
-- el servidor, así que se hace con funciones SECURITY DEFINER que solo devuelven
-- lo mínimo: apodo, racha actual y récord. Nunca correo, montos ni categorías.
--
-- Privacidad: participar es opt-out. Quien no quiera salir en la lista lo apaga
-- desde el propio ranking; deja de aparecer, pero sigue viendo su posición.

alter table public.perfiles
  add column if not exists ranking_visible boolean not null default true;

-- ---------------------------------------------------------------------------
-- Racha actual y récord de cada persona.
--
-- Huecos e islas: a cada día distinto con movimientos se le resta su número de
-- fila; los días consecutivos caen en el mismo grupo. La racha actual sigue
-- viva si el último día es hoy o ayer, igual que `calcularRacha` en el cliente
-- (no penaliza antes de medianoche). El día es de Bogotá, como en toda la app.
create or replace function public.calcular_rachas()
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
    select distinct t.user_id, t.occurred_on as dia
    from public.transacciones t, hoy
    where t.occurred_on <= hoy.dia
  ),
  grupos as (
    select d.user_id, d.dia,
           d.dia - (row_number() over (partition by d.user_id order by d.dia))::int as grupo
    from dias d
  ),
  islas as (
    select g.user_id, count(*)::int as largo, max(g.dia) as ultimo
    from grupos g
    group by g.user_id, g.grupo
  )
  select i.user_id,
         coalesce(max(i.largo) filter (where i.ultimo >= h.dia - 1), 0)::int as racha_actual,
         max(i.largo)::int as racha_maxima
  from islas i, hoy h
  group by i.user_id;
$$;

revoke all on function public.calcular_rachas() from public;

-- ---------------------------------------------------------------------------
-- El ranking: las `limite` mejores visibles y, aparte, la posición de quien
-- consulta aunque no entre al top (o esté oculto).
--
-- Desempate: más récord primero y, si sigue igual, quien lleva más tiempo en
-- la app. Así el orden es estable entre consultas y no baila.
create or replace function public.ranking_racha(limite int default 20)
returns table (
  posicion bigint,
  user_id uuid,
  apodo text,
  racha_actual int,
  racha_maxima int,
  soy_yo boolean,
  visible boolean,
  total_participantes bigint
)
language sql
security definer
stable
set search_path = public
as $$
  with yo as (
    select (select auth.uid()) as id
  ),
  base as (
    select p.id,
           p.ranking_visible as visible,
           nullif(trim(p.usuario), '') as apodo,
           r.racha_actual,
           r.racha_maxima,
           p.created_at
    from public.perfiles p
    join public.calcular_rachas() r on r.user_id = p.id
    where r.racha_actual > 0
  ),
  ordenado as (
    select b.*,
           row_number() over (order by b.racha_actual desc, b.racha_maxima desc, b.created_at asc) as pos
    from base b
    where b.visible
       or b.id = (select id from yo)
  ),
  participantes as (
    select count(*) as n from ordenado o where o.visible
  )
  select o.pos,
         o.id,
         case when o.visible or o.id = (select id from yo)
              then coalesce(o.apodo, 'Lukero anónimo') end,
         o.racha_actual,
         o.racha_maxima,
         o.id = (select id from yo),
         o.visible,
         (select n from participantes)
  from ordenado o
  where (select id from yo) is not null
    and (o.pos <= greatest(1, least(coalesce(limite, 20), 100))
         or o.id = (select id from yo))
  order by o.pos;
$$;

revoke all on function public.ranking_racha(int) from public, anon;
grant execute on function public.ranking_racha(int) to authenticated;

-- ---------------------------------------------------------------------------
-- Entrar o salir del ranking. Se hace por función y no con UPDATE directo para
-- que nadie pueda tocar otra columna de su perfil (el rol, por ejemplo) por el
-- camino.
create or replace function public.fijar_visibilidad_ranking(visible boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.perfiles
  set ranking_visible = coalesce(visible, true)
  where id = (select auth.uid());
$$;

revoke all on function public.fijar_visibilidad_ranking(boolean) from public, anon;
grant execute on function public.fijar_visibilidad_ranking(boolean) to authenticated;
