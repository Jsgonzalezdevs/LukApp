/**
 * Rutas de planes y pagos: el plan de cada persona, el regalo Premium, el
 * checkout y el webhook de Wompi, y la facturación del superadmin.
 */
import { Router } from 'express';
import { type CodigoPlan, fechaPremiumValida, validarConfiguracionPlan } from '../suscripciones.ts';
import { type EventoWompi, centavosWompi, checksumEsperadoWompi, coincideChecksum, firmaIntegridadWompi } from '../wompi.ts';
import { type FilaBeneficioPlan, type IntentoPagoWompi, beneficiosCompatiblesConVersionAnterior, beneficiosDePlan, configuracionWompiLista, esColumnaRegaloPendiente, esMigracionCatalogoPendiente, estadoIntentoDesdeWompi, estadoPlanDe, leerTransaccionWompi, limitesDePlan, vencimientoPremium } from '../planes.ts';
import { clienteAdmin, esRegistro, exigirAdmin, exigirPermiso, exigirUsuario, registrarAuditoria } from '../nucleo.ts';
import { diasDeRegalo } from '../../src/features/lukapp/lib/regaloPremium.ts';
import { randomBytes } from 'node:crypto';

export const rutasPagos = Router();

// ----------------------------------------------------------------------
// PLANES, SUSCRIPCIONES Y FACTURACIÓN
// ----------------------------------------------------------------------
// Estas rutas son la única puerta HTTP hacia las tablas de Freemium. No se
// publican políticas RLS para ellas: así un navegador jamás puede alterar un
// cupo, una vigencia o un cobro llamando directamente a Supabase.
rutasPagos.get('/api/mi-plan', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const cliente = clienteAdmin();
  if (!token) return res.status(401).json({ error: 'Debes iniciar sesión para consultar tu plan.' });
  if (!cliente) return res.status(503).json({ error: 'La gestión de planes todavía no está configurada.' });

  try {
    const acceso = await exigirUsuario(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });
    return res.status(200).json(await estadoPlanDe(cliente, acceso.userId));
  } catch (error: any) {
    console.error('Error consultando el plan propio:', error);
    return res.status(500).json({ error: 'No se pudo consultar tu plan.' });
  }
});

// El Premium de cortesía que el equipo le dio a esta cuenta y que aún no ha
// visto celebrado. Solo cortesías manuales: un pago propio ya tiene su pantalla.
rutasPagos.get('/api/mi-plan/regalo-premium', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const cliente = clienteAdmin();
  if (!token) return res.status(401).json({ error: 'Debes iniciar sesión.' });
  if (!cliente) return res.status(200).json({ regalo: null });

  try {
    const acceso = await exigirUsuario(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });
    const consultar = (columnas: string) => cliente
      .from('suscripciones')
      .select(columnas)
      .eq('user_id', acceso.userId)
      .eq('estado', 'activa')
      .eq('origen', 'manual')
      .is('regalo_visto_en', null)
      .gt('vence_en', new Date().toISOString())
      .order('inicia_en', { ascending: false })
      .limit(1)
      .maybeSingle();
    let { data, error } = await consultar('id,inicia_en,vence_en,mensaje_regalo');
    // Si solo falta la migración del mensaje, el regalo se celebra igual, sin él.
    if (error && /mensaje_regalo/.test(error.message ?? '')) ({ data, error } = await consultar('id,inicia_en,vence_en'));
    if (error) {
      if (esColumnaRegaloPendiente(error)) return res.status(200).json({ regalo: null });
      throw new Error(error.message);
    }
    if (!data) return res.status(200).json({ regalo: null });
    const fila = data as unknown as { id: number; inicia_en: string; vence_en: string; mensaje_regalo?: string | null };
    const mensaje = typeof fila.mensaje_regalo === 'string' ? fila.mensaje_regalo.trim() : '';
    return res.status(200).json({
      regalo: {
        id: Number(fila.id),
        dias: diasDeRegalo(fila.inicia_en, fila.vence_en),
        venceEn: fila.vence_en,
        mensaje: mensaje || null,
      },
    });
  } catch (error: any) {
    console.error('Error consultando el regalo de Premium:', error);
    return res.status(500).json({ error: 'No se pudo consultar tu regalo.' });
  }
});

