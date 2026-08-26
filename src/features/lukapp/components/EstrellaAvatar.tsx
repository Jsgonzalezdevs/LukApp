import React from 'react';

export type EstrellaEmotion =
  | 'happy'
  | 'thinking'
  | 'surprised'
  | 'sad'
  | 'excited'
  | 'sleepy'
  | 'wink'
  | 'skeptical'
  | 'love'
  | 'dizzy';

interface EstrellaAvatarProps {
  className?: string;
  size?: number;
  emotion?: EstrellaEmotion;
  /** Grados AÑADIDOS a la pose de reposo de cada brazo. 0 = reposo. */
  armRotation?: { left: number; right: number };
  /** Grados AÑADIDOS a la pierna recta. 0 = reposo. */
  legRotation?: { left: number; right: number };
  headTilt?: number;
  /** Mueve la mirada aparte de lo que diga la emoción (para "mirar alrededor"). */
  eyeOverride?: { dx: number; dy: number };
  /** Sube/baja todo el personaje (flotar). En px del propio viewBox. */
  bodyBob?: number;
  /** Rota TODO el personaje, no solo la cabeza (para girar/marearse). */
  bodyRotate?: number;
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

/* Pivotes de cada extremidad, en coordenadas absolutas del viewBox. Un brazo
   que gira mucho (el saludo, celebrar) puede alejar su base del sitio donde
   la estrella lo tapa en reposo -- la estrella no rota con él, así que a
   ángulos grandes se abría un hueco entre los dos. La solución es un
   círculo centrado EXACTAMENTE en el pivote: al rotar sobre su propio
   centro no se mueve ni un píxel, así que sella la unión sin importar el
   ángulo, además de la prolongación que ya tapaba el corte del trazado. */
const PIVOTE_BRAZO_IZQ = { x: 45, y: 68 };
const PIVOTE_BRAZO_DER = { x: 150, y: 90 };
const PIVOTE_PIERNA_IZQ = { x: 89, y: 124 };
const PIVOTE_PIERNA_DER = { x: 114, y: 113 };
const PIVOTE_CABEZA = { x: 104, y: 71 };

const OJO_IZQ = { x: 77.4, y: 76 };
const OJO_DER = { x: 123.1, y: 77 };
const OJO_R = 12;

interface EyeConfig {
  dx: number;
  dy: number;
  scale: number;
  /** 0 = abierto, 1 = cerrado. Un párpado del color del cuerpo que baja. */
  lidL: number;
  lidR: number;
}

const EMOCIONES: Record<EstrellaEmotion, { eye: EyeConfig; mouth: string }> = {
  // Mirada al centro y un poco arriba -- no sesgada a un lado, que se lea
  // atenta y despierta en vez de "mirando para otro lado".
  happy: { eye: { dx: 0, dy: -1, scale: 1, lidL: 0, lidR: 0 }, mouth: 'M 93 90 Q 100.5 95 108 90' },
  thinking: { eye: { dx: -2.5, dy: -3, scale: 1, lidL: 0, lidR: 0 }, mouth: 'M 91 92 Q 100.5 87 110 92' },
  surprised: {
    eye: { dx: 0, dy: -1, scale: 1.3, lidL: 0, lidR: 0 },
    mouth: 'M 96 87 A 5 6 0 1 0 105 87 A 5 6 0 1 0 96 87',
  },
  sad: { eye: { dx: 0, dy: 2, scale: 0.9, lidL: 0.18, lidR: 0.18 }, mouth: 'M 93 96 Q 100.5 89 108 96' },
  excited: {
    eye: { dx: 0, dy: -2, scale: 1.2, lidL: 0, lidR: 0 },
    mouth: 'M 90 88 Q 100.5 103 111 88 Q 100.5 97 90 88',
  },
  sleepy: { eye: { dx: 0, dy: 0, scale: 1, lidL: 0.55, lidR: 0.55 }, mouth: 'M 95 92 Q 100.5 94 106 92' },
  wink: { eye: { dx: 2, dy: -1, scale: 1, lidL: 1, lidR: 0 }, mouth: 'M 93 90 Q 100.5 97 108 90' },
  skeptical: { eye: { dx: -2, dy: 0, scale: 0.85, lidL: 0, lidR: 0.4 }, mouth: 'M 94 92 L 107 90' },
  love: {
    eye: { dx: 0, dy: -1, scale: 1.25, lidL: 0, lidR: 0 },
    mouth: 'M 90 88 Q 100.5 103 111 88 Q 100.5 97 90 88',
  },
  dizzy: { eye: { dx: 0, dy: 0, scale: 0.8, lidL: 0, lidR: 0 }, mouth: 'M 92 93 Q 100.5 88 109 93' },
};

export const EstrellaAvatar: React.FC<EstrellaAvatarProps> = ({
  className = '',
  size = 200,
  emotion = 'happy',
  armRotation = { left: 0, right: 0 },
  legRotation = { left: 0, right: 0 },
  headTilt = 0,
  eyeOverride,
  bodyBob = 0,
  bodyRotate = 0,
}) => {
  const config = EMOCIONES[emotion];
  const dx = eyeOverride?.dx ?? config.eye.dx;
  const dy = eyeOverride?.dy ?? config.eye.dy;
  const { scale, lidL, lidR } = config.eye;
  const pupilR = 10 * scale;

  return (
    <svg
      viewBox="-5 -5 210 218"
      className={className}
      width={size}
      height={size}
      style={{ overflow: 'visible' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <g
        style={{
          transformOrigin: '104px 105px',
          transform: `translateY(${bodyBob}px) rotate(${bodyRotate}deg)`,
          transformBox: 'view-box',
          transition: 'transform 0.3s ease-out',
        }}
      >
        {/* Brazo izquierdo (detrás del cuerpo, entra por la muesca de la estrella).
            El trazado real solo cubre la parte VISIBLE en el PNG -- su base
            termina en un corte irregular justo donde la tapaba la estrella. Al
            rotar, ese corte quedaría expuesto y se vería roto, así que se suma
            una prolongación (línea gruesa de puntas redondas) MÁS un círculo
            centrado en el propio pivote -- ese círculo no se mueve al rotar,
            así que sella la unión incluso en ángulos grandes como el saludo. */}
        <g
          style={{
            transformOrigin: `${PIVOTE_BRAZO_IZQ.x}px ${PIVOTE_BRAZO_IZQ.y}px`,
            transform: `rotate(${armRotation.left}deg)`,
            transformBox: 'view-box',
            transition: 'transform 0.3s ease-out',
          }}
        >
          <circle cx={PIVOTE_BRAZO_IZQ.x} cy={PIVOTE_BRAZO_IZQ.y} r={13} fill={MORADO_EXTREMIDADES} />
          <line
            x1={PIVOTE_BRAZO_IZQ.x}
            y1={PIVOTE_BRAZO_IZQ.y}
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
            transformOrigin: `${PIVOTE_BRAZO_DER.x}px ${PIVOTE_BRAZO_DER.y}px`,
            transform: `rotate(${armRotation.right}deg)`,
            transformBox: 'view-box',
            transition: 'transform 0.3s ease-out',
          }}
        >
          <circle cx={PIVOTE_BRAZO_DER.x} cy={PIVOTE_BRAZO_DER.y} r={13} fill={MORADO_EXTREMIDADES} />
          <line
            x1={PIVOTE_BRAZO_DER.x}
            y1={PIVOTE_BRAZO_DER.y}
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
            transformOrigin: `${PIVOTE_CABEZA.x}px ${PIVOTE_CABEZA.y}px`,
            transform: `rotate(${headTilt}deg)`,
            transformBox: 'view-box',
            transition: 'transform 0.3s ease-out',
          }}
        >
          <path d={CUERPO_ESTRELLA} fill={LILA_CUERPO} />

