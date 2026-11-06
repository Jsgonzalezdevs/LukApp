-- La administración ya no tiene un cupo máximo de cuentas. La autorización
-- sigue en el servidor: solo un Superadmin puede conceder este acceso y no se
-- puede degradar ni eliminar al último que queda.
drop trigger if exists limitar_perfiles_admin on public.perfiles;
drop function if exists public.limitar_perfiles_admin();
