import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { GoogleMarca } from './GoogleMarca';
import './BotonGoogle.css';

interface BotonGoogleProps {
  onClick: () => Promise<void>;
  /** Otra acción del formulario está en curso (p. ej. creando la cuenta). */
  deshabilitado?: boolean;
}

/**
 * Entrar y crear cuenta con Google son el mismo botón: Supabase crea la
 * cuenta la primera vez y la reconoce las siguientes.
 */
export const BotonGoogle: React.FC<BotonGoogleProps> = ({
  onClick,
  deshabilitado = false,
}) => {
  /* Estado propio: el `ocupado` de la sesión también se enciende al crear la
     cuenta con correo, y ahí este botón no debe decir "Abriendo Google". */
  const [abriendo, setAbriendo] = useState(false);
  const pulsar = async () => {
    setAbriendo(true);
    try {
      await onClick();
    } finally {
      setAbriendo(false);
    }
  };

  return (
    <div className="boton-google-bloque">
      <button
        type="button"
        className="boton-google"
        onClick={() => void pulsar()}
        disabled={abriendo || deshabilitado}
      >
        {abriendo ? (
          <Loader2 size={18} className="boton-google-girando" aria-hidden />
        ) : (
          <GoogleMarca className="boton-google-marca" />
        )}
        {abriendo ? 'Abriendo Google…' : 'Continuar con Google'}
      </button>
      <div className="boton-google-separador" aria-hidden>
        <span>o con tu correo</span>
      </div>
    </div>
  );
};
