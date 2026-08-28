alter table public.cajitas
  add column if not exists clase_cuenta text;

alter table public.cajitas
  drop constraint if exists cajitas_clase_cuenta_check;

alter table public.cajitas
  add constraint cajitas_clase_cuenta_check
  check (clase_cuenta is null or clase_cuenta in ('efectivo', 'banco', 'billetera'));

update public.cajitas
set clase_cuenta = case
  when lower(nombre) = 'efectivo' then 'efectivo'
  when lower(nombre) in ('nequi', 'daviplata', 'dale!', 'rappi pay', 'movii') then 'billetera'
  else 'banco'
end
where tipo = 'cuenta' and clase_cuenta is null;

create index if not exists cajitas_user_clase_cuenta_idx
  on public.cajitas (user_id, clase_cuenta);
