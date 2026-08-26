import React, { useState, useEffect } from 'react';
import { EstrellaAnimada, type EstrellaAnimation, type EstrellaEmotion } from './EstrellaAnimada';

interface EstrellaSecuenciaProps {
  className?: string;
  size?: number;
}

type SequenceStep = {
  animation: EstrellaAnimation;
  emotion: EstrellaEmotion;
  duration: number;
};

const SECUENCIA: SequenceStep[] = [
  { animation: 'waving', emotion: 'happy', duration: 2000 },
  { animation: 'idle', emotion: 'happy', duration: 3000 },
  { animation: 'thinking', emotion: 'thinking', duration: 2500 },
  { animation: 'idle', emotion: 'happy', duration: 2500 },
  { animation: 'jumping', emotion: 'happy', duration: 2000 },
  { animation: 'idle', emotion: 'happy', duration: 3000 },
  { animation: 'celebrating', emotion: 'happy', duration: 2500 },
  { animation: 'idle', emotion: 'happy', duration: 3500 },
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
