import { useEffect, useState } from 'react';

/** `beforeinstallprompt` todavía no forma parte de los tipos estándar del DOM,
 * aunque Chromium lo entrega en Chrome, Edge y sus navegadores derivados. */
interface EventoAntesDeInstalar extends Event {
  prompt: () => Promise<{ outcome?: 'accepted' | 'dismissed' }>;
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type OpcionInstalacionPwa = 'nativa' | 'ios' | null;
export type ResultadoInstalacionPwa =
  | 'aceptada'
  | 'rechazada'
  | 'indisponible'
  | 'ya-instalada';

export interface EstadoInstalacionPwa {
  opcion: OpcionInstalacionPwa;
  instalada: boolean;
}

let iniciado = false;
let instalada = false;
let eventoDiferido: EventoAntesDeInstalar | null = null;
const suscriptores = new Set<() => void>();

const esPwaInstalada = (): boolean =>
  window.matchMedia?.('(display-mode: standalone)').matches === true ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/* iPad puede reportarse como Mac desde que Safari permite el modo de escritorio.
   La pantalla táctil es la señal que lo distingue de un Mac real. */
const esIos = (): boolean => {
  const agente = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(agente) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const opcionActual = (): OpcionInstalacionPwa => {
  if (instalada) return null;
  if (eventoDiferido) return 'nativa';
  return esIos() ? 'ios' : null;
};

const estadoActual = (): EstadoInstalacionPwa => ({
  opcion: opcionActual(),
  instalada,
});

const avisar = (): void => {
  suscriptores.forEach((suscriptor) => suscriptor());
};

const alDetectarInstalacion = (evento: Event): void => {
  evento.preventDefault();
  if (instalada) return;
  eventoDiferido = evento as EventoAntesDeInstalar;
  avisar();
};

const alInstalar = (): void => {
  eventoDiferido = null;
  instalada = true;
  avisar();
};

/**
 * Empieza a escuchar antes de renderizar React. `beforeinstallprompt` puede
 * llegar muy pronto y el navegador lo emite una sola vez por visita.
 */
export const iniciarInstalacionPwa = (): void => {
  if (typeof window === 'undefined' || iniciado) return;
  iniciado = true;
  instalada = esPwaInstalada();
  window.addEventListener('beforeinstallprompt', alDetectarInstalacion);
  window.addEventListener('appinstalled', alInstalar);
};

const suscribir = (suscriptor: () => void): (() => void) => {
  iniciarInstalacionPwa();
  suscriptores.add(suscriptor);
  return () => suscriptores.delete(suscriptor);
};

/**
 * Abre la confirmación que controla el navegador. Nunca intenta instalar sin
 * que la persona toque el botón: además de ser más respetuoso, Chromium exige
 * esa activación explícita para mostrar el diálogo nativo.
 */
export const solicitarInstalacionPwa = async (): Promise<ResultadoInstalacionPwa> => {
  iniciarInstalacionPwa();
  if (instalada) return 'ya-instalada';
  if (!eventoDiferido) return 'indisponible';

  const evento = eventoDiferido;
  // Cada evento solo permite un `prompt()`. Se limpia antes de invocarlo para
  // que un doble toque nunca abra dos solicitudes ni reutilice el evento.
  eventoDiferido = null;
  avisar();

  try {
    const respuesta = await evento.prompt();
    const eleccion = evento.userChoice ? await evento.userChoice : respuesta;
    return eleccion.outcome === 'accepted' ? 'aceptada' : 'rechazada';
  } catch {
    return 'indisponible';
  }
};

export const useInstalacionPwa = (): EstadoInstalacionPwa => {
  const [estado, setEstado] = useState<EstadoInstalacionPwa>(() => {
    iniciarInstalacionPwa();
    return estadoActual();
  });

  useEffect(() => suscribir(() => setEstado(estadoActual())), []);

  return estado;
};

/* Mantiene aislado el estado de módulo entre pruebas de navegadores distintos.
   No se usa desde la aplicación publicada. */
export const reiniciarInstalacionPwaParaPruebas = (): void => {
  if (typeof window !== 'undefined' && iniciado) {
    window.removeEventListener('beforeinstallprompt', alDetectarInstalacion);
    window.removeEventListener('appinstalled', alInstalar);
  }
  iniciado = false;
  instalada = false;
  eventoDiferido = null;
  suscriptores.clear();
};
