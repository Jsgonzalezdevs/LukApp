import React from 'react';

interface MascotaLukiProps {
  className?: string;
  src?: string;
  alt?: string;
  /** La imagen principal de una vista no debe esperar al umbral de carga diferida. */
  prioridad?: 'alta';
}

/**
 * La ilustración aprobada es la fuente de verdad de Luki. Se monta tal cual
 * llegó de diseño: no se redibuja, no se recompone en vectores y no recibe
 * animaciones que puedan alterar sus proporciones.
 */
export const MascotaLuki: React.FC<MascotaLukiProps> = ({
  className = '',
  src = '/brand/luki-nutria-saludo-transparente.png',
  alt = 'Luki, la mascota de LukApp, saludando',
  prioridad,
}) => (
  <div className={`luki-mascota ${className}`.trim()}>
    <img
      src={src}
      width="306"
      height="347"
      loading={prioridad === 'alta' ? 'eager' : 'lazy'}
      decoding={prioridad === 'alta' ? 'sync' : 'async'}
      fetchPriority={prioridad === 'alta' ? 'high' : 'auto'}
      className="h-full w-full bg-transparent object-contain"
      alt={alt}
    />
  </div>
);
