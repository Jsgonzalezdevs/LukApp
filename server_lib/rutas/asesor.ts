/**
 * Rutas de Luki: el chat del Asesor, su memoria y conversaciones, las
 * recomendaciones de Inicio, la disponibilidad de la IA, la biblioteca de
 * conocimiento y el monitor de consumo del superadmin.
 */
import { Router } from 'express';
import { CONTEXTO_PRODUCTO_LUKAPP } from '../../src/lib/contextoProductoIA.ts';
import { type ClienteAdmin, clienteAdmin, exigirAdmin, exigirConfiguracionSegura, exigirPermiso, exigirUsuario, rateLimiter } from '../nucleo.ts';
import { type FilaFinanciera, construirPerfilFinancieroCompleto, huellaPerfilFinanciero } from '../perfilAsesor.ts';
import { INSTRUCCIONES_BLOQUES_ASESOR, extraerPropuestaModelo, extraerSeguimientosModelo, interpretarRespuestaModelo, quitarDetallesInternos, quitarMontosRepetidos, serializarRespuestaVisual } from '../../src/lib/bloquesAsesor.ts';
import { LIMITE_TOKENS_DIARIOS_REFERENCIA_GROQ_GRATIS } from '../usoProveedorIA.ts';
import { MAX_CARACTERES_MEMORIA_ASESOR, MAX_CARACTERES_PERFIL_INSIGHTS, MAX_CARACTERES_PREGUNTA_ASESOR, MAX_TOKENS_RESPUESTA_ASESOR, acotarHistorialAsesor, caracteresContextoDisponibles, compactarParaIA, insightsSiguenVigentes, recortarConMuestras } from '../presupuestoAsesor.ts';
import { MAX_FILAS_TELEMETRIA_IA_HOY, asegurarDiaActualMetricas, cargarTelemetriaIADeHoy, consumoPorUsuarioDesdePeticiones, cuotaProveedorDesdeFila, metricasIA, registrarUsoIA } from '../telemetriaIA.ts';
import { RESPUESTA_TEMA_TECNICO, clasificarAlcanceAsesor } from '../../src/lib/alcanceAsesor.ts';
import { bogotaDate } from '../../src/features/lukapp/lib/localDate.ts';
import { buscarContextoDocumentalIA, envolverContextoDocumentalIA } from '../contextoDocumentalIA.ts';
import { consultarModeloIA } from '../consultaIA.ts';
import { consumirCupo, devolverCupo, estadoPlanDe } from '../planes.ts';
import { crearRutasConocimientoIA } from '../rutasConocimientoIA.ts';
import { detectarHallazgos, elegirHallazgo, esCharlaBreve, hallazgoDePregunta, seguimientosDeRespaldo } from '../hallazgoAsesor.ts';
import { guiaLukAppPara } from '../../src/lib/guiaLukApp.ts';
import { mensajeCupoAgotado } from '../suscripciones.ts';
import { resolverBloquesAsesor } from '../resolverBloquesAsesor.ts';

export const rutasAsesor = Router();

