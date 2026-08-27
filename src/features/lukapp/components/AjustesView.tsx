import React from 'react';
import { ChevronRight, Clock } from 'lucide-react';
import { PANELES_AJUSTES } from '../sections';
import type { PanelAjustes } from '../sections';
import { useRecordatorioRacha } from '../data/usePreferencias';

interface AjustesViewProps {
  onAbrir: (panel: PanelAjustes) => void;
  temaToggle?: React.ReactNode;
  cuenta?: { email: string; onSalir: () => void };
  mostrarAhorro: boolean;
  onMostrarAhorro: (valor: boolean) => void;
  mostrarEfectivoSeparado: boolean;
  onMostrarEfectivoSeparado: (valor: boolean) => void;
  /** Ausente mientras la guía ya está visible: no hay nada que volver a abrir. */
  onVolverAVerGuia?: () => void;
  esAdmin?: boolean;
}

/** Cada panel con su emoji. Van aquí y no en sections.ts para que ese fichero
 * siga siendo solo datos. Un emoji en vez de un ícono de trazo: ya trae su
 * propio color y forma reconocible de un vistazo, así que una fila se
 * distingue de otra sin tener que leer el título -- sin inventar un sistema
 * de colores decorativos nuevo (ver el comentario de SECTIONS en
 * sections.ts sobre por qué el color ahí significa solo entrada/salida). */
const ICONOS: Record<PanelAjustes, string> = {
  categorias: '🏷️',
  topes: '🎯',
  periodo: '🗓️',
  metas: '🚩',
  recurrentes: '🔁',
  compartido: '👫',
  'dividir-cuenta': '🍽️',
  vaquitas: '🐮',
  fiscal: '🛡️',
  extractos: '📥',
  atajos: '💳',
  gmf: '🏛️',
  nombres: '👥',
  contraseña: '🔑',
  respaldo: '💾',
  'funciones-solicitadas': '🔧',
  cuenta: '☁️',
};

/** Los bloques en que se parte la lista. Agrupar por tema hace que no haya
 * que leer las filas para encontrar una. */
const BLOQUES: ReadonlyArray<{ titulo: string; paneles: readonly PanelAjustes[] }> = [
  { titulo: 'Tu dinero', paneles: ['categorias', 'topes', 'periodo', 'metas', 'recurrentes', 'compartido'] },
  { titulo: 'Herramientas', paneles: ['dividir-cuenta', 'vaquitas', 'fiscal', 'extractos', 'atajos', 'gmf'] },
  { titulo: 'Tus datos', paneles: ['nombres', 'respaldo'] },
  { titulo: 'Comunidad', paneles: ['funciones-solicitadas'] },
];

/** Una fila de la lista: icono, nombre, explicación debajo, y flecha. */
const Fila: React.FC<{
  icono: string;
  titulo: string;
  ayuda?: string;
  ultima: boolean;
  onClick: () => void;
}> = ({ icono, titulo, ayuda, ultima, onClick }) => (
  <li>
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--fin-soft)]"
      style={{ boxShadow: ultima ? undefined : 'inset 0 -1px 0 0 var(--fin-line)' }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[19px] leading-none"
        aria-hidden="true"
      >
        {icono}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-semibold text-[var(--fin-ink)]">{titulo}</span>
        {ayuda ? (
          <span className="mt-0.5 block text-[15px] leading-snug text-[var(--fin-ink-soft)]">
            {ayuda}
          </span>
        ) : null}
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-[var(--fin-ink-ghost)]"
        strokeWidth={2.5}
        aria-hidden="true"
      />
    </button>
  </li>
);

/**
 * Ajustes: todo lo que se configura una vez y no se vuelve a tocar.
 *
 * Antes esto eran 6 pestañas en una barra marcada `hidden lg:grid`, y ese
 * detalle escondía un bug de verdad: en el celular la barra nunca se pintaba,
 * así que el estado se quedaba siempre en 'ajustes' y Categorías, el 4x1000, el
 * Respaldo y el Informe eran imposibles de abrir desde un teléfono. 830 líneas
 * de código que no se podían alcanzar.
 *
 * Como lista de filas, existen en todas partes. Y encima caben las cosas que
 * antes ocupaban un puesto de navegación permanente sin merecerlo: importar
 * extractos del banco se usa 0 o 2 veces al año y era la vista más grande de
 * toda la app.
 */
