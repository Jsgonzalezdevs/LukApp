import { useEffect, useState } from 'react';

const CONSULTA = '(min-width: 768px) and (pointer: fine)';

export const useCapturaEscritorio = (): boolean => {
  const [escritorio, setEscritorio] = useState(() => window.matchMedia(CONSULTA).matches);
  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA);
    const actualizar = () => setEscritorio(consulta.matches);
    actualizar();
    consulta.addEventListener('change', actualizar);
    return () => consulta.removeEventListener('change', actualizar);
  }, []);
  return escritorio;
};
