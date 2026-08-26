import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Lock, Sparkles } from 'lucide-react';
import type { Transaction } from '../types';
import type { CategorySlice, MonthTotals } from '../lib/aggregate';
import { formatCop } from '../lib/formatCop';
import { monthKeyLabel } from '../lib/localDate';
import { etiquetaDePeriodo, type ConfigPeriodo } from '../lib/periodo';
import { resumenDelMes, esResumenMesHabilitado, diaDesbloqueoResumen } from '../lib/resumenMes';
import { descargarExcel } from '../lib/exportarExcel';
import { CategoryBreakdown } from './CategoryBreakdown';
import { DetalleMes } from './DetalleMes';
import { ResumenWrapped } from './ResumenWrapped';
import { TendenciasView } from './TendenciasView';
import { RippleButton } from './RippleButton';
import { AnimatedNumber } from './AnimatedNumber';

interface MesViewProps {
  /** El período activo -- 'YYYY-MM' si la frecuencia es mensual sin desfase
   * (como siempre), o la clave que le corresponda a cualquier otra frecuencia. */
  clave: string;
  config: ConfigPeriodo;
  maxClave: string;
  /** Mes calendario real que contiene el período activo -- SIEMPRE 'YYYY-MM',
   * sin importar la frecuencia elegida. Lo usan las partes de esta pantalla
   * que a propósito se quedaron ancladas al mes calendario (el resumen tipo
   * Wrapped, el detalle por día, las tendencias) en vez de seguir un período
   * que puede ser una semana o una quincena. */
  mesCalendario: string;
  hoy: string;
  onCambiarPeriodo: (clave: string) => void;
  shift: (clave: string, pasos: number) => string;
  totals: MonthTotals;
  gastos: readonly CategorySlice[];
  ingresos: readonly CategorySlice[];
  delMes: readonly Transaction[];
  transacciones: readonly Transaction[];
  /** Los topes de gasto, que se editan desde Ajustes pero se leen aquí. */
  topes?: React.ReactNode;
}

/**
 * "Mes": todo lo que la app calcula a partir de tus movimientos.
 *
 * Esta es la pantalla que puede medir 3.000 píxeles, y está bien que los mida:
 * aquí uno entra a estudiar cómo le fue, no a mirar de pasada. El problema
 * antes era que TODO esto vivía en la pantalla de inicio, o sea en la que se
 * abre veinte veces al día para anotar un almuerzo. Mezclar las dos cosas
 * obligaba a bajar cinco pantallas para llegar a lo que se usa a diario.
 *
 * Aquí sí tiene sentido el balance del mes como número grande: es la respuesta
 * a la pregunta que uno viene a hacer. En Inicio no lo tenía, porque allá la
 * pregunta es otra ("cuánto tengo") y dos números gigantes juntos no dejan ver
 * ninguno de los dos.
 */
