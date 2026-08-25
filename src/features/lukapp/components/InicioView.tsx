import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  EyeOff,
  MessageSquare,
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
import { NovedadesCard } from './NovedadesCard';
import type { Novedad } from '../novedades';

interface InicioViewProps {
  /** El período que se está mirando, ya formateado para mostrar ("agosto 2026",
   * "18-24 ago", "Todo el tiempo" -- depende de la frecuencia elegida en Ajustes). */
  etiquetaPeriodo: string;
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
  modoPrivacidad?: boolean;
  onTogglePrivacidad?: () => void;
  today?: string;
  /** Ausente cuando no hay nada nuevo que contar, o ya se cerró. */
  novedad?: Novedad | null;
  onCerrarNovedad?: () => void;
}

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
}) => {
  const { isDismissed, dismiss } = useDismissedInsights();
  const [indiceRotacion, setIndiceRotacion] = useState(0);
  const [mostrarRachaModal, setMostrarRachaModal] = useState(false);
  const [minimizado, setMinimizado] = useState(() => {
    try {
      // Empieza minimizado salvo que el usuario ya haya elegido dejarlo abierto.
      return localStorage.getItem('lukapp-tips-minimizado') !== 'false';
    } catch {
      return true;
    }
  });

  const infoRacha = useMemo(
    () => calcularRacha(movimientos, today || new Date().toISOString().slice(0, 10)),
    [movimientos, today],
  );

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
      {/* Arriba: el mes a la izquierda, botones de privacidad, búsqueda y ajustes a la derecha */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCambiarMes}
          className="flex items-center gap-1.5 rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-3.5 py-2 text-[15px] font-semibold capitalize text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-card)]"
        >
          {etiquetaPeriodo}
          <ChevronDown
            className="h-4 w-4 text-[var(--fin-ink-faint)]"
            strokeWidth={2.5}
            aria-hidden="true"
          />
        </button>

        <div className="flex items-center gap-1.5">
          {/* Botón de Racha interactivo en la cabecera */}
          <button
            type="button"
            onClick={() => setMostrarRachaModal(true)}
            aria-label={infoRacha.anotadoHoy ? `Racha de ${infoRacha.rachaActual} días asegurada hoy` : 'Racha: anota un movimiento hoy'}
            title={infoRacha.anotadoHoy ? `🔥 Racha de ${infoRacha.rachaActual} días asegurada hoy` : '🔥 Toca para ver tu racha y medallas'}
            className={`flex h-9 items-center gap-1.5 rounded-[var(--fin-r-pill)] px-2.5 text-[13px] font-bold transition-all active:scale-95 ${
              infoRacha.anotadoHoy
                ? 'border border-orange-500/80 bg-gradient-to-r from-orange-500/20 to-amber-500/15 text-orange-400 ring-1 ring-orange-500/40 shadow-[0_0_12px_rgba(249,115,22,0.3)]'
                : 'border border-[var(--fin-line)] bg-[var(--fin-soft)] text-[var(--fin-ink-faint)] opacity-85 hover:border-[var(--fin-ink-ghost)] hover:text-[var(--fin-ink)]'
            }`}
          >
            <span className={`text-[15px] transition-transform ${infoRacha.anotadoHoy ? 'scale-110 drop-shadow-[0_0_6px_rgba(249,115,22,0.8)]' : 'grayscale opacity-75'}`}>
              🔥
            </span>
            <span className="tabular-nums font-extrabold">{infoRacha.rachaActual}</span>
          </button>

          {onTogglePrivacidad && (
            <button
              type="button"
              onClick={onTogglePrivacidad}
              aria-label={modoPrivacidad ? 'Mostrar saldos' : 'Ocultar saldos (Modo Privacidad)'}
              title={modoPrivacidad ? 'Mostrar cifras' : 'Ocultar cifras (Modo Privacidad en la calle)'}
              className={`flex h-9 w-9 items-center justify-center rounded-[var(--fin-r-pill)] transition-all active:scale-95 ${
                modoPrivacidad
                  ? 'bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/30'
                  : 'bg-[var(--fin-soft)] text-[var(--fin-ink-soft)] hover:bg-[var(--fin-card)] hover:text-[var(--fin-ink)]'
              }`}
            >
              {modoPrivacidad ? (
                <EyeOff className="h-[18px] w-[18px]" strokeWidth={2.2} />
              ) : (
                <Eye className="h-[18px] w-[18px]" strokeWidth={2.2} />
              )}
            </button>
          )}
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
      <p className="mt-6 text-center text-[13px] text-[var(--fin-ink-faint)]">
        {modoPrivacidad ? 'Tienes en total (cifras ocultas)' : 'Tienes en total'}
      </p>
      <button
        type="button"
        data-guia="saldo"
        onClick={onVerMes}
        className="mt-1 self-center text-center tabular-nums text-[var(--fin-ink)]"
        style={{ font: 'var(--fin-t-cifra)', letterSpacing: 'var(--fin-track-cifra)' }}
      >
        <AnimatedNumber
          value={patrimonioCop}
          format={(val) => (modoPrivacidad ? '$ ••••••' : formatCop(val))}
        />
      </button>

      {mostrarEfectivoSeparado && saldoEfectivoCop !== undefined && saldoCuentasSinEfectivoCop !== undefined ? (
        <div className="mt-3 flex flex-col gap-1.5 text-center text-[14px]">
          <div className="text-[var(--fin-ink-soft)]">
            En Bancos:{' '}
            <span
              className={`font-semibold tabular-nums ${saldoCuentasSinEfectivoCop < 0 ? 'text-[var(--fin-out)]' : 'text-[var(--fin-ink)]'}`}
            >
              {modoPrivacidad ? '$ ••••••' : formatCop(saldoCuentasSinEfectivoCop)}
            </span>
          </div>
          <div className="text-[var(--fin-ink-soft)]">
            Efectivo:{' '}
            <span className="font-semibold tabular-nums text-[var(--fin-ink)]">
              {modoPrivacidad ? '$ ••••••' : formatCop(saldoEfectivoCop)}
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
            ↓{' '}
            <AnimatedNumber
              value={gastosCop}
              format={(val) => (modoPrivacidad ? '$ ••••••' : formatCop(val))}
            />
          </button>
          <button
            type="button"
            onClick={onVerMes}
            className="border-l border-[var(--fin-line)] px-4 py-2.5 text-[17px] font-semibold tabular-nums transition-colors hover:opacity-85"
            style={{ color: 'var(--fin-in)' }}
          >
            ↑{' '}
            <AnimatedNumber
              value={ingresosCop}
              format={(val) => (modoPrivacidad ? '$ ••••••' : formatCop(val))}
            />
          </button>
        </div>
      </div>

      {novedad && onCerrarNovedad ? <NovedadesCard novedad={novedad} onCerrar={onCerrarNovedad} /> : null}

      {/* "Para ti" — Tips e Insights dinámicos (ocasional / colapsable / interactivo con Asesor) */}
      {insightActual ? (
        <div className="mt-5">
          {minimizado ? (
            /* Modo discreto/compacto cuando el usuario prefiere no tenerlo fijo */
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => toggleMinimizado(false)}
                className="group inline-flex items-center gap-2 rounded-full border border-[var(--fin-accent)]/25 bg-[var(--fin-card)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--fin-ink-soft)] shadow-sm transition-all hover:border-[var(--fin-accent)]/45 hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]"
              >
                <Sparkles className="h-3.5 w-3.5 text-[var(--fin-accent)]" />
                <span>Tip del Asesor: <strong className="font-semibold text-[var(--fin-ink)]">{insightActual.titulo}</strong></span>
                <ChevronDown className="h-3.5 w-3.5 text-[var(--fin-ink-faint)] transition-transform group-hover:translate-y-0.5" />
              </button>
            </div>
          ) : (
            /* Modo expandido completo */
            <div className="relative overflow-hidden rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4 shadow-sm border border-[var(--fin-accent)]/15 transition-all hover:border-[var(--fin-accent)]/30">
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
                style={{ background: 'linear-gradient(90deg, var(--fin-accent), transparent 85%)' }}
                aria-hidden="true"
              />
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
                      <span className="inline-flex items-center gap-0.5 rounded-md bg-[var(--fin-accent)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--fin-accent)]">
                        <Sparkles className="h-2.5 w-2.5" />
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
                      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fin-accent)]/10 px-2.5 py-1 text-[11px] font-medium text-[var(--fin-accent)] transition-colors hover:bg-[var(--fin-accent)]/18"
                    >
                      <MessageSquare className="h-3 w-3" />
                      <span>Preguntarle al Asesor sobre esto</span>
                      <span className="text-[10px]">→</span>
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
                            className={`h-3 w-3 ${cargandoIa ? 'animate-spin text-[var(--fin-accent)]' : ''}`}
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

      {/* Modal de detalles de racha */}
      {mostrarRachaModal && (
        <RachaModal
          infoRacha={infoRacha}
          onCerrar={() => setMostrarRachaModal(false)}
        />
      )}

      {/* Lista de movimientos */}
      <div className="mt-6">
        <TransactionList
          transactions={movimientos}
          conSenal={conSenal}
          onAbrir={onAbrirMovimiento}
          modoPrivacidad={modoPrivacidad}
        />
      </div>
    </div>
  );
};
