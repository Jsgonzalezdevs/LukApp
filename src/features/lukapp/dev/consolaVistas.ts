/**
 * Atajo local para revisar componentes flotantes sin tener que repetir un
 * recorrido de la app. Solo se instala durante `npm run dev`: la versión
 * publicada no expone comandos ni cambia su flujo normal.
 */
export const VISTAS_DE_PRUEBA = [
  'premium',
  'aviso',
  'captura',
  'captura-multiple',
  'reporte',
  'buscar',
] as const;

export type VistaDePrueba = (typeof VISTAS_DE_PRUEBA)[number];

export interface ConsolaDeVistas {
  abrir: (vista: string) => void;
  cerrar: () => void;
  ayuda: () => void;
}

declare global {
  interface Window {
    /** Disponible exclusivamente en el servidor de desarrollo de LukApp. */
    LukAppPruebas?: ConsolaDeVistas;
  }
}

const DESCRIPCIONES: Record<VistaDePrueba, string> = {
  premium: 'Invitación ocasional a Premium.',
  aviso: 'Aviso de movimiento guardado.',
  captura: 'Hoja para anotar un movimiento.',
  'captura-multiple': 'Resumen de varios movimientos detectados.',
  reporte: 'Reporte financiero mensual.',
  buscar: 'Buscador de movimientos.',
};

const esVistaDePrueba = (vista: string): vista is VistaDePrueba =>
  (VISTAS_DE_PRUEBA as readonly string[]).includes(vista);

interface OpcionesLanzador {
  abrir: (vista: VistaDePrueba) => void;
  cerrar: () => void;
}

/** Instala y retira el único punto de entrada para pruebas desde DevTools. */
export const instalarConsolaDeVistas = ({ abrir, cerrar }: OpcionesLanzador): (() => void) => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return () => undefined;

  const anterior = window.LukAppPruebas;
  const ayuda = () => {
    console.info('LukApp · vistas disponibles solo en desarrollo');
    console.table(
      VISTAS_DE_PRUEBA.map((vista) => ({
        comando: `window.LukAppPruebas.abrir('${vista}')`,
        muestra: DESCRIPCIONES[vista],
      })),
    );
    console.info("Para cerrar cualquier vista: window.LukAppPruebas.cerrar()");
  };

  const consola: ConsolaDeVistas = {
    abrir: (vista) => {
      if (!esVistaDePrueba(vista)) {
        console.warn(`LukApp · "${vista}" no es una vista de prueba. Ejecuta window.LukAppPruebas.ayuda().`);
        return;
      }
      abrir(vista);
    },
    cerrar,
    ayuda,
  };

  window.LukAppPruebas = consola;
  console.info('LukApp · pruebas visuales listas. Ejecuta window.LukAppPruebas.ayuda().');

  return () => {
    if (window.LukAppPruebas !== consola) return;
    if (anterior) window.LukAppPruebas = anterior;
    else delete window.LukAppPruebas;
  };
};
