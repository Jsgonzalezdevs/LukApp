-- Los eventos de una acción de soporte pertenecen a la suscripción, pero no
-- son un segundo evento de Wompi. Repetir pasarela y referencia activaba el
-- índice único reservado para hacer idempotente el webhook y revertía toda la
-- cancelación. El vínculo por suscripción conserva la trazabilidad sin fingir
-- que hubo otro cobro.
create or replace function public.administrar_premium_superadmin(
  p_suscripcion bigint,
  p_accion text,
  p_actor uuid,
  p_vence_en timestamptz default null,
  p_nota text default null
)
returns public.suscripciones
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_usuario uuid;
  v_suscripcion public.suscripciones;
  v_nota text := nullif(trim(coalesce(p_nota, '')), '');
begin
  if p_suscripcion is null or p_suscripcion <= 0 then
    raise exception 'La suscripción no es válida.' using errcode = '22023';
  end if;
  if p_accion not in ('actualizar_vigencia', 'cancelar') then
    raise exception 'La acción de suscripción no es válida.' using errcode = '22023';
  end if;
  if p_actor is null then
    raise exception 'Falta identificar a quien administra la suscripción.' using errcode = '22023';
  end if;
  if v_nota is not null and char_length(v_nota) > 280 then
    raise exception 'La nota supera 280 caracteres.' using errcode = '22023';
  end if;

  select user_id into v_usuario
    from public.suscripciones
   where id = p_suscripcion;
  if not found then
    raise exception 'La suscripción no existe.' using errcode = 'P0001';
  end if;

  perform 1 from public.perfiles where id = v_usuario for update;
  if not found then
    raise exception 'La cuenta de esta suscripción ya no existe.' using errcode = 'P0001';
  end if;

  select * into v_suscripcion
    from public.suscripciones
   where id = p_suscripcion
   for update;
  if not found or v_suscripcion.estado <> 'activa' or v_suscripcion.vence_en <= now() then
    raise exception 'La suscripción ya no está vigente.' using errcode = 'P0001';
  end if;

  if p_accion = 'actualizar_vigencia' then
    if p_vence_en is null or p_vence_en <= now() or p_vence_en <= v_suscripcion.inicia_en then
      raise exception 'La nueva vigencia debe terminar después de ahora y del inicio de Premium.' using errcode = '22023';
    end if;

    update public.suscripciones
       set vence_en = p_vence_en,
           nota = coalesce(v_nota, nota)
     where id = v_suscripcion.id
     returning * into v_suscripcion;

    insert into public.eventos_facturacion (user_id, suscripcion_id, actor_id, tipo, detalle)
    values (
      v_suscripcion.user_id,
      v_suscripcion.id,
      p_actor,
      'premium_modificado',
      coalesce(v_nota, 'Vigencia de Premium actualizada por superadmin.')
    );
  else
    update public.suscripciones
       set estado = 'cancelada',
           finalizada_en = now(),
           nota = coalesce(v_nota, nota)
     where id = v_suscripcion.id
     returning * into v_suscripcion;

    insert into public.eventos_facturacion (user_id, suscripcion_id, actor_id, tipo, detalle)
    values (
      v_suscripcion.user_id,
      v_suscripcion.id,
      p_actor,
      'premium_cancelado',
      coalesce(v_nota, 'Acceso Premium retirado por superadmin.')
    );
  end if;

  return v_suscripcion;
end;
$$;

revoke all on function public.administrar_premium_superadmin(bigint, text, uuid, timestamptz, text) from public, anon, authenticated;
grant execute on function public.administrar_premium_superadmin(bigint, text, uuid, timestamptz, text) to service_role;