rutasAsesor.get('/api/metricas-ia', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No authorization header' });

  const cliente = clienteAdmin();
  if (!cliente) return res.status(500).json({ error: 'Falta configuración de Supabase' });

  const acceso = await exigirPermiso(cliente, token, 'ver_metricas_ia');
  if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });

  asegurarDiaActualMetricas();

  const groqKey = Boolean(process.env.GROQ_API_KEY);
  const openaiKey = Boolean(process.env.OPENAI_API_KEY);
  const geminiKey = Boolean(process.env.GEMINI_API_KEY);
  const anthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const deepseekKey = Boolean(process.env.DEEPSEEK_API_KEY);

  let proveedorPrincipal = 'Ninguno (Modo Local)';
  let modeloPrincipal = 'Motor de Reglas Heurístico';

  if (groqKey) {
    proveedorPrincipal = 'Groq Cloud';
    modeloPrincipal = 'openai/gpt-oss-120b';
  } else if (openaiKey) {
    proveedorPrincipal = 'OpenAI';
    modeloPrincipal = 'gpt-4o-mini';
  } else if (geminiKey) {
    proveedorPrincipal = 'Google Gemini';
    modeloPrincipal = 'gemini-1.5-flash';
  } else if (anthropicKey) {
    proveedorPrincipal = 'Anthropic';
    modeloPrincipal = 'claude-3-5-sonnet';
  } else if (deepseekKey) {
    proveedorPrincipal = 'DeepSeek';
    modeloPrincipal = 'deepseek-chat';
  }

  let tokensHoy = metricasIA.tokensHoy;
  let llamadasHoy = metricasIA.llamadasHoy;
  let llamadasExitosasHoy = metricasIA.llamadasExitosasHoy;
  let llamadasFallbackHoy = metricasIA.llamadasFallbackHoy;
  let latenciasMs = metricasIA.latenciasMs;
  let peticionesRecientes = metricasIA.peticionesRecientes;
  let consumoPorUsuario = consumoPorUsuarioDesdePeticiones(peticionesRecientes);
  let cuotaProveedor = metricasIA.ultimaCuotaProveedor;
  let origenMetricas: 'supabase' | 'memoria' = 'memoria';
  let diagnosticoTelemetria: string | null = null;

  // Cargar datos persistentes de Supabase si existen
  try {
    const inicioHoyIso = `${metricasIA.fechaActual}T00:00:00-05:00`;
    const { filas: filasHoy, error: errHoy, truncada } = await cargarTelemetriaIADeHoy(cliente, inicioHoyIso);

    if (errHoy) {
      diagnosticoTelemetria = `Supabase no pudo leer telemetria_ia (${errHoy.code || 'sin código'}). Ejecuta las migraciones 0013 y 20260924193346, y revisa la service role en Render.`;
      console.error('[metricas-ia] Error leyendo telemetria_ia:', { codigo: errHoy.code, mensaje: errHoy.message });
    } else if (filasHoy.length > 0) {
      origenMetricas = 'supabase';
      if (truncada) {
        diagnosticoTelemetria = `Se alcanzó el límite de ${MAX_FILAS_TELEMETRIA_IA_HOY.toLocaleString('es-CO')} consultas de hoy. El desglose necesita una consulta agregada antes de seguir creciendo.`;
      }
      llamadasHoy = filasHoy.length;
      llamadasExitosasHoy = filasHoy.filter((f) => f.exito).length;
      llamadasFallbackHoy = filasHoy.filter((f) => !f.exito).length;
      tokensHoy = filasHoy.filter((f) => f.exito).reduce((acc, f) => acc + (f.total_tokens || 0), 0);
      latenciasMs = filasHoy.filter((f) => f.exito && f.duracion_ms).map((f) => f.duracion_ms);
      peticionesRecientes = filasHoy.slice(0, 50).map((f) => ({
        id: f.id,
        timestamp: f.creado_en,
        usuarioEmail: f.usuario_email,
        proveedor: f.proveedor,
        modelo: f.modelo,
        promptTokens: f.prompt_tokens,
        completionTokens: f.completion_tokens,
        totalTokens: f.total_tokens,
        duracionMs: f.duracion_ms,
        exito: f.exito,
        motivo: f.motivo || undefined,
        promptText: f.prompt_texto || undefined,
        respuestaTexto: f.respuesta_texto || undefined,
      }));
      consumoPorUsuario = consumoPorUsuarioDesdePeticiones(peticionesRecientes.length === filasHoy.length
        ? peticionesRecientes
        : filasHoy.map((f) => ({
          id: f.id,
          timestamp: f.creado_en,
          usuarioEmail: f.usuario_email,
          proveedor: f.proveedor,
          modelo: f.modelo,
          promptTokens: f.prompt_tokens,
          completionTokens: f.completion_tokens,
          totalTokens: f.total_tokens,
          duracionMs: f.duracion_ms,
          exito: f.exito,
        })));
      cuotaProveedor = filasHoy
        .map((fila) => cuotaProveedorDesdeFila(fila))
        .find((cuota): cuota is NonNullable<typeof cuota> => cuota !== null) ?? cuotaProveedor;
    } else if (filasHoy.length === 0) {
      origenMetricas = 'supabase';
      // Si hoy aún no hay consultas, traer las más recientes para mantener el historial visible
      const { data: ultimas, error: errUltimas } = await cliente
        .from('telemetria_ia')
        .select('*')
        .order('creado_en', { ascending: false })
        .limit(50);

      if (!errUltimas && ultimas && ultimas.length > 0) {
        peticionesRecientes = ultimas.map((f) => ({
          id: f.id,
          timestamp: f.creado_en,
          usuarioEmail: f.usuario_email,
          proveedor: f.proveedor,
          modelo: f.modelo,
          promptTokens: f.prompt_tokens,
          completionTokens: f.completion_tokens,
          totalTokens: f.total_tokens,
          duracionMs: f.duracion_ms,
          exito: f.exito,
          motivo: f.motivo || undefined,
          promptText: f.prompt_texto || undefined,
          respuestaTexto: f.respuesta_texto || undefined,
        }));
        cuotaProveedor = ultimas
          .map((fila) => cuotaProveedorDesdeFila(fila))
          .find((cuota): cuota is NonNullable<typeof cuota> => cuota !== null) ?? cuotaProveedor;
      }
    }
  } catch (err) {
    diagnosticoTelemetria = 'No se pudo conectar con Supabase para leer telemetria_ia. Revisa los logs de Render.';
    console.error('[metricas-ia] Usando memoria local por error de consulta:', err);
  }

  const latenciaPromedio = latenciasMs.length > 0
    ? Math.round(latenciasMs.reduce((a, b) => a + b, 0) / latenciasMs.length)
    : 0;

  const porcentajeCapacidadTokens = cuotaProveedor?.limiteTokensMinuto && cuotaProveedor.tokensRestantesMinuto !== null
    ? Number((Math.max(0, 1 - cuotaProveedor.tokensRestantesMinuto / cuotaProveedor.limiteTokensMinuto) * 100).toFixed(2))
    : null;

  return res.status(200).json({
    success: true,
    fecha: metricasIA.fechaActual,
    proveedor: proveedorPrincipal,
    modelo: modeloPrincipal,
    hayIA: Boolean(groqKey || openaiKey || geminiKey || anthropicKey || deepseekKey),
    tokensHoy,
    limiteTokensDiariosReferencia: groqKey ? LIMITE_TOKENS_DIARIOS_REFERENCIA_GROQ_GRATIS : null,
    llamadasHoy,
    llamadasExitosas: llamadasExitosasHoy,
    llamadasFallback: llamadasFallbackHoy,
    limiteTokensProveedorMinuto: cuotaProveedor?.limiteTokensMinuto ?? null,
    tokensProveedorRestantesMinuto: cuotaProveedor?.tokensRestantesMinuto ?? null,
    limiteSolicitudesProveedorDia: cuotaProveedor?.limiteSolicitudesDia ?? null,
    solicitudesProveedorRestantesDia: cuotaProveedor?.solicitudesRestantesDia ?? null,
    porcentajeCapacidadTokens,
    cuotaProveedorObservadaEn: cuotaProveedor?.observadaEn ?? null,
    latenciaPromedioMs: latenciaPromedio,
    costoEstimadoCop: 0,
    origenMetricas,
    diagnosticoTelemetria,
    peticionesRecientes,
    consumoPorUsuario,
  });
});

export interface DisponibilidadIAComprobada {
  ia: boolean;
  proveedor: string | null;
  verificadaEn: string;
  venceEn: number;
}

export let disponibilidadIAReciente: DisponibilidadIAComprobada | null = null;
export const DURACION_DISPONIBILIDAD_IA_EN_LINEA_MS = 45_000;
export const DURACION_DISPONIBILIDAD_IA_NO_DISPONIBLE_MS = 10_000;

/**
 * Una clave configurada puede estar vencida, sin cuota o apuntar a un modelo
 * retirado. Esta prueba pide solo una palabra y su resultado se comparte unos
 * segundos para que abrir varios chats no consuma una consulta por persona.
 */
