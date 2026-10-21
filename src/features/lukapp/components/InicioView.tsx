import { IconoSimbolo } from './IconoSimbolo';
import { ProximosPagosInicio } from './ProximosPagosInicio';
import { construirObligacionesFuturas, type ObligacionFutura } from '../lib/obligacionesFuturas';
import { preparacionInicio } from '../lib/preparacionInicio';
import { PrimerosPasos } from './PrimerosPasos';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ChevronDown,
  Eye,
  EyeOff,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  X,
} from 'lucide-react';
import type { Transaction } from '../types';
import { formatCop } from '../lib/formatCop';
import { TransactionList } from './TransactionList';
import { AnimatedNumber } from './AnimatedNumber';
import type { Insight } from '../lib/insights';
import { useDismissedInsights } from '../data/useDismissedInsights';
import { calcularRacha } from '../lib/racha';
import { RachaModal } from './RachaModal';
import type { Novedad } from '../novedades';
import { useCatalogo } from '../catalogoContexto';
import { DecisionFinanciera } from './DecisionFinanciera';
import type { ContextoFinanciero } from '../lib/motorFinanciero';

interface InicioViewProps {
  etiquetaPeriodo: string;
  onCambiarMes: () => void;
  clavePeriodo?: string;
  maxClavePeriodo?: string;
  onCambiarPeriodo?: (clave: string) => void;
  periodoAdyacente?: (clave: string, delta: number) => string;
  etiquetaPeriodoDeClave?: (clave: string) => string;
  onBuscar: () => void;
  onAjustes: () => void;
  patrimonioCop: number;
  gastosCop: number;
  ingresosCop: number;
  onVerMes: () => void;
  onVerPagos?: () => void;
  obligaciones?: readonly ObligacionFutura[];
  movimientos: readonly Transaction[];
  conSenal?: ReadonlySet<string>;
  onAbrirMovimiento: (tx: Transaction) => void;
  onRepetirMovimiento?: (tx: Transaction) => void;
  onEditarMovimiento?: (tx: Transaction) => void;
  insights?: readonly (Insight & { onTocar?: () => void })[];
  cargandoIa?: boolean;
  onRefrescarInsights?: () => void;
  onConsultarAsesor?: (insight: Insight) => void;
  mostrarEfectivoSeparado?: boolean;
  saldoEfectivoCop?: number;
  saldoCuentasSinEfectivoCop?: number;
  modoPrivacidad?: boolean;
  onTogglePrivacidad?: () => void;
  today?: string;
  novedad?: Novedad | null;
  onCerrarNovedad?: () => void;
  onAnotar?: () => void;
  onConfigurarCuenta?: (id: string | null) => void;
  liquidez: ContextoFinanciero['liquidez'];
  entrada: import('../lib/motorFinanciero').EntradaMotorFinanciero;
  mostrarDecisiones?: boolean;
  resumenPremium?: {
    disponibleDiarioCop: number;
    dineroLibreCop: number;
    diasRestantes: number;
    confianza: 'alta' | 'media' | 'baja';
  } | null;
  onVerResumenPremium?: (insight: Insight | null) => void;
}

const formatMontoCompacto = (monto: number): string => {
  if (monto === 0) return '$0';
  if (monto >= 1_000_000) {
    const num = (monto / 1_000_000).toFixed(1).replace('.0', '');
    return `$${num}M`;
  }
  if (monto >= 1_000) {
    const num = (monto / 1_000).toFixed(1).replace('.0', '');
    return `$${num}K`;
  }
  return `$${monto}`;
};

