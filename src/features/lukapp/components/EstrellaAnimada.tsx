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
            left: -30,
            right: 30 + Math.sin(progress * Math.PI * 4) * 40,
          },
          legRotation: { left: 0, right: 0 },
          headTilt: 0,
        };

      case 'jumping': {
        const jumpProgress = (frame % 40) / 40;
        const jumpHeight = Math.sin(jumpProgress * Math.PI) * 20;
        return {
          armRotation: { left: -45, right: 45 },
          legRotation: { left: jumpHeight * 2, right: jumpHeight * 2 },
          headTilt: 0,
        };
      }

      case 'thinking':
        return {
          armRotation: { left: -20, right: 20 },
          legRotation: { left: 0, right: 0 },
          headTilt: Math.sin(progress * Math.PI * 2) * 5,
        };

      case 'celebrating':
        return {
          armRotation: {
            left: -50 + Math.sin(progress * Math.PI * 4) * 30,
            right: 50 + Math.sin(progress * Math.PI * 4 + Math.PI) * 30,
          },
          legRotation: {
            left: Math.sin(progress * Math.PI * 4) * 15,
            right: Math.sin(progress * Math.PI * 4 + Math.PI) * 15,
          },
          headTilt: Math.sin(progress * Math.PI * 2) * 8,
        };

      case 'idle':
      default:
        return {
          armRotation: {
            left: -30 + Math.sin(progress * Math.PI * 2) * 3,
            right: 30 + Math.sin(progress * Math.PI * 2) * 3,
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
