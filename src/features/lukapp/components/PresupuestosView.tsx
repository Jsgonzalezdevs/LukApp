import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pencil, Plus, Receipt, Sparkles, Trash2, TrendingUp } from 'lucide-react';
import type { Transaction } from '../types';
import type { Presupuesto, TonoPresupuesto } from '../lib/presupuestos';
import { estadoDeTodos, promedioPorPeriodoCategoria, tonoDe } from '../lib/presupuestos';
import type { ConfigPeriodo } from '../lib/periodo';
import { useCatalogo } from '../catalogoContexto';
import { formatCop, formatAmountInput, parseAmountInput, conPuntos } from '../lib/formatCop';
import { RippleButton } from './RippleButton';

interface PresupuestosViewProps {
  presupuestos: readonly Presupuesto[];
  transacciones: readonly Transaction[];
  /** Identificador del período activo (antes siempre 'YYYY-MM'; ahora depende de `config`). */
  clave: string;
  config: ConfigPeriodo;
  hoy: string;
  umbralAlertaPct: number;
  onCambiarUmbralAlerta: (valor: number) => void;
  alertasActivas: boolean;
  onCambiarAlertasActivas: (valor: boolean) => void;
  onFijar: (categoria: string, montoCop: number) => void;
  onQuitar: (categoria: string) => void;
  /** Abre el formulario manual con la categoría ya elegida. Opcional: sin esto
   * la tarjeta flotante simplemente no ofrece ese atajo. */
  onNuevaTransaccion?: (categoria: string) => void;
}

/** Solo para el aro de aviso: el relleno de la barra ya no es esto, es el
 * color de la categoría — así se reconoce de un vistazo antes de leer texto. */
const ARO: Record<TonoPresupuesto, string | null> = {
  bien: null,
  atento: 'var(--fin-warn)',
  excedido: 'var(--fin-out)',
};

/** 16px minimum: anything smaller makes iOS zoom the page in on focus. */
const CAMPO =
  'w-full rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-2.5 text-[17px] font-normal text-[var(--fin-ink)] focus:border-[var(--fin-ink-faint)] focus:outline-none';

/** El fondo tintado detrás de cada ícono de categoría. Reusa el color que ya
 * existe por categoría (el mismo de la barra de progreso) en vez de inventar
 * uno decorativo nuevo -- este color ya significa algo, no es solo relleno. */
const InsigniaCategoria: React.FC<{
  Icono: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
}> = ({ Icono, color }) => (
  <span
    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)]"
    style={{ backgroundColor: `${color}26` }}
    aria-hidden="true"
  >
    <Icono className="h-[18px] w-[18px]" style={{ color }} />
  </span>
);

/**
 * Presupuestos: cómo va el período contra los topes que el usuario se puso.
 *
 * Lista TODAS las categorías, no solo las que ya tienen un tope -- las que
 * aún no tienen uno son la parte más importante de la pantalla, no un caso
 * escondido detrás de un botón "+Nuevo": ponerle presupuesto a algo debería
 * ser tan fácil como tocar esa categoría en la lista.
 */
