import React from 'react';

interface MascotaLukiProps {
  className?: string;
}

/**
 * La ilustración aprobada es la fuente de verdad de Luki. Se monta tal cual
 * llegó de diseño: no se redibuja, no se recompone en vectores y no recibe
 * animaciones que puedan alterar sus proporciones.
 */
export const MascotaLuki: React.FC<MascotaLukiProps> = ({ className = '' }) => (
  <div className={`luki-mascota ${className}`.trim()}>
    <img
      src="/brand/luki-nutria-saludo-transparente.png"
      width="306"
      height="347"
      alt="Luki, la mascota de LukApp, saludando"
    />
  </div>
);