          <circle cx={OJO_IZQ.x} cy={OJO_IZQ.y} r={OJO_R} fill="white" />
          <circle cx={OJO_DER.x} cy={OJO_DER.y} r={OJO_R} fill="white" />

          {emotion === 'dizzy' ? (
            <>
              <g stroke="black" strokeWidth={3} strokeLinecap="round">
                <line
                  x1={OJO_IZQ.x - 6}
                  y1={OJO_IZQ.y - 6}
                  x2={OJO_IZQ.x + 6}
                  y2={OJO_IZQ.y + 6}
                />
                <line
                  x1={OJO_IZQ.x - 6}
                  y1={OJO_IZQ.y + 6}
                  x2={OJO_IZQ.x + 6}
                  y2={OJO_IZQ.y - 6}
                />
                <line
                  x1={OJO_DER.x - 6}
                  y1={OJO_DER.y - 6}
                  x2={OJO_DER.x + 6}
                  y2={OJO_DER.y + 6}
                />
                <line
                  x1={OJO_DER.x - 6}
                  y1={OJO_DER.y + 6}
                  x2={OJO_DER.x + 6}
                  y2={OJO_DER.y - 6}
                />
              </g>
            </>
          ) : (
            <>
              <circle
                cx={OJO_IZQ.x + dx}
                cy={OJO_IZQ.y + dy}
                r={pupilR}
                fill="black"
                style={{ transition: 'all 0.2s ease-out' }}
              />
              <circle
                cx={OJO_DER.x + dx}
                cy={OJO_DER.y + dy}
                r={pupilR}
                fill="black"
                style={{ transition: 'all 0.2s ease-out' }}
              />
            </>
          )}

