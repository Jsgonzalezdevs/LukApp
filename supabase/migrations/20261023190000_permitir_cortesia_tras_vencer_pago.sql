-- Una suscripción pagada puede conservar estado "activa" después de su fecha
-- de vencimiento. Si no se reconcilió al expirar, no debe bloquear una cortesía
-- ni ocupar el índice de suscripción activa; primero cerramos ese estado viejo
-- y conservamos intactos el cobro, la referencia de Wompi y el historial.
create or replace function public.otorgar_premium_manual(
  p_usuario uuid,
  p_vence_en timestamptz,
  p_actor uuid,
  p_nota text default null
)
returns public.suscripciones
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_suscripcion public.suscripciones;
begin
  if p_vence_en <= now() then
    raise exception 'La vigencia de Premium debe terminar en el futuro.' using errcode = '22023';
  end if;
  if p_nota is not null and char_length(p_nota) > 280 then
    raise exception 'La nota supera 280 caracteres.' using errcode = '22023';
  end if;

  perform 1 from public.perfiles where id = p_usuario for update;
  if not found then
    raise exception 'La cuenta no existe.' using errcode = 'P0001';
  end if;

  -- El estado puede quedar atrasado si el proceso de vencimiento no alcanzó
  -- a ejecutarse; una fecha pasada determina que el derecho ya terminó.
  update public.suscripciones
     set estado = 'vencida', finalizada_en = coalesce(finalizada_en, vence_en)
   where user_id = p_usuario and estado = 'activa' and vence_en <= now();

  -- Una cortesía no debe sustituir una suscripción pagada que aún tenga
  -- vigencia. Se conserva el control también para pagos programados.
  if exists (
    select 1
      from public.suscripciones
     where user_id = p_usuario
       and estado = 'activa'
       and origen = 'pasarela'
       and vence_en > now()
  ) then
    raise exception 'La cuenta ya tiene Premium pagado. Adminístralo desde la pasarela.' using errcode = 'P0001';
  end if;

  update public.suscripciones
     set estado = 'cancelada', finalizada_en = now()
   where user_id = p_usuario and estado = 'activa' and origen = 'manual';

  insert into public.suscripciones (
    user_id, plan_codigo, estado, ciclo, origen, valor_cobrado_cop,
    inicia_en, vence_en, otorgada_por, nota
  ) values (
    p_usuario, 'premium', 'activa', 'cortesia', 'manual', 0,
    now(), p_vence_en, p_actor, nullif(trim(coalesce(p_nota, '')), '')
  )
  returning * into v_suscripcion;

  insert into public.eventos_facturacion (user_id, suscripcion_id, actor_id, tipo, detalle)
  values (p_usuario, v_suscripcion.id, p_actor, 'premium_otorgado', v_suscripcion.nota);

  return v_suscripcion;
end;
$$;
