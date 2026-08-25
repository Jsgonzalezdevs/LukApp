-- Funciones solicitadas: una lista donde cualquiera propone una idea y vota
-- las de los demás, para saber qué construir después según lo que la gente
-- de verdad pide -- no lo que a nosotros se nos ocurre que quieren.
--
-- El conteo vive como columna en `funciones_solicitadas` en vez de calcularse
-- leyendo la tabla de votos cada vez. Eso también resuelve la privacidad: la
-- tabla de votos sí importa quién votó qué, y por eso su RLS solo deja ver
-- las filas propias -- el conteo público sale de la columna, nunca de leer
-- los votos de otros.
create table if not exists public.funciones_solicitadas (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  descripcion text,
  creada_por  uuid references auth.users (id) on delete set null,
  creada_en   timestamptz not null default now(),
  votos       integer not null default 0
);

create table if not exists public.funciones_solicitadas_votos (
  funcion_id  uuid not null references public.funciones_solicitadas (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  creado_en   timestamptz not null default now(),
  primary key (funcion_id, user_id)
);

create index if not exists funciones_solicitadas_votos_idx
  on public.funciones_solicitadas (votos desc, creada_en desc);

-- Mantiene `votos` sincronizado sin que el navegador tenga que sumar nada ni
-- volver a leer la tabla entera después de votar.
create or replace function public.actualizar_conteo_votos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.funciones_solicitadas set votos = votos + 1 where id = new.funcion_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.funciones_solicitadas set votos = greatest(votos - 1, 0) where id = old.funcion_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trig_conteo_votos on public.funciones_solicitadas_votos;
create trigger trig_conteo_votos
  after insert or delete on public.funciones_solicitadas_votos
  for each row execute function public.actualizar_conteo_votos();

-- ------------------------------------------------------------------------- RLS
alter table public.funciones_solicitadas enable row level security;
alter table public.funciones_solicitadas_votos enable row level security;

-- Cualquier usuario con sesión ve todas las ideas y su conteo.
create policy "funciones_solicitadas_select" on public.funciones_solicitadas
  for select to authenticated using (true);

-- Cualquiera propone una idea, siempre a su propio nombre.
create policy "funciones_solicitadas_insert" on public.funciones_solicitadas
  for insert to authenticated with check (creada_por = auth.uid());

-- Los votos son privados: cada quien solo ve, crea y borra los suyos.
create policy "funciones_solicitadas_votos_select" on public.funciones_solicitadas_votos
  for select to authenticated using (user_id = auth.uid());

create policy "funciones_solicitadas_votos_insert" on public.funciones_solicitadas_votos
  for insert to authenticated with check (user_id = auth.uid());

create policy "funciones_solicitadas_votos_delete" on public.funciones_solicitadas_votos
  for delete to authenticated using (user_id = auth.uid());
