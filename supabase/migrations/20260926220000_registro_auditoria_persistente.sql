-- Historial inmutable de acciones sensibles. Se escribe exclusivamente desde
-- la API con service_role, para que ningún navegador pueda falsificar eventos.
create table if not exists public.registro_auditoria (
  id uuid primary key default gen_random_uuid(),
  creado_en timestamptz not null default now(),
  actor_id uuid null references auth.users(id) on delete set null,
  actor_email text not null,
  accion text not null,
  objetivo text null,
  detalle text null
);

create index if not exists registro_auditoria_creado_en_idx
  on public.registro_auditoria (creado_en desc);

alter table public.registro_auditoria enable row level security;
revoke all on table public.registro_auditoria from public, anon, authenticated;
