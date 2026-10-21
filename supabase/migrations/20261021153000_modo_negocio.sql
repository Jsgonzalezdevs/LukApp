create table if not exists public.documentos_negocio (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  datos jsonb not null check (jsonb_typeof(datos) = 'object' and datos->>'id' = id::text),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documentos_negocio_usuario_actualizado_idx
  on public.documentos_negocio (user_id, updated_at desc);

alter table public.documentos_negocio enable row level security;

create policy "Cada persona gestiona sus documentos de negocio"
  on public.documentos_negocio for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.documentos_negocio to authenticated;
revoke all on public.documentos_negocio from anon;