export const comprobarDisponibilidadIA = async (): Promise<DisponibilidadIAComprobada> => {
  if (disponibilidadIAReciente && disponibilidadIAReciente.venceEn > Date.now()) {
    return disponibilidadIAReciente;
  }

  const respuesta = await consultarModeloIA({
    systemPrompt: 'Responde únicamente LISTO. Esta es una comprobación interna de disponibilidad.',
    userPrompt: 'Confirma que puedes responder ahora.',
    maxTokens: 3,
    temperature: 0,
    timeoutMs: 4_000,
  });
  const ia = Boolean(respuesta.texto);
  const ahora = new Date().toISOString();
  disponibilidadIAReciente = {
    ia,
    proveedor: ia ? respuesta.proveedor : null,
    verificadaEn: ahora,
    venceEn: Date.now() + (ia ? DURACION_DISPONIBILIDAD_IA_EN_LINEA_MS : DURACION_DISPONIBILIDAD_IA_NO_DISPONIBLE_MS),
  };
  return disponibilidadIAReciente;
};

/**
 * Confirmación autenticada y sin cuota de que un modelo contestó de verdad.
 * No expone claves, modelos ni los motivos internos de cada proveedor.
 */
rutasAsesor.get('/api/asesor-ia/disponibilidad', rateLimiter(8, 60_000), async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const cliente = clienteAdmin();
  if (!exigirConfiguracionSegura(cliente, res, 'La comprobación del Asesor IA')) return;
  if (cliente && !token) {
    return res.status(401).json({ error: 'Inicia sesión para verificar el Asesor IA.' });
  }
  if (cliente && token) {
    const quienLlama = await exigirUsuario(cliente, token);
    if ('status' in quienLlama) {
      return res.status(quienLlama.status).json({ error: 'Tu sesión ya no es válida. Inicia sesión de nuevo.' });
    }
  }

  try {
    const disponibilidad = await comprobarDisponibilidadIA();
    return res.status(200).json({
      ok: true,
      ia: disponibilidad.ia,
      proveedor: disponibilidad.proveedor,
      verificadaEn: disponibilidad.verificadaEn,
    });
  } catch (error) {
    console.error('[asesor] No se pudo comprobar la disponibilidad de IA:', error);
    return res.status(200).json({ ok: true, ia: false });
  }
});

/** Persistencia del asesor: el servidor valida identidad y Supabase aplica RLS. */
rutasAsesor.get('/api/asesor/conversaciones', async (req, res) => {
  const cliente = clienteAdmin();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!cliente || !token) return res.status(401).json({ error: 'Debes iniciar sesión.' });
  const quien = await exigirUsuario(cliente, token);
  if ('status' in quien) return res.status(quien.status).json({ error: quien.error });
  const { data, error } = await cliente.from('ia_conversaciones').select('*').eq('usuario_id', quien.userId).order('actualizado_en', { ascending: false }).limit(30);
  if (error) return res.status(500).json({ error: 'No se pudieron cargar las conversaciones.' });
  return res.json({ conversaciones: data ?? [] });
});

// Lo que Luki muestra al abrir el Asesor, antes de que la persona escriba.
// Sale del expediente con reglas fijas: no llama a la IA ni gasta consultas.
rutasAsesor.get('/api/asesor/resumen-proactivo', rateLimiter(20, 60_000), async (req, res) => {
  const cliente = clienteAdmin();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!cliente || !token) return res.status(401).json({ error: 'Debes iniciar sesión.' });
  const quien = await exigirUsuario(cliente, token);
  if ('status' in quien) return res.status(quien.status).json({ error: quien.error });
  try {
    const perfil = await leerPerfilFinancieroParaIA(cliente, quien.userId);
    return res.json({ hallazgos: detectarHallazgos(perfil, bogotaDate()).slice(0, 3) });
  } catch (error) {
    console.error('[asesor] No se pudo preparar el resumen proactivo:', error);
    return res.status(503).json({ error: 'No se pudo preparar tu resumen.' });
  }
});

rutasAsesor.post('/api/asesor/conversaciones', async (req, res) => {
  const cliente = clienteAdmin();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!cliente || !token) return res.status(401).json({ error: 'Debes iniciar sesión.' });
  const quien = await exigirUsuario(cliente, token);
  if ('status' in quien) return res.status(quien.status).json({ error: quien.error });
  const titulo = typeof req.body?.titulo === 'string' ? req.body.titulo.slice(0, 120) : 'Nueva conversación';
  const { data, error } = await cliente.from('ia_conversaciones').insert({ usuario_id: quien.userId, titulo }).select().single();
  if (error) return res.status(500).json({ error: 'No se pudo crear la conversación.' });
  return res.status(201).json({ conversacion: data });
});

rutasAsesor.get('/api/asesor/conversaciones/:id/mensajes', async (req, res) => {
  const cliente = clienteAdmin();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!cliente || !token) return res.status(401).json({ error: 'Debes iniciar sesión.' });
  const quien = await exigirUsuario(cliente, token);
  if ('status' in quien) return res.status(quien.status).json({ error: quien.error });

  const { data: conversacion, error: errorConversacion } = await cliente
    .from('ia_conversaciones')
    .select('id')
    .eq('id', req.params.id)
    .eq('usuario_id', quien.userId)
    .maybeSingle();
  if (errorConversacion) return res.status(500).json({ error: 'No se pudo validar la conversación.' });
  if (!conversacion) return res.status(404).json({ error: 'Conversación no encontrada.' });

  const { data, error } = await cliente
    .from('ia_mensajes')
    .select('id,rol,texto,proveedor,creado_en')
    .eq('conversacion_id', conversacion.id)
    .eq('usuario_id', quien.userId)
    .order('creado_en', { ascending: true })
    .limit(300);
  if (error) return res.status(500).json({ error: 'No se pudieron cargar los mensajes.' });
  return res.json({ mensajes: data ?? [] });
});