export const InicioView: React.FC<InicioViewProps> = ({
  etiquetaPeriodo,
  onCambiarMes,
  clavePeriodo,
  maxClavePeriodo,
  onCambiarPeriodo,
  periodoAdyacente,
  etiquetaPeriodoDeClave,
  onBuscar,
  onAjustes,
  patrimonioCop,
  gastosCop,
  ingresosCop,
  onVerMes,
  onVerPagos,
  obligaciones,
  movimientos,
  conSenal,
  onAbrirMovimiento,
  onRepetirMovimiento,
  onEditarMovimiento,
  insights,
  cargandoIa,
  onRefrescarInsights,
  onConsultarAsesor,
  saldoEfectivoCop,
  saldoCuentasSinEfectivoCop,
  modoPrivacidad = false,
  onTogglePrivacidad,
  today,
  novedad,
  onCerrarNovedad,
  onAnotar,
  onConfigurarCuenta,
  liquidez,
  entrada,
  mostrarDecisiones,
  resumenPremium = null,
  onVerResumenPremium,
}) => {
  const quieto = useReducedMotion();
  const pagos = useMemo(() => obligaciones ?? construirObligacionesFuturas(entrada), [obligaciones, entrada]);
  const preparacion = preparacionInicio(entrada);
  const [novedadExpandida, setNovedadExpandida] = useState(false);
  const catalogo = useCatalogo();
  const { isDismissed, dismiss } = useDismissedInsights();
  const [indiceRotacion, setIndiceRotacion] = useState(0);
  const [mostrarRachaModal, setMostrarRachaModal] = useState(false);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);
  const [periodoAbierto, setPeriodoAbierto] = useState(false);

  const carouselRef = useRef<HTMLDivElement>(null);
  const recientesRef = useRef<HTMLElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);

  const handleScroll = () => {
    if (!carouselRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = carouselRef.current;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll > 0) {
      setScrollProgress(scrollLeft / maxScroll);
    }
  };

  const infoRacha = useMemo(
    () => calcularRacha(movimientos, today || new Date().toISOString().slice(0, 10)),
    [movimientos, today],
  );

  const insightsVisibles = useMemo(() => {
    if (!insights) return [];
    return insights.filter((i) => !isDismissed(i.id));
  }, [insights, isDismissed]);

  useEffect(() => {
    if (insightsVisibles.length <= 1) return;
    const timer = setInterval(() => {
      setIndiceRotacion((prev) => (prev + 1) % insightsVisibles.length);
    }, 45000);
    return () => clearInterval(timer);
  }, [insightsVisibles.length]);

  const insightActual = preparacion.saldosCompletos && preparacion.primerMovimiento ? (insightsVisibles[insightsVisibles.length > 1 ? indiceRotacion : 0] ?? null) : null;

  const handleAccionInsight = (insight: Insight & { onTocar?: () => void }) => {
    if (onConsultarAsesor) {
      onConsultarAsesor(insight);
    } else if (insight.onTocar) {
      insight.onTocar();
    }
  };

  // Ranking y cálculo de TODAS las categorías (con gasto primero, luego las demás del catálogo)
  const { todasCategorias, maxTotal } = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const m of movimientos) {
      if (m.kind === 'gasto') {
        mapa.set(m.category, (mapa.get(m.category) || 0) + m.amountCop);
      }
    }

    // Incluir todas las categorías del catálogo para que aparezcan en el carrusel
    const clavesCatalogo = catalogo.todas.map((c) => c.clave);
    for (const k of clavesCatalogo) {
      if (!mapa.has(k)) {
        mapa.set(k, 0);
      }
    }

    const lista = Array.from(mapa.entries())
      .map(([clave, total]) => {
        const info = catalogo.de(clave);
        return { clave, total, info, emoji: info.emoji };
      })
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.info.nombre.localeCompare(b.info.nombre);
      });

    const maxVal = Math.max(...lista.map((c) => c.total), 0);
    return { todasCategorias: lista, maxTotal: maxVal };
  }, [movimientos, catalogo]);

  // Movimientos visibles (filtrados por categoría si se seleccionó una)
  const movimientosAMostrar = useMemo(() => {
    const elegidos = categoriaFiltro ? movimientos.filter((m) => m.category === categoriaFiltro) : movimientos;
    return [...elegidos].sort((a, b) => b.occurredOn.localeCompare(a.occurredOn) || b.createdAt.localeCompare(a.createdAt));
  }, [movimientos, categoriaFiltro]);

  return (
    <div className="flex flex-col pb-32">
      {/* ── 1. Cabecera superior minimalista ─────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div onClick={() => clavePeriodo && onCambiarPeriodo && setPeriodoAbierto((abierto) => !abierto)} className="relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-[var(--fin-soft)] px-4 py-2 text-[15px] font-semibold capitalize text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-card)] shadow-xs">
          <span className="text-[13px] opacity-80"><IconoSimbolo valor="CalendarDays" className="h-4 w-4" /></span>
          {clavePeriodo && onCambiarPeriodo && periodoAdyacente && etiquetaPeriodoDeClave ? (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); setPeriodoAbierto((abierto) => !abierto); }} aria-expanded={periodoAbierto} aria-label="Cambiar período" className="font-bold text-[var(--fin-ink)]">
                {etiquetaPeriodoDeClave(clavePeriodo)}
              </button>
              <AnimatePresence>
              {periodoAbierto ? (
                <motion.div initial={{ opacity: 0, scaleY: 0.72, y: -5 }} animate={{ opacity: 1, scaleY: 1, y: 0 }} exit={{ opacity: 0, scaleY: 0.72, y: -5 }} transition={{ type: 'spring', stiffness: 720, damping: 32, mass: 0.42 }} style={{ transformOrigin: 'top center' }} className="absolute left-0 top-full z-40 mt-2 min-w-[190px] overflow-hidden rounded-[var(--fin-r-card)] border border-white/15 bg-gradient-to-br from-[var(--fin-soft)] via-[var(--fin-card)] to-[var(--fin-bg)] p-2 shadow-[0_18px_42px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-xl">
                  {Array.from({ length: 13 }, (_, i) => periodoAdyacente(maxClavePeriodo ?? clavePeriodo, -i)).map((clave) => (
                    <button key={clave} type="button" onClick={() => { onCambiarPeriodo(clave); setPeriodoAbierto(false); }} className={`block w-full rounded-[var(--fin-r-control)] px-3 py-3 text-left text-[13px] font-semibold capitalize transition-all ${clave === clavePeriodo ? 'bg-[var(--fin-accent)] text-[var(--fin-on-accent)] shadow-[0_5px_14px_rgba(168,85,247,0.28)]' : 'text-[var(--fin-ink)] hover:bg-white/10'}`}>
                      {etiquetaPeriodoDeClave(clave)}
                    </button>
                  ))}
                </motion.div>
              ) : null}
              </AnimatePresence>
            </>
          ) : <button type="button" onClick={onCambiarMes} className="font-bold text-[var(--fin-ink)]">{etiquetaPeriodo}</button>}
          <motion.div animate={{ rotate: periodoAbierto ? 180 : 0 }} transition={{ duration: 0.16, ease: 'easeOut' }}>
          <ChevronDown
            className="h-3.5 w-3.5 text-[var(--fin-ink-faint)]"
            strokeWidth={2.5}
            aria-hidden="true"
          />
          </motion.div>
        </div>

        <div className="flex items-center gap-2">
          {onTogglePrivacidad && (
            <button
              type="button"
              onClick={onTogglePrivacidad}
              aria-label={modoPrivacidad ? 'Mostrar saldos' : 'Ocultar saldos'}
              className={`flex h-8.5 w-8.5 items-center justify-center rounded-full transition-all active:scale-95 ${
                modoPrivacidad
                  ? 'bg-[var(--fin-warn-bg)] text-[var(--fin-warn-ink)]'
                  : 'bg-[var(--fin-soft)] text-[var(--fin-ink-soft)] hover:bg-[var(--fin-card)] hover:text-[var(--fin-ink)]'
              }`}
            >
              {modoPrivacidad ? (
                <EyeOff className="h-4 w-4" strokeWidth={2.2} />
              ) : (
                <Eye className="h-4 w-4" strokeWidth={2.2} />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onBuscar}
            aria-label="Buscar movimientos y funciones"
            className="flex h-8.5 w-8.5 items-center justify-center rounded-full bg-[var(--fin-soft)] text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-card)] hover:text-[var(--fin-ink)]"
          >
            <Search className="h-4 w-4" strokeWidth={2.2} />
          </button>

          <button
            type="button"
            onClick={onAjustes}
            aria-label="Ajustes"
            className="flex h-8.5 w-8.5 items-center justify-center rounded-full bg-[var(--fin-soft)] text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-card)] hover:text-[var(--fin-ink)]"
          >
            <Settings2 className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {/* ── 3. Dinero disponible (Patrimonio Total) + Pastilla de Ingresos/Gastos ── */}
      <div className="flex flex-col items-center justify-center pt-5 pb-2 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-[var(--fin-soft)]/75 px-3 py-1 text-[13px] font-bold text-[var(--fin-ink-soft)] tracking-wider uppercase">
          {preparacion.saldosCompletos ? 'Dinero disponible' : 'Saldo por completar'}
        </span>

        <div className="mt-2">
          <button
            type="button"
            onClick={onVerMes}
            aria-label="Ver el resumen de mi dinero"
            className="text-[44px] sm:text-[44px] font-bold tracking-tight tabular-nums text-[var(--fin-ink)] transition-transform active:scale-[0.98]"
            style={{ font: 'var(--fin-t-cifra)', letterSpacing: 'var(--fin-track-cifra)' }}
          >
            {preparacion.saldosCompletos ? <AnimatedNumber
              value={patrimonioCop}
              format={(val) => (modoPrivacidad ? '$ ••••••' : formatCop(val))}
            /> : <span aria-label="Saldo todavía sin confirmar">—</span>}
          </button>
        </div>
        <p className="mt-1 text-[13px] text-[var(--fin-ink-faint)]">
          {preparacion.saldosCompletos ? 'Saldo total menos ahorros reservados y obligaciones.' : 'Confirma tus saldos para calcular cuánto tienes disponible.'}
        </p>

        <details className="mt-2 w-full rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium text-[var(--fin-ink-soft)]">Ver saldos y resultado del período</summary>
        {/* Desglose bancos y efectivo si existen */}
        {preparacion.saldosCompletos && saldoEfectivoCop !== undefined && saldoCuentasSinEfectivoCop !== undefined ? (
          <div className="mt-1 flex items-center gap-3 text-[13px] text-[var(--fin-ink-soft)]">
            <span>
              Bancos:{' '}
              <strong className="font-semibold text-[var(--fin-ink)] tabular-nums">
                {modoPrivacidad ? '$ ••••••' : formatCop(saldoCuentasSinEfectivoCop)}
              </strong>
            </span>
            <span className="text-[var(--fin-line)]">•</span>
            <span>
              Efectivo:{' '}
              <strong className="font-semibold text-[var(--fin-ink)] tabular-nums">
                {modoPrivacidad ? '$ ••••••' : formatCop(saldoEfectivoCop)}
              </strong>
            </span>
          </div>
        ) : null}

        {/* Pastilla de Ingresos y Gastos del periodo en toda la mitad */}
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={onVerMes}
            title="Ver desglose del periodo"
            className="flex items-center gap-3 rounded-full bg-[var(--fin-soft)] px-4 py-2 text-[15px] font-bold tabular-nums shadow-xs hover:bg-[var(--fin-card)] transition-colors active:scale-95"
          >
            <span style={{ color: 'var(--fin-out)' }}>
              ↓ {modoPrivacidad ? '••••' : formatMontoCompacto(gastosCop)}
            </span>
            <span className="text-[var(--fin-line)]">|</span>
            <span style={{ color: 'var(--fin-in)' }}>
              ↑ {modoPrivacidad ? '••••' : formatMontoCompacto(ingresosCop)}
            </span>
          </button>
        </div>
        </details>
      </div>

      <PrimerosPasos estado={preparacion} onCuenta={onConfigurarCuenta} onAnotar={onAnotar} />

      <ProximosPagosInicio obligaciones={pagos} hoy={entrada.hoy} privacidad={modoPrivacidad} onVerPagos={onVerPagos ?? onVerMes} />

      {/* ── 6. Si se activó filtro por categoría ─────────────────────────── */}
      {categoriaFiltro && (
        <div className="my-2 flex items-center justify-between rounded-full bg-[var(--fin-soft)] px-4 py-2 text-[13px]">
          <span className="text-[var(--fin-ink-soft)]">
            Mostrando solo: <strong className="text-[var(--fin-ink)] capitalize">{categoriaFiltro}</strong>
          </span>
          <button
            type="button"
            onClick={() => setCategoriaFiltro(null)}
            className="flex items-center gap-1 font-semibold text-[var(--fin-ink)] hover:underline"
          >
            <span>Ver todos</span>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── 7. Lista de transacciones (Siempre visible) ──────────────────── */}
      <section ref={recientesRef} tabIndex={-1} aria-label="Movimientos recientes" className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-[var(--fin-ink)]">Movimientos recientes</h2>
          <button type="button" onClick={onBuscar} className="rounded-[var(--fin-r-control)] px-2 py-2 text-sm font-semibold text-[var(--fin-ink-soft)]">Ver historial completo</button>
        </div>
        <p className="mb-3 text-xs text-[var(--fin-ink-faint)]">{etiquetaPeriodo} · hasta 5 movimientos</p>
        {movimientosAMostrar.length === 0 ? <p className="py-4 text-center text-sm text-[var(--fin-ink-soft)]">{categoriaFiltro ? `No hay movimientos de ${catalogo.de(categoriaFiltro).nombre} en ${etiquetaPeriodo}.` : preparacion.primerMovimiento ? `No hay movimientos en ${etiquetaPeriodo}.` : 'Aquí aparecerán tus gastos e ingresos cuando guardes el primero.'}</p> : <TransactionList
          transactions={movimientosAMostrar.slice(0, 5)}
          conSenal={conSenal}
          onAbrir={onAbrirMovimiento}
          onRepetir={onRepetirMovimiento}
          onEditar={onEditarMovimiento}
          modoPrivacidad={modoPrivacidad}
        />}
      </section>

      {/* ── 5. Botón suave de acción rápida [ + Anotar nuevo gasto ] ─────── */}
      {onAnotar && preparacion.primerMovimiento && (
        <div className="flex justify-center my-3">
          <button
            type="button"
            onClick={onAnotar}
            className="flex items-center gap-2 rounded-full border-2 border-dashed border-[var(--fin-line)] bg-[var(--fin-card)] hover:border-[var(--fin-ink-faint)] hover:bg-[var(--fin-soft)] px-5 py-3 text-[15px] font-semibold text-[var(--fin-ink)] transition-all active:scale-95 shadow-xs"
          >
            <Plus className="h-4 w-4 text-[var(--fin-ink-soft)]" />
            <span>Anotar nuevo gasto</span>
          </button>
        </div>
      )}

      {preparacion.primerMovimiento ? <details className="mt-5 rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-card)] p-4">
        <summary className="cursor-pointer font-semibold text-[var(--fin-ink)]">Análisis y categorías del período</summary>
      {preparacion.saldosCompletos && preparacion.primerMovimiento && mostrarDecisiones !== false ? (
        <DecisionFinanciera
          liquidez={liquidez}
          entrada={entrada}
          movimientos={movimientos}
          privacidad={modoPrivacidad}
        />
      ) : null}

      {/* ── 4. Carrusel de Gráficas de Categorías (Gráfico de Barras con Alturas Contrastadas) ─ */}
      {maxTotal > 0 ? <div className="my-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div
          ref={carouselRef}
          onScroll={handleScroll}
          data-scroll-horizontal="true"
          className="flex items-end gap-3 sm:gap-3 overflow-x-auto min-h-[225px] pt-3 pb-4 px-1 snap-x scroll-smooth touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none]"
        >
          {todasCategorias.map((cat, idx) => {
            const ratio = maxTotal > 0 && cat.total > 0 ? cat.total / maxTotal : 0;
            const MIN_H = 112;
            const MAX_H = 196;
            // Escala directa y muy contrastada: si una vale 176k y la otra 34k, la diferencia de altura es dramática y clara
            const cardHeight = cat.total > 0 
              ? Math.round(MIN_H + ratio * (MAX_H - MIN_H))
              : MIN_H;

            const seleccionada = categoriaFiltro === cat.clave;

            return (
              <motion.button
                type="button"
                aria-pressed={seleccionada}
                aria-label={`Ver movimientos de ${cat.info.nombre}`}
                key={cat.clave}
                initial={quieto ? false : { height: MIN_H, opacity: 0, y: 10 }}
                animate={{ height: cardHeight, opacity: 1, y: 0 }}
                transition={{
                  duration: quieto ? 0 : undefined,
                  type: quieto ? 'tween' : 'spring',
                  stiffness: 140,
                  damping: 18,
                  delay: quieto ? 0 : Math.min(0.2, idx * 0.02),
                }}
                whileHover={quieto ? undefined : { y: -4 }}
                whileTap={quieto ? undefined : { scale: 0.96 }}
                onClick={() => {
                  setCategoriaFiltro(categoriaFiltro === cat.clave ? null : cat.clave);
                  recientesRef.current?.focus();
                }}
                style={{ height: cardHeight }}
                className={`relative flex-shrink-0 w-[108px] sm:w-[120px] snap-start flex flex-col items-center justify-between rounded-[var(--fin-r-card)] sm:rounded-[var(--fin-r-card)] bg-[var(--fin-card)] border p-2 sm:p-3 cursor-pointer transition-all shadow-[0_6px_16px_-4px_rgba(0,0,0,0.06)] dark:shadow-[0_6px_16px_-4px_rgba(0,0,0,0.35)] ${
                  seleccionada
                    ? 'border-[var(--fin-ink)] ring-2 ring-[var(--fin-ink)]/20 shadow-md scale-102'
                    : 'border-[var(--fin-line)] hover:border-[var(--fin-ink-ghost)]'
                }`}
              >
                {/* Emoji superior con contenedor tintado */}
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-[var(--fin-r-card)] text-[17px] sm:text-[20px] drop-shadow-xs transition-transform shrink-0"
                  style={{
                    backgroundColor: 'var(--fin-soft)',
                  }}
                >
                  <span aria-hidden="true">{cat.emoji}</span>
                </div>

                {/* Monto y nombre inferior */}
                <div className="flex flex-col items-center w-full min-w-0">
                  <span className="text-[13px] sm:text-[13px] font-bold tabular-nums text-[var(--fin-ink)] text-center leading-tight">
                    {modoPrivacidad ? '••••' : formatMontoCompacto(cat.total)}
                  </span>
                  <span className="mt-1 text-[13px] sm:text-[13px] font-semibold leading-tight text-[var(--fin-ink-soft)] line-clamp-2 max-w-[68px] sm:max-w-[76px] text-center capitalize">
                    {cat.info.nombre}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Indicador de scroll sutil y discreto */}
        {todasCategorias.length > 4 && (
          <div className="mt-2 flex justify-center">
            <div className="h-1 w-12 rounded-full bg-[var(--fin-line)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--fin-ink-soft)]/60 transition-all duration-150"
                style={{
                  width: '35%',
                  transform: `translateX(${scrollProgress * 185}%)`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      : null}

      {resumenPremium && preparacion.saldosCompletos && preparacion.primerMovimiento ? (
        <motion.button
          type="button"
          onClick={() => onVerResumenPremium?.(insightActual)}
          aria-label="Abrir el análisis de este Pulso Premium en el Asesor"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.985 }}
          className="mt-3 w-full rounded-[var(--fin-r-card)] border border-[var(--fin-accent)]/25 bg-[var(--fin-card)] px-4 py-3 text-left shadow-xs transition-colors hover:bg-[var(--fin-soft)]"
        >
          <span className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--fin-accent)]">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
              Pulso Premium
            </span>
            <span className="text-[13px] font-medium text-[var(--fin-ink-faint)]">
              {resumenPremium.confianza === 'alta' ? 'Datos al día' : 'Cálculo estimado'}
            </span>
          </span>
          <span className="mt-2 flex items-baseline justify-between gap-3">
            <span>
              <strong className="text-[20px] tracking-[-0.04em] tabular-nums text-[var(--fin-ink)]">
                {modoPrivacidad ? '$ ••••••' : formatCop(resumenPremium.disponibleDiarioCop)}
              </strong>
              <span className="ml-1 text-[13px] text-[var(--fin-ink-soft)]">para usar hoy</span>
            </span>
            <span className="text-right text-[13px] leading-snug text-[var(--fin-ink-faint)]">
              {resumenPremium.diasRestantes === 1 ? 'Queda 1 día' : `Quedan ${resumenPremium.diasRestantes} días`}
            </span>
          </span>
          <span className="mt-1 block text-[13px] leading-snug text-[var(--fin-ink-soft)]">
            {modoPrivacidad
              ? 'Calculado tras separar tus pagos y reservas conocidos.'
              : `${formatCop(resumenPremium.dineroLibreCop)} libres después de separar pagos y reservas conocidos.`}
          </span>
          {insightActual ? (
            <span className="mt-3 block border-t border-[var(--fin-line)] pt-2.5 text-[13px] leading-snug text-[var(--fin-ink-soft)]">
              <span className="font-semibold text-[var(--fin-ink)]">{insightActual.titulo}:</span>{' '}
              {insightActual.detalle}
              <span className="ml-1 font-semibold text-[var(--fin-accent)]">Analizar con IA →</span>
            </span>
          ) : (
            <span className="mt-3 block border-t border-[var(--fin-line)] pt-2.5 text-[13px] font-semibold text-[var(--fin-accent)]">
              Toca para analizar tu margen con IA →
            </span>
          )}
        </motion.button>
      ) : null}

      <AnimatePresence>
        {insightActual && !novedad && !resumenPremium && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-3 flex items-center justify-between rounded-[var(--fin-r-card)] bg-[var(--fin-card)] border border-[var(--fin-accent)]/20 px-4 py-2 text-[13px] shadow-xs"
          >
            <button
              type="button"
              onClick={() => handleAccionInsight(insightActual)}
              className="flex items-center gap-2 truncate text-left min-w-0"
            >
              <Sparkles className="h-3.5 w-3.5 text-[var(--fin-accent)] shrink-0" />
              <span className="truncate text-[var(--fin-ink-soft)]">
                {insightActual.origenIa ? (
                  <span className="mr-2 rounded-[var(--fin-r-pill)] bg-[var(--fin-accent)]/10 px-2 py-1 text-[13px] font-bold uppercase tracking-wide text-[var(--fin-accent)]">
                    Premium
                  </span>
                ) : null}
                <strong className="text-[var(--fin-ink)] font-semibold">
                  {insightActual.titulo}:
                </strong>{' '}
                {insightActual.detalle}
              </span>
            </button>
            <div className="flex items-center gap-1 shrink-0 ml-2">
              {onRefrescarInsights && (
                <button
                  type="button"
                  onClick={onRefrescarInsights}
                  title="Actualizar resumen Premium"
                  className="p-1 text-[var(--fin-ink-faint)] hover:text-[var(--fin-ink)]"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${cargandoIa ? 'animate-spin text-[var(--fin-accent)]' : ''}`}
                  />
                </button>
              )}
              <button
                type="button"
                onClick={() => dismiss(insightActual.id)}
                className="p-1 text-[var(--fin-ink-faint)] hover:text-[var(--fin-ink)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      </details> : null}

      {/* ── 2. Novedad / Tip de IA sutiles y no invasivos ────────────────── */}
      <AnimatePresence>
        {novedad && (
          <motion.div
            initial={{ opacity: 0, x: -18, y: -3 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: -12, y: -3 }}
            transition={{ type: 'spring', stiffness: 620, damping: 34, mass: 0.45 }}
            onClick={() => setNovedadExpandida((actual) => !actual)}
            role="button"
            tabIndex={0}
            aria-expanded={novedadExpandida}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setNovedadExpandida((actual) => !actual);
              }
            }}
            className="novedad-banner mt-3 flex cursor-pointer items-start justify-between rounded-[var(--fin-r-card)] px-4 py-3 text-[13px]"
          >
            <span className={`flex min-w-0 items-start gap-3 ${novedadExpandida ? 'mr-2 whitespace-normal' : 'mr-2 truncate'}`}>
              <span className="novedad-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)]">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
              </span>
              <span className={novedadExpandida ? 'pt-0.5' : 'truncate pt-0.5'}>
                <strong className="novedad-version">v{novedad.version}</strong> {novedad.texto}
              </span>
            </span>
            {onCerrarNovedad && (
              <button
                type="button"
                onClick={(evento) => {
                  evento.stopPropagation();
                  onCerrarNovedad();
                }}
                aria-label="Cerrar novedades"
                className="novedad-close flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-4 flex justify-center">
          {/* Botón de Racha */}
          <button
            type="button"
            onClick={() => setMostrarRachaModal(true)}
            aria-label="Racha de días"
            className={`flex h-8.5 items-center gap-2 rounded-full px-3 text-[13px] font-bold transition-all active:scale-95 ${
              infoRacha.anotadoHoy
                ? 'border border-[var(--fin-warn)]/30 bg-[var(--fin-warn-bg)] text-[var(--fin-warn-ink)] text-[var(--fin-warn-ink)]'
                : 'border border-[var(--fin-line)] bg-[var(--fin-soft)] text-[var(--fin-ink-faint)]'
            }`}
          >
            <span className={infoRacha.anotadoHoy ? 'drop-shadow-sm' : 'grayscale opacity-70'}>
              <IconoSimbolo valor="Flame" className="h-4 w-4" />
            </span>
            <span className="tabular-nums font-semibold">Racha: {infoRacha.rachaActual} días</span>
          </button>

      </div>

      {/* Modal de racha */}
      {mostrarRachaModal && (
        <RachaModal
          infoRacha={infoRacha}
          onCerrar={() => setMostrarRachaModal(false)}
        />
      )}
    </div>
  );
};
