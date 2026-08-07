-- Finanzas schema.
--
-- Every table is scoped to one user and locked down with row level security.
-- RLS is not optional here: the anon key ships inside the browser bundle by
-- design, so it is PostgreSQL — not the client — that has to be the thing
-- stopping one account from reading another's ledger.
--
-- Amounts are stored in whole Colombian pesos as bigint. COP has no minor unit
-- in practice, and float would eventually turn a total into 749999.9999999999.

-- ---------------------------------------------------------------- transacciones
create table if not exists public.transacciones (
  id           uuid primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  kind         text not null check (kind in ('gasto', 'ingreso')),
  amount_cop   bigint not null check (amount_cop > 0),
  category     text not null,
  description  text not null default '',
  -- Bogota calendar day, never a timestamp: the app groups by local day and a
  -- timestamptz would file anything entered after 7 PM under tomorrow.
  occurred_on  date not null,
  raw_transcript text not null default '',
  created_at   timestamptz not null default now()
);

create index if not exists transacciones_user_fecha_idx
  on public.transacciones (user_id, occurred_on desc);

-- --------------------------------------------------------------------- cajitas
create table if not exists public.cajitas (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  nombre      text not null,
  emoji       text not null default '🐷',
  meta_cop    bigint check (meta_cop is null or meta_cop > 0),
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists cajitas_user_idx on public.cajitas (user_id);

-- --------------------------------------------------------- cajita_movimientos
create table if not exists public.cajita_movimientos (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- Cascade mirrors the client: a pocket's history is meaningless without it,
  -- and orphaned rows would silently skew any later balance rebuild.
  cajita_id   uuid not null references public.cajitas (id) on delete cascade,
  kind        text not null check (kind in ('deposito', 'retiro', 'rendimiento', 'ajuste')),
  -- Signed, and deliberately NOT constrained to be non-zero-positive: a
  -- withdrawal is a negative delta and that is the whole point of the column.
  delta_cop   bigint not null,
  occurred_on date not null,
  nota        text not null default '',
  created_at  timestamptz not null default now()
);

create index if not exists cajita_movimientos_cajita_idx
  on public.cajita_movimientos (user_id, cajita_id, occurred_on);

-- ----------------------------------------------------------------------- metas
create table if not exists public.metas (
  id             uuid primary key,
  user_id        uuid not null references auth.users (id) on delete cascade,
  nombre         text not null,
  emoji          text not null default '🎯',
  objetivo_cop   bigint not null check (objetivo_cop > 0),
  fecha_objetivo date,
  -- Losing the pocket must not destroy the goal, only the link that fed its
  -- progress — hence set null rather than cascade.
  cajita_id      uuid references public.cajitas (id) on delete set null,
  ahorrado_cop   bigint not null default 0 check (ahorrado_cop >= 0),
  created_at     timestamptz not null default now(),
  completed_at   timestamptz
);

create index if not exists metas_user_idx on public.metas (user_id);

-- ------------------------------------------------------------------------- RLS
alter table public.transacciones       enable row level security;
alter table public.cajitas             enable row level security;
alter table public.cajita_movimientos  enable row level security;
alter table public.metas               enable row level security;

-- One policy per table covering all four verbs. `using` guards the rows a
-- statement may see or change; `with check` guards the rows it may write —
-- both are required, or a user could update someone else's row into their own
-- account, or insert a row already stamped with another user_id.
do $$
declare
  t text;
begin
  foreach t in array array['transacciones', 'cajitas', 'cajita_movimientos', 'metas']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_propias', t);
    execute format(
      'create policy %I on public.%I
         for all
         to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)',
      t || '_propias', t
    );
  end loop;
end
$$;