rutasPagos.post('/api/mi-plan/regalo-premium/:id/visto', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const cliente = clienteAdmin();
  if (!token) return res.status(401).json({ error: 'Debes iniciar sesión.' });
  if (!cliente) return res.status(503).json({ error: 'La gestión de planes todavía no está configurada.' });

  try {
    const acceso = await exigirUsuario(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'El regalo no es válido.' });
    // El filtro por user_id es el que impide marcar el regalo de otra persona:
    // esta ruta usa la llave de servicio y no pasa por las políticas de RLS.
    const { error } = await cliente
      .from('suscripciones')
      .update({ regalo_visto_en: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', acceso.userId)
      .eq('origen', 'manual')
      .is('regalo_visto_en', null);
    if (error && !esColumnaRegaloPendiente(error)) throw new Error(error.message);
    return res.status(204).end();
  } catch (error: any) {
    console.error('Error marcando el regalo de Premium como visto:', error);
    return res.status(500).json({ error: 'No se pudo guardar que viste tu regalo.' });
  }
});

// El navegador jamás elige precio, referencia ni firma. Esta ruta relee el
// Premium desde PostgreSQL, crea (o recupera) una intención de 30 minutos y
// devuelve los campos exactos que el formulario GET de Web Checkout necesita.
rutasPagos.post('/api/pagos/wompi/checkout', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const cliente = clienteAdmin();
  if (!token) return res.status(401).json({ error: 'Debes iniciar sesión para pagar Premium.' });
  if (!cliente) return res.status(503).json({ error: 'La gestión de pagos todavía no está configurada.' });

  try {
    const acceso = await exigirUsuario(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });
    const ciclo = req.body?.ciclo;
    if (ciclo !== 'mensual' && ciclo !== 'anual') {
      return res.status(400).json({ error: 'Elige el ciclo mensual o anual de Premium.' });
    }

    let wompi;
    try {
      wompi = configuracionWompiLista();
    } catch (error: unknown) {
      console.error('[wompi] Configuración incompleta:', error instanceof Error ? error.message : error);
      return res.status(503).json({ error: 'Los pagos con Wompi aún no están habilitados. Inténtalo más tarde.' });
    }

    const estadoActual = await estadoPlanDe(cliente, acceso.userId);
    if (estadoActual.codigo === 'premium' && estadoActual.suscripcion) {
      return res.status(409).json({ error: 'Tu cuenta ya tiene Premium activo. No necesitas hacer otro pago ahora.' });
    }
    if (!estadoActual.beneficiosPremium.some((beneficio) => beneficio.activo)) {
      return res.status(503).json({ error: 'Premium no tiene prestaciones activas para cobrar en este momento.' });
    }

    const { data: premium, error: errorPlan } = await cliente
      .from('planes_suscripcion')
      .select('precio_mensual_cop,precio_anual_cop,activo')
      .eq('codigo', 'premium')
      .single();
    if (errorPlan || !premium || !premium.activo) {
      throw new Error(errorPlan?.message || 'Premium no está disponible para cobrar.');
    }

    const montoCop = Number(ciclo === 'mensual' ? premium.precio_mensual_cop : premium.precio_anual_cop);
    const venceCheckout = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const referenciaNueva = `LUK${ciclo === 'mensual' ? 'M' : 'A'}-${randomBytes(24).toString('hex').toUpperCase()}`;
    const { data: resultadoIntento, error: errorIntento } = await cliente.rpc('crear_intento_pago_wompi', {
      p_usuario: acceso.userId,
      p_ciclo: ciclo,
      p_monto_cop: montoCop,
      p_ambiente: wompi.ambiente,
      p_referencia: referenciaNueva,
      p_checkout_vence_en: venceCheckout,
    });
    if (errorIntento || !resultadoIntento) throw new Error(errorIntento?.message || 'No se pudo preparar el pago.');

    const intento = (Array.isArray(resultadoIntento) ? resultadoIntento[0] : resultadoIntento) as IntentoPagoWompi;
    if (intento.ciclo !== ciclo) {
      return res.status(409).json({
        error: `Ya tienes un checkout ${intento.ciclo} abierto. Termínalo o espera a que venza antes de cambiar el ciclo.`,
      });
    }
    if (intento.ambiente !== wompi.ambiente || intento.moneda !== 'COP') {
      throw new Error('La intención existente no pertenece al ambiente activo.');
    }

    const montoCentavos = centavosWompi(Number(intento.monto_cop));
    const firma = firmaIntegridadWompi(
      intento.referencia,
      montoCentavos,
      intento.checkout_vence_en,
      wompi.secretoIntegridad,
    );

    return res.status(200).json({
      destino: 'https://checkout.wompi.co/p/',
      campos: {
        'public-key': wompi.llavePublica,
        currency: 'COP',
        'amount-in-cents': String(montoCentavos),
        reference: intento.referencia,
        'signature:integrity': firma,
        'redirect-url': wompi.urlRedireccion,
        'expiration-time': intento.checkout_vence_en,
      },
    });
  } catch (error: any) {
    console.error('Error preparando checkout Wompi:', error);
    return res.status(400).json({ error: error.message || 'No se pudo iniciar el checkout de Wompi.' });
  }
});

