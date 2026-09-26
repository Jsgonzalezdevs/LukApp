-- El texto legal se gestiona únicamente mediante la API de superadmin. RLS
-- impide escrituras directas desde el cliente; el servidor usa service role.
create table if not exists public.documentos_legales (
  clave text primary key check (clave = 'terminos_y_condiciones'),
  contenido text not null check (char_length(contenido) between 80 and 120000),
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references auth.users(id) on delete set null
);

alter table public.documentos_legales enable row level security;

-- Las solicitudes creadas bajo el flujo anterior no pueden otorgar acceso
-- después del cambio a concesión directa por un único administrador.
update public.solicitudes_superadmin
set estado = 'rechazada', resuelta_en = now()
where estado = 'pendiente';
