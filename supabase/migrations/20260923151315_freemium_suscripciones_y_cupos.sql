-- Freemium de LukApp.
--
-- Hay exactamente dos planes: Normal (gratis y siempre disponible) y Premium.
-- Normal no necesita una fila de suscripción: es el respaldo seguro si el pago
-- vence, se cancela o todavía no existe una pasarela configurada. Premium sí
-- queda registrado con fechas, para que la base --no la interfaz-- decida qué
-- cupos corresponden en cada solicitud.

create table if not exists public.planes_suscripcion (
  codigo                            text primary key check (codigo in ('normal', 'premium')),
  nombre                            text not null,
  precio_mensual_cop                bigint not null default 0 check (precio_mensual_cop >= 0),
  precio_anual_cop                  bigint not null default 0 check (precio_anual_cop >= 0),
  limite_dictados_mensual           integer check (limite_dictados_mensual is null or limite_dictados_mensual > 0),
  limite_asesor_ia_mensual          integer check (limite_asesor_ia_mensual is null or limite_asesor_ia_mensual > 0),
  limite_extractos_mensual          integer check (limite_extractos_mensual is null or limite_extractos_mensual > 0),
  limite_espacios_compartidos       integer check (limite_espacios_compartidos is null or limite_espacios_compartidos > 0),
  limite_integrantes_por_espacio    integer check (limite_integrantes_por_espacio is null or limite_integrantes_por_espacio > 0),
  activo                            boolean not null default true,
  actualizado_en                    timestamptz not null default now(),
  actualizado_por                   uuid references public.perfiles(id) on delete set null
);

insert into public.planes_suscripcion (
  codigo,
  nombre,
  precio_mensual_cop,
  precio_anual_cop,
  limite_dictados_mensual,
  limite_asesor_ia_mensual,
  limite_extractos_mensual,
  limite_espacios_compartidos,
  limite_integrantes_por_espacio
) values
  ('normal', 'Normal', 0, 0, 60, 5, 1, 1, 4),
  ('premium', 'Premium', 9900, 79900, 300, 60, 12, null, null)
on conflict (codigo) do nothing;

-- Una suscripción histórica nunca se reescribe como si fuera otro pago. Al
-- cambiar o renovar, se cierra la vigente y se agrega otra fila. Así una
-- pasarela puede reenviar un evento sin crear dos beneficios si conserva su
-- referencia externa.
create table if not exists public.suscripciones (
  id                    bigint generated always as identity primary key,
  user_id               uuid not null references public.perfiles(id) on delete cascade,
  plan_codigo           text not null default 'premium' references public.planes_suscripcion(codigo),
  estado                text not null default 'activa' check (estado in ('pendiente', 'activa', 'cancelada', 'vencida')),
  ciclo                 text not null check (ciclo in ('mensual', 'anual', 'cortesia')),
  origen                text not null check (origen in ('manual', 'pasarela')),
  pasarela              text,
  referencia_externa    text,
  valor_cobrado_cop     bigint not null default 0 check (valor_cobrado_cop >= 0),
  inicia_en             timestamptz not null default now(),
  vence_en              timestamptz not null,
  cancelar_al_vencer    boolean not null default false,
  otorgada_por          uuid references public.perfiles(id) on delete set null,
  nota                  text check (nota is null or char_length(nota) <= 280),
  creada_en             timestamptz not null default now(),
  finalizada_en         timestamptz,
  check (plan_codigo = 'premium'),
  check (vence_en > inicia_en),
  check ((origen = 'manual' and pasarela is null) or origen = 'pasarela')
);

-- La aplicación consulta por persona, estado y vencimiento; el orden de este
-- índice coincide con ese patrón. También hace rápido el cierre en cascada de
-- una cuenta eliminada.
create index if not exists suscripciones_usuario_estado_vence_idx
  on public.suscripciones (user_id, estado, vence_en desc);

-- Solo puede existir un Premium vigente por persona. El índice parcial deja
-- conservar todo el historial de pagos cancelados o vencidos sin estorbar una
-- nueva renovación.
create unique index if not exists suscripciones_una_activa_por_usuario_idx
  on public.suscripciones (user_id)
  where estado = 'activa';