rutasAsesor.post('/api/asesor/mensajes', async (req, res) => {
  const cliente = clienteAdmin();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!cliente || !token) return res.status(401).json({ error: 'Debes iniciar sesión.' });
  const quien = await exigirUsuario(cliente, token);
  if ('status' in quien) return res.status(quien.status).json({ error: quien.error });
  const { conversacionId, rol, texto, proveedor } = req.body ?? {};
  if (typeof conversacionId !== 'string' || !['user', 'assistant'].includes(rol) || typeof texto !== 'string' || !texto.trim()) return res.status(400).json({ error: 'Mensaje inválido.' });
  const { data: conversacion } = await cliente.from('ia_conversaciones').select('id').eq('id', conversacionId).eq('usuario_id', quien.userId).maybeSingle();
  if (!conversacion) return res.status(404).json({ error: 'Conversación no encontrada.' });
  const { error } = await cliente.from('ia_mensajes').insert({ conversacion_id: conversacionId, usuario_id: quien.userId, rol, texto: texto.slice(0, 12000), proveedor: typeof proveedor === 'string' ? proveedor.slice(0, 80) : null });
  if (error) return res.status(500).json({ error: 'No se pudo guardar el mensaje.' });
  await cliente.from('ia_conversaciones').update({ actualizado_en: new Date().toISOString() }).eq('id', conversacionId).eq('usuario_id', quien.userId);
  return res.status(201).json({ ok: true });
});

rutasAsesor.get('/api/asesor/memoria', async (req, res) => {
  const cliente = clienteAdmin();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!cliente || !token) return res.status(401).json({ error: 'Debes iniciar sesión.' });
  const quien = await exigirUsuario(cliente, token);
  if ('status' in quien) return res.status(quien.status).json({ error: quien.error });
  const { data, error } = await cliente.from('ia_memoria_usuario').select('id,clave,valor,fuente,activa,actualizado_en').eq('usuario_id', quien.userId).eq('activa', true).order('actualizado_en', { ascending: false });
  if (error) return res.status(500).json({ error: 'No se pudo cargar la memoria.' });
  return res.json({ memoria: data ?? [] });
});

rutasAsesor.delete('/api/asesor/memoria/:id', async (req, res) => {
  const cliente = clienteAdmin();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!cliente || !token) return res.status(401).json({ error: 'Debes iniciar sesión.' });
  const quien = await exigirUsuario(cliente, token);
  if ('status' in quien) return res.status(quien.status).json({ error: quien.error });
  const { error } = await cliente.from('ia_memoria_usuario').update({ activa: false }).eq('id', req.params.id).eq('usuario_id', quien.userId);
  if (error) return res.status(500).json({ error: 'No se pudo olvidar ese dato.' });
  return res.json({ ok: true });
});

rutasAsesor.use(crearRutasConocimientoIA({ clienteAdmin, exigirAdmin, rateLimiter }));

