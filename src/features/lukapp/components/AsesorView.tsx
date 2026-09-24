import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  User,
  ThumbsUp,
  ThumbsDown,
  Copy,
  Check,
  RotateCcw,
  Volume2,
  VolumeX,
  Share2,
  History,
  Plus,
  X,
  MessageSquareText,
  Mic,
  Square,
  Loader2,
} from 'lucide-react';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useAudioFeedback } from '../hooks/useAudioFeedback';
import { useDictation } from '../hooks/useDictation';
import type { Transaction } from '../types';
import type { Cajita } from '../data/modelos';
import { responderAsesor, detectarMovimiento, type AsesorContext } from '../lib/asesorBot';
import type { EntradaMotorFinanciero } from '../lib/motorFinanciero';
import { simularPregunta } from '../lib/simulacionConversacional';
import type { ContextoParaAsesor } from '../lib/centroInteligenciaFinanciera';
import { VaquitasModal } from './VaquitasModal';
import type { ParsedTransaction } from '../lib/parseTransaction';

import type { LexicoAprendido } from '../lib/aprendizaje';
import { hacerCatalogo, type CategoriaPersonal } from '../categorias';

import { apiUrl, precalentarApi } from '../../../lib/api';
import { obtenerSupabase } from '../data/supabase';
import { bogotaDate, etiquetaConexion, type EstadoConexion } from '../lib/localDate';
import { ES_PASIVO } from '../data/modelos';
import { MascotaLuki } from './landing/MascotaLuki';

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  provider?: string;
  action?: ParsedTransaction;
  actions?: ParsedTransaction[];
  suggestions?: string[];
}

interface MemoriaIA {
  id: string;
  clave: string;
  valor: string;
  fuente: 'usuario' | 'inferida';
}

interface ConversacionIA {
  id: string;
  titulo: string;
  recordar: boolean;
  creado_en: string;
  actualizado_en: string;
}

interface MensajePersistido {
  id: string;
  rol: 'user' | 'assistant';
  texto: string;
  proveedor?: string | null;
}

interface AsesorViewProps {
  transacciones: readonly Transaction[];
  cajitas: readonly Cajita[];
  cajitasBalances: Record<string, number>;
  disponibleDiarioCop?: number;
  categorias: readonly CategoriaPersonal[];
  lexico: LexicoAprendido;
  promptInicial?: string | null;
  onLimpiarPromptInicial?: () => void;
  onCrearTransaccion?: (tx: ParsedTransaction) => void;
  entradaFinanciera?: EntradaMotorFinanciero;
  contextoParaAsesor?: ContextoParaAsesor;
}

