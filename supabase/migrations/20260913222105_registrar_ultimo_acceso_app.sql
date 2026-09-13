-- Auth solo actualiza last_sign_in_at al autenticar de nuevo. LukApp conserva
-- sesiones entre aperturas, por lo que ese campo no representa una entrada
-- real a la aplicación. Este instante se actualiza desde un endpoint que
-- valida el token de la persona antes de escribir su propia fila.
alter table public.perfiles
  add column if not exists ultimo_acceso_app_at timestamptz;
