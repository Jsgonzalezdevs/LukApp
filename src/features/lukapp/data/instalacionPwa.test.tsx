import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PWAInstall } from '../components/landing/PWAInstall';
import {
  iniciarInstalacionPwa,
  reiniciarInstalacionPwaParaPruebas,
  solicitarInstalacionPwa,
} from './instalacionPwa';

type EventoDePrueba = Event & {
  prompt: ReturnType<typeof vi.fn>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const propiedadesNavegador = ['userAgent', 'platform', 'maxTouchPoints'] as const;
const descriptoresOriginales = new Map<string, PropertyDescriptor | undefined>();
let matchMediaOriginal: typeof window.matchMedia;

const definirNavegador = (propiedad: string, valor: unknown) => {
  Object.defineProperty(navigator, propiedad, { configurable: true, value: valor });
};

const configurarModo = (instalada: boolean) => {
  window.matchMedia = vi.fn(() => ({
    matches: instalada,
    media: '(display-mode: standalone)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
};

const eventoInstalable = (outcome: 'accepted' | 'dismissed' = 'accepted'): EventoDePrueba => {
  const evento = new Event('beforeinstallprompt', { cancelable: true }) as EventoDePrueba;
  evento.prompt = vi.fn().mockResolvedValue({ outcome });
  evento.userChoice = Promise.resolve({ outcome });
  return evento;
};

beforeEach(() => {
  reiniciarInstalacionPwaParaPruebas();
  matchMediaOriginal = window.matchMedia;
  propiedadesNavegador.forEach((propiedad) => {
    descriptoresOriginales.set(propiedad, Object.getOwnPropertyDescriptor(navigator, propiedad));
  });
  configurarModo(false);
  definirNavegador('userAgent', 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Safari/537.36');
  definirNavegador('platform', 'Linux armv8l');
  definirNavegador('maxTouchPoints', 1);
});

afterEach(() => {
  reiniciarInstalacionPwaParaPruebas();
  window.matchMedia = matchMediaOriginal;
  propiedadesNavegador.forEach((propiedad) => {
    const descriptor = descriptoresOriginales.get(propiedad);
    if (descriptor) Object.defineProperty(navigator, propiedad, descriptor);
    else delete (navigator as Navigator & Record<string, unknown>)[propiedad];
  });
});

describe('instalación PWA', () => {
  it('abre directamente la confirmación nativa de Chromium y no el manual anterior', async () => {
    const cerrar = vi.fn();
    render(<PWAInstall onClose={cerrar} />);
    expect(screen.queryByRole('button', { name: 'Instalar LukApp' })).not.toBeInTheDocument();

    const evento = eventoInstalable();
    act(() => window.dispatchEvent(evento));

    expect(evento.defaultPrevented).toBe(true);
    fireEvent.click(await screen.findByRole('button', { name: 'Instalar LukApp' }));

    await waitFor(() => expect(evento.prompt).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(cerrar).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Paso 1/i)).not.toBeInTheDocument();
  });

  it('consume el aviso del navegador una sola vez aunque se solicite dos veces', async () => {
    iniciarInstalacionPwa();
    const evento = eventoInstalable('dismissed');
    act(() => window.dispatchEvent(evento));

    const primera = solicitarInstalacionPwa();
    const segunda = solicitarInstalacionPwa();

    await expect(primera).resolves.toBe('rechazada');
    await expect(segunda).resolves.toBe('indisponible');
    expect(evento.prompt).toHaveBeenCalledTimes(1);
  });

  it('retira la invitación cuando Chromium confirma que la app se instaló', async () => {
    render(<PWAInstall onClose={vi.fn()} />);
    act(() => window.dispatchEvent(eventoInstalable()));
    expect(await screen.findByRole('button', { name: 'Instalar LukApp' })).toBeInTheDocument();

    act(() => window.dispatchEvent(new Event('appinstalled')));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Instalar LukApp' })).not.toBeInTheDocument());
  });

  it('en iPhone muestra una sola indicación honesta, no un botón que finja instalar', () => {
    definirNavegador('userAgent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1');
    definirNavegador('platform', 'iPhone');

    render(<PWAInstall onClose={vi.fn()} />);

    expect(screen.getByText(/En tu navegador:/i)).toBeInTheDocument();
    expect(screen.getByText(/Agregar a pantalla de inicio/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Instalar LukApp' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Paso|Siguiente/i)).not.toBeInTheDocument();
  });

  it('también reconoce un iPad que se anuncia como Mac y nunca promociona una PWA ya abierta', () => {
    definirNavegador('userAgent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1');
    definirNavegador('platform', 'MacIntel');
    definirNavegador('maxTouchPoints', 5);

    const primeraVista = render(<PWAInstall onClose={vi.fn()} />);
    expect(screen.getByText(/Ten LukApp a un toque/i)).toBeInTheDocument();

    primeraVista.unmount();
    reiniciarInstalacionPwaParaPruebas();
    configurarModo(true);
    const vista = render(<PWAInstall onClose={vi.fn()} />);
    expect(vista.queryByLabelText('Instalar LukApp')).not.toBeInTheDocument();
  });
});
