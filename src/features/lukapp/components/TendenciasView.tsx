import React, { useMemo, useState } from 'react';
import { COPY } from '../copy';
import { TrendingUp, Scale, Search } from 'lucide-react';
import type { Transaction } from '../types';
import {
  compararCategorias,
  compararRangos,
  promedioMensual,
  RANGOS,
  serieMensual,
  ultimosMeses,
  type MesesRango,
} from '../lib/tendencias';
import { formatCop } from '../lib/formatCop';
import { monthKeyLabel, shiftMonth } from '../lib/localDate';
import { useCatalogo } from '../catalogoContexto';
import { GraficaLineas } from './GraficaLineas';

interface TendenciasViewProps {
  transacciones: readonly Transaction[];
  /** 'YYYY-MM' the view is anchored to — the month the rest of the app shows. */
  mes: string;
}

const RANGO_INICIAL: MesesRango = 6;

export const TendenciasView: React.FC<TendenciasViewProps> = ({ transacciones, mes }) => {
  const catalogo = useCatalogo();

  // Cuántos meses se están mirando. Empieza en 6 porque es lo que había antes,
  // así que a quien ya conocía la pantalla no se le mueve el piso.
  const [rango, setRango] = useState<MesesRango>(RANGO_INICIAL);
  // El mes que se está leyendo en la gráfica. Null = el último, que es el que
  // uno mira primero al abrir.
  const [mesElegido, setMesElegido] = useState<string | null>(null);

  const serie = useMemo(
    () => serieMensual(transacciones, ultimosMeses(mes, rango)),
    [transacciones, mes, rango],
  );
  const comparacion = useMemo(
    () => compararRangos(transacciones, mes, rango),
    [transacciones, mes, rango],
  );

  const promedio = promedioMensual(serie);
  const mesAnterior = shiftMonth(mes, -1);
  const cambios = compararCategorias(transacciones, mes, mesAnterior);

  const nombreRango = RANGOS.find((r) => r.meses === rango)?.largo ?? 'periodo';

  // Al cambiar de rango el mes elegido puede quedar fuera de la ventana; en vez
  // de guardar un mes que ya no se dibuja, se cae al último de la serie.
  const mesActivo =
    mesElegido && serie.some((p) => p.month === mesElegido)
      ? mesElegido
      : (serie[serie.length - 1]?.month ?? mes);
  const puntoActivo = serie.find((p) => p.month === mesActivo);

  const mesesConDatos = serie.filter((p) => p.ingresos > 0 || p.gastos > 0).length;

  if (mesesConDatos === 0) {
    return (
      <div className="mx-auto max-w-3xl rounded-[var(--fin-r-card)] border-2 border-dashed border-[var(--fin-line)] px-6 py-12 text-center">
        <span
          className="block text-[var(--fin-ink-ghost)] mb-2 flex justify-center"
          aria-hidden="true"
        >
          <TrendingUp className="h-10 w-10" strokeWidth={1.5} />
        </span>
        <p className="mt-3 text-[17px] font-semibold text-[var(--fin-ink)]">
          {COPY.tendencias.sinDatos}
        </p>
        <p className="mt-1 text-[15px] text-[var(--fin-ink-faint)]">
          {COPY.tendencias.sinDatosHint}
        </p>
      </div>
    );
  }

  return (
    // Tres tarjetas cortas apiladas en una sola columna angosta se veían bien
    // en el celular, donde el ancho ya es el límite -- pero en un monitor de
    // escritorio dejaban dos tercios de la pantalla en negro. La barra de
    // meses (la más alta) ocupa su propia columna; las otras dos, más cortas,
    // se apilan en la segunda -- así el ancho se usa de verdad en vez de
    // solo estirar tarjetas pequeñas para que se vean más anchas.
    //
    // `w-full` es obligatorio, no cosmético: dentro de Configuración este div
    // es hijo directo de un contenedor flex, y ahí un margen `auto` en el eje
    // cruzado desactiva el stretch de flexbox y el elemento encoge a su
    // contenido en vez de llenar hasta el max-w -- por eso max-w-7xl solo no
    // alcanzaba. Con `w-full` primero llena, LUEGO max-w recorta y mx-auto
    // centra, igual que en flujo de bloque normal.
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-start gap-5 lg:grid-cols-2">
      {/* La gráfica. Antes eran barras horizontales, una fila por mes: contestaban
 "cuánto fue en marzo" pero para ver hacia dónde iba la cosa había que
 leerlas todas. La línea contesta eso de un vistazo, y tocando un mes se
 sigue viendo su cifra exacta -- sin dibujar el mismo dato dos veces. */}
      <section className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-[var(--fin-ink-soft)]">
            <TrendingUp className="mr-1.5 inline h-4 w-4 mb-0.5" aria-hidden="true" />
            {COPY.tendencias.comoVienes}
          </h2>

          {/* Trimestre, semestre y año dichos como los dice la gente frente a una
 gráfica. Un menú que dijera "reporte trimestral" sería la misma
 función con una palabra que obliga a pensar. */}
          <div
            className="flex gap-0.5 rounded-[var(--fin-r-pill)] bg-[var(--fin-bg)] p-0.5"
            role="group"
            aria-label="Cuántos meses mirar"
          >
            {RANGOS.map((r) => {
              const activo = r.meses === rango;
              return (
                <button
                  key={r.meses}
                  type="button"
                  onClick={() => setRango(r.meses)}
                  aria-pressed={activo}
                  title={`Último ${r.largo}`}
                  className={`rounded-[var(--fin-r-pill)] px-3 py-1 text-[13px] font-semibold tabular-nums transition-colors ${
                    activo
                      ? 'bg-[var(--fin-accent)] text-[var(--fin-on-accent)]'
                      : 'text-[var(--fin-ink-soft)] hover:text-[var(--fin-ink)]'
                  }`}
                >
                  {r.corto}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <GraficaLineas serie={serie} seleccionado={mesActivo} onSeleccionar={setMesElegido} />
        </div>

        {/* La lectura del mes que se está tocando. Es lo que reemplaza a la lista
 de barras: la cifra exacta sigue estando, pero solo la del mes que se
 preguntó, en vez de las doce a la vez. */}
        {puntoActivo ? (
          <div className="mt-3 rounded-[var(--fin-r-card)] bg-[var(--fin-bg)] px-4 py-3">
            <p className="text-[13px] font-semibold capitalize text-[var(--fin-ink-soft)]">
              {monthKeyLabel(puntoActivo.month)}
            </p>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-5 gap-y-1">
              <span className="flex items-center gap-1.5 text-[15px] font-semibold tabular-nums">
                <span
                  className="h-2 w-4 shrink-0 rounded-[var(--fin-r-pill)] bg-[var(--fin-in)]"
                  aria-hidden="true"
                />
                <span className="text-[var(--fin-ink-faint)]">{COPY.balance.ingresos}</span>
                <span style={{ color: 'var(--fin-in)' }}>{formatCop(puntoActivo.ingresos)}</span>
              </span>
              <span className="flex items-center gap-1.5 text-[15px] font-semibold tabular-nums">
                <span
                  className="h-2 w-4 shrink-0 rounded-[var(--fin-r-pill)] bg-[var(--fin-out)]"
                  aria-hidden="true"
                />
                <span className="text-[var(--fin-ink-faint)]">{COPY.balance.gastos}</span>
                <span style={{ color: 'var(--fin-out)' }}>{formatCop(puntoActivo.gastos)}</span>
              </span>
            </div>
          </div>
        ) : null}

        {/* La frase que interpreta la gráfica. Sin ella el usuario tiene que
 descifrar dos líneas para contestarse algo que cabe en un renglón. */}
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">
          {comparacion.hayComparacion ? (
            <>
              En este {nombreRango} llevas{' '}
              <strong className="font-semibold text-[var(--fin-ink)] tabular-nums">
                {formatCop(comparacion.actual.gastos)}
              </strong>{' '}
              de gasto,{' '}
              <strong
                className="font-semibold tabular-nums"
                style={{
                  color: comparacion.deltaGastos > 0 ? 'var(--fin-out)' : 'var(--fin-in)',
                }}
              >
                {formatCop(Math.abs(comparacion.deltaGastos))}{' '}
                {comparacion.deltaGastos > 0 ? 'más' : 'menos'}
              </strong>{' '}
              que el {nombreRango} anterior
              {comparacion.deltaGastosPct !== null
                ? ` (${comparacion.deltaGastosPct > 0 ? '+' : ''}${comparacion.deltaGastosPct}%)`
                : ''}
              .
            </>
          ) : (
            <>Todavía no hay un {nombreRango} anterior completo contra el cual comparar.</>
          )}
        </p>
      </section>

      {/* Segunda columna en escritorio: las dos tarjetas cortas juntas, para
 que no queden cada una sola estirada a lo ancho de media pantalla. */}
      <div className="flex flex-col gap-5">
        {/* Averages */}
        <section className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5">
          <h2 className="text-[15px] font-semibold text-[var(--fin-ink-soft)]">
            <Scale className="mr-1.5 inline h-4 w-4 mb-0.5" aria-hidden="true" />
            {COPY.tendencias.promedio}
          </h2>

          <div className="mt-3 grid grid-cols-3 gap-3">
            {[
              { label: COPY.balance.ingresos, valor: promedio.ingresos, color: 'var(--fin-in)' },
              { label: COPY.balance.gastos, valor: promedio.gastos, color: 'var(--fin-out)' },
              {
                label: COPY.balance.balance,
                valor: promedio.balance,
                color: promedio.balance >= 0 ? 'var(--fin-in)' : 'var(--fin-out)',
              },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-[13px] font-semibold text-[var(--fin-ink-faint)]">
                  {item.label}
                </p>
                <p className="text-[17px] font-semibold tabular-nums" style={{ color: item.color }}>
                  {formatCop(item.valor)}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-3 text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
            {COPY.tendencias.promedioNota} ({promedio.meses})
          </p>
        </section>

        {/* Month-over-month by category */}
        {cambios.length > 0 ? (
          <section className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5">
            <h2 className="text-[15px] font-semibold text-[var(--fin-ink-soft)]">
              <Search className="mr-1.5 inline h-4 w-4 mb-0.5" aria-hidden="true" />
              {COPY.tendencias.comparativo}
            </h2>
            <p className="mt-0.5 text-[13px] capitalize text-[var(--fin-ink-faint)]">
              {monthKeyLabel(mes)} vs {monthKeyLabel(mesAnterior)}
            </p>

            <ul className="mt-3 flex flex-col gap-2">
              {cambios.map((cambio) => {
                const entrada = catalogo.de(cambio.category);
                const color = entrada.color;
                const subio = cambio.deltaCop > 0;
                const nuevo = cambio.deltaPct === null && cambio.anteriorCop === 0;
                const desaparecio = cambio.actualCop === 0 && cambio.anteriorCop > 0;

                return (
                  <li
                    key={cambio.category}
                    className="flex items-center gap-3 rounded-[var(--fin-r-card)] bg-[var(--fin-bg)] px-3 py-2.5"
                  >
                    <span className="shrink-0" aria-hidden="true">
                      {(() => {
                        const Icon = entrada.Icono;
                        return <Icon className="h-4 w-4" style={{ color }} />;
                      })()}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold" style={{ color }}>
                        {entrada.nombre}
                      </p>
                      <p className="text-[13px] text-[var(--fin-ink-faint)] tabular-nums">
                        {formatCop(cambio.anteriorCop)} → {formatCop(cambio.actualCop)}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p
                        className="text-[15px] font-semibold tabular-nums"
                        style={{ color: subio ? 'var(--fin-out)' : 'var(--fin-in)' }}
                      >
                        {subio ? '+' : '−'}
                        {formatCop(Math.abs(cambio.deltaCop))}
                      </p>
                      <p className="text-[13px] font-semibold text-[var(--fin-ink-faint)]">
                        {nuevo
                          ? COPY.tendencias.nuevo
                          : desaparecio
                            ? COPY.tendencias.desaparecio
                            : cambio.deltaPct !== null
                              ? `${subio ? COPY.tendencias.subio : COPY.tendencias.bajo} ${Math.abs(cambio.deltaPct)}%`
                              : ''}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
};