export const AjustesView: React.FC<AjustesViewProps> = ({
  onAbrir,
  temaToggle,
  cuenta,
  mostrarAhorro,
  onMostrarAhorro,
  mostrarEfectivoSeparado,
  onMostrarEfectivoSeparado,
  onVolverAVerGuia,
  esAdmin,
}) => {
  const recordatorio = useRecordatorioRacha();

  return (
    <div className="flex flex-col gap-7">
      <h1
        className="px-1 text-[var(--fin-ink)]"
        style={{ font: 'var(--fin-t-titulo-xl)', letterSpacing: 'var(--fin-track-titulo-xl)' }}
      >
        Ajustes
      </h1>

    {BLOQUES.map((bloque) => (
      <section key={bloque.titulo}>
        <h2 className="px-1 pb-2 text-[13px] text-[var(--fin-ink-faint)]">{bloque.titulo}</h2>
        <ul className="overflow-hidden rounded-[var(--fin-r-card)] bg-[var(--fin-card)]">
          {bloque.paneles.map((id, i) => {
            const def = PANELES_AJUSTES.find((p) => p.id === id);
            if (!def) return null;
            return (
              <Fila
                key={id}
                icono={ICONOS[id]}
                titulo={def.label}
                ayuda={def.ayuda}
                ultima={i === bloque.paneles.length - 1}
                onClick={() => onAbrir(id)}
              />
            );
          })}
        </ul>
      </section>
    ))}

    <section>
      <h2 className="px-1 pb-2 text-[13px] text-[var(--fin-ink-faint)]">La app</h2>
      <div className="overflow-hidden rounded-[var(--fin-r-card)] bg-[var(--fin-card)]">
        {/* Este interruptor vivía escondido dentro de una vista de contenido, que
 es el sitio donde nadie va a buscar un ajuste. */}
        <label
          className="flex cursor-pointer items-center gap-3 px-4 py-3.5"
          style={{ boxShadow: 'inset 0 -1px 0 0 var(--fin-line)' }}
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[19px] leading-none"
            aria-hidden="true"
          >
            🐷
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-semibold text-[var(--fin-ink)]">
              Contar los ahorros
            </span>
            <span className="mt-0.5 block text-[15px] leading-snug text-[var(--fin-ink-soft)]">
              Suma lo que tienes guardado al total de arriba
            </span>
          </span>
          <input
            type="checkbox"
            checked={mostrarAhorro}
            onChange={(e) => onMostrarAhorro(e.target.checked)}
            className="h-6 w-6 shrink-0 accent-[var(--fin-in)]"
          />
        </label>

        <label
          className="flex cursor-pointer items-center gap-3 px-4 py-3.5"
          style={{
            boxShadow:
              onVolverAVerGuia || temaToggle || cuenta
                ? 'inset 0 -1px 0 0 var(--fin-line)'
                : undefined,
          }}
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[19px] leading-none"
            aria-hidden="true"
          >
            💵
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-semibold text-[var(--fin-ink)]">
              Mostrar efectivo por separado
            </span>
            <span className="mt-0.5 block text-[15px] leading-snug text-[var(--fin-ink-soft)]">
              Desglosar el dinero en efectivo del total
            </span>
          </span>
          <input
            type="checkbox"
            checked={mostrarEfectivoSeparado}
            onChange={(e) => onMostrarEfectivoSeparado(e.target.checked)}
            className="h-6 w-6 shrink-0 accent-[var(--fin-in)]"
          />
        </label>

        {/* Recordatorio de Racha */}
        <div
          className="flex flex-col px-4 py-3.5"
          style={{
            boxShadow:
              onVolverAVerGuia || temaToggle || cuenta
                ? 'inset 0 -1px 0 0 var(--fin-line)'
                : undefined,
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[19px] leading-none"
                aria-hidden="true"
              >
                🔔
              </span>
              <div className="min-w-0 flex-1">
                <span className="block text-[17px] font-semibold text-[var(--fin-ink)]">
                  Recordatorio diario de racha
                </span>
                <span className="mt-0.5 block text-[15px] leading-snug text-[var(--fin-ink-soft)]">
                  Notificación si aún no has anotado gastos hoy
                </span>
              </div>
            </div>

            <input
              type="checkbox"
              checked={recordatorio.activo}
              onChange={async (e) => {
                if (e.target.checked) {
                  await recordatorio.activarRecordatorio();
                } else {
                  recordatorio.desactivarRecordatorio();
                }
              }}
              className="h-6 w-6 shrink-0 accent-amber-500"
            />
          </div>

          {recordatorio.activo && (
            <div className="mt-3 ml-12 flex items-center justify-between border-t border-[var(--fin-line)]/50 pt-2.5">
              <span className="text-[13px] font-medium text-[var(--fin-ink-soft)] flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                Hora de aviso:
              </span>
              <input
                type="time"
                value={recordatorio.hora}
                onChange={(e) => recordatorio.cambiarHora(e.target.value)}
                className="rounded-lg border border-[var(--fin-line)] bg-[var(--fin-bg)] px-2.5 py-1 text-[16px] font-bold tabular-nums text-[var(--fin-ink)] focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          )}
        </div>

        {onVolverAVerGuia ? (
          <button
            type="button"
            onClick={onVolverAVerGuia}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--fin-soft)]"
            style={{ boxShadow: 'inset 0 -1px 0 0 var(--fin-line)' }}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[19px] leading-none"
              aria-hidden="true"
            >
              🚀
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-semibold text-[var(--fin-ink)]">
                Volver a ver la guía
              </span>
              <span className="mt-0.5 block text-[15px] leading-snug text-[var(--fin-ink-soft)]">
                Te vuelve a señalar cómo funciona la app
              </span>
            </span>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-[var(--fin-ink-ghost)]"
              strokeWidth={2.5}
              aria-hidden="true"
            />
          </button>
        ) : null}

        {esAdmin ? (
          <button
            type="button"
            onClick={() => {
              window.location.href = '/ecosistema';
            }}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--fin-soft)]"
            style={{ boxShadow: temaToggle || cuenta ? 'inset 0 -1px 0 0 var(--fin-line)' : undefined }}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-purple-500/15 text-[19px] leading-none"
              aria-hidden="true"
            >
              🛡️
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-semibold text-[var(--fin-ink)]">
                Ecosistema / Superadmin
              </span>
              <span className="mt-0.5 block text-[15px] leading-snug text-[var(--fin-ink-soft)]">
                Lanzador de aplicaciones, administración y analítica
              </span>
            </span>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-[var(--fin-ink-ghost)]"
              strokeWidth={2.5}
              aria-hidden="true"
            />
          </button>
        ) : null}

        {temaToggle ? (
          <div
            className="flex items-center justify-between gap-3 px-4 py-3.5"
            style={{ boxShadow: cuenta ? 'inset 0 -1px 0 0 var(--fin-line)' : undefined }}
          >
            <span className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[19px] leading-none"
                aria-hidden="true"
              >
                🌗
              </span>
              <span className="text-[17px] font-semibold text-[var(--fin-ink)]">Apariencia</span>
            </span>
            {temaToggle}
          </div>
        ) : null}

        {cuenta ? (
          <button
            type="button"
            onClick={() => onAbrir('cuenta')}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--fin-soft)]"
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[19px] leading-none"
              aria-hidden="true"
            >
              ☁️
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-semibold text-[var(--fin-ink)]">Cuenta</span>
              <span className="mt-0.5 block truncate text-[15px] text-[var(--fin-ink-soft)]">
                {cuenta.email}
              </span>
            </span>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-[var(--fin-ink-ghost)]"
              strokeWidth={2.5}
              aria-hidden="true"
            />
          </button>
        ) : null}
      </div>
    </section>
  </div>
  );
};
