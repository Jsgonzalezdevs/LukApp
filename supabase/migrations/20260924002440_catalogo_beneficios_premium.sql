-- Catálogo de prestaciones por plan.
--
-- Los límites dicen cuánto puede usarse una prestación; este catálogo decide
-- si la prestación existe para cada plan. Separarlos permite que Super Admin
-- componga Premium sin dejar una puerta abierta solo por cambiar la interfaz.
create table public.beneficios_plan (
  plan_codigo    text not null references public.planes_suscripcion(codigo) on delete cascade,
  clave          text not null check (clave in (
    'dictado',
    'asesor_ia',
    'extracto',
    'espacios_compartidos',
    'integrantes_espacio',
    'insights_ia',
    'pulso_premium'
  )),
  activo         boolean not null default false,
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid references public.perfiles(id) on delete set null,
  primary key (plan_codigo, clave)
);

-- La configuración inicial conserva exactamente los accesos de la versión
-- anterior. Los dos análisis proactivos son nuevos beneficios exclusivos de
-- Premium; los demás ya estaban disponibles con los cupos de cada plan.
insert into public.beneficios_plan (plan_codigo, clave, activo) values
  ('normal', 'dictado', true),
  ('normal', 'asesor_ia', true),
  ('normal', 'extracto', true),
  ('normal', 'espacios_compartidos', true),
  ('normal', 'integrantes_espacio', true),
  ('normal', 'insights_ia', false),
  ('normal', 'pulso_premium', false),
  ('premium', 'dictado', true),
  ('premium', 'asesor_ia', true),
  ('premium', 'extracto', true),
  ('premium', 'espacios_compartidos', true),
  ('premium', 'integrantes_espacio', true),
  ('premium', 'insights_ia', true),
  ('premium', 'pulso_premium', true)
on conflict (plan_codigo, clave) do nothing;

alter table public.beneficios_plan enable row level security;
revoke all on table public.beneficios_plan from anon, authenticated;

-- Actualiza el plan y toda su selección de beneficios dentro de una sola
-- transacción. La ruta HTTP ya verifica al superadmin; esta RPC evita que una
-- actualización parcial deje lo que se cobra y lo que se entrega desfasados.
create or replace function public.actualizar_plan_con_beneficios(
  p_codigo text,
  p_precio_mensual_cop bigint,
  p_precio_anual_cop bigint,
  p_limite_dictados_mensual integer,
  p_limite_asesor_ia_mensual integer,
  p_limite_extractos_mensual integer,
  p_limite_espacios_compartidos integer,
  p_limite_integrantes_por_espacio integer,
  p_activo boolean,
  p_beneficios jsonb,
  p_actor uuid
)
returns public.planes_suscripcion
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_plan public.planes_suscripcion;
  v_cantidad_beneficios integer;
