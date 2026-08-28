-- Espacios colaborativos reales. La identidad de la pareja se resuelve al
-- aceptar el enlace; no se guarda ni se necesita su correo.
create table if not exists public.espacios_compartidos (
  id uuid primary key default gen_random_uuid(),
  creado_por uuid not null references auth.users(id) on delete cascade,
  nombre text not null check (char_length(trim(nombre)) between 1 and 80),
  icono text not null default '🏠',
  color text not null default '#8b5cf6',
  created_at timestamptz not null default now()
);

create table if not exists public.espacios_integrantes (
  espacio_id uuid not null references public.espacios_compartidos(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rol text not null default 'integrante' check (rol in ('propietario', 'integrante')),
  nombre text not null default '',
  emoji text not null default '🙂',
  joined_at timestamptz not null default now(),
  primary key (espacio_id, user_id)
);

create table if not exists public.gastos_compartidos (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios_compartidos(id) on delete cascade,
  creado_por uuid not null references auth.users(id) on delete cascade,
  pagado_por uuid not null references auth.users(id) on delete cascade,
  descripcion text not null,
  monto_cop bigint not null check (monto_cop > 0),
  fecha date not null default ((now() at time zone 'America/Bogota')::date),
  categoria text not null default 'otros',
  created_at timestamptz not null default now()
);

create table if not exists public.invitaciones_compartidas (
  id uuid primary key default gen_random_uuid(),
  espacio_id uuid not null references public.espacios_compartidos(id) on delete cascade,
  invitado_por uuid not null references auth.users(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'cancelada')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days')
);

create index if not exists espacios_integrantes_usuario_idx on public.espacios_integrantes(user_id);
create index if not exists gastos_compartidos_espacio_idx on public.gastos_compartidos(espacio_id, created_at desc);

alter table public.espacios_compartidos enable row level security;
alter table public.espacios_integrantes enable row level security;
alter table public.gastos_compartidos enable row level security;
alter table public.invitaciones_compartidas enable row level security;

create or replace function public.es_miembro_espacio(espacio uuid)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.espacios_integrantes where espacio_id = $1 and user_id = (select auth.uid())); $$;
revoke all on function public.es_miembro_espacio(uuid) from public;
grant execute on function public.es_miembro_espacio(uuid) to authenticated;

drop policy if exists espacios_compartidos_miembros on public.espacios_compartidos;
create policy espacios_compartidos_miembros on public.espacios_compartidos for all to authenticated
  using (public.es_miembro_espacio(id)) with check (creado_por = (select auth.uid()));

drop policy if exists espacios_integrantes_miembros on public.espacios_integrantes;
create policy espacios_integrantes_miembros on public.espacios_integrantes for select to authenticated
  using (public.es_miembro_espacio(espacio_id));

drop policy if exists gastos_compartidos_miembros on public.gastos_compartidos;
create policy gastos_compartidos_miembros on public.gastos_compartidos for all to authenticated
  using (public.es_miembro_espacio(espacio_id))
  with check (creado_por = (select auth.uid()) and public.es_miembro_espacio(espacio_id));

drop policy if exists invitaciones_compartidas_propias on public.invitaciones_compartidas;
create policy invitaciones_compartidas_propias on public.invitaciones_compartidas for select to authenticated
  using (invitado_por = (select auth.uid()));

create or replace function public.crear_espacio_compartido(nombre_espacio text, icono_espacio text default '🏠', color_espacio text default '#8b5cf6')
returns uuid language plpgsql security definer set search_path = public
as $$
declare nuevo_id uuid;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión.'; end if;
  insert into public.espacios_compartidos(creado_por, nombre, icono, color)
  values (auth.uid(), trim(nombre_espacio), coalesce(nullif(icono_espacio, ''), '🏠'), coalesce(nullif(color_espacio, ''), '#8b5cf6'))
  returning id into nuevo_id;
  insert into public.espacios_integrantes(espacio_id, user_id, rol, nombre)
  values (nuevo_id, auth.uid(), 'propietario', 'Tú');
  return nuevo_id;
end; $$;

create or replace function public.crear_invitacion_compartida(espacio uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare nuevo_token uuid;
begin
  if not public.es_miembro_espacio(espacio) then raise exception 'No perteneces a este espacio.'; end if;
  update public.invitaciones_compartidas set estado = 'cancelada' where espacio_id = espacio and estado = 'pendiente';
  insert into public.invitaciones_compartidas(espacio_id, invitado_por) values (espacio, auth.uid()) returning token into nuevo_token;
  return nuevo_token;
end; $$;

create or replace function public.aceptar_invitacion_compartida(token_invitacion uuid, nombre_integrante text default 'Pareja', emoji_integrante text default '🙂')
returns uuid language plpgsql security definer set search_path = public
as $$
declare invitacion public.invitaciones_compartidas%rowtype;
begin
  if auth.uid() is null then raise exception 'Debes iniciar sesión para aceptar la invitación.'; end if;
  select * into invitacion from public.invitaciones_compartidas where token = token_invitacion and estado = 'pendiente' and expires_at > now() for update;
  if not found then raise exception 'Esta invitación ya venció o fue utilizada.'; end if;
  if invitacion.invitado_por = auth.uid() then raise exception 'No puedes aceptar tu propia invitación.'; end if;
  insert into public.espacios_integrantes(espacio_id, user_id, rol, nombre, emoji)
  values (invitacion.espacio_id, auth.uid(), 'integrante', coalesce(nullif(trim(nombre_integrante), ''), 'Pareja'), coalesce(nullif(emoji_integrante, ''), '🙂'))
  on conflict (espacio_id, user_id) do nothing;
  update public.invitaciones_compartidas set estado = 'aceptada' where id = invitacion.id;
  return invitacion.espacio_id;
end; $$;

revoke all on function public.crear_espacio_compartido(text, text, text) from public;
revoke all on function public.crear_invitacion_compartida(uuid) from public;
revoke all on function public.aceptar_invitacion_compartida(uuid, text, text) from public;
grant execute on function public.crear_espacio_compartido(text, text, text) to authenticated;
grant execute on function public.crear_invitacion_compartida(uuid) to authenticated;
grant execute on function public.aceptar_invitacion_compartida(uuid, text, text) to authenticated;
