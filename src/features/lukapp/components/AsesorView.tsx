import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useAudioFeedback } from '../hooks/useAudioFeedback';
import type { Transaction } from '../types';
import type { Cajita } from '../data/modelos';
import { detectarMovimiento, type AsesorContext } from '../lib/asesorBot';
import type { EntradaMotorFinanciero } from '../lib/motorFinanciero';
import { simularPregunta } from '../lib/simulacionConversacional';

import { esperarConLimite } from '../lib/esperarConLimite';
import type { ContextoParaAsesor } from '../lib/centroInteligenciaFinanciera';
import { VaquitasModal } from './VaquitasModal';
import type { ParsedTransaction } from '../lib/parseTransaction';

import type { LexicoAprendido } from '../lib/aprendizaje';
import { hacerCatalogo, type CategoriaPersonal } from '../categorias';

import { apiUrl } from '../../../lib/api';
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

/** Chips para arrancar una conversación vacía — el punto de entrada más usado. */
const SUGERENCIAS_INICIALES = [
  'Dime mi resumen',
  'Quiero comparar cómo pagar mi deuda',
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
    const imagenes = [
      { src: '/brand/luki-nutria-saludo-transparente.png', alt: 'Luki, la mascota de LukApp, saludando' },
      { src: '/brand/luki-leyendo-transparente.png', alt: 'Luki, la mascota de LukApp, leyendo un libro' },
      { src: '/brand/luki-escribiendo-transparente.png', alt: 'Luki, la mascota de LukApp, tomando notas' },
      { src: '/brand/luki-abierto-transparente.png', alt: 'Luki, la mascota de LukApp, abriendo el espacio' },
      { src: '/brand/luki-gesto-chistoso.png', alt: 'Luki, la mascota de LukApp, haciendo un gesto chistoso' },
      { src: '/brand/luki-durmiendo-transparente.png', alt: 'Luki, la mascota de LukApp, durmiendo' },
      { src: '/brand/luki-sorprendida-transparente.png', alt: 'Luki, la mascota de LukApp, sorprendida' },
      { src: '/brand/luki-pensando-transparente.png', alt: 'Luki, la mascota de LukApp, pensando' },
      { src: '/brand/luki-saltando-transparente.png', alt: 'Luki, la mascota de LukApp, saltando de alegría' },
      { src: '/brand/luki-timida-transparente.png', alt: 'Luki, la mascota de LukApp, haciendo un gesto tímido' },
      { src: '/brand/luki-easter-egg-lengua.png', alt: 'Luki, la mascota de LukApp, sacando la lengua' },
    ] as const;
    let ultima = -1;
    try {
      ultima = Number(sessionStorage.getItem('lukapp-ultima-pose-luki'));
    } catch {
      // Algunos navegadores bloquean el almacenamiento; la selección sigue funcionando.
    }

    const elegirPose = () => {
      const azar = Math.random();
      if (azar < PROBABILIDAD_LENGUA) return 10;
      if (azar < 0.40) return 0;
      if (azar < 0.48) return 1;
      if (azar < 0.56) return 2;
      if (azar < 0.64) return 3;
      if (azar < 0.72) return 4;
      if (azar < 0.78) return 5;
      if (azar < 0.84) return 6;
    if (azar < 0.90) return 7;
    if (azar < 0.95) return 8;
    return 9;
    };

    let indice = elegirPose();
    for (let intento = 0; indice === ultima && intento < 20; intento += 1) {
      indice = elegirPose();
    }
    if (indice === ultima) indice = (indice + 1) % imagenes.length;
    try {
      sessionStorage.setItem('lukapp-ultima-pose-luki', String(indice));
    } catch {
      // La pose actual ya quedó elegida aunque no pueda persistirse.
    }

    // El saludo es la identidad principal del Asesor. Las otras poses son
    // sorpresas ocasionales; la lengua queda como easter egg auténtico.
    return imagenes[indice];
  });
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: 'bot',
      text: '¡Hola! Soy tu asesor financiero personal. Puedo ayudarte a consultar tus gastos, revisar tu balance, o darte consejos sobre cómo vas este mes. ¿En qué te ayudo hoy?',
    },
  ]);
  const [input, setInput] = useState('');
  const [pensando, setPensando] = useState(false);
  const [etapaConsulta, setEtapaConsulta] = useState('Validando tu sesión…');
  /* Cuál es la respuesta más reciente del asesor: solo esa lleva el rebote de
     la Estrella al aparecer. */
  const haptic = useHapticFeedback();
  const audio = useAudioFeedback();
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [compartidoId, setCompartidoId] = useState<string | null>(null);
  const [hablandoId, setHablandoId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Map<string, 'like' | 'dislike'>>(new Map());
  const [conexion, setConexion] = useState<EstadoConexion>('despertando');
  const [intentandoDespertar, setIntentandoDespertar] = useState(false);
  const [detalleConexion, setDetalleConexion] = useState<string | null>(null);
  const [reintentar, setReintentar] = useState<string | null>(null);
  const revisionConexion = useRef(0);
  const consultaOcupada = useRef(false);
  const consultaAbort = useRef<AbortController | null>(null);
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      revisionConexion.current += 1;
      consultaAbort.current?.abort();
    };
  }, []);
  const [modalVaquitasAbierto, setModalVaquitasAbierto] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const mostrarToast = (mensaje: string) => {
    setToast(mensaje);
    setTimeout(() => {
      setToast((prev) => (prev === mensaje ? null : prev));
    }, 3000);
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

  // Se pregunta por el estado al abrir el chat. La petición despierta de paso el
  // servicio, así que para cuando escribas el primer mensaje suele estar listo.
  useEffect(() => {
    let vigente = true;
    const revision = revisionConexion.current;
    const controller = new AbortController();
    const fin = Date.now() + 60000;
    const timeout = setTimeout(() => controller.abort(), 60000);
    esperarConLimite(fetch(apiUrl('/api/salud'), { signal: controller.signal, cache: 'no-store' }), 60000)
      .then((r) => (r.ok ? esperarConLimite(r.json(), Math.max(0, fin - Date.now())) : null))
      .then((d) => {
        if (vigente && revision === revisionConexion.current) {
          setConexion(d?.ia ? 'configurada' : 'local');
          setDetalleConexion(d?.ia ? null : 'El servidor no confirmó una IA configurada.');
        }
      })
      .catch(() => {
        // Sin servidor no hay IA, pero el motor local sigue respondiendo.
        if (vigente && revision === revisionConexion.current) {
          setConexion('local');
          setDetalleConexion('No se pudo conectar con el servidor. Puedes volver a intentarlo.');
        }
      }).finally(() => clearTimeout(timeout));
    return () => {
      vigente = false;
      controller.abort();
      clearTimeout(timeout);
    };
  }, []);

  // `textoDirecto` deja que un chip de sugerencia envíe su propio texto sin
  // pasar por el campo de escritura: `setInput` es asíncrono, así que
  // `setInput(sug)` seguido de `handleSend()` vería el valor VIEJO de
  // `input` por el cierre de la función — antes esto se resolvía con
  // `setTimeout` adivinando cuánto tardaba React en re-renderizar, que es
  // frágil (¿400ms? ¿y si el dispositivo es más lento?). Pasar el texto
  // directo no depende de ningún tiempo de espera.
  const handleSend = async (textoDirecto?: string, esReintento = false) => {
    const textoUsuario = (textoDirecto ?? input).trim();
    if (!textoUsuario || consultaOcupada.current) return;
    consultaOcupada.current = true;

    const userMsg: Message = { id: nuevoId(), role: 'user', text: textoUsuario };
    if (!esReintento) setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setPensando(true);
    setEtapaConsulta('Validando tu sesión…');
    revisionConexion.current += 1;
    setDetalleConexion(null);
    setReintentar(null);

    try {
      const simulacion = entradaFinanciera
        ? simularPregunta(textoUsuario, entradaFinanciera) : null;
      // 1. Intentar llamar al Asesor con Inteligencia Artificial (LLM)
      const cliente = obtenerSupabase();
      const session = cliente
        ? await esperarConLimite(cliente.auth.getSession(), 8000).then(r => r.data.session).catch(() => null)
        : null;
      if (!montado.current) return;

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

      const finanzasContext = {
        disponibleDiarioCop,
        simulacionSolicitada: simulacion?.resultado,
        ...legacyFinanzasContext,
        ...contextoParaAsesor,
        cajitas: cajitas.filter(c => c.archivedAt === null).map(c => ({
          nombre: c.nombre, tipo: c.tipo, saldoCop: cajitasBalances[c.id] ?? null,
          metaCop: c.metaCop, tasaEaPct: c.tasaEaPct,
        })),
        consultaDeuda: context.conversacionDeuda,
      };
      let respondidoPorLLM = false;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      try {
        if (cliente && !session) {
          setDetalleConexion('No pudimos validar tu sesión. Vuelve a iniciar sesión para usar la IA; tu mensaje queda pendiente.');
        } else {
        setEtapaConsulta('Esperando respuesta de la IA… puede tardar hasta un minuto.');
        const controller = new AbortController();
        const fin = Date.now() + 60000;
        consultaAbort.current = controller;
        const timeoutId = setTimeout(() => controller.abort(), 60000);
        try {
        const res = await esperarConLimite(fetch(apiUrl('/api/asesor-ia'), {
          method: 'POST',
          headers,
          signal: controller.signal,
            body: JSON.stringify({
              prompt: textoUsuario,
              history: (esReintento ? messages.slice(0, -1) : messages).slice(-12).map(({ role, text }) => ({ role, text })),
              finanzasContext,
            }),
          }), 60000);

          if (!montado.current) return;
          if (res.ok) {
            const data = await esperarConLimite(res.json(), Math.max(0, fin - Date.now()));
            if (!montado.current) return;
            const textoLimpio = typeof data?.text === 'string' ? limpiarTextoChat(data.text) : '';
            if (!data?.offline && textoLimpio) {
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
              // El modelo puede preguntar algo distinto al paso del modo local.
              // Conservamos datos, pero no asignamos su próxima respuesta breve
              // a una pregunta que el usuario no llegó a ver.
              setContext({
                ...deteccion.newContext,
                conversacionDeuda: deteccion.newContext.conversacionDeuda
                  ? { ...deteccion.newContext.conversacionDeuda, pendiente: undefined }
                  : undefined,
              });

              const botMsg: Message = {
                id: nuevoId(),
                role: 'bot',
                text: textoLimpio,
                provider: data.provider,
                action: deteccion.propuesta?.action,
                actions: deteccion.propuesta?.actions,
              };
              setMessages((prev) => [...prev, botMsg]);
              respondidoPorLLM = true;
              setConexion('en-linea');
              setDetalleConexion(null);
            }
            else {
              const motivo = typeof data?.motivo === 'string' ? data.motivo : '';
              setDetalleConexion(motivo === 'sin-llave-configurada'
                ? 'El servidor no tiene una clave de IA configurada.'
                : /:429\b/.test(motivo)
                  ? 'El proveedor de IA reportó un límite de uso o cuota. Tu mensaje queda pendiente.'
                  : /:(401|403)\b/.test(motivo)
                    ? 'El proveedor de IA rechazó el acceso del servidor. Es necesario revisar su configuración.'
                    : 'El servidor respondió, pero ningún proveedor de IA pudo completar la consulta. Puedes reintentar.');
            }
          } else {
            setDetalleConexion(res.status === 401 || res.status === 403
              ? 'La IA no pudo validar tu sesión. Vuelve a iniciar sesión e intenta de nuevo.'
              : res.status === 429
                ? 'La IA alcanzó su límite de solicitudes. Intenta de nuevo más tarde.'
                : `El servidor devolvió un error (${res.status}). No se obtuvo una respuesta de IA.`);
          }
        } finally {
          clearTimeout(timeoutId);
          consultaAbort.current = null;
        }
        }
        } catch {
          if (!montado.current) return;
          setDetalleConexion('La IA no respondió en el tiempo disponible o hubo un problema de conexión. Puedes volver a intentarlo.');
          // El error se muestra fuera de las respuestas del modelo.
        }

      if (!respondidoPorLLM) {
        setConexion('local');
        setReintentar(textoUsuario);
      }
    } catch {
      if (montado.current) {
        setConexion('local');
        setDetalleConexion('No pudimos completar esta consulta. Puedes volver a intentarlo.');
        setReintentar(textoUsuario);
      }
    } finally {
      consultaOcupada.current = false;
      if (montado.current) setPensando(false);
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
    <div className="flex min-h-[60vh] flex-col">
      {/* Sin cabecera propia: esta vista se abre dentro de una hoja que ya pone
          el título "Preguntar" arriba. Antes ponía otra encima que decía "Tu
          Asesor Financiero", así que se veían dos títulos seguidos diciendo casi
          lo mismo. Aquí solo queda la línea de estado, que sí aporta algo que el
          título no puede decir. */}
      <div className="flex items-center justify-between gap-2 pb-4">
        <p className="flex items-center gap-2 text-[13px] text-[var(--fin-ink-soft)]">
          <span
            aria-hidden="true"
            className={`inline-block h-2 w-2 shrink-0 rounded-[var(--fin-r-pill)] ${
              conexion === 'local' ? '' : 'animate-pulse'
            }`}
            style={{ backgroundColor: colorConexion }}
          />
          <span className="truncate">{etiquetaConexion(conexion)}</span>
        </p>
        <div className="flex items-center gap-2">
          {conexion === 'local' && (
            <button
              onClick={async () => {
                if (intentandoDespertar) return;
                setIntentandoDespertar(true);
                revisionConexion.current += 1;
                setDetalleConexion('Conectando con el servidor; puede tardar hasta un minuto.');

                const controller = new AbortController();
                const fin = Date.now() + 60000;
                const timeoutId = setTimeout(() => controller.abort(), 60000);
                const revision = revisionConexion.current;

                try {
                  const res = await esperarConLimite(fetch(apiUrl('/api/salud'), { signal: controller.signal, cache: 'no-store' }), 60000);
                  if (revision !== revisionConexion.current) return;

                  if (!res.ok) {
                    console.log('[asesor] Servidor retornó:', res.status);
                    setConexion('local');
                    setDetalleConexion(`No se pudo despertar el servidor (HTTP ${res.status}).`);
                    return;
                  }

                  const data = await esperarConLimite(res.json(), Math.max(0, fin - Date.now()));
                  if (revision !== revisionConexion.current) return;
                  console.log('[asesor] Servidor disponible, IA:', data?.ia);
                  setConexion(data?.ia ? 'configurada' : 'local');
                  setDetalleConexion(data?.ia ? 'El servidor está despierto. Envía una consulta para comprobar la IA.' : 'El servidor está despierto, pero no tiene un proveedor de IA configurado.');
                } catch (error) {
                  if (revision !== revisionConexion.current) return;
                  console.log('[asesor] Error despertando:', error instanceof Error ? error.message : error);
                  setConexion('local');
                  setDetalleConexion('El servidor no respondió en un minuto o hubo un error de red. Intenta de nuevo.');
                } finally {
                  clearTimeout(timeoutId);
                  setIntentandoDespertar(false);
                }
              }}
              disabled={intentandoDespertar}
              className="shrink-0 rounded-[var(--fin-r-pill)] bg-[var(--fin-accent)] px-3 py-1 text-[12px] font-semibold text-[var(--fin-on-accent)] transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-wait"
            >
              {intentandoDespertar ? 'Despertando...' : 'Despertarlo'}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {detalleConexion && <p role="status" className="px-5 pb-3 text-sm text-[var(--fin-ink-soft)]">{detalleConexion}</p>}
      {reintentar && <button type="button" disabled={pensando} onClick={() => void handleSend(reintentar, true)} className="mx-5 mb-3 rounded-lg bg-[var(--fin-accent)] px-4 py-2 text-[var(--fin-on-accent)]">Reintentar con IA</button>}
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
          <div className="mx-auto flex max-w-2xl flex-col gap-6">
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
                  alt="Luki, pensando"
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
                  <span role="status">{etapaConsulta}</span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-[var(--fin-bg)] pt-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] p-1.5">
          <input
            type="text"
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[17px] text-[var(--fin-ink)] border-none shadow-none !outline-none focus:!border-transparent focus:!outline-none focus:!ring-0 focus-visible:!outline-none placeholder:text-[var(--fin-ink-faint)]"
            placeholder="Pregúntale a tu asesor..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!input.trim()}
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
