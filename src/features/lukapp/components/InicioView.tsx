import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  MessageSquare,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  X,
} from 'lucide-react';
import type { Transaction } from '../types';
import { formatCop } from '../lib/formatCop';
import { monthKeyLabel } from '../lib/localDate';
import { TransactionList } from './TransactionList';
import { AnimatedNumber } from './AnimatedNumber';
import type { Insight } from '../lib/insights';
import { useDismissedInsights } from '../data/useDismissedInsights';

interface InicioViewProps {
  /** El mes que se está mirando, en formato YYYY-MM. */
  month: string;
  onCambiarMes: () => void;
  onBuscar: () => void;
  onAjustes: () => void;
  /** Lo que hay en total: cuentas + ahorros − deudas. */
  patrimonioCop: number;
  /** Lo que salió y lo que entró este mes. */
  gastosCop: number;
  ingresosCop: number;
  /** Se llama al tocar cualquiera de las dos mitades de la pastilla. */
  onVerMes: () => void;
  movimientos: readonly Transaction[];
  conSenal?: ReadonlySet<string>;
  onAbrirMovimiento: (tx: Transaction) => void;
  /** Lo que la app notó por su cuenta este mes o generado por IA. */
  insights?: readonly (Insight & { onTocar?: () => void })[];
  cargandoIa?: boolean;
  onRefrescarInsights?: () => void;
  onConsultarAsesor?: (insight: Insight) => void;
  mostrarEfectivoSeparado?: boolean;
  saldoEfectivoCop?: number;
  saldoCuentasSinEfectivoCop?: number;
}

