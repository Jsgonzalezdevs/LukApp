import React from 'react';

interface EstrellaAvatarProps {
  className?: string;
  size?: number;
  emotion?: 'happy' | 'thinking' | 'surprised' | 'sad';
  /** Grados AÑADIDOS a la pose de reposo de cada brazo. 0 = reposo. */
  armRotation?: { left: number; right: number };
  /** Grados AÑADIDOS a la pierna recta. 0 = reposo. */
  legRotation?: { left: number; right: number };
  headTilt?: number;
}

/* Geometría trazada píxel a píxel del arte oficial (public/brand/lukapp-estrella.png):
   se aisló cada región por color (cuerpo lila vs. extremidades moradas), se
   siguió su contorno real con un algoritmo de border-tracing (Moore-neighbor)
   y se simplificó con Ramer-Douglas-Peucker sin forzar simetría -- cada
   esquina conserva su propio radio, tal como salió en el dibujo original. Si
   el arte cambia, hay que repetir ese proceso; estas cifras no se ajustan a
   mano. */
const CUERPO_ESTRELLA =
  'M 25.98,32.4 L 27.65,29.33 L 30.73,28.77 L 78.49,38.27 L 79.89,36.59 L 80.45,2.79 L 82.96,0.28 ' +
  'L 87.43,1.96 L 112.01,34.36 L 144.13,13.69 L 148.88,13.69 L 150.28,17.32 L 142.18,54.75 L 143.85,55.87 ' +
  'L 179.05,60.61 L 182.4,63.13 L 181.28,67.32 L 148.6,86.03 L 155.87,124.3 L 155.31,128.21 L 151.4,129.61 ' +
  'L 120.95,112.85 L 113.97,110.61 L 107.26,114.53 L 72.07,142.18 L 66.76,142.18 L 65.64,138.55 L 68.44,104.75 ' +
  'L 67.04,101.4 L 30.17,110.06 L 27.09,109.22 L 25.98,107.54 L 26.26,104.47 L 50.56,70.39 L 50.0,67.88 Z';

const BRAZO_DERECHO =
  'M 148.88,86.31 L 154.75,82.4 L 155.87,83.24 L 197.49,116.2 L 199.72,120.11 L 198.6,124.86 ' +
  'L 194.97,127.37 L 191.9,127.37 L 189.11,125.98 L 151.4,96.09 L 150.28,94.97 Z';

const BRAZO_IZQUIERDO =
  'M 0.28,42.74 L 3.35,38.83 L 4.75,38.27 L 9.5,38.83 L 43.3,59.22 L 50.0,68.72 L 49.44,72.07 ' +
  'L 46.37,75.98 L 2.79,49.72 L 0.28,46.37 Z';

const PIERNA_IZQUIERDA =
  'M 67.6,196.93 L 70.11,193.58 L 78.21,190.78 L 79.89,189.11 L 81.28,185.75 L 82.12,173.74 ' +
  'L 82.68,134.08 L 96.93,123.18 L 96.65,184.36 L 94.97,196.37 L 94.13,198.04 L 89.94,201.68 ' +
  'L 84.64,204.19 L 77.93,205.87 L 73.74,205.87 L 69.83,204.19 L 67.6,200.84 Z';

const PIERNA_DERECHA =
  'M 105.31,183.52 L 106.98,143.02 L 107.26,120.67 L 106.7,115.64 L 112.29,111.45 L 116.48,111.17 ' +
  'L 121.23,113.41 L 120.39,185.47 L 121.23,188.55 L 123.18,191.34 L 130.17,193.85 L 133.24,196.37 ' +
  'L 133.8,201.68 L 131.56,205.03 L 127.65,206.7 L 120.95,206.15 L 111.73,202.23 L 107.54,198.6 ' +
  'L 106.7,196.93 L 105.59,192.18 Z';

/** Colores tomados con cuentagotas del PNG oficial (no aproximados). */
const LILA_CUERPO = '#735AC2';
const MORADO_EXTREMIDADES = '#4A0182';

