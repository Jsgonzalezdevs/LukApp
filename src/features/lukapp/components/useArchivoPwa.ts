import { useEffect } from 'react';

type ManejadorArchivo = { getFile: () => Promise<File> };
type LanzamientoArchivos = { files: readonly ManejadorArchivo[] };

/** Recibe un PDF cuando el sistema abre LukApp desde la aplicación Archivos. */
export const useArchivoPwa = (alRecibir: (archivos: readonly File[]) => void): void => {
  useEffect(() => {
    const cola = (window as Window & { launchQueue?: { setConsumer: (f: (lanzamiento: LanzamientoArchivos) => void) => void } }).launchQueue;
    if (!cola) return;
    cola.setConsumer((lanzamiento) => {
      void Promise.all(lanzamiento.files.map((archivo) => archivo.getFile()))
        .then((archivos) => alRecibir(archivos))
        .catch(() => undefined);
    });
  }, [alRecibir]);
};