rutasAsesor.post('/api/asesor-ia', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const cliente = clienteAdmin();
  let sesionVerificada: { userId: string; email: string } | null = null;
  if (!exigirConfiguracionSegura(cliente, res, 'El Asesor IA')) return;
  if (cliente && !token) {
    return res.status(401).json({ error: 'Inicia sesión para usar una consulta del Asesor IA.' });
  }
  if (cliente && token) {
    const quienLlama = await exigirUsuario(cliente, token);
    if ('status' in quienLlama) {
      return res.status(quienLlama.status).json({ error: 'Tu sesión ya no es válida. Inicia sesión de nuevo.' });
    }
    sesionVerificada = quienLlama;
  }
  const { prompt, history, finanzasContext, memoriaUsuario, idConsulta, hallazgosVistos } = req.body ?? {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Falta el prompt del usuario' });
  }
  const idsHallazgosVistos = Array.isArray(hallazgosVistos)
    ? hallazgosVistos.filter((id: unknown): id is string => typeof id === 'string').slice(-30).map((id: string) => id.slice(0, 120))
    : [];
  const alcanceConsulta = clasificarAlcanceAsesor(prompt);
  if (alcanceConsulta === 'tecnica-sin-finanzas') {
    return res.status(200).json({
      success: true,
      text: RESPUESTA_TEMA_TECNICO,
      provider: 'Asesor LukApp',
      offline: false,
    });
  }
  let usuarioEmail = 'usuario_local';
  let userId = 'local_user';
  let cupoConsumido = false;
  let perfilFinancieroCompleto: Record<string, unknown> | null = null;

  if (cliente && sesionVerificada) {
    usuarioEmail = sesionVerificada.email || 'usuario';
    userId = sesionVerificada.userId;
    try {
      // En una sesión autenticada el asesor no confía en un resumen enviado
      // por el navegador: relee el historial financiero de su dueña desde el
      // servidor. El filtro user_id es obligatorio incluso con service_role.
      perfilFinancieroCompleto = await leerPerfilFinancieroParaIA(cliente, userId);

      const cupo = await consumirCupo(cliente, userId, 'asesor_ia');
      if (!cupo.permitido) {
        return res.status(429).json({ error: mensajeCupoAgotado('asesor_ia', cupo), codigo: 'cupo-agotado' });
      }
      cupoConsumido = true;
    } catch (error) {
      console.error('No se pudo verificar el cupo del Asesor:', error);
      return res.status(503).json({ error: 'No se pudo preparar tu perfil financiero. Inténtalo de nuevo.' });
    }
  }

  const identificadorConsulta = typeof idConsulta === 'string' && /^[a-zA-Z0-9_-]{8,120}$/.test(idConsulta)
    ? idConsulta
    : undefined;

  if (!cliente) {
    // Este aviso es deliberadamente explícito: el chat sigue funcionando, pero
    // el operador sabe por qué el panel no puede tener datos persistentes.
    console.error('[telemetria_ia] No hay SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY; la consulta del Asesor no podrá persistirse.');
  }

  // Sin sangría: los espacios del JSON bonito también cuentan como tokens.
  // El perfil contiene series extensas. Antes el límite era 60.000 caracteres
  // (unos 16.000 tokens), mayor que la cuota de 8.000 TPM de Groq: por eso la
  // IA rechazaba hasta saludos sencillos con HTTP 413. Se compacta también el
  // perfil del servidor para que el recorte posterior elija extremos útiles.
  const contextoCompleto = perfilFinancieroCompleto
    ? JSON.stringify(compactarParaIA(perfilFinancieroCompleto))
    : finanzasContext
      ? JSON.stringify(compactarParaIA(finanzasContext))
    : 'No hay datos financieros registrados aún.';
  const memoriaParaModelo = Array.isArray(memoriaUsuario)
    ? recortarConMuestras(
      memoriaUsuario
        .slice(0, 20)
        .map((dato: unknown) => `- ${String(dato).slice(0, 300)}`)
        .join('\n'),
      MAX_CARACTERES_MEMORIA_ASESOR,
    )
    : '';
  const preguntaParaModelo = recortarConMuestras(prompt.trim(), MAX_CARACTERES_PREGUNTA_ASESOR);
  const contextoDocumental = envolverContextoDocumentalIA(
    await buscarContextoDocumentalIA(cliente, preguntaParaModelo, ['general', 'producto', 'finanzas', 'extractos']),
  );

  // El último mensaje del usuario también cuenta: «¿y cómo lo hago?» depende
  // del tema que venía de antes.
  const ultimoDelUsuario = Array.isArray(history)
    ? [...history].reverse().find((m) => m?.role === 'user')
    : undefined;
  const guiaDetallada = guiaLukAppPara(`${preguntaParaModelo}\n${String(ultimoDelUsuario?.content ?? ultimoDelUsuario?.text ?? '').slice(0, 300)}`);

  const armarSystemPrompt = (contextoParaModelo: string) => `Eres Luki, un asesor financiero personal experto para Colombia dentro de LukApp: un amigo contador cercano, confiable y profesional.
Tu tono es cálido, humano, empático, claro y directo. Habla como un buen amigo que sabe de finanzas, sin sonar robótico, frío ni regañón.
IDIOMA OBLIGATORIO: Responde SIEMPRE 100% en ESPAÑOL (español de Colombia / latinoamericano). NUNCA respondas ni pienses en inglés.
ESTILO DIRECTO: NO incluyas etiquetas <think>, monólogos internos, introducciones ni explicaciones de tu proceso de pensamiento. Ve directo a la respuesta en español.
Tienes acceso al expediente financiero real del usuario:
${contextoParaModelo}
${memoriaParaModelo ? `
Memoria autorizada por el usuario (úsala solo para personalizar, nunca inventes datos):
${memoriaParaModelo}` : ''}

Guía verificada de LukApp para orientar sobre la aplicación:
${CONTEXTO_PRODUCTO_LUKAPP}${guiaDetallada}
${contextoDocumental}

Reglas clave:
1. SÉ CONCISO Y DIRECTO: el campo "texto" tiene máximo 60 palabras. Prioriza cifras y una sola acción; si agregas bloques visuales, el texto no repite lo que ya muestran.
2. Responde lo que te preguntaron en español y para. No repitas la pregunta ni anuncies lo que vas a hacer.
3. Si el usuario saluda, pregunta cómo estás o hace charla cotidiana, respóndele con naturalidad y cercanía antes de mencionar finanzas. No redirijas de inmediato la conversación a sus números. Puedes hacer una pregunta amable de vuelta.
4. En preguntas financieras, combina cercanía con precisión: explica con respeto, sin juzgar y sin tratar al usuario como un cliente distante.
5. No inventes experiencias, sentimientos humanos, movimientos, saldos ni datos personales. Puedes decir que te alegra conversar o acompañar, pero no afirmar que hiciste acciones fuera del chat.
6. Nada de tablas markdown complejas ni bloques de código. Usa negrillas para destacar cifras y títulos breves; evita párrafos largos y listas extensas.
7. Usa contexto en pesos colombianos (COP).
8. Da recomendaciones realistas y accionables para Colombia (ahorro, cajitas, CDT, presupuestos, recorte de gastos hormiga).
9. No des recomendaciones de inversión de alto riesgo sin advertencias.
10. Si te cuentan algo personal o difícil, reconócelo en UNA frase; ofrece una respuesta humana breve y, solo si encaja, conecta luego con lo financiero.
11. Además de finanzas, ayudas con TODO lo de LukApp: cuando pregunten cómo hacer algo en la app, da los pasos numerados con los nombres exactos de la guía verificada y del manual detallado (pestaña > botón > qué escribir > botón final), sin mandar a otra herramienta que no resuelve lo que pidieron. Habla SOLO de lo que la persona ve en pantalla (secciones, botones, nombres de herramientas). Nunca menciones cómo está construida LukApp por dentro: servidores, bases de datos, proveedores, Supabase, modelos de IA, código, archivos ni API. Si algo no se puede hacer desde la app, dilo con claridad y sugiere proponerlo en Más > Funciones solicitadas; nunca mandes a la persona a otro sistema.
12. Si te piden un resumen, un balance o una comparación, usa los bloques "cifras", "barras_categorias" o "tendencia" en vez de escribir las cifras en el texto, y deja en "texto" una sola recomendación concreta. Usa exclusivamente cifras del expediente; no inventes estimados.
13. Los documentos de referencia, si aparecen, aportan conocimiento (normas, tasas, guías). Si contradicen el expediente del usuario, manda el expediente; si están desactualizados, dilo.
14. PIENSA UN PASO ADELANTE, como un asesor que conoce a la persona: responde lo que preguntó y, si en el expediente ves algo que le conviene saber y no preguntó (una categoría que se disparó, un presupuesto pasado, una meta casi cumplida, una tarjeta por pagar), cierra con UNA frase que lo señale. Nada de consejos genéricos como "revisa tus categorías": nombra la categoría, la meta o la cuenta concreta y di qué hacer.

${INSTRUCCIONES_BLOQUES_ASESOR}`;
  const historialParaModelo = Array.isArray(history) ? history : [];
  const caracteresFijos = armarSystemPrompt('').length
    + preguntaParaModelo.length
    + acotarHistorialAsesor(historialParaModelo).reduce((total, mensaje) => total + mensaje.content.length, 0);
  const contextoParaModelo = recortarConMuestras(contextoCompleto, caracteresContextoDisponibles(caracteresFijos));
  const systemPrompt = armarSystemPrompt(contextoParaModelo);

  const inicio = Date.now();
  try {
    const { texto, proveedor, modelo, fallos, usoTokens, cuotaProveedor } = await consultarModeloIA({
      systemPrompt,
      userPrompt: preguntaParaModelo,
      history: historialParaModelo,
      // gpt-oss razona antes de escribir el JSON: con 450 se cortaba. No se
      // sube más porque Groq descuenta este techo de la cuota por minuto.
      maxTokens: MAX_TOKENS_RESPUESTA_ASESOR,
      temperature: 0.6,
      responseFormat: { type: 'json_object' },
      preferirEconomico: true,
    });
    const respuestaModelo = texto ? interpretarRespuestaModelo(texto) : null;
    const bloques = respuestaModelo ? resolverBloquesAsesor(respuestaModelo.solicitudes, perfilFinancieroCompleto) : [];
    const textoVisible = respuestaModelo ? quitarDetallesInternos(quitarMontosRepetidos(respuestaModelo.texto, bloques)) : '';
    // El hallazgo se calcula del expediente, no lo escribe el modelo: solo
    // tiene sentido con datos reales y fuera de un simple saludo.
    const charlaBreve = esCharlaBreve(prompt);
    const hoy = bogotaDate();
    // Si la pregunta es la de un hallazgo, ese ya se está respondiendo: no se
    // vuelve a mostrar como tarjeta, pero su propuesta acompaña la respuesta.
    const hallazgoRespondido = hallazgoDePregunta(perfilFinancieroCompleto, hoy, prompt);
    const hallazgo = textoVisible && !charlaBreve
      ? elegirHallazgo(perfilFinancieroCompleto, hoy, [...idsHallazgosVistos, ...(hallazgoRespondido ? [hallazgoRespondido.id] : [])], bloques)
      : null;
    const propuesta = textoVisible ? hallazgoRespondido?.propuesta ?? (texto ? extraerPropuestaModelo(texto) : null) : null;
    const seguimientosModelo = texto ? extraerSeguimientosModelo(texto, [prompt, hallazgo?.pregunta ?? '']) : [];
    const seguimientos = seguimientosModelo.length > 0 || charlaBreve
      ? seguimientosModelo
      : seguimientosDeRespaldo(bloques, hallazgo);

    const duracionMs = Date.now() - inicio;
    // Los proveedores compatibles devuelven su conteo exacto. La estimación
    // queda solo como respaldo para uno que no informe `usage`.
    const promptTokens = usoTokens?.promptTokens ?? Math.ceil((preguntaParaModelo.length + systemPrompt.length) / 3.8);
    const completionTokens = usoTokens?.completionTokens ?? Math.ceil((texto?.length || 0) / 3.8);
    const totalTokens = usoTokens?.totalTokens ?? promptTokens + completionTokens;

    if (textoVisible) {
      if (cliente) {
        await registrarUsoIA(
          {
            usuarioEmail,
            proveedor,
            modelo,
            promptTokens,
            completionTokens,
            totalTokens,
            duracionMs,
            exito: true,
            cuotaProveedor: cuotaProveedor ?? undefined,
            promptText: prompt,
            respuestaTexto: serializarRespuestaVisual({ texto: textoVisible, bloques, seguimientos, hallazgo: hallazgo ?? undefined }),
          },
          cliente,
          userId,
          identificadorConsulta,
        );
      }

      return res.status(200).json({
        success: true,
        text: textoVisible,
        bloques,
        seguimientos,
        hallazgo,
        propuesta,
        provider: proveedor,
        offline: false,
      });
    }

    const motivo = fallos.length > 0 ? fallos.join(',') : 'sin-llave-configurada';
    if (cliente) {
      await registrarUsoIA(
        {
          usuarioEmail,
          proveedor: proveedor || 'Ninguno',
          modelo: modelo || 'local',
          promptTokens,
          completionTokens: 0,
          totalTokens: promptTokens,
          duracionMs,
          exito: false,
          motivo,
          promptText: prompt,
          respuestaTexto: `[Consulta respondida por el motor local heurístico: ${motivo}]`,
        },
        cliente,
        userId,
        identificadorConsulta,
      );
    }

    console.error(`[asesor] Ningún proveedor respondió — motivo: ${motivo}`);
    if (cliente && cupoConsumido) await devolverCupo(cliente, userId, 'asesor_ia');
    return res.status(200).json({ offline: true, motivo });
  } catch (error: any) {
    console.error('Error en asesor IA:', error);
    // Un fallo inesperado del proveedor también es una consulta al Asesor. Si
    // no se registra aquí, el chat cae al respaldo local pero el monitor queda
    // congelado en una entrada antigua.
    if (cliente) {
      const duracionMs = Date.now() - inicio;
      const promptTokens = Math.ceil(((prompt?.length || 0) + contextoParaModelo.length) / 3.8);
      await registrarUsoIA({
        usuarioEmail,
        proveedor: 'Ninguno',
        modelo: 'local',
        promptTokens,
        completionTokens: 0,
        totalTokens: promptTokens,
        duracionMs,
        exito: false,
        motivo: error?.message || 'fallo-inesperado',
        promptText: prompt,
        respuestaTexto: '[Consulta atendida por el motor local tras un fallo del servicio IA]',
      }, cliente, userId, identificadorConsulta);
    }
    if (cliente && cupoConsumido) await devolverCupo(cliente, userId, 'asesor_ia');
    return res.status(200).json({ offline: true, error: error.message });
  }
});