export const EstrellaAvatar: React.FC<EstrellaAvatarProps> = ({
  className = '',
  size = 200,
  emotion = 'happy',
  armRotation = { left: 0, right: 0 },
  legRotation = { left: 0, right: 0 },
  headTilt = 0,
}) => {
  const mouthPaths = {
    happy: 'M 93 90 Q 100.5 95 108 90',
    thinking: 'M 91 92 Q 100.5 87 110 92',
    surprised: 'M 96 87 A 5 6 0 1 0 105 87 A 5 6 0 1 0 96 87',
    sad: 'M 93 96 Q 100.5 89 108 96',
  };

  const eyeStates = {
    happy: { pupilOffset: 2.5, scale: 1 },
    thinking: { pupilOffset: -2.5, scale: 1 },
    surprised: { pupilOffset: 0, scale: 1.15 },
    sad: { pupilOffset: 2.5, scale: 0.9 },
  };

  const eyeState = eyeStates[emotion];

  return (
    <svg
      viewBox="-5 -5 210 218"
      className={className}
      width={size}
      height={size}
      style={{ overflow: 'visible' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Brazo izquierdo (detrás del cuerpo, entra por la muesca de la estrella).
          El trazado real solo cubre la parte VISIBLE en el PNG -- su base
          termina en un corte irregular justo donde la tapaba la estrella. Al
          rotar, ese corte quedaría expuesto y se vería roto, así que se suma
          una prolongación (una línea gruesa de puntas redondas) que se mete
          bien adentro del cuerpo y viaja pegada al brazo en la misma <g>,
          para que ningún ángulo de la animación deje ver el corte. */}
      <g
        style={{
          transformOrigin: '45px 68px',
          transform: `rotate(${armRotation.left}deg)`,
          transformBox: 'view-box',
          transition: 'transform 0.3s ease-out',
        }}
      >
        <line
          x1={45}
          y1={68}
          x2={93.5}
          y2={93.9}
          stroke={MORADO_EXTREMIDADES}
          strokeWidth={16}
          strokeLinecap="round"
        />
        <path d={BRAZO_IZQUIERDO} fill={MORADO_EXTREMIDADES} />
      </g>

      {/* Brazo derecho: mismo criterio que el izquierdo. */}
      <g
        style={{
          transformOrigin: '150px 90px',
          transform: `rotate(${armRotation.right}deg)`,
          transformBox: 'view-box',
          transition: 'transform 0.3s ease-out',
        }}
      >
        <line
          x1={150}
          y1={90}
          x2={102.5}
          y2={62.3}
          stroke={MORADO_EXTREMIDADES}
          strokeWidth={16}
          strokeLinecap="round"
        />
        <path d={BRAZO_DERECHO} fill={MORADO_EXTREMIDADES} />
      </g>

      {/* Cabeza: estrella + cara */}
      <g
        style={{
          transformOrigin: '104px 71px',
          transform: `rotate(${headTilt}deg)`,
          transformBox: 'view-box',
          transition: 'transform 0.3s ease-out',
        }}
      >
        <path d={CUERPO_ESTRELLA} fill={LILA_CUERPO} />

        <circle cx={77.4} cy={76} r={12} fill="white" />
        <circle
          cx={77.4 + eyeState.pupilOffset}
          cy={76}
          r={10 * eyeState.scale}
          fill="black"
          style={{ transition: 'all 0.2s ease-out' }}
        />

        <circle cx={123.1} cy={77} r={12} fill="white" />
        <circle
          cx={123.1 + eyeState.pupilOffset}
          cy={77}
          r={10 * eyeState.scale}
          fill="black"
          style={{ transition: 'all 0.2s ease-out' }}
        />

        <path
          d={mouthPaths[emotion]}
          stroke="black"
          strokeWidth={4.5}
          fill={emotion === 'surprised' ? 'black' : 'none'}
          strokeLinecap="round"
          style={{ transition: 'all 0.2s ease-out' }}
        />
      </g>

      {/* Pierna izquierda */}
      <g
        style={{
          transformOrigin: '89px 124px',
          transform: `rotate(${legRotation.left}deg)`,
          transformBox: 'view-box',
          transition: 'transform 0.3s ease-out',
        }}
      >
        <path d={PIERNA_IZQUIERDA} fill={MORADO_EXTREMIDADES} />
      </g>

      {/* Pierna derecha */}
      <g
        style={{
          transformOrigin: '114px 113px',
          transform: `rotate(${legRotation.right}deg)`,
          transformBox: 'view-box',
          transition: 'transform 0.3s ease-out',
        }}
      >
        <path d={PIERNA_DERECHA} fill={MORADO_EXTREMIDADES} />
      </g>
    </svg>
  );
};