// Wompi confirma aquí el estado final. La URL de regreso se limita a informar
// al usuario: solo este webhook, validado con el secreto de eventos y contra
// la intención interna, puede cambiar a una persona de Normal a Premium.
rutasPagos.post('/api/pagos/wompi/webhook', async (req, res) => {
  const cliente = clienteAdmin();
  if (!cliente) {
    console.error('[wompi] Webhook recibido sin cliente de Supabase configurado.');
    return res.status(503).json({ error: 'Servicio de pagos no disponible.' });
  }

  let wompi;
  try {
    wompi = configuracionWompiLista();
  } catch (error: unknown) {
    console.error('[wompi] Webhook recibido con configuración incompleta:', error instanceof Error ? error.message : error);
    return res.status(503).json({ error: 'Servicio de pagos no configurado.' });
  }

  const evento = req.body as EventoWompi;
  const firma = esRegistro(evento?.signature) ? evento.signature : null;
  const checksumCuerpo = firma?.checksum;
  const checksumCabecera = req.get('x-event-checksum');
  const esperado = checksumEsperadoWompi(evento, wompi.secretoEventos);
  if (!esperado || !coincideChecksum(esperado, checksumCuerpo)
    || (checksumCabecera !== undefined && !coincideChecksum(esperado, checksumCabecera))) {
    console.warn('[wompi] Se ignoró un webhook con firma inválida.');
    return res.status(401).json({ error: 'Firma de evento inválida.' });
  }

  // Cada cuenta de Wompi debe tener su propia URL para sandbox y producción.
  // Un evento válido del otro ambiente no puede otorgar beneficios aquí.
  if (evento.event !== 'transaction.updated' || evento.environment !== wompi.ambiente) {
    return res.status(200).json({ ok: true, ignorado: true });
  }

  const transaccion = leerTransaccionWompi(evento);
  if (!transaccion) {
    console.warn('[wompi] Evento firmado con una transacción incompleta.');
    return res.status(200).json({ ok: true, ignorado: true });
  }

  try {
    const { data: datoIntento, error: errorIntento } = await cliente
      .from('intentos_pago_wompi')
      .select('id,referencia,user_id,ciclo,monto_cop,moneda,ambiente,estado,checkout_vence_en,wompi_transaccion_id')
      .eq('referencia', transaccion.referencia)
      .maybeSingle();
    if (errorIntento) throw errorIntento;
    if (!datoIntento) {
      console.warn('[wompi] Se recibió una referencia que LukApp no creó:', transaccion.referencia);
      return res.status(200).json({ ok: true, ignorado: true });
    }

    const intento = datoIntento as IntentoPagoWompi;
    if (intento.ambiente !== wompi.ambiente
      || intento.moneda !== transaccion.moneda
      || centavosWompi(Number(intento.monto_cop)) !== transaccion.montoCentavos
      || (intento.wompi_transaccion_id && intento.wompi_transaccion_id !== transaccion.id)) {
      console.warn('[wompi] El webhook no coincide con su intención interna:', transaccion.referencia);
      return res.status(200).json({ ok: true, ignorado: true });
    }

    const ahora = new Date();
    let suscripcionId: number | null = null;
    if (transaccion.estado === 'APPROVED') {
      const { data: resultadoSuscripcion, error: errorSuscripcion } = await cliente.rpc('activar_premium_pasarela', {
        p_usuario: intento.user_id,
        p_ciclo: intento.ciclo,
        p_pasarela: 'wompi',
        p_referencia_externa: transaccion.id,
        p_valor_cobrado_cop: Number(intento.monto_cop),
        p_inicia_en: ahora.toISOString(),
        p_vence_en: vencimientoPremium(intento.ciclo, ahora),
      });
      if (errorSuscripcion || !resultadoSuscripcion) {
        throw new Error(errorSuscripcion?.message || 'No se pudo activar Premium después del pago.');
      }
      const suscripcion = Array.isArray(resultadoSuscripcion) ? resultadoSuscripcion[0] : resultadoSuscripcion;
      suscripcionId = Number((suscripcion as { id?: unknown }).id);
      if (!Number.isSafeInteger(suscripcionId) || suscripcionId <= 0) {
        throw new Error('La suscripción activada no devolvió un identificador válido.');
      }
    }

    const estado = estadoIntentoDesdeWompi(transaccion.estado);
    const esFinal = estado !== 'pendiente';
    const { error: errorActualizar } = await cliente
      .from('intentos_pago_wompi')
      .update({
        estado,
        wompi_transaccion_id: transaccion.id,
        suscripcion_id: suscripcionId,
        actualizado_en: ahora.toISOString(),
        finalizado_en: esFinal ? ahora.toISOString() : null,
      })
      .eq('id', intento.id);
    if (errorActualizar) throw errorActualizar;

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    // Un 500 hace que Wompi reintente. Es correcto para una caída de base o un
    // fallo transitorio: `activar_premium_pasarela` es idempotente por id de
    // transacción, de modo que el reintento no duplica el beneficio.
    console.error('Error procesando webhook de Wompi:', error);
    return res.status(500).json({ error: 'No se pudo registrar el evento.' });
  }
});

