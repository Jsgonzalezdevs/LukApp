import React from 'react';
import { Star } from 'lucide-react';
import type { Transaction } from '../types';
import type { Cajita, CajitaMovimiento, CajitaTipo } from '../data/modelos';
import { ES_PASIVO, etiquetaTipoCajita } from '../data/modelos';
import { iconoDeCajita } from '../cajitaIconos';
import { idsPasivos, patrimonio, saldosPorCajita, totalPorTipo } from '../lib/cajitas';
import { formatCop } from '../lib/formatCop';
import { AnimatedNumber } from './AnimatedNumber';

interface DineroViewProps {
  transacciones: readonly Transaction[];
  cajitas: readonly Cajita[];
  movimientos: readonly CajitaMovimiento[];
  mostrarAhorro: boolean;
  /** Abre el detalle de una cuenta: historial, saldo, editar. */
  onAbrir: (cajita: Cajita) => void;
  /** Abre el espacio dedicado a tarjetas, incluso si aún no hay ninguna. */
  onAbrirTarjetas: () => void;
  onCrear: () => void;
  modoPrivacidad?: boolean;
  cuentaFavoritaId?: string | null;
}

/** Los tres grupos en que se parte la lista. */
const GRUPOS: ReadonlyArray<{ tipos: CajitaTipo[]; titulo: string }> = [
  { tipos: ['cuenta'], titulo: 'Cuentas' },
  { tipos: ['cajita'], titulo: 'Ahorros' },
  { tipos: ['tarjeta'], titulo: 'Tarjetas de crédito' },
  { tipos: ['deuda'], titulo: 'Deudas' },
];

/**
 * "Dinero": dónde está tu plata.
 *
 * Junta cinco sitios que antes estaban separados —Cuentas, Ahorro › Cajitas,
 * Ahorro › Metas, Deudas y Configuración › Ajustes— en una sola lista.
 *
 * Las metas dejaron de ser una pantalla entera (334 líneas) y son una barrita
 * debajo del nombre. Una meta no es una cosa aparte: es el objetivo de una
 * cajita, y el modelo de datos ya lo decía así (`Cajita.metaCop` existe desde
 * siempre). Tenerla como sección propia obligaba a mirar en dos sitios para
 * saber una sola cosa.
 *
 * Las deudas usan el mismo modelo con el signo al revés (`ES_PASIVO`), así que
 * aquí son el mismo tipo de fila, solo que el saldo se pinta en rojo.
 */
