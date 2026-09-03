import React from 'react';

interface MascotaLukiProps {
  className?: string;
  src?: string;
  alt?: string;
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
}) => (
  <div className={`luki-mascota ${className}`.trim()}>
    <img
      src={src}
      width="306"
      height="347"
      loading="lazy"
      decoding="async"
      className="h-full w-full bg-transparent object-contain"
      alt={alt}
    />
  </div>
);