export const PresupuestosView: React.FC<PresupuestosViewProps> = ({
  presupuestos,
  transacciones,
  clave,
  config,
  hoy,
  umbralAlertaPct,
  onCambiarUmbralAlerta,
  alertasActivas,
  onCambiarAlertasActivas,
  onFijar,
  onQuitar,
  onNuevaTransaccion,
}) => {
  const catalogo = useCatalogo();
  /** La categoría cuyo formulario de creación está abierto, o null. */
  const [creando, setCreando] = useState<string | null>(null);
  const [monto, setMonto] = useState('');
  /** Cuál fila tiene la tarjeta de acciones abierta. Solo una a la vez: abrir
   * otra cierra la anterior, igual que un acordeón. */
  const [abierto, setAbierto] = useState<string | null>(null);
  /** Cuál presupuesto existente se está editando — reusa el mismo form que
   * crear, pero pre-cargado y llamando a onFijar como upsert. */
  const [editando, setEditando] = useState<string | null>(null);

  const estados = useMemo(
    () => estadoDeTodos(presupuestos, transacciones, clave, hoy, config),
    [presupuestos, transacciones, clave, hoy, config],
  );

  const sinPresupuesto = useMemo(() => {
    const yaTienen = new Set(presupuestos.map((p) => p.categoria));
    return catalogo.lista.filter((c) => !yaTienen.has(c.clave));
  }, [presupuestos, catalogo]);

  const sugeridoPorCategoria = useMemo(() => {
    const mapa = new Map<string, number | null>();
    for (const c of sinPresupuesto) {
      mapa.set(c.clave, promedioPorPeriodoCategoria(transacciones, c.clave, clave, config));
    }
    return mapa;
  }, [sinPresupuesto, transacciones, clave, config]);

  const promedioCrear = useMemo(
    () => (creando === null ? null : promedioPorPeriodoCategoria(transacciones, creando, clave, config)),
    [transacciones, creando, clave, config],
  );
  const promedioEditar = useMemo(
    () => (editando === null ? null : promedioPorPeriodoCategoria(transacciones, editando, clave, config)),
    [transacciones, editando, clave, config],
  );

  const empezarCreacion = (categoria: string) => {
    setCreando(categoria);
    setMonto('');
    setAbierto(null);
  };

  const crear = (e: React.FormEvent) => {
    e.preventDefault();
    if (creando === null) return;
    const valor = parseAmountInput(monto);
    if (valor === null || valor <= 0) return;
    onFijar(creando, valor);
    setCreando(null);
    setMonto('');
  };

  const empezarEdicion = (cat: string, topeCop: number) => {
    setEditando(cat);
    setMonto(formatAmountInput(topeCop));
    setAbierto(null);
  };

  const guardarEdicion = (e: React.FormEvent) => {
    e.preventDefault();
    if (editando === null) return;
    const valor = parseAmountInput(monto);
    if (valor === null || valor <= 0) return;
    onFijar(editando, valor);
    setEditando(null);
    setMonto('');
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
        <label className="flex cursor-pointer items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[17px] leading-none"
            aria-hidden="true"
          >
            🔔
          </span>
          <span className="min-w-0 flex-1 text-[15px] font-semibold text-[var(--fin-ink)]">
            Alertas de presupuesto
          </span>
          <span className="relative inline-flex h-7 w-12 shrink-0 items-center">
            <input
              type="checkbox"
              checked={alertasActivas}
              onChange={(e) => onCambiarAlertasActivas(e.target.checked)}
              className="peer sr-only"
            />
            <span className="absolute inset-0 rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] transition-colors peer-checked:bg-[var(--fin-accent)]" />
            <span className="absolute left-1 h-5 w-5 rounded-[var(--fin-r-pill)] bg-white shadow transition-transform peer-checked:translate-x-5" />
          </span>
        </label>

        {alertasActivas ? (
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold text-[var(--fin-ink-soft)]">Umbral de alerta</span>
              <span className="text-[13px] font-bold tabular-nums text-[var(--fin-ink)]">{umbralAlertaPct}%</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={umbralAlertaPct}
              onChange={(e) => onCambiarUmbralAlerta(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--fin-accent)]"
              aria-label="Umbral de alerta de presupuesto"
            />
          </div>
        ) : null}
      </div>

      <AnimatePresence initial={false}>
      {creando !== null ? (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onSubmit={crear}
          className="overflow-hidden rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4"
        >
          <span className="flex items-center gap-1.5">
            <InsigniaCategoria Icono={catalogo.de(creando).Icono} color={catalogo.de(creando).color} />
            <span className="text-[15px] font-semibold text-[var(--fin-ink)]">
              {catalogo.de(creando).nombre}
            </span>
          </span>

          <div className="mt-3 flex items-baseline justify-between gap-2">
            <label htmlFor="pre-monto" className="text-[13px] font-semibold text-[var(--fin-ink-soft)]">
              Máximo por período
            </label>
            {promedioCrear !== null ? (
              <span className="text-[12px] text-[var(--fin-ink-faint)]">
                Sueles gastar {formatCop(promedioCrear)}
              </span>
            ) : null}
          </div>
          <input
            id="pre-monto"
            value={monto}
            onChange={(e) => setMonto(conPuntos(e.target.value))}
            inputMode="numeric"
            placeholder="0"
            autoFocus
            className={`mt-1.5 ${CAMPO}`}
          />

          <div className="mt-3 flex gap-2">
            <RippleButton
              type="submit"
              rippleColor="rgba(255,255,255,0.5)"
              className="flex-1 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-4 py-2.5 text-[15px] font-semibold text-[var(--fin-on-accent)]"
            >
              Guardar
            </RippleButton>
            <button
              type="button"
              onClick={() => setCreando(null)}
              className="rounded-[var(--fin-r-control)] border border-[var(--fin-line)] px-4 py-2.5 text-[15px] font-semibold text-[var(--fin-ink-soft)]"
            >
              Cancelar
            </button>
          </div>
        </motion.form>
      ) : null}
      </AnimatePresence>

      <ul className="flex flex-col gap-2.5">
        {estados.map((e, idx) => {
          const tono = tonoDe(e, umbralAlertaPct);
          const entrada = catalogo.de(e.categoria);
          const editandoEsta = editando === e.categoria;
          const abiertaEsta = abierto === e.categoria;

          if (editandoEsta) {
            return (
              <li key={e.categoria} className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
                <form onSubmit={guardarEdicion}>
                  <span className="flex items-center gap-1.5">
                    <InsigniaCategoria Icono={entrada.Icono} color={entrada.color} />
                    <span className="text-[15px] font-semibold text-[var(--fin-ink)]">{entrada.nombre}</span>
                  </span>

                  <div className="mt-3 flex items-baseline justify-between gap-2">
                    <label
                      htmlFor={`pre-editar-${e.categoria}`}
                      className="text-[13px] font-semibold text-[var(--fin-ink-soft)]"
                    >
                      Máximo por período
                    </label>
                    {promedioEditar !== null ? (
                      <span className="text-[12px] text-[var(--fin-ink-faint)]">
                        Sueles gastar {formatCop(promedioEditar)}
                      </span>
                    ) : null}
                  </div>
                  <input
                    id={`pre-editar-${e.categoria}`}
                    value={monto}
                    onChange={(ev) => setMonto(conPuntos(ev.target.value))}
                    inputMode="numeric"
                    placeholder="0"
                    autoFocus
                    className={`mt-1.5 ${CAMPO}`}
                  />

                  <div className="mt-3 flex gap-2">
                    <RippleButton
                      type="submit"
                      rippleColor="rgba(255,255,255,0.5)"
                      className="flex-1 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-4 py-2.5 text-[15px] font-semibold text-[var(--fin-on-accent)]"
                    >
                      Guardar
                    </RippleButton>
                    <button
                      type="button"
                      onClick={() => {
                        setEditando(null);
                        setMonto('');
                      }}
                      className="rounded-[var(--fin-r-control)] border border-[var(--fin-line)] px-4 py-2.5 text-[15px] font-semibold text-[var(--fin-ink-soft)]"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </li>
            );
          }

          return (
            <motion.li
              key={e.categoria}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(idx, 8) * 0.03, ease: 'easeOut' }}
              className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4"
            >
              <button
                type="button"
                onClick={() => setAbierto(abiertaEsta ? null : e.categoria)}
                aria-expanded={abiertaEsta}
                className="block w-full text-left"
              >
                <div className="flex items-center gap-3">
                  <InsigniaCategoria Icono={entrada.Icono} color={entrada.color} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[15px] font-semibold text-[var(--fin-ink)]">
                        {entrada.nombre}
                      </span>
                      <span className="shrink-0 text-[13px] tabular-nums text-[var(--fin-ink-soft)]">
                        <b className="text-[var(--fin-ink)]">{formatCop(e.gastadoCop)}</b> de{' '}
                        {formatCop(e.topeCop)}
                      </span>
                    </div>

                    <div
                      className="mt-1.5 h-2 overflow-hidden rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] transition-shadow"
                      role="img"
                      aria-label={`${entrada.nombre}: ${e.pctUsado}% del presupuesto`}
                      style={
                        alertasActivas && ARO[tono] ? { boxShadow: `0 0 0 1.5px ${ARO[tono]}` } : undefined
                      }
                    >
                      <div
                        className="h-full rounded-[var(--fin-r-pill)] transition-[width]"
                        style={{ width: `${Math.min(100, e.pctUsado)}%`, backgroundColor: entrada.color }}
                      />
                    </div>

                    <p className="mt-1 text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
                      {/* La proyección va SIEMPRE aparte del gasto real y nunca en su lugar: es una
                          suposición, y darla por hecha llevaría a decidir sobre plata que todavía
                          no ha salido. */}
                      {e.excedidoCop > 0 ? (
                        <span style={{ color: 'var(--fin-out)' }}>Te pasaste por {formatCop(e.excedidoCop)}.</span>
                      ) : e.vaARebasar ? (
                        <span className="inline-flex items-center gap-1" style={{ color: 'var(--fin-warn)' }}>
                          <TrendingUp className="h-3 w-3" strokeWidth={3} aria-hidden="true" />A este ritmo
                          cerrarías en {formatCop(e.proyectadoCop as number)}.
                        </span>
                      ) : (
                        <>Te quedan {formatCop(e.disponibleCop)}.</>
                      )}
                    </p>
                  </div>
                </div>
              </button>

              {abiertaEsta ? (
                <div
                  role="menu"
                  className="fin-glass shadow-medium mt-2 flex flex-col overflow-hidden rounded-[var(--fin-r-card)]"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => empezarEdicion(e.categoria, e.topeCop)}
                    className="flex items-center gap-2.5 px-3.5 py-3 text-left text-[14px] font-semibold text-[var(--fin-ink)] hover:bg-[var(--fin-card-hover)]"
                  >
                    <Pencil className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                    Editar presupuesto
                  </button>
                  {onNuevaTransaccion ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAbierto(null);
                        onNuevaTransaccion(e.categoria);
                      }}
                      className="flex items-center gap-2.5 border-t border-[var(--fin-glass-border)] px-3.5 py-3 text-left text-[14px] font-semibold text-[var(--fin-ink)] hover:bg-[var(--fin-card-hover)]"
                    >
                      <Receipt className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                      Nueva transacción
                    </button>
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAbierto(null);
                      onQuitar(e.categoria);
                    }}
                    className="flex items-center gap-2.5 border-t border-[var(--fin-glass-border)] px-3.5 py-3 text-left text-[14px] font-semibold text-[var(--fin-out)] hover:bg-[var(--fin-card-hover)]"
                  >
                    <Trash2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                    Quitar presupuesto
                  </button>
                </div>
              ) : null}
            </motion.li>
          );
        })}

        {sinPresupuesto.length > 0 ? (
          <li className="pt-1">
            <p className="px-1 pb-2 text-[13px] text-[var(--fin-ink-faint)]">Sin presupuesto establecido</p>
            <ul className="overflow-hidden rounded-[var(--fin-r-card)] bg-[var(--fin-card)]">
              {sinPresupuesto.map((c, i) => {
                const sugerido = sugeridoPorCategoria.get(c.clave) ?? null;
                return (
                  <li key={c.clave}>
                    <button
                      type="button"
                      onClick={() => empezarCreacion(c.clave)}
                      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--fin-soft)]"
                      style={{
                        boxShadow: i === sinPresupuesto.length - 1 ? undefined : 'inset 0 -1px 0 0 var(--fin-line)',
                      }}
                    >
                      <InsigniaCategoria Icono={c.Icono} color={c.color} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-[var(--fin-ink)]">{c.nombre}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-[13px] text-[var(--fin-ink-faint)]">
                          {sugerido !== null ? (
                            <>
                              <Sparkles className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                              Sueles gastar {formatCop(sugerido)}
                            </>
                          ) : (
                            'Sin presupuesto establecido'
                          )}
                        </span>
                      </span>
                      <Plus className="h-4 w-4 shrink-0 text-[var(--fin-ink-ghost)]" strokeWidth={2.5} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        ) : null}

        {estados.length === 0 && sinPresupuesto.length === 0 ? (
          <p className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4 text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
            Ponle un tope a una categoría y aquí te digo cómo vas — y si al ritmo actual te vas a
            pasar antes de que acabe el período.
          </p>
        ) : null}
      </ul>
    </section>
  );
};