// El navegador usa esta ruta únicamente si la pregunta ya enviada acabó en el
// motor local por timeout o un error de red. Es intencionalmente una ruta del
// Asesor (no de visitas ni de impersonación), y comparte idConsulta con la
// petición principal para que la telemetría sea idempotente.
rutasAsesor.post('/api/asesor-ia/respaldo-local', rateLimiter(12, 60000), async (req, res) => {
  const { idConsulta, prompt, respuestaTexto, motivo } = req.body ?? {};
  if (typeof idConsulta !== 'string' || !/^[a-zA-Z0-9_-]{8,120}$/.test(idConsulta)
    || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Respaldo local inválido.' });
  }

  const cliente = clienteAdmin();
  if (!cliente) {
    console.error('[telemetria_ia] No se pudo registrar respaldo local: falta configuración de Supabase.');
    return res.status(202).json({ persistida: false });
  }

  let usuarioEmail = 'usuario_local';
  let userId = 'local_user';
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const quienLlama = await exigirUsuario(cliente, token);
    if (!('status' in quienLlama)) {
      usuarioEmail = quienLlama.email || 'usuario';
      userId = quienLlama.userId;
    }
  }

  await registrarUsoIA({
    usuarioEmail,
    proveedor: 'Respaldo local',
    modelo: 'Motor de Reglas Heurístico',
    promptTokens: Math.ceil(prompt.length / 3.8),
    completionTokens: 0,
    totalTokens: Math.ceil(prompt.length / 3.8),
    duracionMs: 0,
    exito: false,
    motivo: typeof motivo === 'string' ? motivo.slice(0, 300) : 'error-cliente',
    promptText: prompt.slice(0, 12000),
    respuestaTexto: typeof respuestaTexto === 'string' && respuestaTexto.trim()
      ? respuestaTexto.trim().slice(0, 4000)
      : '[Consulta atendida por el motor local en el cliente]',
  }, cliente, userId, idConsulta);
  return res.status(202).json({ persistida: true });
});

