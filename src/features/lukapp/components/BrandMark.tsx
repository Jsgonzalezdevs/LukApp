import React from 'react';

interface BrandMarkProps {
  className?: string;
}

/**
 * La marca oficial de LukApp: el isotipo de la "U".
 *
 * Es el mismo arte que el icono instalado en la pantalla de inicio (ambos
 * salen de public/brand/ vía scripts/generar-iconos-marca.py), así que la
 * cabecera y el icono del teléfono se leen como una sola marca y no como dos
 * dibujos distintos.
 */
export const BrandMark: React.FC<BrandMarkProps> = ({ className }) => (
  <img
    src="/lukapp-isotipo.png"
    alt="LukApp"
    className={className}
    style={{ objectFit: 'contain' }}
    draggable={false}
  />
);
