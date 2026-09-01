import React, { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

interface Direccion {
  x: number;
  y: number;
}

interface MascotaLukiProps {
  className?: string;
}

const DIRECCION_NEUTRA: Direccion = { x: 0, y: 0 };
const DURACION_SALUDO = 900;
/* `luki-portada.svg` lo genera scripts/derivar-luki-portada.py a partir del
   Luki ensamblado: es la misma ilustracion, con la anatomia corregida para que
   la silueta se lea vertical, y ya viene sin las copias recortadas ni la hoja
   de estilos de la demo. Por eso aqui solo se inyecta. */
const cargarVectorLuki = () => import('../../../../../public/luki-vector/luki-portada.svg?raw');

export const MascotaLuki: React.FC<MascotaLukiProps> = ({ className = '' }) => {
  const movimientoReducido = useReducedMotion();
  const [direccion, setDireccion] = useState<Direccion>(DIRECCION_NEUTRA);
  const [saludando, setSaludando] = useState(false);
  const [vectorLuki, setVectorLuki] = useState('');
  const finSaludo = useRef<number | undefined>(undefined);

  useEffect(() => {
    let montada = true;
    void cargarVectorLuki().then(({ default: vector }) => {
      if (montada) setVectorLuki(vector);
    });

    return () => {
      montada = false;
      if (finSaludo.current !== undefined) {
        window.clearTimeout(finSaludo.current);
      }
    };
  }, []);

  /* El seguimiento es de unos pocos píxeles: Luki acompaña a quien pasa por
     encima, no lo persigue ni se estira para llegar. */
  const seguirPuntero = (evento: React.PointerEvent<HTMLButtonElement>) => {
    if (movimientoReducido || evento.pointerType !== 'mouse') return;

    const caja = evento.currentTarget.getBoundingClientRect();
    const x = ((evento.clientX - caja.left) / caja.width - 0.5) * 2;
    const y = ((evento.clientY - caja.top) / caja.height - 0.5) * 2;

    setDireccion({
      x: Math.max(-1, Math.min(1, x)),
      y: Math.max(-1, Math.min(1, y))
    });
  };

  /* Un saludo por toque, y termina. Si vuelven a tocarlo antes de que acabe se
     reinicia limpio en vez de encadenar gestos. */
  const saludar = () => {
    if (movimientoReducido) return;

    if (finSaludo.current !== undefined) {
      window.clearTimeout(finSaludo.current);
    }

    setSaludando(true);
    finSaludo.current = window.setTimeout(() => {
      setSaludando(false);
      finSaludo.current = undefined;
    }, DURACION_SALUDO);
  };

  const estilo = {
    '--luki-desplazamiento-x': `${(direccion.x * 5).toFixed(2)}px`,
    '--luki-desplazamiento-y': `${(direccion.y * 2.5).toFixed(2)}px`,
    '--luki-giro': `${(direccion.x * 1.4).toFixed(2)}deg`
  } as React.CSSProperties;

  return (
    <button
      type="button"
      className={`luki-mascota ${saludando ? 'celebrando' : ''} ${className}`.trim()}
      style={estilo}
      onPointerMove={seguirPuntero}
      onPointerLeave={() => setDireccion(DIRECCION_NEUTRA)}
      onClick={saludar}
      aria-label="Luki, la mascota de LukApp. Tócala para saludar."
    >
      <span className="luki-mascota-escena" aria-hidden="true">
        <span className="luki-mascota-cuerpo">
          <span className="luki-mascota-gesto">
            <span
              className="luki-mascota-arte"
              dangerouslySetInnerHTML={vectorLuki ? { __html: vectorLuki } : undefined}
            />
          </span>
        </span>
      </span>
    </button>
  );
};
