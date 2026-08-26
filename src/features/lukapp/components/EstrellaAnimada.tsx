import React, { useState, useEffect } from 'react';
import { EstrellaAvatar, type EstrellaEmotion } from './EstrellaAvatar';

export type { EstrellaEmotion };

export type EstrellaAnimation =
  | 'idle'
  | 'waving'
  | 'jumping'
  | 'thinking'
  | 'celebrating'
  | 'nodding'
  | 'shaking'
  | 'shrug'
  | 'stretching'
  | 'bowing'
  | 'spinning'
  | 'floating'
  | 'lookingAround'
  | 'sleepyBlink'
  | 'dancing'
  | 'pointingUp'
  | 'loveReaction'
  | 'wink';

interface EstrellaAnimadaProps {
  className?: string;
  size?: number;
  animation?: EstrellaAnimation;
  /** Si no se da, cada animación trae su propia emoción por defecto. */
  emotion?: EstrellaEmotion;
  onAnimationEnd?: () => void;
}

/** La emoción que mejor le queda a cada gesto cuando no se pide otra. */
const EMOCION_POR_DEFECTO: Record<EstrellaAnimation, EstrellaEmotion> = {
  idle: 'happy',
  waving: 'happy',
  jumping: 'excited',
  thinking: 'thinking',
  celebrating: 'excited',
  nodding: 'happy',
  shaking: 'skeptical',
  shrug: 'skeptical',
  stretching: 'sleepy',
  bowing: 'happy',
  spinning: 'dizzy',
  floating: 'happy',
  lookingAround: 'happy',
  sleepyBlink: 'sleepy',
  dancing: 'excited',
  pointingUp: 'excited',
  loveReaction: 'love',
  wink: 'wink',
};

/** Cuántos "frames" de 50ms dura un ciclo de cada gesto antes de repetirse. */
const FRAMES_POR_ANIMACION: Record<EstrellaAnimation, number> = {
  idle: 60,
  waving: 40,
  jumping: 40,
  thinking: 80,
  celebrating: 60,
  nodding: 30,
  shaking: 30,
  shrug: 36,
  stretching: 50,
  bowing: 40,
  spinning: 36,
  floating: 80,
  lookingAround: 90,
  sleepyBlink: 70,
  dancing: 50,
  pointingUp: 40,
  loveReaction: 40,
  wink: 30,
};

interface AnimationProps {
  armRotation: { left: number; right: number };
  legRotation: { left: number; right: number };
  headTilt: number;
  eyeOverride?: { dx: number; dy: number };
  bodyBob?: number;
  bodyRotate?: number;
}

/* Todos los ángulos de aquí son DELTAS sobre la pose de reposo del arte
   trazado en EstrellaAvatar.tsx -- 0 es el brazo tal como quedó dibujado en
   el PNG original, no un brazo horizontal. */