rutasPagos.get('/api/superadmin/facturacion', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const cliente = clienteAdmin();
  if (!token) return res.status(401).json({ error: 'No authorization header' });
  if (!cliente) return res.status(503).json({ error: 'La gestión de planes todavía no está configurada.' });

  try {
    const acceso = await exigirPermiso(cliente, token, 'ver_facturacion');
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

    const ahora = new Date().toISOString();
    const [
      { data: planes, error: errorPlanes },
      { data: suscripciones, error: errorSuscripciones },
      { data: perfil, error: errorPerfil },
      { data: beneficios, error: errorBeneficios },
    ] = await Promise.all([
      cliente
        .from('planes_suscripcion')
        .select('codigo,nombre,precio_mensual_cop,precio_anual_cop,limite_dictados_mensual,limite_asesor_ia_mensual,limite_extractos_mensual,limite_espacios_compartidos,limite_integrantes_por_espacio,activo,actualizado_en')
        .order('codigo'),
      cliente
        .from('suscripciones')
        .select('id,user_id,ciclo,origen,vence_en,cancelar_al_vencer,valor_cobrado_cop,creada_en')
        .eq('estado', 'activa')
        .lte('inicia_en', ahora)
        .gt('vence_en', ahora)
        .order('vence_en', { ascending: true }),
      cliente.from('perfiles').select('rol').eq('id', acceso.userId).single(),
      cliente.from('beneficios_plan').select('plan_codigo,clave,activo'),
    ]);
    if (errorPlanes) throw errorPlanes;
    if (errorSuscripciones) throw errorSuscripciones;
    if (errorPerfil) throw errorPerfil;
    if (errorBeneficios && !esMigracionCatalogoPendiente(errorBeneficios)) throw errorBeneficios;

    const planPremium = (planes ?? []).find((plan) => plan.codigo === 'premium');
    const activas = suscripciones ?? [];
    const mensuales = activas.filter((suscripcion) => suscripcion.ciclo === 'mensual').length;
    const anuales = activas.filter((suscripcion) => suscripcion.ciclo === 'anual').length;
    const cortesia = activas.filter((suscripcion) => suscripcion.ciclo === 'cortesia').length;
    const estimadoMensualCop = mensuales * Number(planPremium?.precio_mensual_cop ?? 0)
      + anuales * Math.round(Number(planPremium?.precio_anual_cop ?? 0) / 12);
    const esAdminFijo = perfil?.rol === 'admin';
    let wompi: { habilitada: boolean; ambiente: 'test' | 'prod' | null } = { habilitada: false, ambiente: null };
    try {
      const configuracion = configuracionWompiLista();
      wompi = { habilitada: true, ambiente: configuracion.ambiente };
    } catch {
      // La persona con permiso de facturación necesita saber si puede cobrar,
      // pero no necesita —ni debe recibir— cuál de los secretos falta.
    }

    // Un rol con "ver_facturacion" solo recibe agregados. Las identidades y
    // vigencias de cada persona las necesita el superadmin fijo para soporte,
    // pero no una persona a quien se le delegó el resumen contable.
    let detalle: Array<Record<string, unknown>> = [];
    let usuarios: Array<{ id: string; email: string; usuario: string | null }> = [];
    if (esAdminFijo) {
      const { data: perfiles, error: errorPerfiles } = await cliente
        .from('perfiles')
        .select('id,email,usuario')
        .order('email', { ascending: true });
      if (errorPerfiles) throw errorPerfiles;
      const porId = new Map((perfiles ?? []).map((persona) => [persona.id, persona]));
      detalle = activas.map((suscripcion) => ({
        ...suscripcion,
        usuario: porId.get(suscripcion.user_id) ?? null,
      }));
      usuarios = perfiles ?? [];
    }

    const usarCompatibilidad = Boolean(errorBeneficios);
    return res.status(200).json({
      planes: (planes ?? []).map((plan) => ({
        ...plan,
        beneficios: usarCompatibilidad
          ? beneficiosCompatiblesConVersionAnterior(plan.codigo as CodigoPlan, limitesDePlan(plan))
          : beneficiosDePlan(
            (beneficios ?? []) as FilaBeneficioPlan[],
            plan.codigo as CodigoPlan,
            limitesDePlan(plan),
          ),
      })),
      resumen: {
        premiumActivas: activas.length,
        mensuales,
        anuales,
        cortesia,
        estimadoMensualCop,
      },
      puedeAdministrar: esAdminFijo,
      pasarela: { codigo: 'wompi', ...wompi },
      suscripciones: detalle,
      usuarios,
    });
  } catch (error: any) {
    console.error('Error cargando facturación:', error);
    return res.status(500).json({ error: error.message || 'No se pudo cargar la facturación.' });
  }
});

