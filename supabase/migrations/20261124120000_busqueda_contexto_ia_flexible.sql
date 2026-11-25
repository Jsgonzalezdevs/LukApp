-- websearch_to_tsquery exige que un fragmento contenga TODAS las palabras de la
-- consulta. Con preguntas naturales ("¿cuánto me cobra el 4x1000 si saco
-- plata del cajero?") casi ningún fragmento las tiene todas, así que la
-- biblioteca del SuperAdmin rara vez llegaba al modelo. Ahora basta con que
-- coincida una raíz; ts_rank premia a los fragmentos que coinciden con más.
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
  with lexemas as (
    -- Las raíces ya salen derivadas por el diccionario español; por eso se
    -- arman con 'simple', que no las vuelve a derivar.
    select lexema
    from unnest(tsvector_to_array(to_tsvector('spanish'::regconfig, left(coalesce(consulta, ''), 1200)))) as lexema
    where length(lexema) > 1
    limit 24
  ),
  consulta_normalizada as (
    select to_tsquery('simple'::regconfig, string_agg(quote_literal(lexema), ' | ')) as terminos
    from lexemas
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
  where consulta_normalizada.terminos is not null
    and fragmento.alcance = any(coalesce(alcances, array['general']::text[]))
    and fragmento.busqueda @@ consulta_normalizada.terminos
  order by relevancia desc, documento.actualizado_en desc, fragmento.posicion asc
  limit greatest(1, least(coalesce(limite, 4), 6));
$$;

revoke all on function public.buscar_contexto_ia(text, text[], integer) from public, anon, authenticated;
grant execute on function public.buscar_contexto_ia(text, text[], integer) to service_role;
