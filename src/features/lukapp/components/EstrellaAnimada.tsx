import React, { useState, useEffect } from 'react';
import { EstrellaAvatar } from './EstrellaAvatar';

export type EstrellaAnimation = 'idle' | 'waving' | 'jumping' | 'thinking' | 'celebrating';
export type EstrellaEmotion = 'happy' | 'thinking' | 'surprised' | 'sad';

interface EstrellaAnimadaProps {
  className?: string;
  size?: number;
  animation?: EstrellaAnimation;
  emotion?: EstrellaEmotion;
  onAnimationEnd?: () => void;
}

/* Todos los ángulos de aquí son DELTAS sobre la pose de reposo del arte
   trazado en EstrellaAvatar.tsx -- 0 es el brazo tal como quedó dibujado en
   el PNG original, no un brazo horizontal. */
export const EstrellaAnimada: React.FC<EstrellaAnimadaProps> = ({
  className = '',
  size = 200,
  animation = 'idle',
  emotion = 'happy',
  onAnimationEnd,
}) => {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const frameDuration = 50;
    const maxFrames = {
      idle: 60,
      waving: 40,
      jumping: 40,
      thinking: 80,
      celebrating: 60,
    }[animation];

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

  const getAnimationProps = () => {
    const progress = frame / 60;

    switch (animation) {
      case 'waving':
        return {
          armRotation: {
            left: Math.sin(progress * Math.PI * 2) * 4,
            // -105 levanta el brazo (que en reposo apunta hacia abajo) hasta
            // arriba del hombro; el resto es el aleteo del saludo en sí.
            right: -105 + Math.sin(progress * Math.PI * 6) * 18,
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

  return (
    <EstrellaAvatar
      className={className}
      size={size}
      emotion={emotion}
      armRotation={props.armRotation}
      legRotation={props.legRotation}
      headTilt={props.headTilt}
    />
  );
};
