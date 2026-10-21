create table if not exists public.comprobantes_correo_destinos (
  alias text primary key default gen_random_uuid()::text,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.comprobantes_correo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resend_email_id text not null,
  message_id text not null unique,
  remitente text not null default '',
  destinatario text not null default '',
  asunto text not null default '',
  recibido_en timestamptz not null default now(),
  adjuntos jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists comprobantes_correo_usuario_fecha_idx
  on public.comprobantes_correo (user_id, recibido_en desc);

alter table public.comprobantes_correo_destinos enable row level security;
alter table public.comprobantes_correo enable row level security;

create policy "Cada persona ve su dirección de comprobantes"
  on public.comprobantes_correo_destinos for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Cada persona ve sus comprobantes recibidos"
  on public.comprobantes_correo for select to authenticated
  using ((select auth.uid()) = user_id);

grant select on public.comprobantes_correo_destinos, public.comprobantes_correo to authenticated;
revoke insert, update, delete on public.comprobantes_correo_destinos, public.comprobantes_correo from anon, authenticated;
