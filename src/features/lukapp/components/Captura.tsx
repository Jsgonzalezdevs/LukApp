import React, { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, Camera, Check, ChevronDown, Keyboard, Loader2, Sparkles, Star, Wallet, X } from 'lucide-react';
import { tint } from '../types';
import type { CategoriaClave, Transaction, TxKind } from '../types';
import type { Cajita } from '../data/modelos';
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
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import type { ConfirmDraft } from './ConfirmSheet';

interface CapturaProps {
  /** Lo que el motor de texto entendió de lo que dijiste. */
  parsed: ParsedTransaction;
  cajitas?: readonly Cajita[];
  transacciones?: readonly Transaction[];
  categorias?: readonly CategoriaPersonal[];
  lexico?: LexicoAprendido;
  onSave: (draft: ConfirmDraft) => void;
  onCancel: () => void;
  /** Se llama al tocar el botón de la foto del recibo. */
  onFoto?: () => void;
  /**
   * La cuenta que se usa cuando no dices ninguna.
   */
  cuentaPorDefecto?: string | null;
  /** Marca si es la primera prueba por micrófono del onboarding. */
  esPrimeraPrueba?: boolean;
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
}) => {
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

  // Cuentas bancarias disponibles activas
  const cuentasActivas = useMemo(
    () => cajitas.filter((c) => !c.archivedAt && c.tipo === 'cuenta'),
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

  const descRef = useRef<HTMLTextAreaElement>(null);
  const capturaRef = useRef<HTMLDivElement>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const catalogo = useCatalogo();
  const haptic = useHapticFeedback();
  const audio = useAudioFeedback();

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

  const { scanImage: escanearEnCaptura, isScanning: escaneandoFoto, progress: progresoFoto } = useImageOCR((ocrText) => {
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
    }
    if (reparseado.cuentaId) {
      setCuentaId(reparseado.cuentaId);
    }
  });

  useSwipeGesture(capturaRef as React.RefObject<HTMLElement>, {
    onSwipeRight: () => {
      haptic.trigger('light');
      audio.play('click');
      onCancel();
    },
  });

  useBloqueoScroll(true);

  const amountCop = digitos === '' ? null : Number(digitos);
  const esGasto = kind === 'gasto';

  // Frecuencia de categorías para ordenar las más usadas primero
  const frecuenciaCategorias = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of transacciones) {
      counts.set(t.category, (counts.get(t.category) || 0) + 1);
    }
    return counts;
  }, [transacciones]);

  const opciones = useMemo(() => {
    const lista = catalogo.lista.some((c) => c.clave === category)
      ? catalogo.lista
      : [...catalogo.lista, catalogo.de(category)];

    return [...lista].sort((a, b) => {
      if (a.clave === category) return -1;
      if (b.clave === category) return 1;
      const countA = frecuenciaCategorias.get(a.clave) || 0;
      const countB = frecuenciaCategorias.get(b.clave) || 0;
      if (countA !== countB) return countB - countA;
      if (a.clave === 'otros') return 1;
      if (b.clave === 'otros') return -1;
      return 0;
    });
  }, [catalogo, category, frecuenciaCategorias]);

  const escribirDigitos = (nuevos: string) => {
    setDigitos((prev) => (prev + nuevos).replace(/^0+(?=\d)/, '').slice(0, 12));
  };

  const ejecutarGuardado = (idCuentaFinal: string | null) => {
    if (amountCop === null || amountCop === 0) return;
    try {
      haptic.trigger('success');
      audio.play('success');
      onSave({
        kind,
        amountCop,
        category,
        description: description.trim() || catalogo.de(category).nombre,
        cuentaId: idCuentaFinal,
        rawTranscript: parsed.raw,
        occurredOn: parsed.dateOverride,
      });
    } catch (error) {
      console.error('Error al guardar:', error);
      haptic.trigger('error');
      audio.play('error');
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
    <motion.div
      ref={capturaRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex flex-col bg-[var(--fin-bg)] px-5 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Anotar un movimiento"
    >
      {/* Banner de primera prueba */}
      {esPrimeraPrueba ? (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-3.5 flex items-start gap-2.5 rounded-[var(--fin-r-card)] border border-amber-500/35 bg-amber-500/10 p-3.5 text-[13px] text-amber-500 shadow-sm backdrop-blur-md"
        >
          <Sparkles className="mt-0.5 h-4.5 w-4.5 shrink-0 text-amber-400" />
          <div className="leading-snug">
            {parsed.raw ? (
              <>
                <span className="font-bold">✨ ¡Prueba por voz reconocida!</span>
                <p className="mt-1 text-[12px] opacity-90">
                  Detectamos «{parsed.raw}». Revisa los datos y pulsa <strong>Guardar</strong> para confirmar tu primer movimiento de prueba.
                </p>
              </>
            ) : (
              <>
                <span className="font-bold">📝 Tu primer movimiento de prueba</span>
                <p className="mt-1 text-[12px] opacity-90">
                  Ingresa un monto y categoría para conocer la app. Podrás editarlo o borrarlo fácilmente con un toque.
                </p>
              </>
            )}
          </div>
        </motion.div>
      ) : null}

      {/* Cabecera superior con Fecha, Selector Plegable de Banco/Cuenta, Selector Gasto/Ingreso y Cerrar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Fecha */}
          <span className="rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-3 py-1.5 text-[12px] font-medium text-[var(--fin-ink-soft)]">
            {parsed.dateOverride
              ? parsed.dateOverride.slice(8) + '/' + parsed.dateOverride.slice(5, 7)
              : 'Hoy'}
          </span>

          {/* Toggle Gasto / Ingreso intuitivo */}
          <div className="flex items-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] p-0.5">
            <button
              type="button"
              onClick={() => {
                haptic.trigger('selection');
                audio.play('selection');
                setKind('gasto');
              }}
              className={`flex items-center gap-1 rounded-[var(--fin-r-pill)] px-2.5 py-1 text-[12px] font-bold transition-all ${
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
              onClick={() => {
                haptic.trigger('selection');
                audio.play('selection');
                setKind('ingreso');
              }}
              className={`flex items-center gap-1 rounded-[var(--fin-r-pill)] px-2.5 py-1 text-[12px] font-bold transition-all ${
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

        <div className="flex items-center gap-1.5">
          <input
            ref={fotoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
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
              else fotoInputRef.current?.click();
            }}
            disabled={escaneandoFoto}
            aria-label="Escanear comprobante"
            title="Escanear recibo o comprobante"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)] transition-colors hover:text-[var(--fin-ink)] disabled:opacity-50"
          >
            {escaneandoFoto ? (
              <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
            ) : (
              <Camera className="h-4 w-4" strokeWidth={2.25} />
            )}
          </button>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar sin guardar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]"
          >
            <X className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Indicador de escaneo activo en Captura */}
      {escaneandoFoto ? (
        <div className="mt-2 flex items-center justify-center gap-2 rounded-[var(--fin-r-card)] bg-amber-500/10 border border-amber-500/20 py-2 px-3 text-[12.5px] font-semibold text-amber-500 animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin" />
          Escaneando comprobante con IA… {Math.round(progresoFoto * 100)}%
        </div>
      ) : null}

      {/* Selector Plegable de Banco / Cuenta */}
      {cuentasActivas.length > 0 && (
        <div className="relative mt-3">
          <button
            type="button"
            onClick={() => setDesplegarCuentas(!desplegarCuentas)}
            className={`flex items-center gap-2 rounded-[var(--fin-r-pill)] px-3.5 py-1.5 text-[13px] font-semibold transition-all ${
              cuentaSeleccionada
                ? 'border border-[var(--fin-line)] bg-[var(--fin-card)] text-[var(--fin-ink)] shadow-sm hover:bg-[var(--fin-soft)]'
                : 'border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
            }`}
          >
            <IconoCuenta className={`h-4 w-4 shrink-0 ${cuentaSeleccionada ? 'text-[var(--fin-ink-soft)]' : 'text-amber-500'}`} />
            <span className="truncate max-w-[170px]">
              {cuentaSeleccionada ? cuentaSeleccionada.nombre : '¿De qué cuenta? (Elegir)'}
            </span>
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${
                desplegarCuentas ? 'rotate-180' : ''
              } ${cuentaSeleccionada ? 'text-[var(--fin-ink-faint)]' : 'text-amber-500'}`}
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
                <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--fin-ink-faint)]">
                  Cuenta o medio de pago
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
                        className={`flex items-center justify-between rounded-[var(--fin-r-control)] px-3 py-2.5 text-left text-[14px] transition-colors ${
                          activa
                            ? 'bg-[var(--fin-soft)] font-bold text-[var(--fin-ink)]'
                            : 'text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]/60 hover:text-[var(--fin-ink)]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <Icon className="h-4 w-4 shrink-0 text-[var(--fin-ink-soft)]" />
                          <span className="truncate">{c.nombre}</span>
                          {c.id === cuentaPorDefecto && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-500">
                              <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> Principal
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
      <div className="mt-6 min-h-0 flex-1">
        <div
          className="tabular-nums"
          style={{
            font: 'var(--fin-t-cifra)',
            letterSpacing: 'var(--fin-track-cifra)',
            color: amountCop === null ? 'var(--fin-ink-ghost)' : colorMonto,
          }}
        >
          {esGasto ? '−' : '+'}$
          <AnimatedNumber
            value={amountCop}
            format={(n) => formatAmountInput(n)}
          />
        </div>

        {editandoTexto ? (
          <textarea
            ref={descRef}
            autoFocus
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            onBlur={() => setEditandoTexto(false)}
            aria-label="Descripción"
            className="mt-3 w-full max-h-32 resize-none bg-transparent text-[20px] font-normal text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-ghost)] focus:outline-none"
            placeholder="¿En qué fue? Ej: Almuerzo, Uber, Mercado..."
            rows={3}
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditandoTexto(true)}
            className="mt-3 block w-full truncate text-left text-[26px] font-normal text-[var(--fin-ink)]"
          >
            {description.trim() || (
              <span className="text-[var(--fin-ink-ghost)]">¿En qué fue?</span>
            )}
          </button>
        )}

        {/* Las categorías en cuadrícula de 2 filas deslizable */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
              Categoría
            </span>
            {categoriaDetectada && (
              <span className="flex items-center gap-1 text-[11.5px] font-bold text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full animate-pulse">
                <Sparkles className="h-3 w-3" /> Detectada: {catalogo.de(categoriaDetectada).nombre}
              </span>
            )}
          </div>
          <div
            data-no-swipe
            className="-mx-5 grid grid-rows-2 grid-flow-col auto-cols-max gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {opciones.map((entrada) => {
              const activa = category === entrada.clave;
              const Icono = entrada.Icono;
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
                  className={`flex shrink-0 items-center gap-2 rounded-[var(--fin-r-pill)] px-3.5 py-2 text-[14px] font-semibold transition-all ${
                    activa ? 'ring-2 ring-[var(--fin-accent)] shadow-sm' : 'hover:bg-[var(--fin-soft)]'
                  }`}
                  style={{
                    backgroundColor: activa ? tint(entrada.color, 0.22) : 'var(--fin-soft)',
                    color: activa ? 'var(--fin-ink)' : 'var(--fin-ink-soft)',
                  }}
                >
                  <Icono className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{entrada.nombre}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Abajo: Teclado numérico y guardar */}
      <div className="mt-6 flex flex-col gap-3">
        <TecladoNumerico
          onDigito={escribirDigitos}
          onBorrar={() => setDigitos((prev) => prev.slice(0, -1))}
        />

        <div className="flex items-center gap-2">
          {onFoto ? (
            <button
              type="button"
              onClick={onFoto}
              aria-label="Foto del recibo"
              className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]"
            >
              <Camera className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setEditandoTexto(true)}
            aria-label="Escribir la descripción"
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]"
          >
            <Keyboard className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>

          <RippleButton
            type="button"
            onClick={guardar}
            disabled={amountCop === null || amountCop === 0}
            rippleColor="rgba(255,255,255,0.5)"
            className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] text-[17px] font-semibold text-[var(--fin-on-accent)] transition-opacity disabled:opacity-30"
          >
            <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
            Guardar
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
              className="w-full max-w-md rounded-t-[var(--fin-r-sheet)] sm:rounded-[var(--fin-r-sheet)] border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-[var(--fin-line)]">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--fin-accent)]/15 text-[var(--fin-accent)]">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-[17px] font-bold text-[var(--fin-ink)]">
                      ¿De qué cuenta salió?
                    </h3>
                    <p className="text-[12px] text-[var(--fin-ink-soft)]">
                      Elige el banco para actualizar tu saldo:
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPidiendoCuenta(false)}
                  className="rounded-full p-1.5 text-[var(--fin-ink-faint)] hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]"
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
                      className="flex items-center justify-between rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-soft)] p-3.5 text-left transition-all hover:border-[var(--fin-accent)] hover:bg-[var(--fin-accent)]/10"
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
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                              <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Principal
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
  );
};