rutasPagos.put('/api/superadmin/planes/:codigo', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const cliente = clienteAdmin();
  if (!token) return res.status(401).json({ error: 'No authorization header' });
  if (!cliente) return res.status(503).json({ error: 'La gestión de planes todavía no está configurada.' });

  try {
    const acceso = await exigirAdmin(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });
    const codigo = req.params.codigo;
    if (codigo !== 'normal' && codigo !== 'premium') {
      return res.status(400).json({ error: 'Solo existen los planes Normal y Premium.' });
    }

    const configuracion = validarConfiguracionPlan(req.body);
    if (!configuracion.activo) {
      return res.status(400).json({ error: 'No se puede desactivar un plan: Normal debe estar siempre disponible y Premium debe respetar beneficios vigentes.' });
    }
    if (codigo === 'normal' && (configuracion.precioMensualCop !== 0 || configuracion.precioAnualCop !== 0)) {
      return res.status(400).json({ error: 'El plan Normal debe ser gratuito para siempre.' });
    }
    if (codigo === 'premium' && (configuracion.precioMensualCop <= 0 || configuracion.precioAnualCop <= 0)) {
      return res.status(400).json({ error: 'Premium debe conservar un precio mensual y anual mayor que cero.' });
    }

    const { data, error } = await cliente.rpc('actualizar_plan_con_beneficios', {
      p_codigo: codigo,
      p_precio_mensual_cop: configuracion.precioMensualCop,
      p_precio_anual_cop: configuracion.precioAnualCop,
      p_limite_dictados_mensual: configuracion.limiteDictadosMensual,
      p_limite_asesor_ia_mensual: configuracion.limiteAsesorIaMensual,
      p_limite_extractos_mensual: configuracion.limiteExtractosMensual,
      p_limite_espacios_compartidos: configuracion.limiteEspaciosCompartidos,
      p_limite_integrantes_por_espacio: configuracion.limiteIntegrantesPorEspacio,
      p_activo: configuracion.activo,
      p_beneficios: configuracion.beneficios,
      p_actor: acceso.userId,
    });
    if (error) {
      if (esMigracionCatalogoPendiente(error)) {
        return res.status(409).json({
          error: 'La configuración de prestaciones aún se está actualizando. Aplica la migración de Premium y vuelve a intentarlo.',
          codigo: 'migracion-premium-pendiente',
        });
      }
      throw error;
    }
    const plan = Array.isArray(data) ? data[0] : data;
    await registrarAuditoria(cliente, acceso.email, 'Actualizó plan Freemium', codigo, undefined, acceso.userId);
    return res.status(200).json({ plan });
  } catch (error: any) {
    console.error('Error actualizando plan:', error);
    return res.status(400).json({ error: error.message || 'No se pudo actualizar el plan.' });
  }
});

