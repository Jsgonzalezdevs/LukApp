import { afterEach, describe, expect, it, vi } from 'vitest';
import { EVENTO_MOSTRAR_INSTALACION_PWA, instalarConsolaDeVistas } from './consolaVistas';

describe('consola de vistas', () => {
  afterEach(() => {
    delete window.LukAppPruebas;
    vi.restoreAllMocks();
  });

  it('abre solo las vistas declaradas y puede retirarse al desmontar', () => {
    const abrir = vi.fn();
    const cerrar = vi.fn();
    const advertir = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const retirar = instalarConsolaDeVistas({ abrir, cerrar });

    window.LukAppPruebas?.abrir('premium');
    Reflect.get(window, 'premium');
    window.LukAppPruebas?.abrir('no-existe');
    window.LukAppPruebas?.cerrar();

    expect(abrir).toHaveBeenCalledWith('premium');
    expect(abrir).toHaveBeenCalledTimes(2);
    expect(advertir).toHaveBeenCalledWith(expect.stringContaining('Precaución'));
    expect(advertir).toHaveBeenCalledWith(expect.stringContaining('no-existe'));
    expect(cerrar).toHaveBeenCalledOnce();

    retirar();
    expect(window.LukAppPruebas).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(window, 'premium')).toBe(false);
  });

  it('incluye el aviso de instalación PWA entre los atajos de consola', () => {
    const mostrarInstalacion = vi.fn();
    window.addEventListener(EVENTO_MOSTRAR_INSTALACION_PWA, mostrarInstalacion);
    const retirar = instalarConsolaDeVistas({ abrir: vi.fn(), cerrar: vi.fn() });

    Reflect.get(window, 'instalar');
    window.LukAppPruebas?.instalarPwa();

    expect(mostrarInstalacion).toHaveBeenCalledTimes(2);
    retirar();
    window.removeEventListener(EVENTO_MOSTRAR_INSTALACION_PWA, mostrarInstalacion);
  });
});
