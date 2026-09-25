create table if not exists public.suscripciones_push (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  suscripcion jsonb not null,
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.suscripciones_push enable row level security;

create policy "Cada usuario administra sus destinos push"
on public.suscripciones_push for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