export type InsightPersonalizado = {
  id: string;
  titulo: string;
  detalle: string;
  tono: 'neutral' | 'bien' | 'atento';
  seccion: 'mes' | 'dinero' | null;
  origenIa: true;
};

export const tonoInsight = (valor: unknown): InsightPersonalizado['tono'] =>
  valor === 'bien' || valor === 'atento' ? valor : 'neutral';

export const seccionInsight = (valor: unknown): InsightPersonalizado['seccion'] =>
  valor === 'mes' || valor === 'dinero' ? valor : null;

export const normalizarInsightsPersonalizados = (texto: string): InsightPersonalizado[] => {
  try {
    const json = texto.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    const parseado = JSON.parse(json) as unknown;
    const lista = Array.isArray(parseado)
      ? parseado
      : parseado && typeof parseado === 'object' && Array.isArray((parseado as { insights?: unknown }).insights)
        ? (parseado as { insights: unknown[] }).insights
        : [];
    return lista
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
      .map((item, indice) => ({
        id: typeof item.id === 'string' && item.id.trim() ? item.id.slice(0, 100) : `perfil-${indice}`,
        titulo: typeof item.titulo === 'string' ? item.titulo.trim().slice(0, 140) : '',
        detalle: typeof item.detalle === 'string' ? item.detalle.trim().slice(0, 300) : '',
        tono: tonoInsight(item.tono),
        seccion: seccionInsight(item.seccion),
        origenIa: true as const,
      }))
      .filter((item) => item.titulo && item.detalle)
      .slice(0, 4);
  } catch {
    return [];
  }
};

export const leerPerfilFinancieroParaIA = async (cliente: ClienteAdmin, userId: string): Promise<Record<string, unknown>> => {
  const [transacciones, cajitas, movimientosCajitas, metas, categorias, presupuestos, recurrentes] = await Promise.all([
    cliente.from('transacciones').select('*').eq('user_id', userId),
    cliente.from('cajitas').select('*').eq('user_id', userId),
    cliente.from('cajita_movimientos').select('*').eq('user_id', userId),
    cliente.from('metas').select('*').eq('user_id', userId),
    cliente.from('categorias').select('*').eq('user_id', userId),
    cliente.from('presupuestos').select('*').eq('user_id', userId),
    cliente.from('recurrentes').select('*').eq('user_id', userId),
  ]);
  const respuestas = [transacciones, cajitas, movimientosCajitas, metas, categorias, presupuestos, recurrentes];
  const error = respuestas.find((respuesta) => respuesta.error)?.error;
  if (error) throw new Error(error.message);

  return construirPerfilFinancieroCompleto({
    transacciones: (transacciones.data ?? []) as FilaFinanciera[],
    cajitas: (cajitas.data ?? []) as FilaFinanciera[],
    movimientosCajitas: (movimientosCajitas.data ?? []) as FilaFinanciera[],
    metas: (metas.data ?? []) as FilaFinanciera[],
    categorias: (categorias.data ?? []) as FilaFinanciera[],
    presupuestos: (presupuestos.data ?? []) as FilaFinanciera[],
    recurrentes: (recurrentes.data ?? []) as FilaFinanciera[],
  });
};

export const insightsGuardados = (datos: unknown, huella: string): InsightPersonalizado[] | null => {
  if (!datos || typeof datos !== 'object') return null;
  const cache = datos as { version?: unknown; huella?: unknown; insights?: unknown };
  if (cache.version !== 1 || cache.huella !== huella || !Array.isArray(cache.insights)) return null;
  const insights = cache.insights
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item, indice) => ({
      id: typeof item.id === 'string' ? item.id.slice(0, 100) : `perfil-${indice}`,
      titulo: typeof item.titulo === 'string' ? item.titulo.slice(0, 140) : '',
      detalle: typeof item.detalle === 'string' ? item.detalle.slice(0, 300) : '',
      tono: tonoInsight(item.tono),
      seccion: seccionInsight(item.seccion),
      origenIa: true as const,
    }))
    .filter((item) => item.titulo && item.detalle)
    .slice(0, 4);
  return insights.length > 0 ? insights : null;
};

