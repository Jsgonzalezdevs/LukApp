import React, { useId, useMemo } from 'react';
import type { PuntoMensual } from '../lib/tendencias';
import { formatCop } from '../lib/formatCop';
import { monthKeyShort } from '../lib/localDate';

interface GraficaLineasProps {
  serie: readonly PuntoMensual[];
  /** El mes que está seleccionado, o null para no destacar ninguno. */
  seleccionado: string | null;
  onSeleccionar: (month: string) => void;
}

/* El lienzo. Coordenadas fijas y el SVG escalado por CSS: así una sola geometría
   sirve igual en un celular de 360px que en un monitor, sin recalcular nada al
   redimensionar ni depender de medir el DOM. */
const ANCHO = 340;
const ALTO = 150;
const PAD_X = 10;
const PAD_ARRIBA = 14;
const PAD_ABAJO = 22; // deja sitio para los nombres de los meses

/**
 * Dos líneas -- lo que entró y lo que salió -- a lo largo de los meses.
 *
 * Por qué líneas y no las barras que ya había: una barra contesta "cuánto fue
 * este mes" y hay que leerlas una por una para ver hacia dónde va la cosa. Una
 * línea contesta "hacia dónde voy" de un vistazo, que es la pregunta que uno
 * trae cuando abre una gráfica de varios meses. Las barras siguen abajo, para
 * la lectura mes a mes.
 *
 * Las dos líneas comparten escala vertical a propósito. Dibujar cada una con su
 * propio techo las haría ver siempre cruzándose y del mismo tamaño, y se
 * perdería lo único que importa de verdad: cuál de las dos va por encima.
 */
export const GraficaLineas: React.FC<GraficaLineasProps> = ({
  serie,
  seleccionado,
  onSeleccionar,
}) => {
  const idIn = useId();
  const idOut = useId();

  const geometria = useMemo(() => {
    // El techo es el máximo entre AMBAS series, nunca el de cada una: es lo que
    // hace que la altura signifique lo mismo en las dos líneas.
    const techo = Math.max(1, ...serie.map((p) => Math.max(p.ingresos, p.gastos)));
    const util = ANCHO - PAD_X * 2;
    // Con un solo mes no hay tramo que repartir; dividir por cero dejaría el
    // punto en NaN y el SVG entero sin pintar.
    const paso = serie.length > 1 ? util / (serie.length - 1) : 0;

    const x = (i: number) => PAD_X + paso * i;
    const y = (valor: number) =>
      ALTO - PAD_ABAJO - (valor / techo) * (ALTO - PAD_ARRIBA - PAD_ABAJO);

    const puntos = serie.map((p, i) => ({
      ...p,
      x: x(i),
      yIn: y(p.ingresos),
      yOut: y(p.gastos),
    }));

    const linea = (clave: 'yIn' | 'yOut') =>
      puntos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p[clave]}`).join(' ');

    // El área bajo cada línea: un relleno muy tenue que da volumen sin competir
    // con la línea. Se cierra contra la base del lienzo.
    const area = (clave: 'yIn' | 'yOut') =>
      puntos.length > 1
        ? `${linea(clave)} L ${puntos[puntos.length - 1].x} ${ALTO - PAD_ABAJO} L ${puntos[0].x} ${ALTO - PAD_ABAJO} Z`
        : '';

    return {
      puntos,
      lineaIn: linea('yIn'),
      lineaOut: linea('yOut'),
      areaIn: area('yIn'),
      areaOut: area('yOut'),
      baseY: ALTO - PAD_ABAJO,
    };
  }, [serie]);

  return (
    <svg
      viewBox={`0 0 ${ANCHO} ${ALTO}`}
      className="w-full"
      style={{ height: 'auto' }}
      role="img"
      aria-label={`Ingresos y gastos de los últimos ${serie.length} meses`}
    >
      <defs>
        <linearGradient id={idIn} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--fin-in)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--fin-in)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={idOut} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--fin-out)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--fin-out)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* La base. Sin rejilla completa: las líneas horizontales de fondo compiten
          con las dos que sí llevan información. */}
      <line
        x1={PAD_X}
        y1={geometria.baseY}
        x2={ANCHO - PAD_X}
        y2={geometria.baseY}
        stroke="var(--fin-line)"
        strokeWidth="1"
      />

      {geometria.areaOut ? <path d={geometria.areaOut} fill={`url(#${idOut})`} /> : null}
      {geometria.areaIn ? <path d={geometria.areaIn} fill={`url(#${idIn})`} /> : null}

      <path
        d={geometria.lineaOut}
        fill="none"
        stroke="var(--fin-out)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={geometria.lineaIn}
        fill="none"
        stroke="var(--fin-in)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {geometria.puntos.map((p) => {
        const activo = p.month === seleccionado;
        return (
          <g key={p.month}>
            {/* La guía vertical del mes elegido, para poder seguir la columna
                hasta su nombre abajo. */}
            {activo ? (
              <line
                x1={p.x}
                y1={PAD_ARRIBA - 6}
                x2={p.x}
                y2={geometria.baseY}
                stroke="var(--fin-ink-ghost)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
            ) : null}

            <circle
              cx={p.x}
              cy={p.yOut}
              r={activo ? 4.5 : 3}
              fill="var(--fin-out)"
              stroke="var(--fin-bg)"
              strokeWidth="1.5"
            />
            <circle
              cx={p.x}
              cy={p.yIn}
              r={activo ? 4.5 : 3}
              fill="var(--fin-in)"
              stroke="var(--fin-bg)"
              strokeWidth="1.5"
            />

            <text
              x={p.x}
              y={ALTO - 7}
              textAnchor="middle"
              fontSize="10"
              fontWeight={activo ? 700 : 500}
              fill={activo ? 'var(--fin-ink)' : 'var(--fin-ink-faint)'}
            >
              {monthKeyShort(p.month)}
            </text>

            {/* La zona que se toca. Va al final para quedar encima de todo, y es
                mucho más ancha que el punto: en un celular nadie acierta un
                círculo de 3px, y un objetivo pequeño se siente como que la
                gráfica no responde. */}
            <rect
              x={p.x - (ANCHO - PAD_X * 2) / Math.max(serie.length, 1) / 2}
              y={0}
              width={(ANCHO - PAD_X * 2) / Math.max(serie.length, 1)}
              height={ALTO}
              fill="transparent"
              className="cursor-pointer"
              onClick={() => onSeleccionar(p.month)}
              role="button"
              tabIndex={0}
              aria-label={`${monthKeyShort(p.month)}: entró ${formatCop(p.ingresos)}, salió ${formatCop(p.gastos)}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSeleccionar(p.month);
                }
              }}
            />
          </g>
        );
      })}
    </svg>
  );
};
