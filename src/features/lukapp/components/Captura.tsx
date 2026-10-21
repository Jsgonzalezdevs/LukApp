import { useCapturaEscritorio } from '../hooks/useCapturaEscritorio';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Camera, Check, ChevronDown, Ear, Keyboard, Loader2, Mic, Sparkles, Star, Wallet, X } from 'lucide-react';
import type { CategoriaClave, Transaction, TxKind } from '../types';
import { etiquetaTipoCajita, type Cajita } from '../data/modelos';
import type { CategoriaPersonal } from '../categorias';
import { iconoDeCajita } from '../cajitaIconos';
import { formatAmountInput } from '../lib/formatCop';
import { parseTransaction } from '../lib/parseTransaction';
import { LEXICO_VACIO } from '../lib/aprendizaje';
import type { LexicoAprendido } from '../lib/aprendizaje';
import type { ParsedTransaction } from '../lib/parseTransaction';
import { useBloqueoScroll } from '../data/useBloqueoScroll';
import { useCatalogo } from '../catalogoContexto';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useAudioFeedback } from '../hooks/useAudioFeedback';
import { useImageOCR } from '../hooks/useImageOCR';
import { TecladoNumerico } from './TecladoNumerico';
import { AnimatedNumber } from './AnimatedNumber';
import { RippleButton } from './RippleButton';
import type { ConfirmDraft } from './ConfirmSheet';

const claveDescripcion = (texto: string): string =>
  texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('es-CO');

interface CapturaProps {
  /** Lo que el motor de texto entendió de lo que dijiste. */
  parsed: ParsedTransaction;
  cajitas?: readonly Cajita[];
  transacciones?: readonly Transaction[];
  categorias?: readonly CategoriaPersonal[];
  lexico?: LexicoAprendido;
  onSave: (draft: ConfirmDraft) => boolean | void | Promise<boolean | void>;
  onCancel: () => void;
  /** Se llama al tocar el botón de la foto del recibo. */
  onFoto?: () => void;
  /**
   * La cuenta que se usa cuando no dices ninguna.
   */
  cuentaPorDefecto?: string | null;
  /** Marca si es la primera prueba por micrófono del onboarding. */
  esPrimeraPrueba?: boolean;
  /** Descarta este intento y abre inmediatamente una nueva escucha. */
  onReintentarVoz?: () => void;
}

/**
 * La pantalla de anotar un gasto / ingreso rápido.
 *
 * Incluye selección clara de Gasto vs Ingreso, selector de cuentas/bancos con confirmación
 * obligatoria si no se especificó cuenta, y categorización automática inteligente basada en NLP.
 */