rutasPagos.post('/api/superadmin/suscripciones/otorgar', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const cliente = clienteAdmin();
  if (!token) return res.status(401).json({ error: 'No authorization header' });
  if (!cliente) return res.status(503).json({ error: 'La gestión de planes todavía no está configurada.' });

  try {
    const acceso = await exigirAdmin(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });
    const userId = typeof req.body?.userId === 'string' ? req.body.userId : '';
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(userId)) {
      return res.status(400).json({ error: 'La cuenta seleccionada no es válida.' });
    }
    const venceEn = fechaPremiumValida(req.body?.venceEn);
    const nota = typeof req.body?.nota === 'string' ? req.body.nota.trim() : '';
    if (nota.length > 280) return res.status(400).json({ error: 'La nota puede tener máximo 280 caracteres.' });

    const { data: suscripcion, error } = await cliente.rpc('otorgar_premium_manual', {
      p_usuario: userId,
      p_vence_en: venceEn,
      p_actor: acceso.userId,
      p_nota: nota || null,
    });
    if (error) throw error;
    // La nota de la cortesía es el mensaje que la persona lee al celebrarla. Se
    // copia aparte porque `nota` cambia con cada edición interna de la vigencia.
    if (nota && suscripcion?.id) {
      const { error: errorMensaje } = await cliente
        .from('suscripciones')
        .update({ mensaje_regalo: nota })
        .eq('id', suscripcion.id);
      if (errorMensaje && !esColumnaRegaloPendiente(errorMensaje)) {
        console.error('No se guardó el mensaje del regalo de Premium:', errorMensaje.message);
      }
    }
    await registrarAuditoria(cliente, acceso.email, 'Otorgó Premium de cortesía', userId, `Hasta ${venceEn}`, acceso.userId);
    return res.status(201).json({ suscripcion });
  } catch (error: any) {
    console.error('Error otorgando Premium:', error);
    const conflictoPagoActivo = error.message === 'La cuenta ya tiene Premium pagado. Adminístralo desde la pasarela.';
    return res.status(conflictoPagoActivo ? 409 : 400).json({ error: error.message || 'No se pudo otorgar Premium.' });
  }
});

rutasPagos.patch('/api/superadmin/suscripciones/:id', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const cliente = clienteAdmin();
  if (!token) return res.status(401).json({ error: 'No authorization header' });
  if (!cliente) return res.status(503).json({ error: 'La gestión de planes todavía no está configurada.' });

  try {
    const acceso = await exigirAdmin(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'La suscripción no es válida.' });
    const venceEn = fechaPremiumValida(req.body?.venceEn);
    const nota = typeof req.body?.nota === 'string' ? req.body.nota.trim() : '';
    if (nota.length > 280) return res.status(400).json({ error: 'La nota puede tener máximo 280 caracteres.' });

    const { data: suscripcion, error } = await cliente.rpc('administrar_premium_superadmin', {
      p_suscripcion: id,
      p_accion: 'actualizar_vigencia',
      p_actor: acceso.userId,
      p_vence_en: venceEn,
      p_nota: nota || null,
    });
    if (error) throw error;
    await registrarAuditoria(cliente, acceso.email, 'Actualizó vigencia de Premium', String(id), `Hasta ${venceEn}`, acceso.userId);
    return res.status(200).json({ suscripcion });
  } catch (error: any) {
    console.error('Error actualizando vigencia de Premium:', error);
    return res.status(400).json({ error: error.message || 'No se pudo actualizar la vigencia de Premium.' });
  }
});

rutasPagos.post('/api/superadmin/suscripciones/:id/cancelar', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const cliente = clienteAdmin();
  if (!token) return res.status(401).json({ error: 'No authorization header' });
  if (!cliente) return res.status(503).json({ error: 'La gestión de planes todavía no está configurada.' });

  try {
    const acceso = await exigirAdmin(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'La suscripción no es válida.' });
    const nota = typeof req.body?.nota === 'string' ? req.body.nota.trim() : '';
    if (nota.length > 280) return res.status(400).json({ error: 'La nota puede tener máximo 280 caracteres.' });

    const { data: suscripcion, error } = await cliente.rpc('administrar_premium_superadmin', {
      p_suscripcion: id,
      p_accion: 'cancelar',
      p_actor: acceso.userId,
      p_nota: nota || null,
    });
    if (error) throw error;
    await registrarAuditoria(cliente, acceso.email, 'Retiró Premium', String(id), 'El acceso fue retirado desde Facturación; el cobro histórico se conserva.', acceso.userId);
    return res.status(200).json({ suscripcion });
  } catch (error: any) {
    console.error('Error cancelando Premium:', error);
    return res.status(400).json({ error: error.message || 'No se pudo cancelar Premium.' });
  }
});