export const MesView: React.FC<MesViewProps> = ({
  clave,
  config,
  maxClave,
  mesCalendario,
  hoy,
  onCambiarPeriodo,
  shift,
  totals,
  gastos,
  ingresos,
  delMes,
  transacciones,
  topes,
}) => {
  const positivo = totals.balance >= 0;
  const sinNavegacion = config.frecuencia === 'todo-el-tiempo';
  const anterior = shift(clave, -1);
  const siguiente = shift(clave, 1);
  // No se puede navegar al futuro: no hay nada que mirar allá. En "todo el
  // tiempo" no hay periodo anterior ni siguiente que mostrar, punto.
  const haySiguiente = !sinNavegacion && siguiente <= maxClave;
  const etiquetaPeriodo = etiquetaDePeriodo(clave, config);

  const [resumenAbierto, setResumenAbierto] = useState(false);
  const habilitado = useMemo(
    () => esResumenMesHabilitado(mesCalendario, hoy),
    [mesCalendario, hoy],
  );
  const diaDesbloqueo = useMemo(() => diaDesbloqueoResumen(mesCalendario), [mesCalendario]);

  // Se calcula solo al abrir: recorre todo el historial (para el promedio de
  // comparación), y esta pantalla se renderiza mucho más seguido de lo que
  // alguien va a tocar "Tu resumen".
  const tarjetasResumen = useMemo(
    () => (resumenAbierto && habilitado ? resumenDelMes(transacciones, mesCalendario, hoy) : []),
    [resumenAbierto, habilitado, transacciones, mesCalendario, hoy],
  );

  return (
    <div className="flex flex-col gap-8">
      {/* El selector de mes, que aquí sí merece su fila: es el control principal
 de la pantalla, porque todo lo de abajo depende de él. */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onCambiarPeriodo(anterior)}
          disabled={sinNavegacion}
          aria-label="Período anterior"
          className="flex h-9 w-9 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)] disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
        </button>
        <h1
          className="capitalize text-[var(--fin-ink)]"
          style={{ font: 'var(--fin-t-titulo)', letterSpacing: 'var(--fin-track-titulo)' }}
        >
          {etiquetaPeriodo}
        </h1>
        <button
          type="button"
          onClick={() => haySiguiente && onCambiarPeriodo(siguiente)}
          disabled={!haySiguiente}
          aria-label="Período siguiente"
          className="flex h-9 w-9 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)] disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>

      {habilitado ? (
        <RippleButton
          type="button"
          onClick={() => setResumenAbierto(true)}
          rippleColor="rgba(255,255,255,0.5)"
          className="flex items-center gap-3 rounded-[var(--fin-r-card)] bg-[var(--fin-accent)] px-4 py-3.5 text-left text-[var(--fin-on-accent)] transition-transform active:scale-[0.99]"
        >
          <Sparkles className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">Tu resumen de {monthKeyLabel(mesCalendario)}</span>
            <span className="mt-0.5 block text-[13px] opacity-70">
              Lo mejor y lo raro del mes, en una historia
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 opacity-60" strokeWidth={2.5} aria-hidden="true" />
        </RippleButton>
      ) : (
        <div
          className="flex items-center gap-3 rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-soft)] px-4 py-3 text-left text-[var(--fin-ink-faint)] select-none opacity-80"
          title={`El resumen se habilita el día ${diaDesbloqueo} de ${monthKeyLabel(mesCalendario)}`}
        >
          <Sparkles className="h-5 w-5 shrink-0 opacity-30 text-[var(--fin-ink-ghost)]" strokeWidth={2} aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="block text-[14px] font-semibold text-[var(--fin-ink-soft)]">
                Tu resumen de {monthKeyLabel(mesCalendario)}
              </span>
              <span className="rounded-[var(--fin-r-pill)] bg-[var(--fin-card)] border border-[var(--fin-line)] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--fin-ink-faint)] uppercase">
                Próximamente
              </span>
            </div>
            <span className="mt-0.5 block text-[12px] text-[var(--fin-ink-faint)]">
              Se habilita el {diaDesbloqueo} de {monthKeyLabel(mesCalendario).split(' ')[0]} (2 días antes de fin de mes)
            </span>
          </span>
          <Lock className="h-4 w-4 shrink-0 opacity-40 text-[var(--fin-ink-ghost)]" strokeWidth={2} aria-hidden="true" />
        </div>
      )}

      <div>
        <p className="text-center text-[13px] text-[var(--fin-ink-faint)]">
          {positivo ? 'Te sobró' : 'Te faltó'}
        </p>
        <p
          className="mt-1 text-center tabular-nums"
          style={{
            font: 'var(--fin-t-cifra)',
            letterSpacing: 'var(--fin-track-cifra)',
            color: positivo ? 'var(--fin-in)' : 'var(--fin-out)',
          }}
        >
          <AnimatedNumber value={totals.balance} format={formatCop} />
        </p>
        <p className="mt-2 text-center text-[15px] text-[var(--fin-ink-soft)] tabular-nums">
          Entró <AnimatedNumber value={totals.ingresos} format={formatCop} /> · Salió{' '}
          <AnimatedNumber value={totals.gastos} format={formatCop} />
        </p>
      </div>

      {topes}

      {/* Un solo dibujo por dato. Antes el reparto por categoría se pintaba dos
 veces en la misma pantalla —una barra apilada arriba y estas barras
 horizontales abajo— y encima con distinta precisión: la misma categoría
 podía leerse 23% en un sitio y 22,6% en el otro. */}
      <CategoryBreakdown title="En qué se te va" slices={gastos} />
      <CategoryBreakdown title="De dónde entra" slices={ingresos} />

      <DetalleMes delMes={delMes} transacciones={transacciones} mes={mesCalendario} />

      <TendenciasView transacciones={transacciones} mes={mesCalendario} />

      {delMes.length > 0 ? (
        <div className="flex items-center justify-center pt-2 pb-1">
          <button
            type="button"
            onClick={() => {
              descargarExcel(
                {
                  transacciones: delMes as any,
                  cajitas: [],
                  cajitaMovimientos: [],
                  contactos: [],
                  presupuestos: [],
                  metas: [],
                  recurrentes: [],
                  categorias: [],
                },
                {},
                // `delMes` ya viene filtrado exactamente al período activo -- sin
                // `mesFiltro` no se vuelve a filtrar por prefijo de mes, que
                // recortaría datos válidos si el período no es un mes calendario.
                undefined,
                clave,
              );
            }}
            className="flex items-center gap-2 rounded-[var(--fin-r-pill)] border border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-2.5 text-[13px] font-semibold text-[var(--fin-ink-soft)] shadow-sm transition-all hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)] active:scale-95"
          >
            <Download className="h-4 w-4" strokeWidth={2.25} />
            Exportar {etiquetaPeriodo} a Excel (.xls)
          </button>
        </div>
      ) : null}

      {resumenAbierto ? (
        <ResumenWrapped tarjetas={tarjetasResumen} onCerrar={() => setResumenAbierto(false)} />
      ) : null}
    </div>
  );
};
