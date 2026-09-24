-- El cliente autenticado necesita privilegios de tabla además de RLS. Algunos
-- proyectos antiguos conservaban la política de filas pero no el GRANT, por
-- lo que PostgREST devolvía 403 al crear o actualizar una cajita.
--
-- El GRANT no abre la tabla: RLS se mantiene activo y esta política limita cada
-- lectura y escritura a las filas cuya dueña es la sesión autenticada.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.cajitas to authenticated;

alter table public.cajitas enable row level security;

drop policy if exists cajitas_propias on public.cajitas;
create policy cajitas_propias on public.cajitas
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';