export const Captura: React.FC<CapturaProps> = ({
  parsed,
  cajitas = [],
  transacciones = [],
  categorias = [],
  lexico = LEXICO_VACIO,
  onSave,
  onCancel,
  onFoto,
  cuentaPorDefecto = null,
  esPrimeraPrueba = false,
  onReintentarVoz,
}) => {
  const escritorio = useCapturaEscritorio();
  const quieto = useReducedMotion();
  const dialogoRef = useRef<HTMLDivElement>(null);
  const montoRef = useRef<HTMLInputElement>(null);
  const focoAnterior = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const [editandoMonto, setEditandoMonto] = useState(false);
  const [mostrarTodasCategorias, setMostrarTodasCategorias] = useState(false);
  useEffect(() => {
    if (editandoMonto) montoRef.current?.focus();
    else if (!montoRef.current) dialogoRef.current?.focus();
  }, [editandoMonto]);
  useEffect(() => {
    if (!montoRef.current) dialogoRef.current?.focus();
    const mantenerFoco = (evento: FocusEvent) => {
      if (evento.target instanceof Node && !dialogoRef.current?.contains(evento.target)) dialogoRef.current?.focus();
    };
    document.addEventListener('focusin', mantenerFoco);
    const anterior = focoAnterior.current;
    return () => { document.removeEventListener('focusin', mantenerFoco); if (anterior?.isConnected) anterior.focus(); };
  }, []);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState(false);
  const guardandoRef = useRef(false);
  const [digitos, setDigitos] = useState(() =>
    parsed.amount === null ? '' : String(Math.round(parsed.amount)),
  );
  const [kind, setKind] = useState<TxKind>(parsed.kind);
  const [category, setCategory] = useState<CategoriaClave>(parsed.category);
  const [description, setDescription] = useState(parsed.description);
  const [categoriaDetectada, setCategoriaDetectada] = useState<string | null>(null);
  const [editandoTexto, setEditandoTexto] = useState(false);
  const [desplegarCuentas, setDesplegarCuentas] = useState(false);
  const [pidiendoCuenta, setPidiendoCuenta] = useState(false);
  useEffect(() => {
    if (!pidiendoCuenta) return;
    const raiz = dialogoRef.current;
    raiz?.querySelector<HTMLButtonElement>('[data-confirmar-cuenta] button')?.focus();
    return () => { if (raiz?.isConnected) raiz.focus(); };
  }, [pidiendoCuenta]);
  const [resultadoImagen, setResultadoImagen] = useState<TxKind | null>(null);

  // Una tarjeta es un medio de pago aunque su saldo sea una deuda. Incluirla
  // aquí permite que una foto de compra se cargue a la tarjeta correcta en vez
  // de descontar efectivo por accidente.
  const cuentasActivas = useMemo(
    () => cajitas.filter((c) => !c.archivedAt && (c.tipo === 'cuenta' || c.tipo === 'tarjeta')),
    [cajitas],
  );

  // Solo se preselecciona si vino explícitamente en el parseo o por defecto explícito
  const [cuentaId, setCuentaId] = useState<string | null>(() => {
    if (parsed.cuentaId && cuentasActivas.some((c) => c.id === parsed.cuentaId)) {
      return parsed.cuentaId;
    }
    if (cuentaPorDefecto && cuentasActivas.some((c) => c.id === cuentaPorDefecto)) {
      return cuentaPorDefecto;
    }
    return null;
  });

  const cuentaSeleccionada = useMemo(
    () => cuentasActivas.find((c) => c.id === cuentaId) ?? null,
    [cuentasActivas, cuentaId],
  );

  // Solo se sugiere una repetición cuando la descripción coincide de verdad.
  // Una coincidencia floja por categoría ("Mercado" → "Almuerzo") sería una
  // comodidad aparente que puede terminar enviando el gasto a la cuenta mala.
  const sugerenciaContextual = useMemo(() => {
    const clave = claveDescripcion(description);
    if (clave.length < 3) return null;
    const ultimaCoincidencia = transacciones
      .filter((tx) => claveDescripcion(tx.description) === clave)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (!ultimaCoincidencia) return null;

    const cambiaAlgo =
      ultimaCoincidencia.kind !== kind ||
      ultimaCoincidencia.category !== category ||
      ultimaCoincidencia.cuentaId !== cuentaId ||
      (digitos === '' && ultimaCoincidencia.amountCop > 0);
    if (!cambiaAlgo) return null;

    return {
      movimiento: ultimaCoincidencia,
      cuenta: cuentasActivas.find((cuenta) => cuenta.id === ultimaCoincidencia.cuentaId) ?? null,
    };
  }, [category, cuentaId, cuentasActivas, description, digitos, kind, transacciones]);

  const descRef = useRef<HTMLTextAreaElement>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const selectorFotosAbiertoRef = useRef(false);
  const catalogo = useCatalogo();
  const haptic = useHapticFeedback();
  const audio = useAudioFeedback();

  const abrirSelectorFotos = () => {
    const selector = fotoInputRef.current;
    if (!selector) return;
    // Safari conserva el valor del selector si se vuelve desde Archivos sin
    // elegir nada. Limpiarlo antes de cada apertura hace que el siguiente toque
    // siempre sea una solicitud nueva, incluso si se intenta la misma foto.
    selector.value = '';
    selectorFotosAbiertoRef.current = true;
    selector.click();
  };

  useEffect(() => {
    const liberarSelectorAlVolver = () => {
      if (!selectorFotosAbiertoRef.current) return;
      selectorFotosAbiertoRef.current = false;
      if (fotoInputRef.current) fotoInputRef.current.value = '';
    };
    window.addEventListener('focus', liberarSelectorAlVolver);
    return () => window.removeEventListener('focus', liberarSelectorAlVolver);
  }, []);

  // Inferencia en tiempo real cuando el usuario escribe en la descripción
  const handleDescriptionChange = (texto: string) => {
    setDescription(texto);
    if (texto.trim().length >= 2) {
      const reparseado = parseTransaction(
        texto,
        cuentasActivas,
        categorias,
        lexico,
        transacciones,
      );
      if (reparseado.category && reparseado.category !== 'otros') {
        setCategory(reparseado.category);
        setCategoriaDetectada(reparseado.category);
      }
      if (
        reparseado.kind &&
        (reparseado.signals?.kindSource === 'category-implied' ||
          reparseado.signals?.kindSource === 'keyword')
      ) {
        setKind(reparseado.kind);
      }
      if (reparseado.cuentaId && !cuentaId) {
        setCuentaId(reparseado.cuentaId);
      }
    }
  };

  const {
    scanImage: escanearEnCaptura,
    isScanning: escaneandoFoto,
    progress: progresoFoto,
    error: errorImagen,
  } = useImageOCR((ocrText) => {
    haptic.trigger('medium');
    audio.play('click');
    const reparseado = parseTransaction(ocrText, cuentasActivas, categorias, lexico, transacciones);
    if (reparseado.amount !== null) {
      setDigitos(String(Math.round(reparseado.amount)));
    }
    if (reparseado.category && reparseado.category !== 'otros') {
      setCategory(reparseado.category);
      setCategoriaDetectada(reparseado.category);
    }
    if (reparseado.description) {
      setDescription(reparseado.description);
    }
    if (reparseado.kind) {
      setKind(reparseado.kind);
      setResultadoImagen(reparseado.kind);
    }
    if (reparseado.cuentaId) {
      setCuentaId(reparseado.cuentaId);
    }
  });

  useBloqueoScroll(true);

  const amountCop = digitos === '' ? null : Number(digitos);
  const esGasto = kind === 'gasto';
  const esComprobanteOCR = parsed.raw.startsWith('[OCR]');
  const alertaRevision = esComprobanteOCR
    ? null
    : parsed.signals.amountSource === 'none' && parsed.amount !== null
    ? 'No escuché un monto; propuse el de un movimiento anterior. Confírmalo o cámbialo.'
    : parsed.signals.amountSource === 'none'
      ? 'No pude identificar el monto. Escríbelo antes de guardar.'
    : parsed.signals.ambiguousAmount
      ? 'Escuché más de una cifra. Confirma que el monto grande sea el total correcto.'
      : parsed.signals.kindSource === 'default'
        ? 'No quedó claro si el dinero entró o salió. Revisa Gasto o Ingreso.'
        : null;

  // Frecuencia de categorías para ordenar las más usadas primero
  const frecuenciaCategorias = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of transacciones.filter((t) => t.kind === kind)) {
      counts.set(t.category, (counts.get(t.category) || 0) + 1);
    }
    return counts;
  }, [transacciones, kind]);

  const opciones = useMemo(() => {
    const lista = catalogo.lista.some((c) => c.clave === category)
      ? catalogo.lista
      : [...catalogo.lista, catalogo.de(category)];

    return [...lista].sort((a, b) => {
      const countA = frecuenciaCategorias.get(a.clave) || 0;
      const countB = frecuenciaCategorias.get(b.clave) || 0;
      if (countA !== countB) return countB - countA;
      if (a.clave === 'otros') return 1;
      if (b.clave === 'otros') return -1;
      return 0;
    });
  }, [catalogo, category, frecuenciaCategorias]);

  const opcionesFrecuentes = opciones.slice(0, 5);
  if (!opcionesFrecuentes.some((c) => c.clave === category)) {
    opcionesFrecuentes[opcionesFrecuentes.length - 1] = catalogo.de(category);
  }
  const opcionesVisibles = mostrarTodasCategorias ? opciones : opcionesFrecuentes;

  const escribirDigitos = (nuevos: string) => {
    setDigitos((prev) => (prev + nuevos).replace(/^0+(?=\d)/, '').slice(0, 12));
  };

  const ejecutarGuardado = async (idCuentaFinal: string | null) => {
    if (amountCop === null || amountCop === 0 || guardandoRef.current) return;
    guardandoRef.current = true;
    setGuardando(true);
    setErrorGuardado(false);
    try {
      const correcto = await onSave({
        kind,
        amountCop,
        category,
        description: description.trim() || catalogo.de(category).nombre,
        cuentaId: idCuentaFinal,
        rawTranscript: parsed.raw,
        occurredOn: parsed.dateOverride,
        cuotasTotal: parsed.cuotasTotal,
        cuotaCop: parsed.cuotaCop,
      });
      setErrorGuardado(correcto === false);
      haptic.trigger(correcto === false ? 'error' : 'success');
      audio.play(correcto === false ? 'error' : 'success');
    } catch (error) {
      setErrorGuardado(true);
      console.error('Error al guardar:', error);
      haptic.trigger('error');
      audio.play('error');
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  };

  const guardar = () => {
    if (amountCop === null || amountCop === 0) {
      haptic.trigger('error');
      audio.play('error');
      return;
    }

    // Si no se eligió cuenta y el usuario tiene cuentas bancarias configuradas, pedir confirmación de cuenta
    if (!cuentaId && cuentasActivas.length > 0) {
      haptic.trigger('selection');
      audio.play('selection');
      setPidiendoCuenta(true);
      return;
    }

    ejecutarGuardado(cuentaId);
  };

  const colorMonto = esGasto ? 'var(--fin-out)' : 'var(--fin-in)';
  const IconoCuenta = cuentaSeleccionada ? iconoDeCajita(cuentaSeleccionada.icon) : Wallet;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--fin-scrim)] md:p-6">
    <motion.div
      ref={dialogoRef}
      tabIndex={-1}
      onKeyDown={(evento) => {
        if (evento.key === 'Escape' && !guardando) {
          evento.stopPropagation();
          if (pidiendoCuenta) setPidiendoCuenta(false);
          else onCancel();
        }
        if (evento.key !== 'Tab') return;
        const raiz = pidiendoCuenta ? dialogoRef.current?.querySelector('[data-confirmar-cuenta]') : dialogoRef.current;
        const elementos = Array.from(raiz?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([type="file"]):not([disabled]), textarea:not([disabled])') ?? []);
        const primero = elementos[0];
        const ultimo = elementos[elementos.length - 1];
        if (evento.shiftKey && document.activeElement === primero) { evento.preventDefault(); ultimo?.focus(); }
        else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primero?.focus(); }
      }}
      initial={quieto ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="relative flex h-full w-full max-w-2xl flex-col overflow-y-auto overscroll-contain bg-[var(--fin-bg)] px-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] md:max-h-[calc(100dvh-3rem)] md:rounded-[var(--fin-r-sheet)] md:px-8 md:shadow-2xl"
      role="dialog"
      aria-modal="true"
      aria-label="Anotar un movimiento"
    >
      {/* Banner de primera prueba */}
      {esPrimeraPrueba ? (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 flex items-start gap-3 rounded-[var(--fin-r-card)] border border-[var(--fin-warn)]/30 bg-[var(--fin-warn-bg)] p-4 text-[13px] text-[var(--fin-warn-ink)] shadow-sm backdrop-blur-md"
        >
          <Sparkles className="mt-1 h-4.5 w-4.5 shrink-0 text-[var(--fin-warn-ink)]" />
          <div className="leading-snug">
            {parsed.raw ? (
              <>
                <span className="font-bold">Prueba por voz reconocida</span>
                <p className="mt-1 text-[13px] opacity-90">
                  Detectamos «{parsed.raw}». Revisa los datos y pulsa <strong>Guardar</strong> para confirmar tu primer movimiento de prueba.
                </p>
              </>
            ) : (
              <>
                <span className="font-bold">Tu primer movimiento de prueba</span>
                <p className="mt-1 text-[13px] opacity-90">
                  Ingresa un monto y categoría para conocer la app. Podrás editarlo o borrarlo fácilmente con un toque.
                </p>
              </>
            )}
          </div>
        </motion.div>
      ) : null}

      {/* Cabecera superior con Fecha, Selector Plegable de Banco/Cuenta, Selector Gasto/Ingreso y Cerrar */}
      <div className="sticky top-0 z-20 flex items-center justify-between gap-2 bg-[var(--fin-bg)] pb-2">
        <div className="flex items-center gap-2">
          {/* Toggle Gasto / Ingreso intuitivo */}
          <div className="flex items-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] p-1">
            <button
              type="button"
              disabled={guardando}
              onClick={() => {
                haptic.trigger('selection');
                audio.play('selection');
                setKind('gasto');
              }}
              className={`flex items-center gap-1 rounded-[var(--fin-r-pill)] px-3 py-1 text-[13px] font-bold transition-all ${
                esGasto
                  ? 'bg-[var(--fin-out)] text-[var(--fin-on-accent)] shadow-sm'
                  : 'text-[var(--fin-ink-faint)] hover:text-[var(--fin-ink-soft)]'
              }`}
            >
              <ArrowDownRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              Gasto
            </button>
            <button
              type="button"
              disabled={guardando}
              onClick={() => {
                haptic.trigger('selection');
                audio.play('selection');
                setKind('ingreso');
              }}
              className={`flex items-center gap-1 rounded-[var(--fin-r-pill)] px-3 py-1 text-[13px] font-bold transition-all ${
                !esGasto
                  ? 'bg-[var(--fin-in)] text-[var(--fin-on-accent)] shadow-sm'
                  : 'text-[var(--fin-ink-faint)] hover:text-[var(--fin-ink-soft)]'
              }`}
            >
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} />
              Ingreso
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            ref={fotoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              selectorFotosAbiertoRef.current = false;
              const file = e.target.files?.[0];
              if (file) {
                haptic.trigger('medium');
                audio.play('click');
                void escanearEnCaptura(file);
                e.target.value = '';
              }
            }}
          />

          <button
            type="button"
            onClick={() => {
              if (onFoto) onFoto();
              else abrirSelectorFotos();
            }}
            disabled={guardando || escaneandoFoto}
            aria-label="Escanear comprobante"
            title="Escanear recibo o comprobante"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)] transition-colors hover:text-[var(--fin-ink)] disabled:opacity-50"
          >
            {escaneandoFoto ? (
              <Loader2 className="h-4 w-4 animate-spin text-[var(--fin-warn-ink)]" />
            ) : (
              <Camera className="h-4 w-4" strokeWidth={2.25} />
            )}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={guardando}
            aria-label="Cerrar sin guardar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]"
          >
            <X className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mt-2 flex justify-start">
          {/* Fecha */}
          <span className="rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-3 py-2 text-[13px] font-medium text-[var(--fin-ink-soft)]">
            {parsed.dateOverride
              ? parsed.dateOverride.slice(8) + '/' + parsed.dateOverride.slice(5, 7)
              : 'Hoy'}
          </span>

      </div>

      {/* La transcripción definitiva debe permanecer visible durante la
          confirmación. El texto parcial del overlay es solo una ayuda mientras
          se habla y puede equivocarse; aquí se enseña exactamente la versión
          que produjo los campos de abajo. */}
      {parsed.raw.trim() && !esComprobanteOCR ? (
        <section
          className="mt-3 rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3"
          aria-label="Transcripción del dictado"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 whitespace-nowrap text-[13px] font-bold uppercase tracking-wider text-[var(--fin-ink-faint)]">
              <Ear className="h-3.5 w-3.5" aria-hidden="true" />
              Tu dictado
            </span>
            {onReintentarVoz ? (
              <button
                type="button"
                disabled={guardando}
                onClick={onReintentarVoz}
                className="flex shrink-0 items-center gap-2 rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-3 py-2 text-[13px] font-semibold text-[var(--fin-ink-soft)]"
              >
                <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                Dictar otra vez
              </button>
            ) : null}
          </div>
          <p className="mt-2 text-[15px] font-medium leading-relaxed text-[var(--fin-ink)]">
            &ldquo;{parsed.raw.trim()}&rdquo;
          </p>
          {alertaRevision ? (
            <p className="mt-2 flex items-start gap-2 text-[13px] font-semibold leading-snug text-[var(--fin-warn)]">
              <AlertTriangle className="mt-1 h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
              {alertaRevision}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Indicador de escaneo activo en Captura */}
      {escaneandoFoto ? (
        <div className="mt-2 flex items-center justify-center gap-2 rounded-[var(--fin-r-card)] bg-[var(--fin-warn-bg)] border border-[var(--fin-warn)]/30 py-2 px-3 text-[13px] font-semibold text-[var(--fin-warn-ink)] animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin" />
          Escaneando comprobante con IA… {Math.round(progresoFoto * 100)}%
        </div>
      ) : null}
      {!escaneandoFoto && (resultadoImagen || esComprobanteOCR) ? (
        <div className={`mt-2 flex items-center justify-center gap-2 rounded-[var(--fin-r-card)] border py-2 px-3 text-[13px] font-semibold ${
          (resultadoImagen ?? parsed.kind) === 'ingreso'
            ? 'border-[var(--fin-in)]/25 bg-[var(--fin-in)]/10 text-[var(--fin-in)]'
            : 'border-[var(--fin-out)]/25 bg-[var(--fin-out)]/10 text-[var(--fin-out)]'
        }`}>
          <Check className="h-4 w-4" />
          Comprobante leído: {(resultadoImagen ?? parsed.kind) === 'ingreso' ? 'Ingreso detectado' : 'Gasto detectado'} · Revisa antes de guardar
        </div>
      ) : null}
      {parsed.cuotasTotal && parsed.cuotaCop ? (
        <p className="mt-2 rounded-[var(--fin-r-card)] border border-[var(--fin-warn)]/30 bg-[var(--fin-warn-bg)] px-3 py-2 text-center text-[13px] font-semibold text-[var(--fin-warn-ink)] text-[var(--fin-warn-ink)]">
          Compra a {parsed.cuotasTotal} cuotas de ${formatAmountInput(parsed.cuotaCop)} al mes. Se cargará a tu tarjeta cuando la elijas.
        </p>
      ) : null}
      {!escaneandoFoto && errorImagen ? (
        <p className="mt-2 text-center text-[13px] font-medium text-[var(--fin-out)]">{errorImagen}</p>
      ) : null}

      {sugerenciaContextual ? (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex items-center gap-3 rounded-[var(--fin-r-card)] border border-[var(--fin-accent)]/20 bg-[var(--fin-soft)] px-3 py-3"
        >
          <Sparkles className="h-4 w-4 shrink-0 text-[var(--fin-accent)]" strokeWidth={2.3} aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[13px] leading-snug text-[var(--fin-ink-soft)]">
            <strong className="font-semibold text-[var(--fin-ink)]">Como la última vez:</strong>{' '}
            {catalogo.de(sugerenciaContextual.movimiento.category).nombre}
            {sugerenciaContextual.cuenta ? ` · ${sugerenciaContextual.cuenta.nombre}` : ''}
          </p>
          <button
            type="button"
            onClick={() => {
              const { movimiento } = sugerenciaContextual;
              haptic.trigger('selection');
              audio.play('selection');
              setKind(movimiento.kind);
              setCategory(movimiento.category);
              setCuentaId(movimiento.cuentaId);
              if (digitos === '') setDigitos(String(Math.round(movimiento.amountCop)));
              setCategoriaDetectada(movimiento.category);
            }}
            className="shrink-0 rounded-[var(--fin-r-pill)] bg-[var(--fin-card)] px-3 py-2 text-[13px] font-bold text-[var(--fin-ink)] shadow-xs transition-colors hover:bg-[var(--fin-bg)]"
          >
            Usar
          </button>
        </motion.div>
      ) : null}

      {/* Selector Plegable de Banco / Cuenta */}
      {cuentasActivas.length > 0 && (
        <div className="relative mt-3">
          <button
            type="button"
            disabled={guardando}
            onClick={() => setDesplegarCuentas(!desplegarCuentas)}
            className={`flex w-full items-center gap-2 rounded-[var(--fin-r-control)] px-4 py-3 text-[13px] font-semibold transition-all ${
              cuentaSeleccionada
                ? 'border border-[var(--fin-line)] bg-[var(--fin-card)] text-[var(--fin-ink)] shadow-sm hover:bg-[var(--fin-soft)]'
                : 'border border-[var(--fin-warn)]/30 bg-[var(--fin-warn-bg)] text-[var(--fin-warn-ink)] text-[var(--fin-warn-ink)] hover:bg-[var(--fin-warn-bg)]'
            }`}
          >
            <IconoCuenta className={`h-4 w-4 shrink-0 ${cuentaSeleccionada ? 'text-[var(--fin-ink-soft)]' : 'text-[var(--fin-warn-ink)]'}`} />
            <span className="min-w-0 flex-1 truncate text-left">
              {cuentaSeleccionada ? cuentaSeleccionada.nombre : '¿Desde qué cuenta o tarjeta?'}
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${
                desplegarCuentas ? 'rotate-180' : ''
              } ${cuentaSeleccionada ? 'text-[var(--fin-ink-faint)]' : 'text-[var(--fin-warn-ink)]'}`}
            />
          </button>

          <AnimatePresence>
            {desplegarCuentas && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-full z-50 mt-2 min-w-[250px] rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-card)] p-2 shadow-2xl backdrop-blur-xl"
                style={{ backgroundColor: 'var(--fin-surface)' }}
              >
                <p className="px-3 py-1 text-[13px] font-bold uppercase tracking-wider text-[var(--fin-ink-faint)]">
                  Cuenta o tarjeta de pago
                </p>
                <div className="mt-1 flex flex-col gap-1 max-h-52 overflow-y-auto">
                  {cuentasActivas.map((c) => {
                    const Icon = iconoDeCajita(c.icon);
                    const activa = c.id === cuentaId;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          haptic.trigger('selection');
                          audio.play('selection');
                          setCuentaId(c.id);
                          setDesplegarCuentas(false);
                        }}
                        className={`flex items-center justify-between rounded-[var(--fin-r-control)] px-3 py-3 text-left text-[15px] transition-colors ${
                          activa
                            ? 'bg-[var(--fin-soft)] font-bold text-[var(--fin-ink)]'
                            : 'text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]/60 hover:text-[var(--fin-ink)]'
                        }`}
                      >
                        <div className="flex items-center gap-3 truncate">
                          <Icon className="h-4 w-4 shrink-0 text-[var(--fin-ink-soft)]" />
                          <span className="min-w-0 truncate">
                            <span className="block truncate">{c.nombre}</span>
                            <span className="block text-[13px] font-normal text-[var(--fin-ink-faint)]">
                              {etiquetaTipoCajita(c)}
                            </span>
                          </span>
                          {c.id === cuentaPorDefecto && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--fin-warn-bg)] px-2 py-1 text-[13px] font-bold text-[var(--fin-warn-ink)]">
                              <Star className="h-2.5 w-2.5 fill-amber-500 text-[var(--fin-warn-ink)]" /> Principal
                            </span>
                          )}
                        </div>
                        {activa && <Check className="h-4 w-4 shrink-0 text-[var(--fin-accent)]" />}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      haptic.trigger('selection');
                      audio.play('selection');
                      setCuentaId(null);
                      setDesplegarCuentas(false);
                    }}
                    className={`flex items-center justify-between rounded-[var(--fin-r-control)] px-3 py-2 text-left text-[13px] border-t border-[var(--fin-line)]/40 transition-colors ${
                      cuentaId === null
                        ? 'bg-[var(--fin-soft)] font-bold text-[var(--fin-ink)]'
                        : 'text-[var(--fin-ink-faint)] hover:text-[var(--fin-ink)]'
                    }`}
                  >
                    <span>Sin cuenta (Solo registrar)</span>
                    {cuentaId === null && <Check className="h-3.5 w-3.5 text-[var(--fin-accent)]" />}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* El centro: Monto y Descripción */}
      <div className="mt-4 grow shrink-0">
        <div className="tabular-nums" style={{ font: 'var(--fin-t-cifra)', letterSpacing: 'var(--fin-track-cifra)', color: amountCop === null ? 'var(--fin-ink-ghost)' : colorMonto }}>
          <label className="block text-xs font-semibold tracking-normal text-[var(--fin-ink-soft)]" htmlFor="captura-monto">Monto en pesos colombianos</label>
          {escritorio || editandoMonto ? <div className="mt-2 flex items-baseline gap-2">
            <span aria-hidden="true">{esGasto ? '−' : '+'}$</span>
            <input id="captura-monto" ref={montoRef} autoFocus={escritorio} inputMode="numeric" type="text" autoComplete="off" value={formatAmountInput(amountCop)}
              onChange={(e) => setDigitos(e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 12))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guardar(); } }}
              disabled={guardando} placeholder="0" className="min-w-0 w-full border-0 bg-transparent p-0 tabular-nums text-inherit outline-none focus:ring-0" />
          </div> : <button id="captura-monto" type="button" disabled={guardando} onClick={() => setEditandoMonto(true)} aria-label="Escribir el monto" className="mt-2 w-full text-left">
            {esGasto ? '−' : '+'}$<AnimatedNumber value={amountCop} format={(n) => formatAmountInput(n)} />
          </button>}
          {!escritorio && !editandoMonto ? <p className="mt-1 text-xs font-normal tracking-normal text-[var(--fin-ink-soft)]">Toca el monto para escribirlo con tu teclado.</p> : null}
          {!escritorio && editandoMonto ? <button type="button" onClick={() => setEditandoMonto(false)} className="mt-2 block text-sm font-semibold tracking-normal text-[var(--fin-ink-soft)]">Usar teclado de LukApp</button> : null}
        </div>

        {editandoTexto || escritorio ? (
          <textarea
            ref={descRef}
            autoFocus={!escritorio}
            disabled={guardando}
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            onBlur={() => { if (!escritorio) setEditandoTexto(false); }}
            aria-label="Descripción"
            className="mt-3 w-full max-h-32 resize-none border-0 bg-transparent text-[20px] font-normal text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-ghost)] outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
            placeholder="¿En qué fue? Ej: Almuerzo, Uber, Mercado..."
            rows={3}
          />
        ) : (
          <button
            type="button"
            disabled={guardando}
            onClick={() => setEditandoTexto(true)}
            className="mt-3 block w-full truncate text-left text-[20px] font-normal text-[var(--fin-ink)]"
          >
            {description.trim() || (
              <span className="text-[var(--fin-ink-ghost)]">¿En qué fue?</span>
            )}
          </button>
        )}

        {/* Una sola fila mantiene su altura dentro del flujo. La cuadrícula de
            dos filas desbordaba su caja y terminaba tapando 1, 2 y 3. */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-[13px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
              Categoría · {catalogo.de(category).nombre}
            </span>
            {categoriaDetectada && (
              <span className="flex items-center gap-1 text-[13px] font-bold text-[var(--fin-warn-ink)] bg-[var(--fin-warn-bg)] px-3 py-1 rounded-full animate-pulse">
                <Sparkles className="h-3 w-3" /> Detectada: {catalogo.de(categoriaDetectada).nombre}
              </span>
            )}
          </div>
          <div
            data-no-swipe
            role="group"
            aria-label="Categorías"
            className="-mx-5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-2 scroll-px-5 md:mx-0 md:flex-wrap md:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {opcionesVisibles.map((entrada) => {
              const activa = category === entrada.clave;
              return (
                <button
                  key={entrada.clave}
                  type="button"
                  onClick={() => {
                    haptic.trigger('selection');
                    audio.play('selection');
                    setCategory(entrada.clave);
                    setCategoriaDetectada(null);
                  }}
                  aria-pressed={activa}
                  disabled={guardando}
                  className={`flex min-w-max shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-[var(--fin-r-pill)] border px-3 py-2 text-[13px] font-semibold transition-all ${
                    activa ? 'shadow-sm' : 'border-transparent hover:bg-[var(--fin-soft)]'
                  }`}
                  style={{
                    backgroundColor: activa ? 'var(--fin-card-hover)' : 'var(--fin-soft)',
                    borderColor: activa ? 'var(--fin-ink)' : undefined,
                    color: activa ? 'var(--fin-ink)' : 'var(--fin-ink-soft)',
                  }}
                >
                  <span className="shrink-0 text-[17px]" aria-hidden="true">
                    <entrada.Icono className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>{entrada.nombre}</span>
                </button>
              );
            })}
          </div>
          <button type="button" disabled={guardando} onClick={() => setMostrarTodasCategorias((v) => !v)} aria-expanded={mostrarTodasCategorias} className="mt-1 rounded-[var(--fin-r-control)] px-2 py-2 text-sm font-semibold text-[var(--fin-ink-soft)]">{mostrarTodasCategorias ? 'Solo frecuentes' : 'Ver todas las categorías'}</button>
        </div>
      </div>

      {/* Abajo: Teclado numérico y guardar */}
      <div className="mt-4 flex shrink-0 flex-col gap-3 border-t border-[var(--fin-line)] pt-4">
        {!escritorio && !editandoMonto ? <div inert={guardando || undefined}><TecladoNumerico
          compacto
          onDigito={escribirDigitos}
          onBorrar={() => setDigitos((prev) => prev.slice(0, -1))}
        /></div> : null}

          {errorGuardado ? <p role="alert" className="text-sm text-[var(--fin-out)]">No se pudo guardar. Tus datos siguen aquí para que puedas intentarlo de nuevo.</p> : null}
        <div className="flex items-center gap-2">
          {onFoto ? (
            <button
              type="button"
              onClick={onFoto}
              disabled={guardando}
              aria-label="Foto del recibo"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]"
            >
              <Camera className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            disabled={guardando}
            onClick={() => setEditandoTexto(true)}
            aria-label="Escribir la descripción"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]"
          >
            <Keyboard className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>

          <RippleButton
            type="button"
            onClick={guardar}
            disabled={guardando || amountCop === null || amountCop === 0}
            rippleColor="rgba(255,255,255,0.5)"
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] text-[17px] font-semibold text-[var(--fin-on-accent)] transition-opacity disabled:opacity-30"
          >
            <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
            {guardando ? 'Guardando…' : 'Guardar'}
          </RippleButton>
        </div>
      </div>

      {/* Modal / Diálogo: Preguntar cuenta antes de guardar si no se seleccionó ninguna */}
      <AnimatePresence>
        {pidiendoCuenta && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              data-confirmar-cuenta
              className="w-full max-w-md rounded-t-[var(--fin-r-sheet)] sm:rounded-[var(--fin-r-sheet)] border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[var(--fin-line)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--fin-accent)]/15 text-[var(--fin-accent)]">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-[17px] font-bold text-[var(--fin-ink)]">
                      {esGasto ? '¿De qué cuenta salió?' : '¿En qué cuenta entró?'}
                    </h3>
                    <p className="text-[13px] text-[var(--fin-ink-soft)]">
                      Elige el banco para actualizar tu saldo:
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPidiendoCuenta(false)}
                  className="rounded-full p-2 text-[var(--fin-ink-faint)] hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-2 max-h-[55vh] overflow-y-auto">
                {cuentasActivas.map((c) => {
                  const Icon = iconoDeCajita(c.icon);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCuentaId(c.id);
                        setPidiendoCuenta(false);
                        ejecutarGuardado(c.id);
                      }}
                      className="flex items-center justify-between rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-soft)] p-4 text-left transition-all hover:border-[var(--fin-accent)] hover:bg-[var(--fin-accent)]/10"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--fin-card)] text-[var(--fin-ink)]">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-bold text-[var(--fin-ink)]">
                            {c.nombre}
                          </span>
                          {c.id === cuentaPorDefecto && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--fin-warn-bg)] px-2 py-1 text-[13px] font-bold text-[var(--fin-warn-ink)] text-[var(--fin-warn-ink)]">
                              <Star className="h-3 w-3 fill-amber-500 text-[var(--fin-warn-ink)]" /> Principal
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowDownRight className="h-4 w-4 text-[var(--fin-ink-faint)]" />
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    setCuentaId(null);
                    setPidiendoCuenta(false);
                    ejecutarGuardado(null);
                  }}
                  className="mt-1 flex items-center justify-center gap-2 rounded-[var(--fin-r-card)] p-3 text-[13px] font-semibold text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]"
                >
                  Anotar sin cuenta bancaria (No mover saldo)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
    </div>
  );
};
