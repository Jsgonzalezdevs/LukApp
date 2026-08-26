import React from 'react';
import { EstrellaAnimada, type EstrellaAnimation } from './EstrellaAnimada';

export type EstadoEstrella =
  /** Respirando, sin nada que hacer. */
  | 'quieta'
  /** El asesor está calculando: se balancea más rápido. */
  | 'pensando'
  /** Acaba de llegar una respuesta: un rebote y vuelve a lo suyo. */
  | 'contenta';

interface EstrellaProps {
  className?: string;
  estado?: EstadoEstrella;
  /** `cuerpo` trae brazos y piernas; `cara` es solo la estrella. */
  variante?: 'cara' | 'cuerpo';
  /**
   * Texto alternativo. Vacío (lo normal cuando acompaña a un texto que ya dice
   * lo mismo) la deja como decoración para el lector de pantalla.
   */
  alt?: string;
}

const estadoAAnimacion: Record<EstadoEstrella, EstrellaAnimation> = {
  quieta: 'idle',
  pensando: 'thinking',
  contenta: 'celebrating',
};

const varianzeTamaño: Record<'cara' | 'cuerpo', number> = {
  cara: 120,
  cuerpo: 200,
};

export const Estrella: React.FC<EstrellaProps> = ({
  className = '',
  estado = 'quieta',
  variante = 'cuerpo',
  alt = '',
}) => {
  const animacion = estadoAAnimacion[estado];
  const size = varianzeTamaño[variante];

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 0,
      }}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
    >
      <EstrellaAnimada
        size={size}
        animation={animacion}
        emotion="happy"
      />
    </div>
  );
};
