/**
 * Cliente único de los proveedores de IA del Asesor, los insights y los
 * extractos. Vive aparte de server.ts para que la cadena de respaldos (Groq →
 * xAI → DeepSeek → OpenAI → Gemini → Claude) se pueda leer y probar sin
 * arrastrar las rutas de Express.
 */
import { acotarHistorialAsesor } from './presupuestoAsesor.ts';
import { ordenModelosGroq } from './proveedoresIA.ts';
import {
  cuotaGroqDesdeCabeceras,
  usoDesdeRespuestaChat,
  usoDesdeRespuestaClaude,
  usoDesdeRespuestaGemini,
  type CuotaProveedorIA,
  type UsoTokensIA,
} from './usoProveedorIA.ts';

/** Evita que un proveedor lento bloquee el chat y fuerce un falso modo local. */
export const fetchConTiempoLimite = async (url: string, init: RequestInit, ms = 12000): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

export interface ConsultaIAParams {
  systemPrompt: string;
  userPrompt: string;
  history?: Array<{ role?: string; content?: string; text?: string }>;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: { type: 'json_object' };
  /** Tiempo máximo por intento de proveedor; la comprobación de disponibilidad usa uno corto. */
  timeoutMs?: number;
  /** En chats e insights prioriza el modelo económico; los extractos conservan el modelo preciso. */
  preferirEconomico?: boolean;
}

export interface ConsultaIAResult {
  texto: string;
  proveedor: string;
  modelo: string;
  fallos: string[];
  usoTokens: UsoTokensIA | null;
  cuotaProveedor: CuotaProveedorIA | null;
}