export const DineroView: React.FC<DineroViewProps> = ({
  transacciones,
  cajitas,
  movimientos,
  mostrarAhorro,
  onAbrir,
  onAbrirTarjetas,
  onCrear,
  modoPrivacidad = false,
  cuentaFavoritaId = null,
}) => {
  const saldos = saldosPorCajita(movimientos, transacciones, idsPasivos(cajitas));
  const vivas = cajitas.filter((c) => c.archivedAt === null);
  const resumen = patrimonio(cajitas, movimientos, transacciones);
  const reservadoCop = mostrarAhorro ? 0 : resumen.cajitasCop;
  const deudaTarjetasCop = Math.abs(totalPorTipo(cajitas, movimientos, 'tarjeta', transacciones));
  const disponibleCop = resumen.totalCop - reservadoCop - (resumen.deudasCop - deudaTarjetasCop);

  return (
    <div className="flex flex-col gap-8">
      {/* La misma cifra que en Inicio, en el mismo sitio de la pantalla. Es a
 propósito: tocaste un número y sigues viendo ese número, así que se
 entiende que entraste a su detalle y no a otra parte. */}
      <div>
        <p className="text-center text-[13px] text-[var(--fin-ink-faint)]">
          {modoPrivacidad ? 'Disponible (cifras ocultas)' : 'Disponible'}
        </p>
        <p
          className="mt-1 text-center tabular-nums text-[var(--fin-ink)]"
          style={{ font: 'var(--fin-t-cifra)', letterSpacing: 'var(--fin-track-cifra)' }}
        >
          <AnimatedNumber
            value={disponibleCop}
            format={(val) => (modoPrivacidad ? '$ ••••••' : formatCop(val))}
          />
        </p>
      </div>
      <p className="-mt-6 text-center text-[12px] text-[var(--fin-ink-faint)]">
        Saldo total menos ahorros reservados y obligaciones.
      </p>

      {vivas.length === 0 ? (
        <div className="rounded-[var(--fin-r-card)] border border-dashed border-[var(--fin-line)] px-5 py-8 text-center">
          <p className="text-[17px] font-semibold text-[var(--fin-ink)]">Empieza por tu banco</p>
          <p className="mx-auto mt-1.5 max-w-xs text-[15px] leading-relaxed text-[var(--fin-ink-soft)]">
            Agrega dónde tienes la plata y escribe cuánto hay. Lo demás se calcula solo.
          </p>
          <button
            type="button"
            onClick={onCrear}
            className="mt-5 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-5 py-3 text-[15px] font-semibold text-[var(--fin-on-accent)]"
          >
            Agregar una cuenta
          </button>
        </div>
      ) : null}

      {GRUPOS.map((grupo) => {
        const delGrupo = vivas
          .filter((c) => grupo.tipos.includes(c.tipo))
          .sort((a, b) => {
            const saldoA = saldos.get(a.id) ?? 0;
            const saldoB = saldos.get(b.id) ?? 0;
            return saldoB - saldoA;
          });
        if (delGrupo.length === 0) return null;

        return (
          <section key={grupo.titulo}>
            <div className="flex items-center justify-between px-1 pb-2">
              <h2 className="text-[13px] text-[var(--fin-ink-faint)]">{grupo.titulo}</h2>
              {grupo.tipos.length === 1 && grupo.tipos[0] === 'tarjeta' ? (
                <button
                  type="button"
                  onClick={onAbrirTarjetas}
                  className="text-[13px] font-semibold text-[var(--fin-ink-soft)] underline underline-offset-4"
                >
                  Ver todas
                </button>
              ) : null}
            </div>

            {/* Una sola tarjeta con filas separadas por una línea, como la lista
 de Ajustes de iOS. Antes cada cuenta era su propia tarjeta con su
 propio borde y su propia sombra, y doce cuentas eran doce cajas
 compitiendo entre ellas. */}
            <ul className="overflow-hidden rounded-[var(--fin-r-card)] bg-[var(--fin-card)]">
              {delGrupo.map((cajita, i) => {
                const Icono = iconoDeCajita(cajita.icon);
                const saldo = saldos.get(cajita.id) ?? 0;
                const pasivo = ES_PASIVO[cajita.tipo];
                const meta = cajita.metaCop;
                const pct = meta && meta > 0 ? Math.min(100, (saldo / meta) * 100) : null;
                const pagoMensualCop = cajita.tipo === 'tarjeta'
                  ? transacciones
                    .filter((tx) => tx.cuentaId === cajita.id && tx.cuotaCop)
                    .reduce((total, tx) => total + (tx.cuotaCop ?? 0), 0)
                  : 0;

                return (
                  <li key={cajita.id}>
                    <button
                      type="button"
                      onClick={() => onAbrir(cajita)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--fin-soft)]"
                      style={{
                        // La línea empieza donde empieza el texto, no en el
                        // borde: así se lee como una lista y no como filas
                        // sueltas. Es el patrón de Ajustes de iOS.
                        boxShadow:
                          i < delGrupo.length - 1 ? 'inset 0 -1px 0 0 var(--fin-line)' : undefined,
                      }}
                    >
                      <span
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)]"
                        aria-hidden="true"
                      >
                        <Icono className="h-5 w-5 text-[var(--fin-ink-soft)]" strokeWidth={2} />
                      </span>

                      <span className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[17px] font-semibold text-[var(--fin-ink)]">
                            {cajita.nombre}
                          </span>
                          {cajita.id === cuentaFavoritaId && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                              <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> Principal
                            </span>
                          )}
                        </div>
                        <span className="mt-0.5 block text-[12px] text-[var(--fin-ink-faint)]">
                          {cajita.tipo === 'tarjeta' && pagoMensualCop > 0
                            ? `Pago mensual estimado: ${formatCop(pagoMensualCop)}`
                            : etiquetaTipoCajita(cajita)}
                        </span>
                        {pct !== null ? (
                          <>
                            <span className="mt-1.5 block h-1 overflow-hidden rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)]">
                              <span
                                className="block h-full rounded-[var(--fin-r-pill)] bg-[var(--fin-in)]"
                                style={{ width: `${pct}%` }}
                              />
                            </span>
                            <span className="mt-1 block text-[13px] text-[var(--fin-ink-faint)]">
                              {Math.round(pct)}% de {formatCop(meta ?? 0)}
                            </span>
                          </>
                        ) : null}
                      </span>

                      <span
                        className="shrink-0 text-[17px] font-semibold tabular-nums"
                        style={{ color: pasivo ? 'var(--fin-out)' : 'var(--fin-ink)' }}
                      >
                        {modoPrivacidad ? '$ ••••••' : formatCop(saldo)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {vivas.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCrear}
            className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] px-4 py-3.5 text-[15px] font-semibold text-[var(--fin-ink-soft)] transition-colors hover:text-[var(--fin-ink)]"
          >
            Agregar cuenta
          </button>
          <button
            type="button"
            onClick={onAbrirTarjetas}
            className="rounded-[var(--fin-r-card)] bg-[var(--fin-soft)] px-4 py-3.5 text-[15px] font-semibold text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-line)]"
          >
            Tarjetas de crédito
          </button>
        </div>
      ) : null}
    </div>
  );
};