// Genera sugerencias proactivas desde el expediente financiero completo de la
// cuenta autenticada. El navegador no manda el contexto ni puede escoger otro
// user_id: la API lo relee con service_role y lo limita al dueño de la sesión.
rutasAsesor.post('/api/finanzas-insights-ia', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const cliente = clienteAdmin();
  if (!token) return res.status(401).json({ error: 'Debes iniciar sesión para generar recomendaciones con IA.' });
  if (!cliente) return res.status(503).json({ error: 'No se pudo verificar tu plan para las recomendaciones con IA.' });

  let userId: string;
  let usuarioEmail = 'usuario';
  try {
    const acceso = await exigirUsuario(cliente, token);
    if ('error' in acceso) return res.status(acceso.status).json({ error: acceso.error });
    userId = acceso.userId;
    usuarioEmail = acceso.email || usuarioEmail;

    const plan = await estadoPlanDe(cliente, userId);
    if (!plan.beneficios.some((beneficio) => beneficio.clave === 'insights_ia' && beneficio.activo)) {
      return res.status(403).json({
        error: 'Las recomendaciones mensuales con IA no están incluidas en tu plan actual.',
        codigo: 'beneficio-no-incluido',
      });
    }
  } catch (error: any) {
    console.error('Error verificando Premium para los insights IA:', error);
    return res.status(503).json({ error: 'No se pudo verificar tu plan para las recomendaciones con IA.' });
  }

  let perfil: Record<string, unknown>;
  try {
    perfil = await leerPerfilFinancieroParaIA(cliente, userId);
  } catch (error: any) {
    console.error('Error cargando el perfil financiero personalizado:', error);
    return res.status(500).json({ error: 'No se pudo preparar tu perfil financiero para el Asesor.' });
  }
  const huella = huellaPerfilFinanciero(perfil);

  const { data: analisisPrevio, error: errorAnalisisPrevio } = await cliente
    .from('ia_analisis_usuario')
    .select('datos, generado_en')
    .eq('usuario_id', userId)
    .maybeSingle();
  if (errorAnalisisPrevio && !/does not exist|schema cache/i.test(errorAnalisisPrevio.message)) {
    console.error('Error leyendo el análisis personalizado guardado:', errorAnalisisPrevio.message);
  }
  const cache = insightsGuardados(analisisPrevio?.datos, huella);
  if (cache) {
    return res.status(200).json({ success: true, insights: cache, provider: 'Análisis personalizado guardado' });
  }
  // Cada gasto nuevo cambia la huella, y así un día normal de registros
  // quemaba miles de tokens en recomendaciones casi iguales. Mientras el
  // último análisis siga vigente se reutiliza; refrescar a mano lo salta.
  const forzar = req.body?.forzar === true;
  const datosPrevios = analisisPrevio?.datos as { huella?: unknown } | null | undefined;
  const reciente = !forzar && insightsSiguenVigentes(analisisPrevio?.generado_en, Date.now())
    ? insightsGuardados(analisisPrevio?.datos, typeof datosPrevios?.huella === 'string' ? datosPrevios.huella : '')
    : null;
  if (reciente) {
    return res.status(200).json({ success: true, insights: reciente, provider: 'Análisis personalizado guardado' });
  }

  const systemPrompt = `Eres el asesor financiero personal y proactivo de una persona en Colombia dentro de LukApp.
Recibes un expediente financiero detallado, construido desde el historial completo de ESA persona: movimientos recientes, tendencias de todos los meses, cuentas, deudas, tarjetas, metas, presupuestos y pagos recurrentes.
Analiza solo la información suministrada. No inventes cifras ni asumas movimientos que no aparecen. Si faltan datos, dilo con claridad. Genera entre 2 y 4 sugerencias concretas, personalizadas y accionables, sin necesidad de que la persona pregunte por chat.

Reglas obligatorias:
1. Devuelve ÚNICAMENTE un array JSON con objetos de la estructura:
[
  {
    "id": "ai-string-unico",
    "titulo": "Título corto con dato concreto o emoji",
    "detalle": "Explicación directa o recomendación pragmática con cifras en pesos colombianos (COP)",
    "tono": "neutral" | "bien" | "atento",
    "seccion": "mes" | "dinero" | null
 }
]
2. Menciona evidencia concreta cuando exista (fecha, categoría, monto, cuota o tendencia), pero no repitas datos innecesarios.
3. Prioriza riesgos de liquidez, pagos próximos, deudas, metas atrasadas, presupuestos y hábitos recurrentes antes que consejos genéricos.
4. Tono directo, empático y colombiano. Máximo 36 palabras por detalle.
5. No recomiendes inversiones de alto riesgo ni prometas resultados.`;

  // El perfil entero pesaba ~7.000 tokens: casi toda la cuota por minuto de
  // Groq en una recomendación que nadie pidió por chat.
  const perfilParaModelo = recortarConMuestras(JSON.stringify(compactarParaIA(perfil)), MAX_CARACTERES_PERFIL_INSIGHTS);
  const userPrompt = `Expediente financiero real de la persona:\n${perfilParaModelo}\n\nGenera los insights en formato JSON.`;
  const contextoDocumental = envolverContextoDocumentalIA(
    await buscarContextoDocumentalIA(cliente, 'finanzas personales presupuesto ahorro cuentas Colombia', ['general', 'finanzas'], 1, 1_500),
  );

  const inicio = Date.now();
  try {
    const { texto, proveedor, modelo, fallos, usoTokens, cuotaProveedor } = await consultarModeloIA({
      systemPrompt: `${systemPrompt}${contextoDocumental}`,
      userPrompt,
      maxTokens: 500,
      temperature: 0.75,
      preferirEconomico: true,
    });

    if (texto) {
      const insights = normalizarInsightsPersonalizados(texto);
      if (insights.length > 0) {
        const resumen = insights.map((insight) => `${insight.titulo}: ${insight.detalle}`).join('\n');
        const { error: errorGuardar } = await cliente.from('ia_analisis_usuario').upsert({
          usuario_id: userId,
          resumen,
          datos: { version: 1, huella, insights },
          generado_en: new Date().toISOString(),
        });
        if (errorGuardar) console.error('Error guardando el análisis personalizado:', errorGuardar.message);

        const promptTokens = usoTokens?.promptTokens ?? Math.ceil((userPrompt.length + systemPrompt.length) / 3.8);
        const completionTokens = usoTokens?.completionTokens ?? Math.ceil(texto.length / 3.8);
        await registrarUsoIA({
          usuarioEmail,
          proveedor,
          modelo,
          promptTokens,
          completionTokens,
          totalTokens: usoTokens?.totalTokens ?? promptTokens + completionTokens,
          duracionMs: Date.now() - inicio,
          exito: true,
          cuotaProveedor: cuotaProveedor ?? undefined,
          promptText: '[Análisis proactivo con perfil financiero completo]',
          // El SuperAdmin pinta este JSON como las mismas tarjetas que ve el usuario.
          respuestaTexto: JSON.stringify(insights.map(({ id, titulo, detalle, tono, seccion }) => ({ id, titulo, detalle, tono, seccion }))),
        }, cliente, userId);
        return res.status(200).json({
          success: true,
          insights,
          provider: proveedor,
          model: modelo,
        });
      }
    }

    return res.status(200).json({ success: false, offline: true, fallos });
  } catch (error: any) {
    console.error('Error generando insights con IA:', error);
    return res.status(200).json({ success: false, offline: true, error: error.message });
  }
});
