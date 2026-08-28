import React from 'react';

interface BrandWordmarkProps {
  className?: string;
}

/**
 * El logotipo horizontal ("Luk"), para donde antes iba el nombre escrito a
 * mano: la barra de la landing y el encabezado del acceso. El texto queda en
 * el alt para que un lector de pantalla siga anunciando "LukApp".
 */
export const BrandWordmark: React.FC<BrandWordmarkProps> = ({ className }) => (
  <img
    src="/brand/lukapp-wordmark.png"
    alt="LukApp"
    className={className}
    style={{ objectFit: 'contain' }}
    draggable={false}
    onError={(event) => {
      event.currentTarget.onerror = null;
      event.currentTarget.src = '/lukapp-wordmark.png';
    }}
  />
);
