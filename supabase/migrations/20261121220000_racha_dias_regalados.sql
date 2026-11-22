-- Días de racha que el equipo regala desde el superadmin. Van aparte de las
-- transacciones para no inventar movimientos en el libro de nadie: la racha los
-- suma, pero saldos, presupuestos y resúmenes nunca los ven.
create table if not exists public.racha_dias_regalados (
  user_id uuid not null references auth.users(id) on delete cascade,
  fecha date not null,
  otorgado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, fecha)
);

alter table public.racha_dias_regalados enable row level security;

create policy "Cada persona ve los días de racha que le regalaron"
  on public.racha_dias_regalados for select to authenticated
  using ((select auth.uid()) = user_id);

-- Solo el servidor (service-role) los escribe: si el navegador pudiera
-- insertarlos, cualquiera se fabricaría la racha que quisiera.
grant select on public.racha_dias_regalados to authenticated;
revoke insert, update, delete on public.racha_dias_regalados from anon, authenticated;