export function limpiarTextoIA(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let res = raw;
  // 1. Eliminar bloques <think>...</think> completos
  res = res.replace(/<think>[\s\S]*?<\/think>/gi, '');
  // 2. Si quedó una etiqueta <think> abierta sin cierre
  if (res.includes('<think>')) {
    res = res.replace(/<think>[\s\S]*/gi, '');
  }
  // 3. Eliminar posibles encabezados de pensamiento en inglés
  res = res.replace(/^Here('s| is) a thinking process:[\s\S]*?\n\n/i, '');
  res = res.replace(/^Thinking Process:[\s\S]*?\n\n/i, '');
  return res.trim();
}

export async function consultarModeloIA(params: ConsultaIAParams): Promise<ConsultaIAResult> {
  const {
    systemPrompt,
    userPrompt,
    history = [],
    maxTokens = 500,
    temperature = 0.6,
    responseFormat,
    timeoutMs = 12000,
    preferirEconomico = false,
  } = params;
  type RespuestaChat = { choices?: { message?: { content?: string } }[]; usage?: Record<string, unknown> };
  type RespuestaGemini = { candidates?: { content?: { parts?: { text?: string }[] } }[]; usageMetadata?: Record<string, unknown> };
  type RespuestaClaude = { content?: { text?: string }[]; usage?: Record<string, unknown> };
  const groqKey = process.env.GROQ_API_KEY;
  const grokKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const historialAcotado = acotarHistorialAsesor(history);

  const fallos: string[] = [];
  let texto = '';
  let proveedor = '';
  let modelo = 'desconocido';
  let usoTokens: UsoTokensIA | null = null;
  let cuotaProveedor: CuotaProveedorIA | null = null;

  // 1. Groq (modelos directos en español, sin volcar etiquetas de pensamiento)
  if (groqKey) {
    const modelosGroq = ordenModelosGroq(preferirEconomico);
    for (const modeloGroq of modelosGroq) {
      try {
        const bodyPayload: any = {
          model: modeloGroq.id,
          messages: [
            { role: 'system', content: systemPrompt },
            ...historialAcotado,
            { role: 'user', content: userPrompt },
          ],
          temperature,
          max_tokens: maxTokens,
          reasoning_effort: modeloGroq.esfuerzoRazonamiento,
        };
        if (responseFormat) {
          bodyPayload.response_format = responseFormat;
        }

        const pedirAGroq = () => fetchConTiempoLimite('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
          body: JSON.stringify(bodyPayload),
        }, timeoutMs);
        let res = await pedirAGroq();
        // En modo JSON Groq responde 400 (json_validate_failed) si el modelo
        // se corta o se sale del formato, y así se caían todos los modelos y
        // el Asesor quedaba "no disponible". Se reintenta en texto libre: quien
        // llama ya sabe leer una respuesta que no venga en JSON.
        if (res.status === 400 && responseFormat) {
          const detalle = await res.text().catch(() => '');
          console.error(`[ia] Groq ${modeloGroq.id} rechazó el modo JSON: ${detalle.slice(0, 300)}`);
          fallos.push(`groq-${modeloGroq.id}:400-json`);
          delete bodyPayload.response_format;
          res = await pedirAGroq();
        }
        if (res.ok) {
          const data = (await res.json()) as RespuestaChat;
          const raw = data.choices?.[0]?.message?.content || '';
          const cleaned = limpiarTextoIA(raw);
          if (cleaned) {
            texto = cleaned;
            proveedor = 'Groq';
            modelo = modeloGroq.id;
            usoTokens = usoDesdeRespuestaChat(data);
            cuotaProveedor = cuotaGroqDesdeCabeceras(res.headers);
            break;
          }
          fallos.push(`groq-${modeloGroq.id}:sin-texto`);
        } else {
          fallos.push(`groq-${modeloGroq.id}:${res.status}`);
        }
      } catch (err: any) {
        fallos.push(`groq-${modeloGroq.id}:${err.message}`);
      }
    }
  }

  // 2. xAI Grok
  if (!texto && grokKey) {
    const grokModelos = ['grok-2', 'grok-beta'];
    for (const m of grokModelos) {
      try {
        const res = await fetchConTiempoLimite('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${grokKey}` },
          body: JSON.stringify({
            model: m,
            messages: [
              { role: 'system', content: systemPrompt },
              ...historialAcotado,
              { role: 'user', content: userPrompt },
            ],
            temperature,
            max_tokens: maxTokens,
          }),
        }, timeoutMs);
        if (res.ok) {
          const data = (await res.json()) as RespuestaChat;
          const raw = data.choices?.[0]?.message?.content || '';
          const cleaned = limpiarTextoIA(raw);
          if (cleaned) {
            texto = cleaned;
            proveedor = 'xAI (Grok)';
            modelo = m;
            usoTokens = usoDesdeRespuestaChat(data);
            break;
          }
        } else {
          fallos.push(`grok-${m}:${res.status}`);
        }
      } catch (err: any) {
        fallos.push(`grok-${m}:${err.message}`);
      }
    }
  }

  // 3. DeepSeek
  if (!texto && deepseekKey) {
    try {
      const res = await fetchConTiempoLimite('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${deepseekKey}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: systemPrompt },
            ...historialAcotado,
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokens,
        }),
      }, timeoutMs);
      if (res.ok) {
        const data = (await res.json()) as RespuestaChat;
        const raw = data.choices?.[0]?.message?.content || '';
        const cleaned = limpiarTextoIA(raw);
        if (cleaned) {
          texto = cleaned;
          proveedor = 'DeepSeek';
          modelo = 'deepseek-chat';
          usoTokens = usoDesdeRespuestaChat(data);
        }
      } else {
        fallos.push(`deepseek:${res.status}`);
      }
    } catch (err: any) {
      fallos.push(`deepseek:${err.message}`);
    }
  }

  // 4. OpenAI
  if (!texto && openaiKey) {
    try {
      const res = await fetchConTiempoLimite('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            ...historialAcotado,
            { role: 'user', content: userPrompt },
          ],
          temperature,
          max_tokens: maxTokens,
          ...(responseFormat ? { response_format: responseFormat } : {}),
        }),
      }, timeoutMs);
      if (res.ok) {
        const data = (await res.json()) as RespuestaChat;
        const raw = data.choices?.[0]?.message?.content || '';
        const cleaned = limpiarTextoIA(raw);
        if (cleaned) {
          texto = cleaned;
          proveedor = 'OpenAI';
          modelo = 'gpt-4o-mini';
          usoTokens = usoDesdeRespuestaChat(data);
        }
      } else {
        fallos.push(`openai:${res.status}`);
      }
    } catch (err: any) {
      fallos.push(`openai:${err.message}`);
    }
  }

  // 5. Google Gemini
  if (!texto && geminiKey) {
    try {
      const res = await fetchConTiempoLimite(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [
            ...historialAcotado.map((mensaje) => ({
              role: mensaje.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: mensaje.content }],
            })),
            { role: 'user', parts: [{ text: userPrompt }] },
          ],
          generationConfig: { maxOutputTokens: maxTokens, temperature },
        }),
      }, timeoutMs);
      if (res.ok) {
        const data = (await res.json()) as RespuestaGemini;
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleaned = limpiarTextoIA(raw);
        if (cleaned) {
          texto = cleaned;
          proveedor = 'Google Gemini';
          modelo = 'gemini-1.5-flash';
          usoTokens = usoDesdeRespuestaGemini(data);
        }
      } else {
        fallos.push(`gemini:${res.status}`);
      }
    } catch (err: any) {
      fallos.push(`gemini:${err.message}`);
    }
  }

  // 6. Anthropic Claude
  if (!texto && anthropicKey) {
    try {
      const clRes = await fetchConTiempoLimite('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          system: systemPrompt,
          messages: [
            ...historialAcotado,
            { role: 'user', content: userPrompt },
          ],
          max_tokens: maxTokens,
        }),
      }, timeoutMs);
      if (clRes.ok) {
        const data = (await clRes.json()) as RespuestaClaude;
        const raw = data.content?.[0]?.text || '';
        const cleaned = limpiarTextoIA(raw);
        if (cleaned) {
          texto = cleaned;
          proveedor = 'Claude Haiku';
          modelo = 'claude-3-5-haiku-20241022';
          usoTokens = usoDesdeRespuestaClaude(data);
        }
      } else {
        fallos.push(`claude:${clRes.status}`);
      }
    } catch (err: any) {
      fallos.push(`claude:${err.message}`);
    }
  }

  return { texto, proveedor, modelo, fallos, usoTokens, cuotaProveedor };
}
