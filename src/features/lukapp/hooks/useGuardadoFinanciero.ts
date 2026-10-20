import { useCallback, useRef, useState } from 'react';

export type ResultadoGuardado = boolean | void | Promise<boolean | void>;

/** Conserva el formulario y evita enviar dos veces mientras se confirma el dato. */
export const useGuardadoFinanciero = () => {
  const enCurso = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ejecutar = useCallback(async (operacion: () => ResultadoGuardado): Promise<boolean> => {
    if (enCurso.current) return false;
    enCurso.current = true;
    setOcupado(true);
    setError(null);
    try {
      if (await operacion() === false) {
        setError('No se pudo guardar. Tus datos siguen aquí para que puedas intentarlo de nuevo.');
        return false;
      }
      return true;
    } catch (fallo) {
      setError(fallo instanceof Error ? fallo.message : 'No se pudo guardar. Inténtalo de nuevo.');
      return false;
    } finally {
      enCurso.current = false;
      setOcupado(false);
    }
  }, []);
  return { ejecutar, ocupado, error };
};