export const EstrellaAnimada: React.FC<EstrellaAnimadaProps> = ({
  className = '',
  size = 200,
  animation = 'idle',
  emotion,
  onAnimationEnd,
}) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    setFrame(0);
    const frameDuration = 50;
    const maxFrames = FRAMES_POR_ANIMACION[animation];

    const interval = setInterval(() => {
      setFrame((prev) => {
        const next = prev + 1;
        if (next >= maxFrames) {
          onAnimationEnd?.();
          return 0;
        }
        return next;
      });
    }, frameDuration);

    return () => clearInterval(interval);
  }, [animation, onAnimationEnd]);

  const getAnimationProps = (): AnimationProps => {
    const progress = frame / 60;

    switch (animation) {
      case 'waving':
        return {
          armRotation: {
            left: Math.sin(progress * Math.PI * 2) * 4,
            // -95 levanta el brazo (que en reposo apunta hacia abajo) hasta
            // arriba del hombro; el resto es el aleteo del saludo en sí.
            right: -95 + Math.sin(progress * Math.PI * 6) * 16,
          },
          legRotation: { left: 0, right: 0 },
          headTilt: Math.sin(progress * Math.PI * 3) * 3,
        };

      case 'jumping': {
        const jumpProgress = (frame % 20) / 20;
        const kick = Math.sin(jumpProgress * Math.PI * 2) * 22;
        return {
          armRotation: { left: -18 - kick * 0.6, right: 18 + kick * 0.6 },
          legRotation: { left: kick, right: -kick },
          headTilt: Math.sin(progress * Math.PI * 4) * 3,
        };
      }

      case 'thinking':
        return {
          armRotation: { left: 0, right: -55 },
          legRotation: { left: 0, right: 0 },
          headTilt: Math.sin(progress * Math.PI * 2) * 6,
          eyeOverride: { dx: -2.5 + Math.sin(progress * Math.PI * 1.4) * 1.5, dy: -3 },
        };

      case 'celebrating':
        return {
          armRotation: {
            left: Math.sin(progress * Math.PI * 4) * 35,
            right: Math.sin(progress * Math.PI * 4 + Math.PI) * 35,
          },
          legRotation: {
            left: Math.sin(progress * Math.PI * 4) * 12,
            right: Math.sin(progress * Math.PI * 4 + Math.PI) * 12,
          },
          headTilt: Math.sin(progress * Math.PI * 2) * 8,
        };

      case 'nodding': {
        const nod = Math.sin(progress * Math.PI * 5);
        return {
          armRotation: { left: 0, right: 0 },
          legRotation: { left: 0, right: 0 },
          headTilt: nod * 6,
          bodyBob: nod * 3,
        };
      }

      case 'shaking':
        return {
          armRotation: { left: 0, right: 0 },
          legRotation: { left: 0, right: 0 },
          headTilt: Math.sin(progress * Math.PI * 6) * 16,
        };

      case 'shrug': {
        const t = Math.min(1, frame / 10) - Math.max(0, (frame - 26) / 10);
        return {
          armRotation: { left: -20 * t, right: 20 * t },
          legRotation: { left: 0, right: 0 },
          headTilt: 3 * t,
        };
      }

      case 'stretching': {
        const t = Math.sin(progress * Math.PI * 1.2);
        return {
          armRotation: { left: -85 * Math.max(0, t), right: 85 * Math.max(0, t) },
          legRotation: { left: -4 * Math.max(0, t), right: 4 * Math.max(0, t) },
          headTilt: -4 * Math.max(0, t),
        };
      }

      case 'bowing': {
        const t = Math.sin(progress * Math.PI * 1.2);
        return {
          armRotation: { left: 12 * Math.max(0, t), right: -12 * Math.max(0, t) },
          legRotation: { left: 0, right: 0 },
          headTilt: 14 * Math.max(0, t),
          bodyBob: 6 * Math.max(0, t),
        };
      }

      case 'spinning':
        return {
          armRotation: { left: -6, right: 6 },
          legRotation: { left: 0, right: 0 },
          headTilt: 0,
          bodyRotate: progress * 360 * 1.2,
        };

      case 'floating':
        return {
          armRotation: {
            left: Math.sin(progress * Math.PI * 1.5) * 5,
            right: Math.sin(progress * Math.PI * 1.5 + Math.PI) * 5,
          },
          legRotation: { left: 0, right: 0 },
          headTilt: Math.sin(progress * Math.PI * 1.5) * 3,
          bodyBob: Math.sin(progress * Math.PI * 1.5) * 8,
        };

      case 'lookingAround':
        return {
          armRotation: { left: 0, right: 0 },
          legRotation: { left: 0, right: 0 },
          headTilt: Math.sin(progress * Math.PI * 0.9) * 5,
          eyeOverride: { dx: Math.sin(progress * Math.PI * 0.9) * 5, dy: -1 },
        };

      case 'sleepyBlink': {
        const droop = Math.max(0, Math.sin(progress * Math.PI * 1.1));
        return {
          armRotation: { left: 0, right: 0 },
          legRotation: { left: 0, right: 0 },
          headTilt: droop * 5,
          bodyBob: droop * 2,
        };
      }

      case 'dancing': {
        const sway = Math.sin(progress * Math.PI * 5);
        return {
          armRotation: { left: sway * 25, right: -sway * 25 },
          legRotation: { left: -sway * 14, right: sway * 14 },
          headTilt: sway * 8,
          bodyBob: Math.abs(sway) * -3,
        };
      }

      case 'pointingUp':
        return {
          armRotation: { left: -100, right: Math.sin(progress * Math.PI * 2) * 4 },
          legRotation: { left: 0, right: 0 },
          headTilt: -4,
        };

      case 'loveReaction': {
        const pulse = Math.abs(Math.sin(progress * Math.PI * 3));
        return {
          armRotation: { left: -10 - pulse * 8, right: 10 + pulse * 8 },
          legRotation: { left: 0, right: 0 },
          headTilt: Math.sin(progress * Math.PI * 2) * 4,
          bodyBob: -pulse * 4,
        };
      }

      case 'wink':
        return {
          armRotation: { left: Math.sin(progress * Math.PI * 2) * 3, right: 0 },
          legRotation: { left: 0, right: 0 },
          headTilt: 4,
        };

      case 'idle':
      default:
        return {
          armRotation: {
            left: Math.sin(progress * Math.PI * 2) * 3,
            right: Math.sin(progress * Math.PI * 2 + Math.PI) * 3,
          },
          legRotation: { left: 0, right: 0 },
          headTilt: Math.sin(progress * Math.PI * 2) * 2,
        };
    }
  };

  const props = getAnimationProps();
  const emocionFinal = emotion ?? EMOCION_POR_DEFECTO[animation];

  return (
    <EstrellaAvatar
      className={className}
      size={size}
      emotion={emocionFinal}
      armRotation={props.armRotation}
      legRotation={props.legRotation}
      headTilt={props.headTilt}
      eyeOverride={props.eyeOverride}
      bodyBob={props.bodyBob}
      bodyRotate={props.bodyRotate}
    />
  );
};
