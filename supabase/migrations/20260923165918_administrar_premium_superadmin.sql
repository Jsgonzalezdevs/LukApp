-- El superadmin puede resolver casos de soporte sobre una suscripción pagada
-- sin reescribir la transacción ni la referencia que llegaron desde Wompi. La
-- acción solo modifica el acceso a Premium y queda trazada para auditoría.
alter table public.eventos_facturacion
  drop constraint if exists eventos_facturacion_tipo_check;

alter table public.eventos_facturacion
  add constraint eventos_facturacion_tipo_check check (
    tipo in (
      'premium_otorgado',
      'premium_cancelado',
      'premium_modificado',
      'plan_actualizado',
      'evento_pasarela'
    )
  );

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

  -- Se bloquea primero el perfil, igual que el webhook de Wompi. Así se evita
  -- invertir el orden de bloqueo y dejar dos operaciones esperando entre sí.
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

    insert into public.eventos_facturacion (user_id, suscripcion_id, actor_id, tipo, pasarela, referencia_externa, detalle)
    values (
      v_suscripcion.user_id,
      v_suscripcion.id,
      p_actor,
      'premium_modificado',
      v_suscripcion.pasarela,
      v_suscripcion.referencia_externa,
      coalesce(v_nota, 'Vigencia de Premium actualizada por superadmin.')
    );
  else
    -- No es un reembolso ni modifica el cobro en Wompi: corta el acceso ahora
    -- y conserva íntegra la evidencia de la transacción para conciliación.
    update public.suscripciones
       set estado = 'cancelada',
           finalizada_en = now(),
           nota = coalesce(v_nota, nota)
     where id = v_suscripcion.id
     returning * into v_suscripcion;

    insert into public.eventos_facturacion (user_id, suscripcion_id, actor_id, tipo, pasarela, referencia_externa, detalle)
    values (
      v_suscripcion.user_id,
      v_suscripcion.id,
      p_actor,
      'premium_cancelado',
      v_suscripcion.pasarela,
      v_suscripcion.referencia_externa,
      coalesce(v_nota, 'Acceso Premium retirado por superadmin.')
    );
  end if;

  return v_suscripcion;
end;
$$;

revoke all on function public.administrar_premium_superadmin(bigint, text, uuid, timestamptz, text) from public, anon, authenticated;
grant execute on function public.administrar_premium_superadmin(bigint, text, uuid, timestamptz, text) to service_role;