export const InicioView: React.FC<InicioViewProps> = ({
  month,
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
}) => {
  const { isDismissed, dismiss } = useDismissedInsights();
  const [indiceRotacion, setIndiceRotacion] = useState(0);
  const [minimizado, setMinimizado] = useState(() => {
    try {
      return localStorage.getItem('lukapp-tips-minimizado') === 'true';
    } catch {
      return false;
    }
  });

  const toggleMinimizado = (val: boolean) => {
    setMinimizado(val);
    try {
      localStorage.setItem('lukapp-tips-minimizado', String(val));
    } catch {
      // Ignorar
    }
  };

  // Filtrar insights no descartados
  const insightsVisibles = useMemo(() => {
    if (!insights) return [];
    return insights.filter((i) => !isDismissed(i.id));
  }, [insights, isDismissed]);

  // Rotar entre insights cada 50 segundos si hay múltiples
  useEffect(() => {
    if (insightsVisibles.length <= 1) return;
    const timer = setInterval(() => {
      setIndiceRotacion((prev) => (prev + 1) % insightsVisibles.length);
    }, 50000);
    return () => clearInterval(timer);
  }, [insightsVisibles.length]);

  // Ajustar índice si la lista cambió
  useEffect(() => {
    if (indiceRotacion >= insightsVisibles.length && insightsVisibles.length > 0) {
      setIndiceRotacion(0);
    }
  }, [insightsVisibles.length, indiceRotacion]);

  // El insight a mostrar
  const insightActual = insightsVisibles[insightsVisibles.length > 1 ? indiceRotacion : 0] ?? null;

  const handleAccionInsight = (insight: Insight & { onTocar?: () => void }) => {
    if (onConsultarAsesor) {
      onConsultarAsesor(insight);
    } else if (insight.onTocar) {
      insight.onTocar();
    }
  };

  return (
    <div className="flex flex-col">
      {/* Arriba: el mes a la izquierda, dos botones a la derecha */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCambiarMes}
          className="flex items-center gap-1.5 rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-3.5 py-2 text-[15px] font-semibold capitalize text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-card)]"
        >
          {monthKeyLabel(month)}
          <ChevronDown
            className="h-4 w-4 text-[var(--fin-ink-faint)]"
            strokeWidth={2.5}
            aria-hidden="true"
          />
        </button>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onBuscar}
            aria-label="Buscar un movimiento"
            className="flex h-9 w-9 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-card)] hover:text-[var(--fin-ink)]"
          >
            <Search className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onAjustes}
            aria-label="Ajustes"
            className="flex h-9 w-9 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-card)] hover:text-[var(--fin-ink)]"
          >
            <Settings2 className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* El número principal */}
      <p className="mt-6 text-center text-[13px] text-[var(--fin-ink-faint)]">Tienes en total</p>
      <button
        type="button"
        data-guia="saldo"
        onClick={onVerMes}
        className="mt-1 self-center text-center tabular-nums text-[var(--fin-ink)]"
        style={{ font: 'var(--fin-t-cifra)', letterSpacing: 'var(--fin-track-cifra)' }}
      >
        <AnimatedNumber value={patrimonioCop} format={formatCop} />
      </button>

      {mostrarEfectivoSeparado && saldoEfectivoCop !== undefined && saldoCuentasSinEfectivoCop !== undefined ? (
        <div className="mt-3 flex flex-col gap-1.5 text-center text-[14px]">
          <div className="text-[var(--fin-ink-soft)]">
            En Bancos:{' '}
            <span
              className={`font-semibold tabular-nums ${saldoCuentasSinEfectivoCop < 0 ? 'text-[var(--fin-out)]' : 'text-[var(--fin-ink)]'}`}
            >
              {formatCop(saldoCuentasSinEfectivoCop)}
            </span>
          </div>
          <div className="text-[var(--fin-ink-soft)]">
            Efectivo:{' '}
            <span className="font-semibold tabular-nums text-[var(--fin-ink)]">
              {formatCop(saldoEfectivoCop)}
            </span>
          </div>
        </div>
      ) : null}

      {/* Salidas y Entradas */}
      <div className="mt-4 flex justify-center">
        <div className="flex overflow-hidden rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)]">
          <button
            type="button"
            onClick={onVerMes}
            className="px-4 py-2.5 text-[17px] font-semibold tabular-nums transition-colors hover:opacity-85"
            style={{ color: 'var(--fin-out)' }}
          >
            ↓ <AnimatedNumber value={gastosCop} format={formatCop} />
          </button>
          <button
            type="button"
            onClick={onVerMes}
            className="border-l border-[var(--fin-line)] px-4 py-2.5 text-[17px] font-semibold tabular-nums transition-colors hover:opacity-85"
            style={{ color: 'var(--fin-in)' }}
          >
            ↑ <AnimatedNumber value={ingresosCop} format={formatCop} />
          </button>
        </div>
      </div>

      {/* "Para ti" — Tips e Insights dinámicos (ocasional / colapsable / interactivo con Asesor) */}
      {insightActual ? (
        <div className="mt-5">
          {minimizado ? (
            /* Modo discreto/compacto cuando el usuario prefiere no tenerlo fijo */
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => toggleMinimizado(false)}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--fin-line)] bg-[var(--fin-card)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--fin-ink-soft)] shadow-sm transition-all hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>Tip del Asesor: <strong className="font-semibold text-[var(--fin-ink)]">{insightActual.titulo}</strong></span>
                <ChevronDown className="h-3.5 w-3.5 text-[var(--fin-ink-faint)]" />
              </button>
            </div>
          ) : (
            /* Modo expandido completo */
            <div className="relative rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4 shadow-sm border border-[var(--fin-line)]/50 transition-all hover:border-[var(--fin-line)]">
              <div className="flex items-start gap-2.5">
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      insightActual.tono === 'atento'
                        ? 'var(--fin-out)'
                        : insightActual.tono === 'bien'
                          ? 'var(--fin-in)'
                          : 'var(--fin-ink-faint)',
                  }}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleAccionInsight(insightActual)}
                      className="text-left font-medium text-[15px] text-[var(--fin-ink)] hover:text-[var(--fin-ink)] hover:underline"
                    >
                      {insightActual.titulo}
                    </button>
                    {insightActual.origenIa && (
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-[var(--fin-soft)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--fin-ink-soft)]">
                        <Sparkles className="h-2.5 w-2.5 text-amber-500" />
                        Grok IA
                      </span>
                    )}
                  </div>

                  <p
                    onClick={() => handleAccionInsight(insightActual)}
                    className="mt-1 text-[13px] text-[var(--fin-ink-soft)] leading-relaxed cursor-pointer hover:text-[var(--fin-ink)]"
                  >
                    {insightActual.detalle}
                  </p>

                  {/* Botón directo para profundizar con el Asesor */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAccionInsight(insightActual)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fin-soft)] px-2.5 py-1 text-[11px] font-medium text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-line)]"
                    >
                      <MessageSquare className="h-3 w-3 text-amber-500" />
                      <span>Preguntarle al Asesor sobre esto</span>
                      <span className="text-[10px] text-[var(--fin-ink-faint)]">→</span>
                    </button>
                  </div>

                  {/* Controles de navegación y rotación */}
                  <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--fin-ink-faint)]">
                    {insightsVisibles.length > 1 ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setIndiceRotacion(
                              (prev) =>
                                (prev - 1 + insightsVisibles.length) % insightsVisibles.length,
                            )
                          }
                          aria-label="Insight anterior"
                          className="rounded p-1 hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <span className="font-semibold tabular-nums">
                          {indiceRotacion + 1} de {insightsVisibles.length}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setIndiceRotacion((prev) => (prev + 1) % insightsVisibles.length)
                          }
                          aria-label="Siguiente insight"
                          className="rounded p-1 hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span />
                    )}

                    <div className="flex items-center gap-2">
                      {onRefrescarInsights && (
                        <button
                          type="button"
                          onClick={onRefrescarInsights}
                          disabled={cargandoIa}
                          title="Actualizar análisis con IA"
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)] disabled:opacity-50"
                        >
                          <RefreshCw
                            className={`h-3 w-3 ${cargandoIa ? 'animate-spin text-amber-500' : ''}`}
                          />
                          <span>{cargandoIa ? 'Analizando...' : 'Actualizar'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleMinimizado(true)}
                        title="Minimizar para no dejarlo fijo"
                        className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]"
                      >
                        <ChevronUp className="h-3 w-3" />
                        <span>Minimizar</span>
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => dismiss(insightActual.id)}
                  aria-label="Cerrar insight"
                  className="shrink-0 rounded-lg p-1 text-[var(--fin-ink-faint)] hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)] transition-colors"
                >
                  <X className="h-4 w-4" strokeWidth={2.2} />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Lista de movimientos */}
      <div className="mt-7">
        <TransactionList
          transactions={movimientos}
          conSenal={conSenal}
          onAbrir={onAbrirMovimiento}
        />
      </div>
    </div>
  );
};