begin
  if p_codigo not in ('normal', 'premium') then
    raise exception 'Solo existen los planes Normal y Premium.' using errcode = '22023';
  end if;
  if p_activo is distinct from true then
    raise exception 'Los planes Normal y Premium deben mantenerse disponibles.' using errcode = '22023';
  end if;
  if p_codigo = 'normal' and (p_precio_mensual_cop <> 0 or p_precio_anual_cop <> 0) then
    raise exception 'El plan Normal debe ser gratuito para siempre.' using errcode = '22023';
  end if;
  if p_codigo = 'premium' and (p_precio_mensual_cop <= 0 or p_precio_anual_cop <= 0) then
    raise exception 'Premium debe conservar un precio mensual y anual mayor que cero.' using errcode = '22023';
  end if;
  if p_beneficios is null or jsonb_typeof(p_beneficios) <> 'object' then
    raise exception 'La selección de beneficios no es válida.' using errcode = '22023';
  end if;

  select count(*) into v_cantidad_beneficios from jsonb_each(p_beneficios);
  if v_cantidad_beneficios <> 7 or exists (
    select 1
      from jsonb_each(p_beneficios) as beneficio(clave, valor)
     where beneficio.clave not in (
       'dictado', 'asesor_ia', 'extracto', 'espacios_compartidos',
       'integrantes_espacio', 'insights_ia', 'pulso_premium'
     )
        or jsonb_typeof(beneficio.valor) <> 'boolean'
  ) then
    raise exception 'La selección de beneficios está incompleta o contiene una prestación desconocida.' using errcode = '22023';
  end if;
  if coalesce((p_beneficios ->> 'integrantes_espacio')::boolean, false)
    and not coalesce((p_beneficios ->> 'espacios_compartidos')::boolean, false) then
    raise exception 'No se pueden incluir integrantes si los espacios compartidos están desactivados.' using errcode = '22023';
  end if;
  if coalesce((p_beneficios ->> 'pulso_premium')::boolean, false)
    and not coalesce((p_beneficios ->> 'asesor_ia')::boolean, false) then
    raise exception 'No se puede incluir Pulso Premium si el Asesor IA está desactivado.' using errcode = '22023';
  end if;
  if p_codigo = 'premium' and not exists (
    select 1 from jsonb_each(p_beneficios) as beneficio(clave, valor)
     where beneficio.valor = 'true'::jsonb
  ) then
    raise exception 'Premium debe incluir al menos una prestación antes de poder cobrarse.' using errcode = '22023';
  end if;

  update public.planes_suscripcion
     set precio_mensual_cop = p_precio_mensual_cop,
         precio_anual_cop = p_precio_anual_cop,
         limite_dictados_mensual = p_limite_dictados_mensual,
         limite_asesor_ia_mensual = p_limite_asesor_ia_mensual,
         limite_extractos_mensual = p_limite_extractos_mensual,
         limite_espacios_compartidos = p_limite_espacios_compartidos,
         limite_integrantes_por_espacio = p_limite_integrantes_por_espacio,
         activo = p_activo,
         actualizado_en = now(),
         actualizado_por = p_actor
   where codigo = p_codigo
  returning * into v_plan;

  if not found then
    raise exception 'El plan solicitado no existe.' using errcode = 'P0001';
  end if;

  insert into public.beneficios_plan (plan_codigo, clave, activo, actualizado_en, actualizado_por)
  select p_codigo, beneficio.clave, (beneficio.valor #>> '{}')::boolean, now(), p_actor
    from jsonb_each(p_beneficios) as beneficio(clave, valor)
  on conflict (plan_codigo, clave) do update
    set activo = excluded.activo,
        actualizado_en = excluded.actualizado_en,
        actualizado_por = excluded.actualizado_por;

  insert into public.eventos_facturacion (actor_id, tipo, detalle)
  values (p_actor, 'plan_actualizado', format('Actualizó precios, cupos y beneficios del plan %s.', p_codigo));

  return v_plan;
end;
$$;

revoke all on function public.actualizar_plan_con_beneficios(text, bigint, bigint, integer, integer, integer, integer, integer, boolean, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.actualizar_plan_con_beneficios(text, bigint, bigint, integer, integer, integer, integer, integer, boolean, jsonb, uuid) to service_role;

-- Al desactivar una prestación, las rutas que gastan infraestructura dejan de
-- consumir cupo de inmediato; el resultado diferencia una prestación ausente
-- de un contador agotado para que la API pueda explicarlo correctamente.
drop function public.consumir_cupo_plan(uuid, text);
create function public.consumir_cupo_plan(
  p_usuario uuid,
  p_recurso text
)
returns table (
  permitido boolean,
  plan_codigo text,
  limite integer,
  usado integer,
  incluido boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_plan text;
  v_limite integer;
  v_usado integer;
  v_incluido boolean;
  v_periodo date := date_trunc('month', now() at time zone 'America/Bogota')::date;
begin
  if p_usuario is null then
    raise exception 'Falta la cuenta a la que pertenece el cupo.' using errcode = '22023';
  end if;
  if p_recurso not in ('dictado', 'asesor_ia', 'extracto') then
    raise exception 'El recurso solicitado no existe.' using errcode = '22023';
  end if;

  v_plan := public.plan_vigente_de(p_usuario);
  select case p_recurso
    when 'dictado' then plan.limite_dictados_mensual
    when 'asesor_ia' then plan.limite_asesor_ia_mensual
    when 'extracto' then plan.limite_extractos_mensual
  end,
  exists (
    select 1 from public.beneficios_plan beneficio
     where beneficio.plan_codigo = plan.codigo
       and beneficio.clave = p_recurso
       and beneficio.activo
  )
  into v_limite, v_incluido
  from public.planes_suscripcion plan
  where plan.codigo = v_plan and plan.activo = true;

  if not found then
    raise exception 'El plan vigente no está disponible.' using errcode = 'P0001';
  end if;

  if not coalesce(v_incluido, false) then
    select case p_recurso
      when 'dictado' then dictados
      when 'asesor_ia' then asesor_ia
      else extractos
    end
    into v_usado
    from public.consumos_plan_mensual
    where user_id = p_usuario and periodo = v_periodo;
    return query select false, v_plan, 0, coalesce(v_usado, 0), false;
    return;
  end if;

  if p_recurso = 'dictado' then
    insert into public.consumos_plan_mensual (user_id, periodo, dictados)
    values (p_usuario, v_periodo, 1)
    on conflict (user_id, periodo) do update
      set dictados = public.consumos_plan_mensual.dictados + 1,
          actualizado_en = now()
      where v_limite is null or public.consumos_plan_mensual.dictados < v_limite
    returning dictados into v_usado;
  elsif p_recurso = 'asesor_ia' then
    insert into public.consumos_plan_mensual (user_id, periodo, asesor_ia)
    values (p_usuario, v_periodo, 1)
    on conflict (user_id, periodo) do update
      set asesor_ia = public.consumos_plan_mensual.asesor_ia + 1,
          actualizado_en = now()
      where v_limite is null or public.consumos_plan_mensual.asesor_ia < v_limite
    returning asesor_ia into v_usado;
  else
    insert into public.consumos_plan_mensual (user_id, periodo, extractos)
    values (p_usuario, v_periodo, 1)
    on conflict (user_id, periodo) do update
      set extractos = public.consumos_plan_mensual.extractos + 1,
          actualizado_en = now()
      where v_limite is null or public.consumos_plan_mensual.extractos < v_limite
    returning extractos into v_usado;
  end if;

  if v_usado is null then
    select case p_recurso
      when 'dictado' then dictados
      when 'asesor_ia' then asesor_ia
      else extractos
    end
    into v_usado
    from public.consumos_plan_mensual
    where user_id = p_usuario and periodo = v_periodo;
    return query select false, v_plan, v_limite, coalesce(v_usado, 0), true;
    return;
  end if;

  return query select true, v_plan, v_limite, v_usado, true;
end;
$$;

revoke all on function public.consumir_cupo_plan(uuid, text) from public, anon, authenticated;
grant execute on function public.consumir_cupo_plan(uuid, text) to service_role;

-- Los espacios compartidos se crean desde clientes autenticados, por eso el
-- bloqueo también se hace dentro de estas funciones SECURITY DEFINER y no
-- depende de que una pantalla haya ocultado un botón.
create or replace function public.crear_espacio_compartido(
  nombre_espacio text,
  icono_espacio text default '🏠',
  color_espacio text default '#8b5cf6'
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  nuevo_id uuid;
  v_plan text;
  v_limite integer;
  v_incluido boolean;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  v_plan := public.plan_vigente_de(auth.uid());
  select plan.limite_espacios_compartidos,
         exists (
           select 1 from public.beneficios_plan beneficio
            where beneficio.plan_codigo = plan.codigo
              and beneficio.clave = 'espacios_compartidos'
              and beneficio.activo
         )
    into v_limite, v_incluido
    from public.planes_suscripcion plan
   where plan.codigo = v_plan and plan.activo = true;

  if not found then
    raise exception 'El plan vigente no está disponible.' using errcode = 'P0001';
  end if;
  if not coalesce(v_incluido, false) then
    raise exception 'Los espacios compartidos no están incluidos en tu plan actual.' using errcode = 'P0001';
  end if;
  if v_limite is not null and (
    select count(*) from public.espacios_compartidos where creado_por = auth.uid()
  ) >= v_limite then
    raise exception 'Tu plan ya llegó al límite de espacios compartidos.' using errcode = 'P0001';
  end if;

  insert into public.espacios_compartidos(creado_por, nombre, icono, color)
  values (auth.uid(), trim(nombre_espacio), coalesce(nullif(icono_espacio, ''), '🏠'), coalesce(nullif(color_espacio, ''), '#8b5cf6'))
  returning id into nuevo_id;
  insert into public.espacios_integrantes(espacio_id, user_id, rol, nombre)
  values (nuevo_id, auth.uid(), 'propietario', 'Tú');
  return nuevo_id;
end;
$$;

create or replace function public.aceptar_invitacion_compartida(
  token_invitacion uuid,
  nombre_integrante text default 'Pareja',
  emoji_integrante text default '🙂'
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  invitacion public.invitaciones_compartidas%rowtype;
  v_propietario uuid;
  v_plan text;
  v_limite integer;
  v_incluido boolean;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión para aceptar la invitación.';
  end if;
  select * into invitacion from public.invitaciones_compartidas
   where token = token_invitacion and estado = 'pendiente' and expires_at > now()
   for update;
  if not found then
    raise exception 'Esta invitación ya venció o fue utilizada.';
  end if;
  if invitacion.invitado_por = auth.uid() then
    raise exception 'No puedes aceptar tu propia invitación.';
  end if;

  select creado_por into v_propietario
    from public.espacios_compartidos
   where id = invitacion.espacio_id;
  v_plan := public.plan_vigente_de(v_propietario);
  select plan.limite_integrantes_por_espacio,
         exists (
           select 1 from public.beneficios_plan beneficio
            where beneficio.plan_codigo = plan.codigo
              and beneficio.clave = 'integrantes_espacio'
              and beneficio.activo
         )
    into v_limite, v_incluido
    from public.planes_suscripcion plan
   where plan.codigo = v_plan and plan.activo = true;

  if not found then
    raise exception 'El plan vigente no está disponible.' using errcode = 'P0001';
  end if;
  if not coalesce(v_incluido, false) then
    raise exception 'Las invitaciones a espacios no están incluidas en el plan de la persona propietaria.' using errcode = 'P0001';
  end if;
  if v_limite is not null and (
    select count(*) from public.espacios_integrantes where espacio_id = invitacion.espacio_id
  ) >= v_limite then
    raise exception 'Este espacio ya llegó al límite de integrantes de su plan.' using errcode = 'P0001';
  end if;

  insert into public.espacios_integrantes(espacio_id, user_id, rol, nombre, emoji)
  values (invitacion.espacio_id, auth.uid(), 'integrante', coalesce(nullif(trim(nombre_integrante), ''), 'Pareja'), coalesce(nullif(emoji_integrante, ''), '🙂'))
  on conflict (espacio_id, user_id) do nothing;
  update public.invitaciones_compartidas set estado = 'aceptada' where id = invitacion.id;
  return invitacion.espacio_id;
end;
$$;