-- La pasarela puede reintentar exactamente el mismo evento. Su referencia se
-- vuelve idempotente sin bloquear las suscripciones manuales, que no tienen
-- referencia externa.
create unique index if not exists suscripciones_referencia_pasarela_unica_idx
  on public.suscripciones (pasarela, referencia_externa)
  where pasarela is not null and referencia_externa is not null;

-- Solo se guardan contadores agregados mensuales: nunca audios, preguntas,
-- textos de extractos ni montos financieros. El mes se calcula en Bogotá para
-- que el cupo no cambie a las siete de la noche por usar UTC.
create table if not exists public.consumos_plan_mensual (
  user_id       uuid not null references public.perfiles(id) on delete cascade,
  periodo       date not null,
  dictados      integer not null default 0 check (dictados >= 0),
  asesor_ia     integer not null default 0 check (asesor_ia >= 0),
  extractos     integer not null default 0 check (extractos >= 0),
  actualizado_en timestamptz not null default now(),
  primary key (user_id, periodo),
  check (periodo = date_trunc('month', periodo)::date)
);

-- La pestaña de facturación no depende del log volátil del proceso Node. Este
-- historial no guarda medios de pago ni respuestas crudas de la pasarela:
-- bastan el actor, la referencia y el resultado para auditar una decisión.
create table if not exists public.eventos_facturacion (
  id                  bigint generated always as identity primary key,
  user_id             uuid references public.perfiles(id) on delete set null,
  suscripcion_id      bigint references public.suscripciones(id) on delete set null,
  actor_id            uuid references public.perfiles(id) on delete set null,
  tipo                text not null check (tipo in ('premium_otorgado', 'premium_cancelado', 'plan_actualizado', 'evento_pasarela')),
  pasarela            text,
  referencia_externa  text,
  detalle             text check (detalle is null or char_length(detalle) <= 500),
  creado_en           timestamptz not null default now()
);

create index if not exists eventos_facturacion_usuario_creado_idx
  on public.eventos_facturacion (user_id, creado_en desc);
create unique index if not exists eventos_facturacion_pasarela_referencia_unica_idx
  on public.eventos_facturacion (pasarela, referencia_externa)
  where pasarela is not null and referencia_externa is not null;

-- ---------------------------------------------------------------------------
-- Permisos administrativos.
--
-- Ver facturación es delegable para que, por ejemplo, una persona contable vea
-- el resumen. Cambiar precios, otorgar Premium o cancelar beneficios queda
-- reservado al superadmin fijo: no se delega dinero ni se abre una vía de
-- escalación de privilegios desde un rol personalizado.
insert into public.permisos (clave, descripcion) values
  ('ver_facturacion', 'Ver el resumen de suscripciones y facturación')
on conflict (clave) do nothing;

-- ---------------------------------------------------------------------------
-- RLS y funciones internas.
--
-- Ninguna tabla de cobros se expone al navegador. Las rutas del servidor
-- validan el JWT y usan service_role; las RPC internas quedan revocadas de
-- todos los roles públicos para que un usuario no pueda consumir, devolver o
-- otorgarse cupos con una llamada directa.
alter table public.planes_suscripcion enable row level security;
alter table public.suscripciones enable row level security;
alter table public.consumos_plan_mensual enable row level security;
alter table public.eventos_facturacion enable row level security;

revoke all on table public.planes_suscripcion from anon, authenticated;
revoke all on table public.suscripciones from anon, authenticated;
revoke all on table public.consumos_plan_mensual from anon, authenticated;
revoke all on table public.eventos_facturacion from anon, authenticated;

create or replace function public.plan_vigente_de(p_usuario uuid)
returns text
language sql
security definer
set search_path = pg_catalog, public
stable
as $$
  select coalesce((
    select s.plan_codigo
      from public.suscripciones s
     where s.user_id = p_usuario
       and s.estado = 'activa'
       and s.inicia_en <= now()
       and s.vence_en > now()
     order by s.vence_en desc
     limit 1
  ), 'normal');
$$;

revoke all on function public.plan_vigente_de(uuid) from public, anon, authenticated;
grant execute on function public.plan_vigente_de(uuid) to service_role;

