-- Roles y perfiles.
--
-- Objetivo: solo un administrador puede crear cuentas. El registro público se
-- apaga en el panel de Supabase (Authentication → Sign In / Providers → Email →
-- "Allow new users to sign up"), y la creación pasa por una función de Netlify
-- que sí tiene la llave secreta. Nada de esto vive en el navegador.

create table if not exists public.perfiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  -- Nombre de usuario para entrar sin escribir el correo. Único e insensible a
  -- mayúsculas: "MiUsuario" y "miusuario" no pueden ser dos cuentas distintas.
  usuario    text unique,
  rol        text not null default 'usuario' check (rol in ('admin', 'usuario')),
  created_at timestamptz not null default now()
);

create unique index if not exists perfiles_usuario_lower_idx
  on public.perfiles (lower(usuario));

-- ---------------------------------------------------------------------------
-- ¿Quien llama es admin?
--
-- SECURITY DEFINER a propósito: la política de `perfiles` necesita preguntar por
-- el rol del que llama, y si esa consulta pasara otra vez por RLS se llamaría a
-- sí misma en bucle infinito. Al ejecutarse como dueña de la función, la lectura
-- se salta RLS y la recursión desaparece.
--
-- `search_path` fijo evita que un esquema puesto por otro usuario secuestre los
-- nombres de tabla dentro de una función con permisos elevados.
create or replace function public.es_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.perfiles
    where id = (select auth.uid()) and rol = 'admin'
  );
$$;

revoke all on function public.es_admin() from public;
grant execute on function public.es_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Perfil automático al crear la cuenta, para que nunca exista un usuario de
-- auth sin fila en perfiles (que quedaría sin rol y sin poder entrar a nada).
create or replace function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, email, usuario)
  values (
    new.id,
    new.email,
    -- El admin manda el usuario en la metadata al crear la cuenta.
    nullif(new.raw_user_meta_data ->> 'usuario', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil();

-- ---------------------------------------------------------------------------
-- RLS
alter table public.perfiles enable row level security;

drop policy if exists perfiles_leer on public.perfiles;
create policy perfiles_leer on public.perfiles
  for select to authenticated
  using (id = (select auth.uid()) or public.es_admin());

-- Escribir perfiles NO tiene política para `authenticated` a propósito: crear,
-- cambiar de rol y borrar cuentas pasa solo por la función de Netlify con la
-- llave secreta, que se salta RLS. Sin política, nadie desde el navegador puede
-- ascenderse a sí mismo a admin.
drop policy if exists perfiles_escribir on public.perfiles;

-- ---------------------------------------------------------------------------
-- Resolver usuario -> correo para poder entrar sin escribir el correo.
--
-- Devuelve SOLO el correo y solo con coincidencia exacta. Es una revelación
-- deliberada y acotada: quien adivine un nombre de usuario obtiene el correo
-- asociado. Se acepta porque este sistema es cerrado (las cuentas las crea el
-- admin, no hay registro público), y la alternativa —entrar únicamente con
-- correo— era justo lo que se quería evitar.
create or replace function public.correo_de_usuario(nombre text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select email from public.perfiles where lower(usuario) = lower(nombre) limit 1;
$$;

revoke all on function public.correo_de_usuario(text) from public;
grant execute on function public.correo_de_usuario(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Después de crear tu cuenta en el panel de Supabase, córrelo UNA vez para
-- volverte administrador (cambia el correo por el tuyo):
--
--   update public.perfiles
--      set rol = 'admin', usuario = 'TU-USUARIO-AQUI'
--    where email = 'TU-CORREO-AQUI';
--
-- Comprueba que quedó:
--   select email, usuario, rol from public.perfiles;
