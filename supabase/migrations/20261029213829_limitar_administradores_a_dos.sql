-- El proyecto mantiene dos cuentas de administración. La validación vive en
-- Postgres para que no se pueda saltar llamando directamente a la API ni con
-- dos altas simultáneas desde el panel.
do $$
begin
  if (select count(*) from public.perfiles where rol = 'admin') > 2 then
    raise exception 'Hay más de dos administradores; corrige los perfiles antes de aplicar esta migración.';
  end if;
end;
$$;

create or replace function public.limitar_perfiles_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cantidad_admins integer;
begin
  if new.rol is distinct from 'admin' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.rol = 'admin' then
    return new;
  end if;

  -- Serializa promociones/altas; el conteo posterior se ejecuta como una
  -- sentencia nueva y ve lo que confirmó la transacción anterior.
  perform pg_catalog.pg_advisory_xact_lock(74280119, 2);
  select count(*)::integer into cantidad_admins
  from public.perfiles
  where rol = 'admin';

  if cantidad_admins >= 2 then
    raise exception using
      errcode = '23514',
      message = 'LukApp ya tiene sus dos cuentas administradoras.';
  end if;

  return new;
end;
$$;

revoke all on function public.limitar_perfiles_admin() from public, anon, authenticated;

drop trigger if exists limitar_perfiles_admin on public.perfiles;
create trigger limitar_perfiles_admin
  before insert or update of rol on public.perfiles
  for each row execute function public.limitar_perfiles_admin();