create or replace function public.consumir_cupo_plan(
  p_usuario uuid,
  p_recurso text
)
returns table (
  permitido boolean,
  plan_codigo text,
  limite integer,
  usado integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_plan text;
  v_limite integer;
  v_usado integer;
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
    when 'dictado' then limite_dictados_mensual
    when 'asesor_ia' then limite_asesor_ia_mensual
    when 'extracto' then limite_extractos_mensual
  end
  into v_limite
  from public.planes_suscripcion
  where codigo = v_plan and activo = true;

  if not found then
    raise exception 'El plan vigente no está disponible.' using errcode = 'P0001';
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
    return query select false, v_plan, v_limite, coalesce(v_usado, 0);
    return;
  end if;

  return query select true, v_plan, v_limite, v_usado;
end;
$$;

create or replace function public.devolver_cupo_plan(
  p_usuario uuid,
  p_recurso text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_periodo date := date_trunc('month', now() at time zone 'America/Bogota')::date;
begin
  if p_recurso = 'dictado' then
    update public.consumos_plan_mensual
       set dictados = greatest(dictados - 1, 0), actualizado_en = now()
     where user_id = p_usuario and periodo = v_periodo;
  elsif p_recurso = 'asesor_ia' then
    update public.consumos_plan_mensual
       set asesor_ia = greatest(asesor_ia - 1, 0), actualizado_en = now()
     where user_id = p_usuario and periodo = v_periodo;
  elsif p_recurso = 'extracto' then
    update public.consumos_plan_mensual
       set extractos = greatest(extractos - 1, 0), actualizado_en = now()
     where user_id = p_usuario and periodo = v_periodo;
  else
    raise exception 'El recurso solicitado no existe.' using errcode = '22023';
  end if;
end;
$$;

-- El cierre y la concesión manual comparten un bloqueo de la fila de perfil.
-- De esta manera dos clics del panel, o un webhook que llegue al mismo tiempo,
-- nunca pueden dejar dos Premium activos para la misma persona.
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

  -- Una cortesía no debe borrar ni sustituir silenciosamente una suscripción
  -- pagada. Esa relación se cancela o reembolsa en su pasarela y el webhook
  -- conserva su trazabilidad; aquí solo se administran cortesías.
  if exists (
    select 1
      from public.suscripciones
     where user_id = p_usuario and estado = 'activa' and origen = 'pasarela'
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

create or replace function public.cancelar_premium_manual(
  p_suscripcion bigint,
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
  update public.suscripciones
     set estado = 'cancelada', finalizada_en = now(), nota = coalesce(nullif(trim(coalesce(p_nota, '')), ''), nota)
   where id = p_suscripcion and estado = 'activa' and origen = 'manual'
  returning * into v_suscripcion;

  if not found then
    raise exception 'La suscripción no está activa o debe administrarse desde la pasarela.' using errcode = 'P0001';
  end if;

  insert into public.eventos_facturacion (user_id, suscripcion_id, actor_id, tipo, detalle)
  values (v_suscripcion.user_id, v_suscripcion.id, p_actor, 'premium_cancelado', p_nota);

  return v_suscripcion;
end;
$$;

-- Única vía de base para que un webhook ya verificado active Premium. No se
-- expone a cuentas autenticadas ni guarda el cuerpo crudo del evento. La
-- referencia de la pasarela es idempotente: un reintento devuelve la misma
-- fila y nunca duplica el beneficio ni la auditoría.
create or replace function public.activar_premium_pasarela(
  p_usuario uuid,
  p_ciclo text,
  p_pasarela text,
  p_referencia_externa text,
  p_valor_cobrado_cop bigint,
  p_inicia_en timestamptz,
  p_vence_en timestamptz
)
returns public.suscripciones
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_existente public.suscripciones;
  v_suscripcion public.suscripciones;
begin
  if p_usuario is null or p_ciclo not in ('mensual', 'anual')
    or p_pasarela is null or char_length(trim(p_pasarela)) not between 2 and 60
    or p_referencia_externa is null or char_length(trim(p_referencia_externa)) not between 3 and 200
    or p_valor_cobrado_cop <= 0 or p_inicia_en is null or p_vence_en <= p_inicia_en then
    raise exception 'El evento de pago no tiene los datos requeridos.' using errcode = '22023';
  end if;

  perform 1 from public.perfiles where id = p_usuario for update;
  if not found then
    raise exception 'La cuenta asociada al pago no existe.' using errcode = 'P0001';
  end if;

  select * into v_existente
    from public.suscripciones
   where pasarela = trim(p_pasarela)
     and referencia_externa = trim(p_referencia_externa);
  if found then
    return v_existente;
  end if;

  -- Un pago aprobado reemplaza una cortesía o una vigencia anterior. La fila
  -- anterior se conserva como historial, y el bloqueo sobre perfiles evita
  -- que dos webhooks simultáneos creen dos Premium activos.
  update public.suscripciones
     set estado = case when vence_en <= now() then 'vencida' else 'cancelada' end,
         finalizada_en = now()
   where user_id = p_usuario and estado = 'activa';

  insert into public.suscripciones (
    user_id, plan_codigo, estado, ciclo, origen, pasarela,
    referencia_externa, valor_cobrado_cop, inicia_en, vence_en
  ) values (
    p_usuario, 'premium', 'activa', p_ciclo, 'pasarela', trim(p_pasarela),
    trim(p_referencia_externa), p_valor_cobrado_cop, p_inicia_en, p_vence_en
  )
  returning * into v_suscripcion;

  insert into public.eventos_facturacion (
    user_id, suscripcion_id, tipo, pasarela, referencia_externa, detalle
  ) values (
    p_usuario, v_suscripcion.id, 'evento_pasarela', trim(p_pasarela),
    trim(p_referencia_externa), 'Pago aprobado y Premium activado.'
  );

  return v_suscripcion;
end;
$$;

revoke all on function public.consumir_cupo_plan(uuid, text) from public, anon, authenticated;
revoke all on function public.devolver_cupo_plan(uuid, text) from public, anon, authenticated;
revoke all on function public.otorgar_premium_manual(uuid, timestamptz, uuid, text) from public, anon, authenticated;
revoke all on function public.cancelar_premium_manual(bigint, uuid, text) from public, anon, authenticated;
revoke all on function public.activar_premium_pasarela(uuid, text, text, text, bigint, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.consumir_cupo_plan(uuid, text) to service_role;
grant execute on function public.devolver_cupo_plan(uuid, text) to service_role;
grant execute on function public.otorgar_premium_manual(uuid, timestamptz, uuid, text) to service_role;
grant execute on function public.cancelar_premium_manual(bigint, uuid, text) to service_role;
grant execute on function public.activar_premium_pasarela(uuid, text, text, text, bigint, timestamptz, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- Espacios compartidos: el límite se hace cumplir dentro de las funciones que
-- ya son la única vía segura de alta. Cambiar un contador solo en React sería
-- eludible desde otra pestaña o una llamada directa al API de Supabase.
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
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  v_plan := public.plan_vigente_de(auth.uid());
  select limite_espacios_compartidos into v_limite
    from public.planes_suscripcion
   where codigo = v_plan and activo = true;

  if v_limite is not null and (
    select count(*) from public.espacios_compartidos where creado_por = auth.uid()
  ) >= v_limite then
    raise exception 'Tu plan Normal incluye un espacio compartido. Pásate a Premium para crear más.' using errcode = 'P0001';
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
  select limite_integrantes_por_espacio into v_limite
    from public.planes_suscripcion
   where codigo = v_plan and activo = true;

  if v_limite is not null and (
    select count(*) from public.espacios_integrantes where espacio_id = invitacion.espacio_id
  ) >= v_limite then
    raise exception 'Este espacio ya llegó al límite de integrantes del plan Normal.' using errcode = 'P0001';
  end if;

  insert into public.espacios_integrantes(espacio_id, user_id, rol, nombre, emoji)
  values (invitacion.espacio_id, auth.uid(), 'integrante', coalesce(nullif(trim(nombre_integrante), ''), 'Pareja'), coalesce(nullif(emoji_integrante, ''), '🙂'))
  on conflict (espacio_id, user_id) do nothing;
  update public.invitaciones_compartidas set estado = 'aceptada' where id = invitacion.id;
  return invitacion.espacio_id;
end;
$$;

revoke all on function public.crear_espacio_compartido(text, text, text) from public;
revoke all on function public.aceptar_invitacion_compartida(uuid, text, text) from public;
grant execute on function public.crear_espacio_compartido(text, text, text) to authenticated;
grant execute on function public.aceptar_invitacion_compartida(uuid, text, text) to authenticated;
