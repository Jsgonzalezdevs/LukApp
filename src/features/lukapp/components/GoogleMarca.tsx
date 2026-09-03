import React from 'react';

interface GoogleMarcaProps {
  className?: string;
}

/** La G oficial en sus cuatro colores, sin cargar un recurso remoto. */
export const GoogleMarca: React.FC<GoogleMarcaProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M21.81 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.5a4.7 4.7 0 0 1-2.04 3.08v2.54h3.3c1.93-1.78 3.05-4.4 3.05-7.46Z"
    />
    <path
      fill="#34A853"
      d="M12 22c2.75 0 5.06-.91 6.75-2.47l-3.3-2.54c-.91.61-2.08.98-3.45.98-2.66 0-4.91-1.8-5.72-4.21H2.87v2.62A10.2 10.2 0 0 0 12 22Z"
    />
    <path
      fill="#FBBC05"
      d="M6.28 13.76A6.13 6.13 0 0 1 5.96 12c0-.61.11-1.2.32-1.76V7.62H2.87A10.2 10.2 0 0 0 1.8 12c0 1.57.38 3.05 1.07 4.38l3.41-2.62Z"
    />
    <path
      fill="#EA4335"
      d="M12 6.03c1.5 0 2.84.52 3.9 1.53l2.93-2.93A9.83 9.83 0 0 0 12 2a10.2 10.2 0 0 0-9.13 5.62l3.41 2.62C7.09 7.83 9.34 6.03 12 6.03Z"
    />
  </svg>
);
