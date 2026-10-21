-- A historical statement belongs in reports without rewriting today's account balance.
-- Old records stay balance-affecting; only imports explicitly marked historical opt out.
alter table public.transacciones
  add column if not exists afecta_saldo boolean not null default true;
