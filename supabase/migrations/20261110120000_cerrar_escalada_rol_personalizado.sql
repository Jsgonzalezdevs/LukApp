-- Cierra una escalada de privilegios: la política que deja a cada persona
-- editar su propio apodo (0017) comprobaba `rol` y `email`, pero no
-- `rol_personalizado_id`. Cualquier usuario autenticado podía ponerse un rol
-- delegado con permisos de superadmin (impersonar, eliminar, etc.) con un
-- simple UPDATE desde el navegador.
--
-- Ahora la fila solo puede cambiar el apodo: el rol fijo, el correo y el rol
-- personalizado deben quedar exactamente como estaban. Los cambios de rol
-- pasan por el servidor con service-role, que no está sujeto a RLS.
drop policy if exists perfiles_editar_apodo on public.perfiles;
create policy perfiles_editar_apodo on public.perfiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and rol = (select p.rol from public.perfiles p where p.id = (select auth.uid()))
    and email = (select p.email from public.perfiles p where p.id = (select auth.uid()))
    and rol_personalizado_id is not distinct from (
      select p.rol_personalizado_id from public.perfiles p where p.id = (select auth.uid())
    )
  );
