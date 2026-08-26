import React, { useState, useEffect } from 'react';
import { EstrellaAnimada, type EstrellaAnimation, type EstrellaEmotion } from './EstrellaAnimada';

interface EstrellaSecuenciaProps {
  className?: string;
  size?: number;
}

type SequenceStep = {
  animation: EstrellaAnimation;
  emotion?: EstrellaEmotion;
  duration: number;
};

/** Una pausa corta de "solo respirar" entre gesto y gesto. */
const RESPIRO: SequenceStep = { animation: 'idle', duration: 2200 };

/* El repertorio de gestos de la Estrella. Cada uno va seguido de un respiro
   para que no se sienta como una máquina en bucle: hace algo, se queda un
   rato quieta (respirando), hace lo siguiente. */
const SECUENCIA: SequenceStep[] = [
  { animation: 'waving', duration: 2000 },
  RESPIRO,
  { animation: 'thinking', duration: 2800 },
  RESPIRO,
  { animation: 'lookingAround', duration: 3200 },
  RESPIRO,
  { animation: 'jumping', duration: 1600 },
  RESPIRO,
  { animation: 'nodding', duration: 1400 },
  RESPIRO,
  { animation: 'shrug', duration: 1600 },
  RESPIRO,
  { animation: 'celebrating', duration: 2200 },
  RESPIRO,
  { animation: 'stretching', duration: 2200 },
  RESPIRO,
  { animation: 'wink', duration: 1200 },
  RESPIRO,
  { animation: 'shaking', duration: 1400 },
  RESPIRO,
  { animation: 'dancing', duration: 2000 },
  RESPIRO,
  { animation: 'bowing', duration: 1800 },
  RESPIRO,
  { animation: 'pointingUp', duration: 1600 },
  RESPIRO,
  { animation: 'floating', duration: 3200 },
  RESPIRO,
  { animation: 'loveReaction', duration: 1600 },
  RESPIRO,
  { animation: 'sleepyBlink', duration: 2600 },
  RESPIRO,
  { animation: 'spinning', duration: 1400 },
  RESPIRO,
];

export const EstrellaSecuencia: React.FC<EstrellaSecuenciaProps> = ({
  className = '',
  size = 240,
}) => {
  const [stepIndex, setStepIndex] = useState(0);

  const currentStep = SECUENCIA[stepIndex];

  useEffect(() => {
    const timer = setTimeout(() => {
      setStepIndex((prev) => (prev + 1) % SECUENCIA.length);
    }, currentStep.duration);

    return () => clearTimeout(timer);
  }, [stepIndex, currentStep.duration]);

  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <EstrellaAnimada
        size={size}
        animation={currentStep.animation}
        emotion={currentStep.emotion}
      />
    </div>
  );
};
