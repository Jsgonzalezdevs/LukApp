-- Biblioteca privada de conocimiento usada por el Asesor y los analizadores.
-- El navegador no recibe permisos para leer documentos ni fragmentos.

create table if not exists public.ia_contexto_documentos (
  id uuid primary key,
  nombre text not null,
  alcance text not null check (alcance in ('general', 'producto', 'finanzas', 'extractos')),
  tipo_mime text not null check (tipo_mime in ('application/pdf', 'text/plain', 'text/markdown')),
  tamano_bytes integer not null check (tamano_bytes between 1 and 4194304),
  caracteres integer not null check (caracteres between 1 and 150000),
  sha256 text not null unique check (sha256 ~ '^[0-9a-f]{64}$'),
  ruta_objeto text not null unique,
  creado_por uuid not null references auth.users(id) on delete restrict,
  activo boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.ia_contexto_fragmentos (
  id bigint generated always as identity primary key,
  documento_id uuid not null references public.ia_contexto_documentos(id) on delete cascade,
  nombre_documento text not null,
  alcance text not null check (alcance in ('general', 'producto', 'finanzas', 'extractos')),
  posicion integer not null check (posicion >= 0),
  contenido text not null,
  busqueda tsvector generated always as (to_tsvector('spanish', coalesce(contenido, ''))) stored,
  unique (documento_id, posicion)
);

create index if not exists ia_contexto_fragmentos_busqueda_idx
  on public.ia_contexto_fragmentos using gin (busqueda);
create index if not exists ia_contexto_fragmentos_alcance_idx
  on public.ia_contexto_fragmentos (alcance, documento_id);

alter table public.ia_contexto_documentos enable row level security;
alter table public.ia_contexto_fragmentos enable row level security;
revoke all on public.ia_contexto_documentos from anon, authenticated;
revoke all on public.ia_contexto_fragmentos from anon, authenticated;
grant all on public.ia_contexto_documentos to service_role;
grant all on public.ia_contexto_fragmentos to service_role;
grant usage, select on sequence public.ia_contexto_fragmentos_id_seq to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ia-contexto',
  'ia-contexto',
  false,
  4194304,
  array['application/pdf', 'text/plain', 'text/markdown']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.buscar_contexto_ia(
  consulta text,
  alcances text[],
  limite integer default 4
)
returns table (nombre text, alcance text, contenido text, posicion integer, relevancia real)
language sql
stable
security invoker
set search_path = ''
as $$
  with consulta_normalizada as (
    select websearch_to_tsquery('spanish'::regconfig, coalesce(consulta, '')) as terminos
  )
  select
    fragmento.nombre_documento,
    fragmento.alcance,
    fragmento.contenido,
    fragmento.posicion,
    ts_rank(fragmento.busqueda, consulta_normalizada.terminos)::real as relevancia
  from public.ia_contexto_fragmentos as fragmento
  join public.ia_contexto_documentos as documento
    on documento.id = fragmento.documento_id and documento.activo
  cross join consulta_normalizada
  where fragmento.alcance = any(coalesce(alcances, array['general']::text[]))
    and consulta_normalizada.terminos <> ''::tsquery
    and fragmento.busqueda @@ consulta_normalizada.terminos
  order by relevancia desc, documento.actualizado_en desc, fragmento.posicion asc
  limit greatest(1, least(coalesce(limite, 4), 6));
$$;

revoke all on function public.buscar_contexto_ia(text, text[], integer) from public, anon, authenticated;
grant execute on function public.buscar_contexto_ia(text, text[], integer) to service_role;