          {/* Párpados: un cuarto de círculo del lila del cuerpo que baja desde
              arriba, como si la propia piel de la estrella cerrara el ojo. */}
          {lidL > 0 && (
            <rect
              x={OJO_IZQ.x - OJO_R - 2}
              y={OJO_IZQ.y - OJO_R}
              width={OJO_R * 2 + 4}
              height={OJO_R * 2 * lidL}
              fill={LILA_CUERPO}
              style={{ transition: 'all 0.2s ease-out' }}
            />
          )}
          {lidR > 0 && (
            <rect
              x={OJO_DER.x - OJO_R - 2}
              y={OJO_DER.y - OJO_R}
              width={OJO_R * 2 + 4}
              height={OJO_R * 2 * lidR}
              fill={LILA_CUERPO}
              style={{ transition: 'all 0.2s ease-out' }}
            />
          )}

          <path
            d={config.mouth}
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
            transformOrigin: `${PIVOTE_PIERNA_IZQ.x}px ${PIVOTE_PIERNA_IZQ.y}px`,
            transform: `rotate(${legRotation.left}deg)`,
            transformBox: 'view-box',
            transition: 'transform 0.3s ease-out',
          }}
        >
          <circle cx={PIVOTE_PIERNA_IZQ.x} cy={PIVOTE_PIERNA_IZQ.y} r={10} fill={MORADO_EXTREMIDADES} />
          <path d={PIERNA_IZQUIERDA} fill={MORADO_EXTREMIDADES} />
        </g>

        {/* Pierna derecha */}
        <g
          style={{
            transformOrigin: `${PIVOTE_PIERNA_DER.x}px ${PIVOTE_PIERNA_DER.y}px`,
            transform: `rotate(${legRotation.right}deg)`,
            transformBox: 'view-box',
            transition: 'transform 0.3s ease-out',
          }}
        >
          <circle cx={PIVOTE_PIERNA_DER.x} cy={PIVOTE_PIERNA_DER.y} r={10} fill={MORADO_EXTREMIDADES} />
          <path d={PIERNA_DERECHA} fill={MORADO_EXTREMIDADES} />
        </g>
      </g>
    </svg>
  );
};
