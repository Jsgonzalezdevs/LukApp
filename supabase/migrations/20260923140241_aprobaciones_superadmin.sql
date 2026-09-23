-- Elevación a superadmin con separación de funciones.
-- Ningún cliente tiene permisos directos sobre esta tabla: las rutas del
-- servidor validan el JWT y la función de aprobación vuelve a validarlo en BD.

create table if not exists public.solicitudes_superadmin (
  id uuid primary key default gen_random_uuid(),
  objetivo_id uuid not null references public.perfiles(id) on delete cascade,
  solicitada_por uuid not null references public.perfiles(id) on delete restrict,
  aprobada_por uuid references public.perfiles(id) on delete restrict,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada')),
  creada_en timestamptz not null default now(),
  resuelta_en timestamptz,
  check (objetivo_id <> solicitada_por),
  check (aprobada_por is null or aprobada_por <> solicitada_por),
  check (aprobada_por is null or aprobada_por <> objetivo_id)
);

create unique index if not exists solicitudes_superadmin_una_pendiente_por_objetivo
  on public.solicitudes_superadmin (objetivo_id)
  where estado = 'pendiente';

alter table public.solicitudes_superadmin enable row level security;
revoke all on table public.solicitudes_superadmin from public, anon, authenticated;

-- La promoción y el cambio de estado ocurren en la misma transacción. La
-- función sólo se puede invocar usando la llave de servicio, que permanece en
-- el servidor; aun así verifica que el aprobador sea un admin distinto.
create or replace function public.aprobar_solicitud_superadmin(
  p_solicitud_id uuid,
  p_aprobador_id uuid
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  solicitud public.solicitudes_superadmin%rowtype;
begin
  select * into solicitud
  from public.solicitudes_superadmin
  where id = p_solicitud_id and estado = 'pendiente'
  for update;

  if not found then
    raise exception 'La solicitud ya no está pendiente.' using errcode = 'P0001';
  end if;
  if solicitud.solicitada_por = p_aprobador_id or solicitud.objetivo_id = p_aprobador_id then
    raise exception 'La solicitud debe aprobarla otro superadmin.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.perfiles where id = p_aprobador_id and rol = 'admin') then
    raise exception 'El aprobador ya no es superadmin.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.perfiles where id = solicitud.solicitada_por and rol = 'admin') then
    raise exception 'El solicitante ya no es superadmin.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.perfiles where id = solicitud.objetivo_id and rol = 'usuario') then
    raise exception 'La persona ya no puede elevarse.' using errcode = 'P0001';
  end if;

  update public.perfiles
  set rol = 'admin', rol_personalizado_id = null
  where id = solicitud.objetivo_id;

  update public.solicitudes_superadmin
  set estado = 'aprobada', aprobada_por = p_aprobador_id, resuelta_en = now()
  where id = solicitud.id;
end;
$$;

revoke all on function public.aprobar_solicitud_superadmin(uuid, uuid) from public, anon, authenticated;
grant execute on function public.aprobar_solicitud_superadmin(uuid, uuid) to service_role;
