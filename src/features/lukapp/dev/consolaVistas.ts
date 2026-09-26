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
  instalarPwa: () => void;
}

/** Evento interno para que el lanzador, que vive sobre la app, abra el aviso. */
export const EVENTO_MOSTRAR_INSTALACION_PWA = 'lukapp:mostrar-instalacion-pwa';

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

/** Cada alias se ejecuta al escribir esa única palabra en la consola. */
const ATAJOS_DE_UNA_PALABRA: Record<string, VistaDePrueba | 'cerrar' | 'ayuda' | 'instalar-pwa'> = {
  premium: 'premium',
  aviso: 'aviso',
  captura: 'captura',
  multiple: 'captura-multiple',
  reporte: 'reporte',
  buscar: 'buscar',
  cerrar: 'cerrar',
  ayuda: 'ayuda',
  instalar: 'instalar-pwa',
};

const esVistaDePrueba = (vista: string): vista is VistaDePrueba =>
  (VISTAS_DE_PRUEBA as readonly string[]).includes(vista);

interface OpcionesLanzador {
  abrir: (vista: VistaDePrueba) => void;
  cerrar: () => void;
  /** Solo el superadmin puede habilitar atajos en la app publicada. */
  permitirEnProduccion?: boolean;
}

/** Instala y retira el único punto de entrada para pruebas desde DevTools. */
export const instalarConsolaDeVistas = ({ abrir, cerrar, permitirEnProduccion = false }: OpcionesLanzador): (() => void) => {
  const disponible = import.meta.env.DEV || permitirEnProduccion;
  if (!disponible || typeof window === 'undefined') return () => undefined;

  const anterior = window.LukAppPruebas;
  const contexto = import.meta.env.DEV ? 'desarrollo' : 'superadmin en producción';
  const ayuda = () => {
    console.info(`LukApp · vistas disponibles para ${contexto}`);
    console.table(
      [...VISTAS_DE_PRUEBA.map((vista) => ({
        atajo: vista === 'captura-multiple' ? 'multiple' : vista,
        comando: `window.LukAppPruebas.abrir('${vista}')`,
        muestra: DESCRIPCIONES[vista],
      })), {
        atajo: 'instalar',
        comando: 'window.LukAppPruebas.instalarPwa()',
        muestra: 'Aviso para instalar la PWA.',
      }],
    );
    console.info("Para cerrar cualquier vista: cerrar  ·  También puedes usar window.LukAppPruebas.cerrar()");
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
    instalarPwa: () => window.dispatchEvent(new Event(EVENTO_MOSTRAR_INSTALACION_PWA)),
  };

  window.LukAppPruebas = consola;
  const descriptoresAnteriores = new Map<string, PropertyDescriptor | undefined>();
  for (const [alias, destino] of Object.entries(ATAJOS_DE_UNA_PALABRA)) {
    const descriptor = Object.getOwnPropertyDescriptor(window, alias);
    if (descriptor && !descriptor.configurable) {
      console.warn(`LukApp · no se pudo reservar el atajo "${alias}".`);
      continue;
    }
    descriptoresAnteriores.set(alias, descriptor);
    Object.defineProperty(window, alias, {
      configurable: true,
      get: () => {
        if (destino === 'cerrar') cerrar();
        else if (destino === 'ayuda') ayuda();
        else if (destino === 'instalar-pwa') consola.instalarPwa();
        else consola.abrir(destino);
        return undefined;
      },
    });
  }
  console.info(`LukApp · atajos visuales listos para ${contexto}. Escribe premium, instalar o ayuda.`);
  console.warn('LukApp · Precaución: usa únicamente los atajos documentados. No pegues ni ejecutes código desconocido en esta consola.');

  return () => {
    if (window.LukAppPruebas === consola) {
      if (anterior) window.LukAppPruebas = anterior;
      else delete window.LukAppPruebas;
    }
    for (const [alias, descriptor] of descriptoresAnteriores) {
      if (descriptor) Object.defineProperty(window, alias, descriptor);
      else Reflect.deleteProperty(window, alias);
    }
  };
};