const nuevoId = () => `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const PROBABILIDAD_LENGUA = 0.00001; // 0,001 %
export const PROBABILIDAD_LUKI_LOCO = 0.0001; // 0,01 %: una vez cada diez mil aperturas en promedio.

const IMAGENES_LUKI_ASESOR = [
  { src: '/brand/luki-nutria-saludo-transparente.png', alt: 'Luki, la mascota de LukApp, saludando' },
  { src: '/brand/luki-leyendo-transparente.webp', alt: 'Luki, la mascota de LukApp, leyendo un libro' },
  { src: '/brand/luki-escribiendo-transparente.webp', alt: 'Luki, la mascota de LukApp, tomando notas' },
  { src: '/brand/luki-abierto-transparente.webp', alt: 'Luki, la mascota de LukApp, abriendo el espacio' },
  { src: '/brand/luki-gesto-chistoso.webp', alt: 'Luki, la mascota de LukApp, haciendo un gesto chistoso' },
  { src: '/brand/luki-durmiendo-transparente.webp', alt: 'Luki, la mascota de LukApp, durmiendo' },
  { src: '/brand/luki-sorprendida-transparente.webp', alt: 'Luki, la mascota de LukApp, sorprendida' },
  { src: '/brand/luki-pensando-transparente.webp', alt: 'Luki, la mascota de LukApp, pensando' },
  { src: '/brand/luki-saltando-transparente.webp', alt: 'Luki, la mascota de LukApp, saltando de alegría' },
  { src: '/brand/luki-timida-transparente.webp', alt: 'Luki, la mascota de LukApp, haciendo un gesto tímido' },
  { src: '/brand/luki-easter-egg-lengua.webp', alt: 'Luki, la mascota de LukApp, sacando la lengua' },
] as const;

/**
 * El gesto chistoso es el Luki "loco" que el usuario descubre por casualidad,
 * no una pose habitual del asesor. La pose de lengua queda aún más escondida.
 */
export const elegirIndiceImagenLuki = (azar: number): number => {
  if (azar < PROBABILIDAD_LENGUA) return 10;
  if (azar < PROBABILIDAD_LENGUA + PROBABILIDAD_LUKI_LOCO) return 4;

  const azarComun = (azar - PROBABILIDAD_LENGUA - PROBABILIDAD_LUKI_LOCO)
    / (1 - PROBABILIDAD_LENGUA - PROBABILIDAD_LUKI_LOCO);
  if (azarComun < 0.40) return 0;
  if (azarComun < 0.48) return 1;
  if (azarComun < 0.56) return 2;
  if (azarComun < 0.64) return 3;
  if (azarComun < 0.72) return 5;
  if (azarComun < 0.78) return 6;
  if (azarComun < 0.84) return 7;
  if (azarComun < 0.90) return 8;
  return 9;
};

const MENSAJE_INICIAL: Message = {
  id: 'init',
  role: 'bot',
  text: '¡Hola! Soy tu asesor financiero personal. Puedo ayudarte a consultar tus gastos, revisar tu balance, o darte consejos sobre cómo vas este mes. ¿En qué te ayudo hoy?',
};

/** Chips para arrancar una conversación vacía — el punto de entrada más usado. */
const SUGERENCIAS_INICIALES = [
  'Dime mi resumen',
  '¿Cuánto puedo gastar?',
  '¿Debo declarar renta?',
  '¿Pagaré 4x1000 este mes?',
  'Mis suscripciones',
  'Sorpréndeme',
];

const renderMarkdownLine = (line: string) => {
  const parts = line.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
};

const limpiarTextoChat = (t: string): string => {
  if (!t) return '';
  return t
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*/gi, '')
    .replace(/^Here('s| is) a thinking process:[\s\S]*?\n\n/i, '')
    .trim();
};

/** Convierte la respuesta remota en texto seguro para mostrar en el chat. */
const extraerRespuestaIA = (respuesta: unknown): string | null => {
  if (!respuesta || typeof respuesta !== 'object') return null;
  const datos = respuesta as { text?: unknown; offline?: unknown };
  if (datos.offline || typeof datos.text !== 'string') return null;
  const texto = limpiarTextoChat(datos.text);
  return texto || null;
};

export const AsesorView: React.FC<AsesorViewProps> = ({
  transacciones,
  cajitas,
  cajitasBalances,
  disponibleDiarioCop,
  categorias,
  lexico,
  promptInicial,
  onLimpiarPromptInicial,
  onCrearTransaccion,
  entradaFinanciera,
  contextoParaAsesor,
}) => {
  const [context, setContext] = useState<AsesorContext>({ ultimoAsunto: null, ultimaFecha: null });
  const [imagenLuki] = useState(() => {
    let ultima = -1;
    try {
      ultima = Number(sessionStorage.getItem('lukapp-ultima-pose-luki'));
    } catch {
      // Algunos navegadores bloquean el almacenamiento; la selección sigue funcionando.
    }

    let indice = elegirIndiceImagenLuki(Math.random());
    for (let intento = 0; indice === ultima && intento < 20; intento += 1) {
      indice = elegirIndiceImagenLuki(Math.random());
    }
    if (indice === ultima) indice = (indice + 1) % IMAGENES_LUKI_ASESOR.length;
    try {
      sessionStorage.setItem('lukapp-ultima-pose-luki', String(indice));
    } catch {
      // La pose actual ya quedó elegida aunque no pueda persistirse.
    }

    // El saludo es la identidad principal del Asesor. Las otras poses son
    // sorpresas ocasionales; la lengua queda como easter egg auténtico.
    return IMAGENES_LUKI_ASESOR[indice];
  });
  const [messages, setMessages] = useState<Message[]>([MENSAJE_INICIAL]);
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  const [conversaciones, setConversaciones] = useState<ConversacionIA[]>([]);
  const [historialAbierto, setHistorialAbierto] = useState(false);
  const [cargandoConversacion, setCargandoConversacion] = useState(false);
  const [memoria, setMemoria] = useState<MemoriaIA[]>([]);
  const [recordar, setRecordar] = useState(true);
  const [input, setInput] = useState('');
  const [pensando, setPensando] = useState(false);
  /* Cuál es la respuesta más reciente del asesor: solo esa lleva el rebote de
     la Estrella al aparecer. */
  const haptic = useHapticFeedback();
  const audio = useAudioFeedback();
  const manejarDictadoFinal = useCallback((texto: string) => {
    const transcripcion = texto.trim();
    if (!transcripcion) return;
    setInput((actual) => [actual.trim(), transcripcion].filter(Boolean).join(' '));
  }, []);
  const dictado = useDictation(manejarDictadoFinal);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [compartidoId, setCompartidoId] = useState<string | null>(null);
  const [hablandoId, setHablandoId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Map<string, 'like' | 'dislike'>>(new Map());
  const [conexion, setConexion] = useState<EstadoConexion>('despertando');
  const [intentandoDespertar, setIntentandoDespertar] = useState(false);
  const [modalVaquitasAbierto, setModalVaquitasAbierto] = useState(false);
  const [errorIA, setErrorIA] = useState<string | null>(null);
  const [textoParaReintentar, setTextoParaReintentar] = useState<string | null>(null);
  const [validandoSesion, setValidandoSesion] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const historialRef = useRef<HTMLElement>(null);
  const peticionIARef = useRef<AbortController | null>(null);
  const cancelacionIARef = useRef<'salida' | 'tiempo' | null>(null);
  const conversacionIdRef = useRef<string | null>(null);
  const creandoConversacionRef = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    if (!historialAbierto) return;
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const foco = historialRef.current?.querySelector<HTMLElement>('button:not([disabled])');
    const cerrarConEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        setHistorialAbierto(false);
      }
    };
    document.addEventListener('keydown', cerrarConEscape);
    requestAnimationFrame(() => foco?.focus());
    return () => {
      document.removeEventListener('keydown', cerrarConEscape);
      anterior?.focus();
    };
  }, [historialAbierto]);

  useEffect(() => () => {
    cancelacionIARef.current = 'salida';
    peticionIARef.current?.abort();
    peticionIARef.current = null;
  }, []);

  const cabecerasIA = useCallback(async (): Promise<Record<string, string>> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const cliente = obtenerSupabase();
    const session = cliente ? (await cliente.auth.getSession()).data.session : null;
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    return headers;
  }, []);

  const cargarConversacion = async (conversacion: ConversacionIA, cerrarHistorial = true) => {
    setCargandoConversacion(true);
    try {
      const headers = await cabecerasIA();
      const respuesta = await fetch(apiUrl(`/api/asesor/conversaciones/${conversacion.id}/mensajes`), { headers });
      if (!respuesta.ok) throw new Error('No se pudo abrir la conversación.');
      const guardados = ((await respuesta.json()).mensajes ?? []) as MensajePersistido[];
      const recuperados: Message[] = guardados.map((mensaje) => ({
        id: mensaje.id,
        role: mensaje.rol === 'assistant' ? 'bot' : 'user',
        text: mensaje.texto,
        provider: mensaje.proveedor ?? undefined,
      }));
      setMessages(recuperados.length > 0 ? recuperados : [MENSAJE_INICIAL]);
      conversacionIdRef.current = conversacion.id;
      setConversacionId(conversacion.id);
      setRecordar(conversacion.recordar !== false);
      setContext({ ultimoAsunto: null, ultimaFecha: null });
      if (cerrarHistorial) setHistorialAbierto(false);
    } catch {
      mostrarToast('No pudimos abrir esa conversación.');
    } finally {
      setCargandoConversacion(false);
    }
  };

  const nuevaConversacion = () => {
    conversacionIdRef.current = null;
    creandoConversacionRef.current = null;
    setConversacionId(null);
    setMessages([MENSAJE_INICIAL]);
    setContext({ ultimoAsunto: null, ultimaFecha: null });
    setInput('');
    setHistorialAbierto(false);
  };

  useEffect(() => {
    let activo = true;
    const cargarPersistencia = async () => {
      try {
        const headers = await cabecerasIA();
        const [memoriaRes, conversacionesRes] = await Promise.all([
          fetch(apiUrl('/api/asesor/memoria'), { headers }),
          fetch(apiUrl('/api/asesor/conversaciones'), { headers }),
        ]);
        if (!activo) return;
        if (memoriaRes.ok) setMemoria((await memoriaRes.json()).memoria ?? []);
        if (conversacionesRes.ok) {
          const conversacionesCargadas = ((await conversacionesRes.json()).conversaciones ?? []) as ConversacionIA[];
          setConversaciones(conversacionesCargadas);
          // El historial queda listo en segundo plano; cada entrada empieza limpia.
        }
      } catch {
        // El asesor conserva su funcionamiento local aunque no haya sesión o API.
      }
    };
    void cargarPersistencia();
    return () => { activo = false; };
  }, [cabecerasIA]);

  const guardarMensaje = async (mensaje: Message) => {
    if (!recordar || !obtenerSupabase()) return;
    try {
      const headers = await cabecerasIA();
      let id = conversacionIdRef.current;
      if (!id) {
        if (!creandoConversacionRef.current) {
          creandoConversacionRef.current = (async () => {
            const nueva = await fetch(apiUrl('/api/asesor/conversaciones'), { method: 'POST', headers, body: JSON.stringify({ titulo: mensaje.text.slice(0, 70) }) });
            if (!nueva.ok) return null;
            const creada = (await nueva.json()).conversacion as ConversacionIA | undefined;
            if (!creada?.id) return null;
            conversacionIdRef.current = creada.id;
            setConversacionId(creada.id);
            setConversaciones((actuales) => [creada, ...actuales.filter((item) => item.id !== creada.id)]);
            return creada.id;
          })().finally(() => {
            creandoConversacionRef.current = null;
          });
        }
        id = await creandoConversacionRef.current;
      }
      if (!id) return;
      const guardado = await fetch(apiUrl('/api/asesor/mensajes'), { method: 'POST', headers, body: JSON.stringify({ conversacionId: id, rol: mensaje.role === 'bot' ? 'assistant' : 'user', texto: mensaje.text, proveedor: mensaje.provider }) });
      if (guardado.ok) {
        const ahora = new Date().toISOString();
        setConversaciones((actuales) => actuales
          .map((item) => item.id === id ? { ...item, actualizado_en: ahora } : item)
          .sort((a, b) => b.actualizado_en.localeCompare(a.actualizado_en)));
      }
    } catch {
      // La persistencia nunca debe bloquear una consulta.
    }
  };

  const mostrarToast = (mensaje: string) => {
    setToast(mensaje);
    setTimeout(() => {
      setToast((prev) => (prev === mensaje ? null : prev));
    }, 3000);
  };

  const alternarDictado = () => {
    if (dictado.status === 'processing') return;
    if (!dictado.supported) {
      mostrarToast('El micrófono no está disponible en este dispositivo.');
      return;
    }
    haptic.trigger(dictado.status === 'listening' ? 'light' : 'heavy');
    audio.play(dictado.status === 'listening' ? 'click' : 'warning');
    if (dictado.status === 'listening') dictado.stop();
    else dictado.start();
  };

  // Detener voz si el componente se desmonta o cambia de pestaña
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      // Precargar voces del navegador (en Chrome/Brave cargan asíncronamente)
      window.speechSynthesis.getVoices();
      const onVoicesChanged = () => window.speechSynthesis.getVoices();
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);

      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
        window.speechSynthesis.cancel();
      };
    }
  }, []);

  const handleFeedback = (msgId: string, tipo: 'like' | 'dislike') => {
    haptic.trigger('selection');
    audio.play('selection');
    setFeedback((prev) => {
      const next = new Map(prev);
      if (next.get(msgId) === tipo) {
        next.delete(msgId);
      } else {
        next.set(msgId, tipo);
      }
      return next;
    });
  };

  const handleCopiar = async (msgId: string, texto: string) => {
    try {
      await navigator.clipboard.writeText(limpiarTextoChat(texto));
      setCopiadoId(msgId);
      mostrarToast('✓ Copiado al portapapeles');
      haptic.trigger('light');
      audio.play('click');
      setTimeout(() => {
        setCopiadoId((prev) => (prev === msgId ? null : prev));
      }, 2000);
    } catch {
      mostrarToast('No se pudo copiar el texto.');
    }
  };

  const handleLeerEnVozAlta = (msgId: string, texto: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      mostrarToast('Tu navegador no soporta lectura en voz alta');
      return;
    }

    if (hablandoId === msgId) {
      window.speechSynthesis.cancel();
      setHablandoId(null);
      mostrarToast('Lectura pausada');
      return;
    }

    // Cancelar cualquier audio anterior y reanudar estado
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    const clean = limpiarTextoChat(texto);
    if (!clean) return;

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = 'es-ES';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voces = window.speechSynthesis.getVoices();
    if (voces && voces.length > 0) {
      const vozEs = voces.find((v) => v.lang.toLowerCase().startsWith('es'));
      if (vozEs) utterance.voice = vozEs;
    }

    utterance.onstart = () => {
      setHablandoId(msgId);
      mostrarToast('🔊 Leyendo consejo...');
    };

    utterance.onend = () => {
      setHablandoId((prev) => (prev === msgId ? null : prev));
    };

    utterance.onerror = (e) => {
      console.warn('Speech error:', e);
      setHablandoId((prev) => (prev === msgId ? null : prev));
    };

    setHablandoId(msgId);
    window.speechSynthesis.speak(utterance);
    haptic.trigger('light');
    audio.play('click');
  };

  const handleCompartir = async (msgId: string, texto: string) => {
    haptic.trigger('medium');
    audio.play('click');
    const clean = limpiarTextoChat(texto);
    const textoCompartir = `💡 *Consejo de mi Asesor en LukApp*:\n\n"${clean}"\n\n━━━━━━━━━━━━━━━━━━━━\n🚀 Estoy gestionando mis finanzas con *LukApp* (control de gastos por voz, metas y asistente IA).\n👉 Pruébalo gratis en: https://lukapp.app`;

    // Intentar Web Share API nativo si está disponible
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Consejo Financiero · LukApp',
          text: textoCompartir,
          url: 'https://lukapp.app',
        });
        setCompartidoId(msgId);
        mostrarToast('✨ ¡Consejo compartido con éxito!');
        setTimeout(() => setCompartidoId((prev) => (prev === msgId ? null : prev)), 2500);
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return; // Cancelado por usuario
      }
    }

    // Fallback para computadores o navegadores sin API de compartir
    try {
      await navigator.clipboard.writeText(textoCompartir);
      setCompartidoId(msgId);
      mostrarToast('📋 ¡Copiado con formato de LukApp listo para WhatsApp!');
      setTimeout(() => setCompartidoId((prev) => (prev === msgId ? null : prev)), 2500);
    } catch {
      mostrarToast('No se pudo copiar el texto');
    }
  };

  const handleRegenerar = (botMsgId: string) => {
    haptic.trigger('medium');
    audio.play('click');
    const idx = messages.findIndex((m) => m.id === botMsgId);
    if (idx === -1) return;
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        void handleSend(messages[i].text);
        return;
      }
    }
    void handleSend('Dame un resumen de mis finanzas');
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pensando]);

  const handleSendRef = useRef<(texto?: string) => Promise<void>>(async () => {});

  // Si viene un prompt inicial desde un tip o enlace externo, enviarlo de inmediato
  useEffect(() => {
    if (promptInicial && promptInicial.trim()) {
      const texto = promptInicial.trim();
      onLimpiarPromptInicial?.();
      void handleSendRef.current(texto);
    }
  }, [promptInicial, onLimpiarPromptInicial]);

  /**
   * No basta con que una llave exista en Render: el indicador solo se vuelve
   * verde después de que un proveedor responde una comprobación real. El ping
   * ligero se dispara en paralelo para que un Render dormido empiece a arrancar
   * antes de que termine de validarse la sesión.
   */
  const verificarDisponibilidadIA = useCallback(async (
    controladorExterno?: AbortController,
    respetarEstadoPosterior = false,
  ) => {
    const controlador = controladorExterno ?? new AbortController();
    const limite = window.setTimeout(() => controlador.abort(), 60_000);
    setIntentandoDespertar(true);
    setConexion('despertando');
    void precalentarApi();

    try {
      const headers = await cabecerasIA();
      if (controlador.signal.aborted) return;
      const respuesta = await fetch(apiUrl('/api/asesor-ia/disponibilidad'), {
        headers,
        cache: 'no-store',
        signal: controlador.signal,
      });
      if (!respuesta.ok) {
        setConexion((estadoActual) => (
          respetarEstadoPosterior && estadoActual !== 'despertando' ? estadoActual : 'local'
        ));
        return;
      }
      const datos = await respuesta.json();
      setConexion((estadoActual) => (
        respetarEstadoPosterior && estadoActual !== 'despertando'
          ? estadoActual
          : datos?.ia === true ? 'en-linea' : 'local'
      ));
    } catch {
      // El respaldo local sigue siendo útil, pero nunca se presenta como IA.
      if (!controlador.signal.aborted) {
        setConexion((estadoActual) => (
          respetarEstadoPosterior && estadoActual !== 'despertando' ? estadoActual : 'local'
        ));
      }
    } finally {
      window.clearTimeout(limite);
      if (!controlador.signal.aborted) setIntentandoDespertar(false);
    }
  }, [cabecerasIA]);

  useEffect(() => {
    const controlador = new AbortController();
    void verificarDisponibilidadIA(controlador, true);
    return () => controlador.abort();
  }, [verificarDisponibilidadIA]);

  // `textoDirecto` deja que un chip de sugerencia envíe su propio texto sin
  // pasar por el campo de escritura: `setInput` es asíncrono, así que
  // `setInput(sug)` seguido de `handleSend()` vería el valor VIEJO de
  // `input` por el cierre de la función — antes esto se resolvía con
  // `setTimeout` adivinando cuánto tardaba React en re-renderizar, que es
  // frágil (¿400ms? ¿y si el dispositivo es más lento?). Pasar el texto
  // directo no depende de ningún tiempo de espera.
  const handleSend = async (textoDirecto?: string, esReintento = false) => {
    const textoUsuario = (textoDirecto ?? input).trim();
    if (!textoUsuario || pensando || peticionIARef.current) return;

    const userMsg: Message = { id: nuevoId(), role: 'user', text: textoUsuario };
    if (!esReintento) {
      setMessages((prev) => [...prev, userMsg]);
      void guardarMensaje(userMsg);
    } else {
      // El primer intento ya dejó la respuesta local como respaldo. Al
      // reintentar con IA se reemplaza ese respaldo para no mostrar dos
      // diagnósticos sobre la misma pregunta.
      setMessages((prev) => {
        const ultimo = prev[prev.length - 1];
        return ultimo?.role === 'bot' ? prev.slice(0, -1) : prev;
      });
    }
    setInput('');
    setPensando(true);
    setErrorIA(null);
    setTextoParaReintentar(null);

    const controlador = new AbortController();
    peticionIARef.current = controlador;
    cancelacionIARef.current = null;
    // Una misma pregunta conserva su identidad aunque la respuesta remota se
    // pierda. Eso permite que el respaldo local quede auditado sin duplicarla
    // si Render termina la petición unos segundos después.
    const idConsulta = `asesor-${Date.now()}-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
    let encabezadosTelemetria: Record<string, string> = { 'Content-Type': 'application/json' };

    const usarRespaldoLocal = (mensajeError: string) => {
      // No esperamos esta señal ni dejamos que su fallo afecte el chat: el
      // propósito es conservar evidencia del respaldo local cuando la petición
      // original venció, fue bloqueada o perdió conectividad.
      void fetch(apiUrl('/api/asesor-ia/respaldo-local'), {
        method: 'POST',
        headers: encabezadosTelemetria,
        keepalive: true,
        body: JSON.stringify({
          idConsulta,
          prompt: textoUsuario,
          motivo: mensajeError,
        }),
      }).catch((error) => console.warn('[asesor] No se pudo enviar la telemetría del respaldo local:', error));
      setConexion('local');
      setErrorIA(mensajeError);
      setTextoParaReintentar(textoUsuario);
      const { text, newContext, action, actions, suggestions } = responderAsesor(
        textoUsuario, transacciones, cajitas, cajitasBalances, categorias, lexico, context, disponibleDiarioCop,
      );
      setContext(newContext);
      const respuestaLocal: Message = { id: nuevoId(), role: 'bot', text, action, actions, suggestions };
      setMessages((prev) => [...prev, respuestaLocal]);
      void guardarMensaje(respuestaLocal);
    };

    try {
      const simulacion = entradaFinanciera ? simularPregunta(textoUsuario, entradaFinanciera) : null;
      if (simulacion) {
        setConexion('local');
        const simulacionMsg: Message = { id: nuevoId(), role: 'bot', text: simulacion.respuesta };
        setMessages((prev) => [...prev, simulacionMsg]);
        void guardarMensaje(simulacionMsg);
        return;
      }
      // 1. Intentar llamar al Asesor con Inteligencia Artificial (LLM)
      const mesActual = bogotaDate().slice(0, 7);
      const txMes = transacciones.filter((t) => t.occurredOn.startsWith(mesActual));
      const gastosMes = txMes
        .filter((t) => t.kind === 'gasto')
        .reduce((acc, t) => acc + t.amountCop, 0);
      const ingresosMes = txMes
        .filter((t) => t.kind === 'ingreso')
        .reduce((acc, t) => acc + t.amountCop, 0);

      const legacyFinanzasContext = {
        mes: mesActual,
        gastosEsteMesCop: gastosMes,
        ingresosEsteMesCop: ingresosMes,
        balanceMesCop: ingresosMes - gastosMes,
        cuentas: cajitas
          .filter((c) => !c.archivedAt && !ES_PASIVO[c.tipo])
          .map((c) => ({
            nombre: c.nombre,
            saldoCop: cajitasBalances[c.id] ?? 0,
          })),
        deudas: cajitas
          .filter((c) => !c.archivedAt && ES_PASIVO[c.tipo])
          .map((c) => ({
            nombre: c.nombre,
            deudaCop: cajitasBalances[c.id] ?? 0,
          })),
        topCategoriasGasto: Array.from(
          txMes
            .filter((t) => t.kind === 'gasto')
            .reduce((map, t) => {
              const nombre = hacerCatalogo(categorias).de(t.category).nombre;
              map.set(nombre, (map.get(nombre) || 0) + t.amountCop);
              return map;
            }, new Map<string, number>())
            .entries(),
        )
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([cat, total]) => ({ categoria: cat, totalCop: total })),
      };

      const finanzasContext = contextoParaAsesor ?? legacyFinanzasContext;
      try {
        const esperarConsulta = <T,>(promesa: Promise<T>) => new Promise<T>((resolve, reject) => {
          const timeoutId = window.setTimeout(() => {
          cancelacionIARef.current = 'tiempo';
          controlador.abort();
            reject(new Error('La consulta tardó demasiado.'));
          }, 60_000);
          void promesa.then(resolve, reject).finally(() => window.clearTimeout(timeoutId));
        });

        const cliente = obtenerSupabase();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (cliente) {
          setValidandoSesion(true);
          const sesion = await new Promise<Awaited<ReturnType<typeof cliente.auth.getSession>>>((resolve, reject) => {
            const timeoutId = window.setTimeout(() => reject(new Error('No se pudo validar tu sesión.')), 8_000);
            void cliente.auth.getSession().then(resolve, reject).finally(() => window.clearTimeout(timeoutId));
          });
          if (sesion.data.session?.access_token) headers.Authorization = `Bearer ${sesion.data.session.access_token}`;
          setValidandoSesion(false);
        }
        encabezadosTelemetria = headers;

        const res = await esperarConsulta(fetch(apiUrl('/api/asesor-ia'), {
          method: 'POST',
          headers,
          signal: controlador.signal,
          body: JSON.stringify({
            prompt: textoUsuario,
            history: messages.slice(-5),
            finanzasContext,
            memoriaUsuario: recordar ? memoria.map((dato) => `${dato.clave}: ${dato.valor}`) : [],
            idConsulta,
          }),
        }));
        const data = typeof res.json === 'function' ? await esperarConsulta(res.json()).catch(() => null) : null;
        if (res.ok) {
          const textoRespuesta = extraerRespuestaIA(data);
          if (textoRespuesta) {
              // El modelo redacta la respuesta, pero nunca decide qué se
              // guarda: se le pasa lo que la persona dictó por la MISMA
              // puerta que usa el motor local (detectarMovimiento), que corre
              // parseTransaction de forma determinista. Si el modelo se
              // inventa un monto que no dijiste, no hay botón de confirmar —
              // solo aparece cuando el parser, no el LLM, confirma que hay un
              // movimiento real ahí.
              const deteccion = detectarMovimiento(
                textoUsuario,
                transacciones,
                cajitas,
                categorias,
                lexico,
                context,
              );
              setContext(deteccion.newContext);

              const proveedor = data && typeof data === 'object' && typeof (data as { provider?: unknown }).provider === 'string'
                ? (data as { provider: string }).provider
                : undefined;
              const botMsg: Message = {
                id: nuevoId(),
                role: 'bot',
                text: textoRespuesta,
                provider: proveedor,
                action: deteccion.propuesta?.action,
                actions: deteccion.propuesta?.actions,
              };
              setMessages((prev) => [...prev, botMsg]);
              void guardarMensaje(botMsg);
            setConexion('en-linea');
          } else {
            usarRespaldoLocal('No encontramos ningún proveedor de IA disponible.');
          }
        } else {
          const mensajeApi = data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
            ? (data as { error: string }).error
            : null;
          const mensaje = res.status === 401
            ? 'Tu sesión venció. Entra de nuevo para consultar la IA.'
            : res.status === 403
              ? mensajeApi || 'Tu plan actual no incluye esta función de IA.'
              : res.status === 429
                ? mensajeApi || 'Alcanzaste el límite de solicitudes. Intenta de nuevo en un momento.'
                : res.status >= 500
                  ? mensajeApi || 'La IA no pudo preparar tu consulta. Intenta de nuevo en unos minutos.'
                  : mensajeApi || `La IA respondió con un error (${res.status}).`;
          usarRespaldoLocal(mensaje);
        }
      } catch (error) {
          if (controlador.signal.aborted && cancelacionIARef.current !== 'tiempo') return;
          const mensaje = error instanceof Error && error.message === 'No se pudo validar tu sesión.'
            ? error.message
            : cancelacionIARef.current === 'tiempo'
              ? 'La IA tardó demasiado en responder. Puedes reintentarlo.'
              : 'No pudimos conectar con la IA. El motor local sigue disponible.';
          usarRespaldoLocal(mensaje);
        }
    } finally {
      if (peticionIARef.current === controlador) peticionIARef.current = null;
      setValidandoSesion(false);
      setPensando(false);
    }
  };
  handleSendRef.current = handleSend;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // El estado se dice tal cual es: en línea con IA, despertando, o respondiendo
  // en local. Fingir "en línea" mientras contesta el motor de reglas sería
  // mentirle a quien pregunta.
  const colorConexion =
    conexion === 'en-linea'
      ? 'var(--fin-in)'
      : conexion === 'despertando'
        ? 'var(--fin-warn)'
        : 'var(--fin-ink-faint)';

  return (
    <div className="relative flex min-h-[60vh] flex-col">
      {/* Sin cabecera propia: esta vista se abre dentro de una hoja que ya pone
          el título "Preguntar" arriba. Antes ponía otra encima que decía "Tu
          Asesor Financiero", así que se veían dos títulos seguidos diciendo casi
          lo mismo. Aquí solo queda la línea de estado, que sí aporta algo que el
          título no puede decir. */}
      <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--fin-line)] bg-[var(--fin-bg)] px-1 pb-4 pt-1">
        <button
          type="button"
          onClick={() => void verificarDisponibilidadIA()}
          disabled={intentandoDespertar}
          aria-label="Verificar disponibilidad de IA"
          title={conexion === 'en-linea' ? 'La IA respondió y está disponible. Pulsa para verificar de nuevo.' : 'Verificar disponibilidad de IA'}
          className={`flex max-w-full items-center gap-2 rounded-[var(--fin-r-pill)] px-2.5 py-1 text-[13px] transition-colors disabled:cursor-wait ${
            conexion === 'en-linea'
              ? 'bg-emerald-500/15 font-semibold text-emerald-700 dark:text-emerald-300'
              : 'text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]'
          }`}
        >
          <span
            aria-hidden="true"
            className={`inline-block h-2 w-2 shrink-0 rounded-[var(--fin-r-pill)] ${
              conexion === 'despertando' ? 'animate-pulse' : ''
            }`}
            style={{ backgroundColor: colorConexion }}
          />
          <span className="truncate">{etiquetaConexion(conexion)}</span>
        </button>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setHistorialAbierto(true)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-card-hover)] hover:text-[var(--fin-ink)]"
            title="Ver conversaciones anteriores"
            aria-label="Ver conversaciones anteriores"
          >
            <History className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={nuevaConversacion}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-card-hover)] hover:text-[var(--fin-ink)]"
            title="Nueva conversación"
            aria-label="Nueva conversación"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setRecordar((actual) => !actual)}
            className="rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--fin-ink-soft)]"
            title="Controla si el asesor guarda esta conversación"
          >
            {recordar ? 'Memoria activa' : 'Memoria apagada'}
          </button>
        </div>
      </div>

      {historialAbierto && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/45" role="dialog" aria-modal="true" aria-labelledby="historial-asesor-titulo">
          <button
            type="button"
            className="min-w-0 flex-1 cursor-default"
            onClick={() => setHistorialAbierto(false)}
            aria-label="Cerrar historial"
          />
          <section ref={historialRef} className="flex h-full w-[min(88vw,22rem)] flex-col border-l border-[var(--fin-line)] bg-[var(--fin-bg)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--fin-line)] px-4 py-4">
              <div>
                <h2 id="historial-asesor-titulo" className="text-[16px] font-semibold text-[var(--fin-ink)]">Conversaciones</h2>
                <p className="mt-0.5 text-[11px] text-[var(--fin-ink-faint)]">Tus chats guardados con el asesor</p>
              </div>
              <button
                type="button"
                onClick={() => setHistorialAbierto(false)}
                className="flex h-9 w-9 items-center justify-center rounded-[var(--fin-r-pill)] text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-3">
              <button
                type="button"
                onClick={nuevaConversacion}
                className="flex w-full items-center justify-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-4 py-2.5 text-[13px] font-semibold text-[var(--fin-on-accent)]"
              >
                <Plus className="h-4 w-4" />
                Nueva conversación
              </button>
            </div>
            <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
              {conversaciones.length === 0 ? (
                <div className="flex flex-col items-center px-5 py-12 text-center text-[var(--fin-ink-faint)]">
                  <MessageSquareText className="mb-3 h-8 w-8" />
                  <p className="text-[13px]">Todavía no tienes conversaciones guardadas.</p>
                </div>
              ) : conversaciones.map((conversacion) => (
                <button
                  type="button"
                  key={conversacion.id}
                  onClick={() => void cargarConversacion(conversacion)}
                  disabled={cargandoConversacion}
                  className={`w-full rounded-[var(--fin-r-control)] px-3 py-3 text-left transition-colors disabled:opacity-60 ${
                    conversacion.id === conversacionId
                      ? 'bg-[var(--fin-soft)] text-[var(--fin-ink)]'
                      : 'text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]'
                  }`}
                >
                  <span className="block truncate text-[13px] font-semibold">{conversacion.titulo || 'Conversación sin título'}</span>
                  <span className="mt-1 block text-[11px] text-[var(--fin-ink-faint)]">
                    {new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(conversacion.actualizado_en))}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* Antes de que exista una conversación real (solo el saludo inicial),
 un único globo de chat flotando en una pantalla ancha se ve como un
 vacío negro con una frase perdida en la esquina — es justo lo que
 se veía "muy feo". En vez de eso, un punto de partida real: el
 saludo centrado como intro, no como burbuja, y chips que arrancan
 la conversación con un clic en lugar de tener que pensar qué
 escribir primero. */}
        {messages.length === 1 ? (
          <div className="mx-auto flex max-w-lg flex-col items-center gap-2.5 py-4 text-center">
            {/* El personaje entero, no un icono: es la única pantalla con
                sitio para que se le vean las piernas, y es la primera vez que
                el usuario se encuentra con la IA. */}
            <MascotaLuki
              className="h-36 w-36 shrink-0 object-contain sm:h-40 sm:w-40 md:h-44 md:w-44 lg:h-48 lg:w-48"
              src={imagenLuki.src}
              alt={imagenLuki.alt}
              prioridad="alta"
            />
            <p className="text-[14px] leading-snug text-[var(--fin-ink-soft)]">
              {messages[0].text}
            </p>
            <div className="grid grid-cols-2 gap-2 w-full px-2">
              {SUGERENCIAS_INICIALES.map((sug) => (
                <button
                  key={sug}
                  onClick={() => handleSend(sug)}
                  disabled={pensando}
                  className="rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-3 py-1.5 text-[13px] font-semibold text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-card-hover)] disabled:opacity-50"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-6" aria-live="polite" aria-label="Conversación con el asesor">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-end gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                {/* La pastilla gris identifica al usuario; Luki acompaña las
                    respuestas del asesor como en el dashboard. */}
                {msg.role === 'user' ? (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]">
                    <User className="h-4 w-4" strokeWidth={2.5} />
                  </div>
                ) : (
                  <MascotaLuki
                    className="h-10 w-10 shrink-0 object-contain"
                    alt="Luki, mascota del asesor"
                  />
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-[16px] leading-relaxed break-words ${
                    msg.role === 'user'
                      ? 'rounded-br-none bg-[var(--fin-accent)] text-[var(--fin-on-accent)] font-medium'
                      : 'rounded-bl-none bg-[var(--fin-soft)] text-[var(--fin-ink)]'
                  }`}
                >
                  <div className="space-y-2">
                    {msg.text.split('\n\n').map((paragraph, pIdx) => (
                      <div key={pIdx}>
                        {paragraph.split('\n').map((line, lIdx) => (
                          <React.Fragment key={lIdx}>
                            {renderMarkdownLine(line)}
                            {lIdx !== paragraph.split('\n').length - 1 && <br />}
                          </React.Fragment>
                        ))}
                      </div>
                    ))}
                  </div>
                  {msg.action && onCrearTransaccion && (
                    <div className="mt-3 border-t border-[var(--fin-line)] pt-3">
                      <button
                        onClick={() => onCrearTransaccion(msg.action!)}
                        className="w-full rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-3 py-2 text-[13px] font-semibold text-[var(--fin-on-accent)] transition-opacity hover:opacity-90"
                      >
                        Sí, registrar gasto
                      </button>
                    </div>
                  )}
                  {msg.actions && msg.actions.length > 0 && onCrearTransaccion && (
                    <div className="mt-3 border-t border-[var(--fin-line)] pt-3 flex flex-col gap-2">
                      {msg.actions.map((act, idx) => (
                        <button
                          key={idx}
                          onClick={() => onCrearTransaccion(act)}
                          className="w-full rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-3 py-2 text-[13px] font-semibold text-[var(--fin-on-accent)] transition-opacity hover:opacity-90"
                        >
                          Sí, registrar $ {act.amount?.toLocaleString('es-CO')} en {act.category}
                        </button>
                      ))}
                    </div>
                  )}
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 pt-1">
                      {msg.suggestions.map((sug, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(sug)}
                          disabled={pensando}
                          className="rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-3 py-1.5 text-[13px] font-semibold text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-card-hover)] disabled:opacity-50"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  )}
                  {msg.role === 'bot' && (
                    <div className="mt-3 flex items-center gap-1 border-t border-[var(--fin-line)] pt-2 text-[var(--fin-ink-faint)]">
                      {/* Copiar texto */}
                      <button
                        type="button"
                        onClick={() => handleCopiar(msg.id, msg.text)}
                        className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--fin-card-hover)] hover:text-[var(--fin-ink)] active:scale-95"
                        title={copiadoId === msg.id ? 'Copiado al portapapeles' : 'Copiar respuesta'}
                        aria-label="Copiar"
                      >
                        {copiadoId === msg.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.5} />
                        ) : (
                          <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                        )}
                      </button>

                      {/* Me gusta */}
                      <button
                        type="button"
                        onClick={() => handleFeedback(msg.id, 'like')}
                        className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors active:scale-95 ${
                          feedback.get(msg.id) === 'like'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'hover:bg-[var(--fin-card-hover)] hover:text-[var(--fin-ink)]'
                        }`}
                        title="Buena respuesta"
                        aria-label="Útil"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>

                      {/* No me gusta */}
                      <button
                        type="button"
                        onClick={() => handleFeedback(msg.id, 'dislike')}
                        className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors active:scale-95 ${
                          feedback.get(msg.id) === 'dislike'
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                            : 'hover:bg-[var(--fin-card-hover)] hover:text-[var(--fin-ink)]'
                        }`}
                        title="Mala respuesta"
                        aria-label="No fue útil"
                      >
                        <ThumbsDown className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>

                      {/* Leer en voz alta */}
                      <button
                        type="button"
                        onClick={() => handleLeerEnVozAlta(msg.id, msg.text)}
                        className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors active:scale-95 ${
                          hablandoId === msg.id
                            ? 'bg-blue-500/20 text-blue-500 animate-pulse'
                            : 'hover:bg-[var(--fin-card-hover)] hover:text-[var(--fin-ink)]'
                        }`}
                        title={hablandoId === msg.id ? 'Detener lectura' : 'Leer en voz alta'}
                        aria-label={hablandoId === msg.id ? 'Detener lectura' : 'Leer en voz alta'}
                      >
                        {hablandoId === msg.id ? (
                          <VolumeX className="h-3.5 w-3.5" strokeWidth={2} />
                        ) : (
                          <Volume2 className="h-3.5 w-3.5" strokeWidth={2} />
                        )}
                      </button>

                      {/* Compartir */}
                      <button
                        type="button"
                        onClick={() => handleCompartir(msg.id, msg.text)}
                        className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--fin-card-hover)] hover:text-[var(--fin-ink)] active:scale-95"
                        title={compartidoId === msg.id ? '¡Consejo copiado con formato de LukApp!' : 'Compartir consejo de LukApp'}
                        aria-label="Compartir"
                      >
                        {compartidoId === msg.id ? (
                          <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.5} />
                        ) : (
                          <Share2 className="h-3.5 w-3.5" strokeWidth={2} />
                        )}
                      </button>

                      {/* Regenerar respuesta */}
                      <button
                        type="button"
                        onClick={() => handleRegenerar(msg.id)}
                        disabled={pensando}
                        className="flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-[var(--fin-card-hover)] hover:text-[var(--fin-ink)] active:scale-95 disabled:opacity-40"
                        title="Regenerar respuesta"
                        aria-label="Regenerar"
                      >
                        <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {pensando && (
              <div className="flex items-end gap-3">
                <MascotaLuki
                  className="h-10 w-10 shrink-0 object-contain"
                  src="/brand/luki-pensando-transparente.webp"
                  alt="Luki, pensando"
                  prioridad="alta"
                />
                <div className="flex items-center gap-2 rounded-[var(--fin-r-card)] rounded-bl-sm bg-[var(--fin-card)] px-4 py-3 text-[13px] text-[var(--fin-ink-soft)]">
                  <span className="flex gap-1">
                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-[var(--fin-r-pill)] bg-[var(--fin-ink-faint)]"
                      style={{ animationDelay: '0ms' }}
                    />
                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-[var(--fin-r-pill)] bg-[var(--fin-ink-faint)]"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="h-1.5 w-1.5 animate-bounce rounded-[var(--fin-r-pill)] bg-[var(--fin-ink-faint)]"
                      style={{ animationDelay: '300ms' }}
                    />
                  </span>
                  <span>{validandoSesion ? 'Validando tu sesión…' : 'Analizando tus finanzas...'}</span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Input */}
      {errorIA && textoParaReintentar ? (
        <div className="mx-auto mb-3 flex max-w-2xl items-center justify-between gap-3 rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-soft)] px-3 py-2 text-[12px]" role="status" aria-live="polite">
          <span className="text-[var(--fin-ink-soft)]">{errorIA}</span>
          <button
            type="button"
            className="shrink-0 rounded-[var(--fin-r-pill)] bg-[var(--fin-accent)] px-3 py-1.5 font-semibold text-[var(--fin-on-accent)]"
            onClick={() => void handleSend(textoParaReintentar, true)}
            disabled={pensando}
          >
            Reintentar con IA
          </button>
        </div>
      ) : null}
      <div className="sticky bottom-0 bg-[var(--fin-bg)] pt-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {(dictado.status === 'listening' || dictado.status === 'processing' || dictado.error) && (
          <p
            className={`mx-auto mb-2 max-w-2xl px-3 text-center text-[12px] font-medium ${
              dictado.error ? 'text-[var(--fin-out)]' : 'text-[var(--fin-ink-soft)]'
            }`}
            aria-live="polite"
          >
            {dictado.error
              ? dictado.error
              : dictado.status === 'processing'
                ? 'Transcribiendo tu pregunta…'
                : dictado.interim || 'Te escucho… toca el botón para terminar'}
          </p>
        )}
        <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] p-1.5">
          <input
            type="text"
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[17px] text-[var(--fin-ink)] border-none shadow-none !outline-none focus:!border-transparent focus:!outline-none focus:!ring-0 focus-visible:!outline-none placeholder:text-[var(--fin-ink-faint)]"
            placeholder={dictado.status === 'listening' ? 'Te escucho…' : 'Pregúntale a tu asesor...'}
            value={
              (dictado.status === 'listening' || dictado.status === 'processing') && dictado.interim
                ? dictado.interim
                : input
            }
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={dictado.status === 'listening' || dictado.status === 'processing'}
            autoFocus
          />
          <button
            type="button"
            onClick={alternarDictado}
            disabled={dictado.status === 'processing'}
            aria-pressed={dictado.status === 'listening'}
            aria-label={
              dictado.status === 'processing'
                ? 'Transcribiendo'
                : dictado.status === 'listening'
                  ? 'Dejar de escuchar'
                  : 'Dictar una pregunta'
            }
            title={dictado.status === 'listening' ? 'Terminar dictado' : 'Dictar una pregunta'}
            className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-visible rounded-[var(--fin-r-pill)] transition-all disabled:opacity-50 ${
              dictado.status === 'listening'
                ? 'bg-[var(--fin-out)] text-white'
                : 'text-[var(--fin-ink-soft)] hover:bg-[var(--fin-card-hover)] hover:text-[var(--fin-ink)]'
            }`}
          >
            {dictado.status === 'listening' && (
              <span
                aria-hidden="true"
                className="absolute inset-0 -z-10 rounded-[var(--fin-r-pill)] bg-[var(--fin-out)] opacity-25"
                style={{ transform: `scale(${1.15 + dictado.level * 0.35})` }}
              />
            )}
            {dictado.status === 'processing' ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" strokeWidth={2.5} />
            ) : dictado.status === 'listening' ? (
              <Square className="h-4 w-4" fill="currentColor" strokeWidth={2.5} />
            ) : (
              <Mic className="h-5 w-5" strokeWidth={2.5} />
            )}
          </button>
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={
              !input.trim() || dictado.status === 'listening' || dictado.status === 'processing'
            }
            aria-label="Enviar pregunta"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-accent)] text-[var(--fin-on-accent)] transition-opacity hover:opacity-90 disabled:opacity-30"
          >
            <Send className="mr-0.5 h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-[var(--fin-ink-faint)]">
          LukApp es una IA y puede cometer errores. Verifica cualquier consejo sobre dinero antes de actuar.
        </p>
      </div>

      {/* Notificación Toast flotante */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-[var(--fin-r-pill)] bg-[var(--fin-card)] border border-[var(--fin-line)] px-4 py-2 text-[12px] font-semibold text-[var(--fin-ink)] shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <span>{toast}</span>
        </div>
      )}

      {/* Modal de Vaquitas & Gastos Compartidos */}
      <VaquitasModal
        isOpen={modalVaquitasAbierto}
        onClose={() => setModalVaquitasAbierto(false)}
      />
    </div>
  );
};
