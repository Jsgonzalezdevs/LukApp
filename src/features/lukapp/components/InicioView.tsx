import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
import { tint } from '../types';

interface InicioViewProps {
  etiquetaPeriodo: string;
  onCambiarMes: () => void;
  onBuscar: () => void;
  onAjustes: () => void;
  patrimonioCop: number;
  gastosCop: number;
  ingresosCop: number;
  onVerMes: () => void;
  movimientos: readonly Transaction[];
  conSenal?: ReadonlySet<string>;
  onAbrirMovimiento: (tx: Transaction) => void;
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
  onBuscar,
  onAjustes,
  patrimonioCop,
  gastosCop,
  ingresosCop,
  onVerMes,
  movimientos,
  conSenal,
  onAbrirMovimiento,
  insights,
  cargandoIa,
  onRefrescarInsights,
  onConsultarAsesor,
  mostrarEfectivoSeparado,
  saldoEfectivoCop,
  saldoCuentasSinEfectivoCop,
  modoPrivacidad = false,
  onTogglePrivacidad,
  today,
  novedad,
  onCerrarNovedad,
  onAnotar,
}) => {
  const catalogo = useCatalogo();
  const { isDismissed, dismiss } = useDismissedInsights();
  const [indiceRotacion, setIndiceRotacion] = useState(0);
  const [mostrarRachaModal, setMostrarRachaModal] = useState(false);
  const [modoCifra, setModoCifra] = useState<'gasto' | 'patrimonio'>('gasto');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);

  const carouselRef = useRef<HTMLDivElement>(null);
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

  const insightActual = insightsVisibles[insightsVisibles.length > 1 ? indiceRotacion : 0] ?? null;

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

    const maxVal = Math.max(...lista.map((c) => c.total), 1);
    return { todasCategorias: lista, maxTotal: maxVal };
  }, [movimientos, catalogo]);

  // Movimientos visibles (filtrados por categoría si se seleccionó una)
  const movimientosAMostrar = useMemo(() => {
    if (!categoriaFiltro) return movimientos;
    return movimientos.filter((m) => m.category === categoriaFiltro);
  }, [movimientos, categoriaFiltro]);

  return (
    <div className="flex flex-col pb-6">
      {/* ── 1. Cabecera superior minimalista ─────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCambiarMes}
          className="flex items-center gap-1.5 rounded-full bg-[var(--fin-soft)] px-3.5 py-1.5 text-[14px] font-semibold capitalize text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-card)] shadow-xs"
        >
          <span className="text-[var(--fin-ink-soft)] text-[12px] uppercase tracking-wider">
            {modoCifra === 'gasto' ? 'Gasto' : 'Saldo'}
          </span>
          <span className="text-[var(--fin-ink)] font-bold">{etiquetaPeriodo}</span>
          <ChevronDown
            className="h-3.5 w-3.5 text-[var(--fin-ink-faint)]"
            strokeWidth={2.5}
            aria-hidden="true"
          />
        </button>

        <div className="flex items-center gap-1.5">
          {/* Botón de Racha */}
          <button
            type="button"
            onClick={() => setMostrarRachaModal(true)}
            aria-label="Racha de días"
            className={`flex h-8.5 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-bold transition-all active:scale-95 ${
              infoRacha.anotadoHoy
                ? 'border border-amber-500/50 bg-amber-500/15 text-amber-600 dark:text-amber-400'
                : 'border border-[var(--fin-line)] bg-[var(--fin-soft)] text-[var(--fin-ink-faint)]'
            }`}
          >
            <span className={infoRacha.anotadoHoy ? 'drop-shadow-sm' : 'grayscale opacity-70'}>
              🔥
            </span>
            <span className="tabular-nums font-extrabold">{infoRacha.rachaActual}</span>
          </button>

          {onTogglePrivacidad && (
            <button
              type="button"
              onClick={onTogglePrivacidad}
              aria-label={modoPrivacidad ? 'Mostrar saldos' : 'Ocultar saldos'}
              className={`flex h-8.5 w-8.5 items-center justify-center rounded-full transition-all active:scale-95 ${
                modoPrivacidad
                  ? 'bg-amber-500/20 text-amber-500'
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
            aria-label="Buscar un movimiento"
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

      {/* ── 2. Novedad / Tip de IA sutiles y no invasivos ────────────────── */}
      <AnimatePresence>
        {novedad && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-3 flex items-center justify-between rounded-2xl bg-amber-500/10 border border-amber-500/25 px-3.5 py-2 text-[12.5px] text-amber-800 dark:text-amber-200"
          >
            <span className="truncate mr-2">
              ✨ <strong>v{novedad.version}:</strong> {novedad.texto}
            </span>
            {onCerrarNovedad && (
              <button
                type="button"
                onClick={onCerrarNovedad}
                className="p-1 hover:opacity-75 shrink-0"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {insightActual && !novedad && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-3 flex items-center justify-between rounded-2xl bg-[var(--fin-card)] border border-[var(--fin-accent)]/20 px-3.5 py-2 text-[12.5px] shadow-xs"
          >
            <button
              type="button"
              onClick={() => handleAccionInsight(insightActual)}
              className="flex items-center gap-2 truncate text-left min-w-0"
            >
              <Sparkles className="h-3.5 w-3.5 text-[var(--fin-accent)] shrink-0" />
              <span className="truncate text-[var(--fin-ink-soft)]">
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
                  title="Actualizar IA"
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

      {/* ── 3. Número Hero Principal + Pastilla de Ingresos/Egresos centrada ── */}
      <div className="flex flex-col items-center justify-center pt-6 pb-2 text-center">
        <button
          type="button"
          onClick={() => setModoCifra((prev) => (prev === 'gasto' ? 'patrimonio' : 'gasto'))}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fin-soft)]/60 px-3 py-1 text-[12px] font-semibold text-[var(--fin-ink-soft)] hover:text-[var(--fin-ink)] transition-colors"
        >
          <span>{modoCifra === 'gasto' ? 'Gastado en este periodo' : 'Patrimonio total'}</span>
          <span className="text-[10px] text-[var(--fin-ink-faint)]">⇄</span>
        </button>

        <div className="mt-2">
          <button
            type="button"
            onClick={onVerMes}
            className="text-[44px] sm:text-[52px] font-extrabold tracking-tight tabular-nums text-[var(--fin-ink)] transition-transform active:scale-[0.98]"
            style={{ font: 'var(--fin-t-cifra)', letterSpacing: 'var(--fin-track-cifra)' }}
          >
            <AnimatedNumber
              value={modoCifra === 'gasto' ? gastosCop : patrimonioCop}
              format={(val) => (modoPrivacidad ? '$ ••••••' : formatCop(val))}
            />
          </button>
        </div>

        {/* Desglose bancos y efectivo si está activo */}
        {mostrarEfectivoSeparado && saldoEfectivoCop !== undefined && saldoCuentasSinEfectivoCop !== undefined ? (
          <div className="mt-1 flex items-center gap-3 text-[13px] text-[var(--fin-ink-soft)]">
            <span>
              Bancos:{' '}
              <strong className="font-semibold text-[var(--fin-ink)] tabular-nums">
                {modoPrivacidad ? '$ ••••••' : formatCop(saldoCuentasSinEfectivoCop)}
              </strong>
            </span>
            <span>•</span>
            <span>
              Efectivo:{' '}
              <strong className="font-semibold text-[var(--fin-ink)] tabular-nums">
                {modoPrivacidad ? '$ ••••••' : formatCop(saldoEfectivoCop)}
              </strong>
            </span>
          </div>
        ) : null}

        {/* Pastilla de Ingresos y Egresos en toda la mitad */}
        <div className="mt-3.5 flex justify-center">
          <button
            type="button"
            onClick={onVerMes}
            className="flex items-center gap-2.5 rounded-full bg-[var(--fin-soft)] px-4 py-2 text-[13.5px] font-bold tabular-nums shadow-xs hover:bg-[var(--fin-card)] transition-colors"
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
      </div>

      {/* ── 4. Carrusel Deslizable de Gráficas de Categorías con Color y Scrollbar Oculto ─ */}
      <div className="my-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div
          ref={carouselRef}
          onScroll={handleScroll}
          className="flex gap-2.5 sm:gap-3 overflow-x-auto py-2 px-1 snap-x scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none]"
        >
          {todasCategorias.map((cat, idx) => {
            const pct = maxTotal > 0 && cat.total > 0 ? (cat.total / maxTotal) * 100 : 0;
            const alturaBarra = pct > 0 ? Math.min(100, Math.max(14, pct)) : 0;
            const seleccionada = categoriaFiltro === cat.clave;
            const colorCat = cat.info.color;

            return (
              <motion.div
                key={cat.clave}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  setCategoriaFiltro(categoriaFiltro === cat.clave ? null : cat.clave);
                }}
                className={`relative flex-shrink-0 w-[88px] sm:w-[96px] h-[150px] sm:h-[162px] snap-start flex flex-col items-center justify-between rounded-[24px] sm:rounded-[28px] bg-[var(--fin-card)] border p-2.5 cursor-pointer transition-all overflow-hidden ${
                  seleccionada
                    ? 'border-[var(--fin-ink)] ring-2 ring-[var(--fin-ink)]/20 shadow-md scale-102'
                    : 'border-[var(--fin-line)] shadow-xs hover:border-[var(--fin-ink-ghost)]'
                }`}
              >
                {/* Relleno animado vertical de la barra con color vivo */}
                <div
                  className="absolute inset-x-1.5 bottom-1.5 rounded-[19px] sm:rounded-[23px] -z-0 overflow-hidden flex flex-col justify-end"
                  style={{
                    backgroundColor: tint(colorCat, 0.08),
                  }}
                >
                  {alturaBarra > 0 ? (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${alturaBarra}%` }}
                      transition={{
                        type: 'spring',
                        stiffness: 110,
                        damping: 17,
                        delay: Math.min(0.2, idx * 0.03),
                      }}
                      style={{
                        backgroundColor: tint(colorCat, 0.28),
                        borderTop: `2px solid ${colorCat}`,
                      }}
                      className="w-full rounded-[19px] sm:rounded-[23px]"
                    />
                  ) : null}
                </div>

                {/* Icono / Emoji superior con contenedor tintado */}
                <div
                  className="relative z-10 flex h-9 w-9 items-center justify-center rounded-2xl text-[20px] sm:text-[22px] drop-shadow-xs transition-transform"
                  style={{
                    backgroundColor: tint(colorCat, 0.16),
                  }}
                >
                  {cat.emoji}
                </div>

                {/* Monto y nombre inferior */}
                <div className="relative z-10 flex flex-col items-center w-full">
                  <span className="text-[12px] sm:text-[13.5px] font-extrabold tabular-nums text-[var(--fin-ink)] text-center">
                    {modoPrivacidad ? '••••' : formatMontoCompacto(cat.total)}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-[var(--fin-ink-soft)] truncate max-w-[76px] sm:max-w-[84px] text-center capitalize">
                    {cat.info.nombre}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Indicador de scroll sutil y discreto */}
        {todasCategorias.length > 4 && (
          <div className="mt-1.5 flex justify-center">
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

      {/* ── 5. Botón suave de acción rápida [ + Anotar nuevo gasto ] ─────── */}
      {onAnotar && (
        <div className="flex justify-center my-3">
          <button
            type="button"
            onClick={onAnotar}
            className="flex items-center gap-2 rounded-full border-2 border-dashed border-[var(--fin-line)] bg-[var(--fin-card)] hover:border-[var(--fin-ink-faint)] hover:bg-[var(--fin-soft)] px-5 py-2.5 text-[13.5px] font-semibold text-[var(--fin-ink)] transition-all active:scale-95 shadow-xs"
          >
            <Plus className="h-4 w-4 text-[var(--fin-ink-soft)]" />
            <span>Anotar nuevo gasto</span>
          </button>
        </div>
      )}

      {/* ── 6. Si se activó filtro por categoría ─────────────────────────── */}
      {categoriaFiltro && (
        <div className="my-2 flex items-center justify-between rounded-full bg-[var(--fin-soft)] px-4 py-1.5 text-[13px]">
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
      <div className="mt-4">
        <TransactionList
          transactions={movimientosAMostrar}
          conSenal={conSenal}
          onAbrir={onAbrirMovimiento}
          modoPrivacidad={modoPrivacidad}
        />
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
