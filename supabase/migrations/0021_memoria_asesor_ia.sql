-- Conversaciones y memoria explícita del asesor. Todo queda aislado por auth.uid().
create table if not exists public.ia_conversaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null default 'Nueva conversación',
  recordar boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.ia_mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references public.ia_conversaciones(id) on delete cascade,
  usuario_id uuid not null references auth.users(id) on delete cascade,
  rol text not null check (rol in ('user', 'assistant')),
  texto text not null,
  proveedor text,
  creado_en timestamptz not null default now()
);

create table if not exists public.ia_memoria_usuario (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  clave text not null,
  valor text not null,
  fuente text not null default 'usuario' check (fuente in ('usuario', 'inferida')),
  activa boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (usuario_id, clave)
);

create table if not exists public.ia_analisis_usuario (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  resumen text not null,
  datos jsonb not null default '{}'::jsonb,
  generado_en timestamptz not null default now()
);

alter table public.ia_conversaciones enable row level security;
alter table public.ia_mensajes enable row level security;
alter table public.ia_memoria_usuario enable row level security;
alter table public.ia_analisis_usuario enable row level security;

create policy ia_conversaciones_propias on public.ia_conversaciones for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy ia_mensajes_propios on public.ia_mensajes for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy ia_memoria_propia on public.ia_memoria_usuario for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy ia_analisis_propio on public.ia_analisis_usuario for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create index if not exists ia_conversaciones_usuario_actualizado_idx on public.ia_conversaciones(usuario_id, actualizado_en desc);
create index if not exists ia_mensajes_conversacion_creado_idx on public.ia_mensajes(conversacion_id, creado_en);
