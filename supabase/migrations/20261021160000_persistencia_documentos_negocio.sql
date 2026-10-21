-- Los documentos laborales viven en el mismo libro durable y se respaldan con él.

-- La bandeja y los movimientos importados se confirman en el mismo lote:
-- si la decisión no se guarda, tampoco se declara completo el lote local.
create or replace function public.aplicar_cambios_financieros(cambios jsonb, id_operacion uuid)
returns void language plpgsql security invoker set search_path = ''
as $$
declare
  usuario uuid := auth.uid();
  tabla text;
  fila jsonb;
  columna text;
  columnas text;
  actualizaciones text;
  clave text;
  guardado text;
  referencia uuid;
  tablas constant text[] := array['cajitas','categorias','contactos','presupuestos','recurrentes','metas','transacciones','cajita_movimientos','revisiones_dudosas','documentos_negocio'];
begin
  if usuario is null then raise exception 'Debes iniciar sesión.' using errcode = '42501'; end if;
  if id_operacion is null or cambios is null or jsonb_typeof(cambios) <> 'object' then
    raise exception 'La operación financiera no es válida.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(usuario::text, 0));
  select huella into guardado from public.operaciones_financieras where user_id = usuario and id = id_operacion;
  if found then
    if guardado <> pg_catalog.md5(cambios::text) then raise exception 'El identificador pertenece a otra operación.'; end if;
    return;
  end if;
  if exists(select 1 from jsonb_object_keys(coalesce(cambios->'guardar', '{}'::jsonb)) k where not k = any(tablas))
    or exists(select 1 from jsonb_object_keys(coalesce(cambios->'borrar', '{}'::jsonb)) k where not k = any(tablas)) then
    raise exception 'La operación contiene una tabla no permitida.' using errcode = '42501';
  end if;

  foreach tabla in array array['transacciones','metas','cajita_movimientos','recurrentes','cajitas','categorias','contactos','presupuestos','revisiones_dudosas','documentos_negocio'] loop
    clave := case when tabla = 'presupuestos' then 'categoria' else 'id' end;
    if coalesce((cambios->>'reemplazar')::boolean, false) then
      execute format('delete from public.%I where user_id = $1', tabla) using usuario;
    else
      execute format('delete from public.%I where user_id = $1 and %I::text in (select jsonb_array_elements_text($2))', tabla, clave)
        using usuario, coalesce(cambios->'borrar'->tabla, '[]'::jsonb);
    end if;
  end loop;

  foreach tabla in array tablas loop
    for fila in select value from jsonb_array_elements(coalesce(cambios->'guardar'->tabla, '[]'::jsonb)) loop
      if jsonb_typeof(fila) <> 'object' then raise exception 'Hay un registro financiero no válido.'; end if;
      if fila ? 'user_id' and (fila->>'user_id')::uuid is distinct from usuario then
        raise exception 'No puedes guardar registros de otra cuenta.' using errcode = '42501';
      end if;
      fila := fila || jsonb_build_object('user_id', usuario);
      if tabla in ('transacciones','recurrentes') then referencia := (fila->>'cuenta_id')::uuid;
      elsif tabla in ('cajita_movimientos','metas') then referencia := (fila->>'cajita_id')::uuid;
      else referencia := null;
      end if;
      if referencia is not null and not exists(select 1 from public.cajitas where id = referencia and user_id = usuario) then
        raise exception 'La cuenta del movimiento no existe o no te pertenece.' using errcode = '42501';
      end if;
      clave := case when tabla = 'presupuestos' then 'user_id, categoria' else 'id' end;
      columnas := '';
      actualizaciones := '';
      for columna in select jsonb_object_keys(fila) loop
        if not exists(select 1 from information_schema.columns where table_schema='public' and table_name=tabla and column_name=columna) then
          raise exception 'El registro contiene un campo desconocido: %.', columna;
        end if;
        columnas := columnas || case when columnas = '' then '' else ', ' end || format('%I', columna);
        if columna not in ('id','user_id') and not (tabla = 'presupuestos' and columna = 'categoria') then
          actualizaciones := actualizaciones || case when actualizaciones = '' then '' else ', ' end || format('%1$I = excluded.%1$I', columna);
        end if;
      end loop;
      execute format('insert into public.%1$I (%2$s) select %2$s from jsonb_populate_record(null::public.%1$I, $1) on conflict (%3$s) do update set %4$s', tabla, columnas, clave, actualizaciones)
        using fila;
    end loop;
  end loop;
  insert into public.operaciones_financieras(user_id,id,huella) values (usuario,id_operacion,pg_catalog.md5(cambios::text));
end;
$$;
revoke all on function public.aplicar_cambios_financieros(jsonb,uuid) from public, anon;
grant execute on function public.aplicar_cambios_financieros(jsonb,uuid) to authenticated;
