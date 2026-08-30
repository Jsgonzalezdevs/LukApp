import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAudioCapture } from './useAudioCapture';

type GrabadoraFalsa = {
  state: 'inactive' | 'recording';
  mimeType: string;
  ondataavailable: ((evento: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  romper: () => void;
};

const grabadoras: GrabadoraFalsa[] = [];
const pista = { stop: vi.fn() };
const flujo = { getTracks: () => [pista] } as unknown as MediaStream;
let ahora = 0;

class MediaRecorderFalso {
  static lanzarAlConstruir = false;
  static emitirVacio = false;
  static demorarStop = false;
  static isTypeSupported = vi.fn(() => true);
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: GrabadoraFalsa['ondataavailable'] = null;
  onstop: GrabadoraFalsa['onstop'] = null;
  onerror: GrabadoraFalsa['onerror'] = null;

  constructor() {
    if (MediaRecorderFalso.lanzarAlConstruir) throw new Error('Sin códec');
    grabadoras.push(this as unknown as GrabadoraFalsa);
  }

  start = () => {
    this.state = 'recording';
  };

  stop = () => {
    if (this.state === 'inactive') return;
    this.state = 'inactive';
    const terminar = () => {
      this.ondataavailable?.({ data: new Blob(MediaRecorderFalso.emitirVacio ? [] : ['voz'], { type: this.mimeType }) });
      this.onstop?.();
    };
    if (MediaRecorderFalso.demorarStop) setTimeout(terminar, 0);
    else terminar();
  };

  romper = () => {
    this.state = 'inactive';
    this.onerror?.();
  };
}

const respuesta = (cuerpo: unknown, ok = true) =>
  Promise.resolve(new Response(JSON.stringify(cuerpo), { status: ok ? 200 : 503 }));

const instalarConexion = (effectiveType = '3g', saveData = false) => {
  Object.defineProperty(navigator, 'connection', {
    configurable: true,
    value: { effectiveType, saveData },
  });
};

beforeEach(() => {
  ahora = new Date('2026-08-30T12:00:00Z').getTime();
  vi.spyOn(Date, 'now').mockImplementation(() => ahora);
  grabadoras.length = 0;
  pista.stop.mockReset();
  MediaRecorderFalso.lanzarAlConstruir = false;
  MediaRecorderFalso.emitirVacio = false;
  MediaRecorderFalso.demorarStop = false;
  MediaRecorderFalso.isTypeSupported = vi.fn(() => true);
  Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: MediaRecorderFalso });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn().mockResolvedValue(flujo) },
  });
  Object.defineProperty(navigator, 'permissions', { configurable: true, value: undefined });
  instalarConexion();
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => respuesta({ text: 'pagué 20 mil' })));
  Object.defineProperty(window, 'AudioContext', { configurable: true, value: undefined });
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useAudioCapture', () => {
  it('expone que no hay soporte si el navegador no puede grabar', () => {
    Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: undefined });
    const { result } = renderHook(() => useAudioCapture(vi.fn()));
    expect(result.current.supported).toBe(false);
  });

  it('tolera navegadores que no anuncian formatos y deja que el navegador elija', async () => {
    MediaRecorderFalso.isTypeSupported = undefined as unknown as typeof MediaRecorderFalso.isTypeSupported;
    const { result } = renderHook(() => useAudioCapture(vi.fn()));
    await act(async () => result.current.start());
    expect(grabadoras).toHaveLength(1);
    await act(async () => result.current.cancel());
  });

  it('transcribe una nota válida y libera el micrófono', async () => {
    const alFinal = vi.fn();
    const { result } = renderHook(() => useAudioCapture(alFinal));

    await act(async () => result.current.start());
    expect(result.current.status).toBe('listening');
    expect(grabadoras).toHaveLength(1);

    await act(async () => {
      ahora += 900;
      result.current.stop();
      await Promise.resolve();
    });

    await waitFor(() => expect(alFinal).toHaveBeenCalledWith('pagué 20 mil'));
    expect(pista.stop).toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('pasa a procesando en el mismo toque aunque el navegador tarde en emitir onstop', async () => {
    MediaRecorderFalso.demorarStop = true;
    const { result } = renderHook(() => useAudioCapture(vi.fn()));
    await act(async () => result.current.start());

    act(() => {
      ahora += 900;
      result.current.stop();
    });

    expect(result.current.status).toBe('processing');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it('no sube una pulsación demasiado corta', async () => {
    const { result } = renderHook(() => useAudioCapture(vi.fn()));
    await act(async () => result.current.start());
    await act(async () => result.current.stop());

    expect(result.current.error).toContain('Muy corto');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('descarta una grabación larga que llegó vacía', async () => {
    MediaRecorderFalso.emitirVacio = true;
    const { result } = renderHook(() => useAudioCapture(vi.fn()));
    await act(async () => result.current.start());
    await act(async () => {
      ahora += 900;
      result.current.stop();
    });
    expect(result.current.error).toContain('Muy corto');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('descarta el audio al cancelar, incluso si ya estaba grabando', async () => {
    const alFinal = vi.fn();
    const { result } = renderHook(() => useAudioCapture(alFinal));
    await act(async () => result.current.start());
    await act(async () => {
      ahora += 900;
      result.current.cancel();
    });

    expect(result.current.status).toBe('idle');
    expect(alFinal).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(pista.stop).toHaveBeenCalled();
  });

  it('explica un permiso denegado y recuerda que ya se intentó pedirlo', async () => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValue(
      new DOMException('No', 'NotAllowedError'),
    );
    const { result } = renderHook(() => useAudioCapture(vi.fn()));

    await act(async () => result.current.start());
    expect(result.current.status).toBe('blocked');
    expect(result.current.error).toContain('Necesitamos acceso');

    await act(async () => result.current.start());
    expect(result.current.error).toContain('Ajustes');
  });

  it('informa cuando no se pudo abrir el micrófono por un error inesperado', async () => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('ocupado'));
    const { result } = renderHook(() => useAudioCapture(vi.fn()));
    await act(async () => result.current.start());
    expect(result.current.error).toBe('No se pudo abrir el micrófono.');
  });

  it('maneja una desconexión abrupta del micrófono sin intentar subir audio', async () => {
    const { result } = renderHook(() => useAudioCapture(vi.fn()));
    await act(async () => result.current.start());

    await act(async () => grabadoras[0].romper());
    expect(result.current.status).toBe('idle');
    expect(result.current.error).toBe('Se interrumpió la grabación.');
    expect(pista.stop).toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('cancela con seguridad si el permiso llega después de cerrar el dictado', async () => {
    let resolverFlujo: ((valor: MediaStream) => void) | undefined;
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => new Promise<MediaStream>((resolve) => { resolverFlujo = resolve; }),
    );
    const { result } = renderHook(() => useAudioCapture(vi.fn()));
    const inicio = result.current.start();
    act(() => result.current.cancel());
    await act(async () => {
      resolverFlujo?.(flujo);
      await inicio;
    });
    expect(result.current.status).toBe('idle');
    expect(pista.stop).toHaveBeenCalled();
    expect(grabadoras).toHaveLength(0);
  });

  it('informa cuando el navegador no permite crear la grabadora', async () => {
    MediaRecorderFalso.lanzarAlConstruir = true;
    const { result } = renderHook(() => useAudioCapture(vi.fn()));
    await act(async () => result.current.start());
    expect(result.current.error).toBe('Este teléfono no deja grabar audio desde la app.');
    expect(pista.stop).toHaveBeenCalled();
  });

  it('filtra alucinaciones de silencio en vez de registrarlas como un movimiento', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => respuesta({ text: 'Gracias por ver el video' }));
    const alFinal = vi.fn();
    const { result } = renderHook(() => useAudioCapture(alFinal));
    await act(async () => result.current.start());
    await act(async () => {
      ahora += 900;
      result.current.stop();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.error).toContain('No se entendió'));
    expect(alFinal).not.toHaveBeenCalled();
  });

  it('reintenta una conexión caída y muestra un error comprensible si no vuelve', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('red caída'));
    const { result } = renderHook(() => useAudioCapture(vi.fn()));
    await act(async () => result.current.start());
    await act(async () => {
      ahora += 900;
      result.current.stop();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.error).toContain('No se pudo conectar'));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('no reenvía el mismo audio ante un rechazo 4xx', async () => {
    vi.mocked(fetch).mockImplementationOnce(() =>
      Promise.resolve(new Response('{}', { status: 400 })),
    );
    const { result } = renderHook(() => useAudioCapture(vi.fn()));
    await act(async () => result.current.start());
    await act(async () => {
      ahora += 900;
      result.current.stop();
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.error).toContain('No se pudo conectar'));
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('reintenta un error HTTP temporal y conserva una transcripción que sí llegó', async () => {
    vi.mocked(fetch)
      .mockImplementationOnce(() => respuesta({}, false))
      .mockImplementationOnce(() => respuesta({ text: 'pagué el mercado' }));
    const alFinal = vi.fn();
    const { result } = renderHook(() => useAudioCapture(alFinal));
    await act(async () => result.current.start());
    await act(async () => {
      ahora += 900;
      result.current.stop();
      await Promise.resolve();
    });
    await waitFor(() => expect(alFinal).toHaveBeenCalledWith('pagué el mercado'));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('traduce los errores de servidor y no entrega una transcripción incompleta', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => respuesta({ offline: true, error: 'Falta llave de transcripción' }));
    const alFinal = vi.fn();
    const { result } = renderHook(() => useAudioCapture(alFinal));
    await act(async () => result.current.start());
    await act(async () => {
      ahora += 900;
      result.current.stop();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.error).toContain('GROQ_API_KEY'));
    expect(alFinal).not.toHaveBeenCalled();
  });

  it.each([
    ['No llegó audio', 'Mantén la app abierta'],
    ['servicio no disponible', 'No se pudo transcribir'],
    [undefined, 'No se pudo transcribir'],
  ])('convierte el error remoto «%s» en un mensaje útil', async (error, esperado) => {
    vi.mocked(fetch).mockImplementationOnce(() => respuesta({ offline: true, error }));
    const { result } = renderHook(() => useAudioCapture(vi.fn()));
    await act(async () => result.current.start());
    await act(async () => {
      ahora += 900;
      result.current.stop();
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.error).toContain(esperado));
  });

  it('muestra el texto parcial y cierra el medidor visual al cancelar', async () => {
    instalarConexion('4g');
    let siguienteFotograma: FrameRequestCallback | undefined;
    const cerrarContexto = vi.fn().mockResolvedValue(undefined);
    class ContextoAudioFalso {
      createMediaStreamSource = () => ({ connect: vi.fn() });
      createAnalyser = () => ({
        fftSize: 0,
        smoothingTimeConstant: 0,
        frequencyBinCount: 2,
        getByteFrequencyData: (datos: Uint8Array) => datos.set([50, 50]),
      });
      close = cerrarContexto;
    }
    Object.defineProperty(window, 'AudioContext', { configurable: true, value: ContextoAudioFalso });
    vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => {
      siguienteFotograma = cb;
      return 7;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.mocked(fetch).mockImplementationOnce(() => respuesta({ text: 'pagué el almuerzo' }));
    const { result } = renderHook(() => useAudioCapture(vi.fn()));
    await act(async () => result.current.start());
    expect(grabadoras).toHaveLength(2);
    await act(async () => {
      grabadoras[1].stop();
      await Promise.resolve();
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.interim).toBe('pagué el almuerzo'));
    await act(async () => {
      siguienteFotograma?.(0);
      result.current.cancel();
    });
    expect(result.current.level).toBe(0);
    expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
    expect(cerrarContexto).toHaveBeenCalled();
  });

  it('salta un segmento vacío y continúa escuchando sin añadir texto basura', async () => {
    instalarConexion('4g');
    MediaRecorderFalso.emitirVacio = true;
    const { result } = renderHook(() => useAudioCapture(vi.fn()));
    await act(async () => result.current.start());
    expect(grabadoras).toHaveLength(2);
    await act(async () => {
      grabadoras[1].stop();
      await Promise.resolve();
    });
    expect(result.current.interim).toBe('');
    expect(grabadoras.length).toBeGreaterThanOrEqual(3);
    await act(async () => result.current.cancel());
  });

  it('detiene automáticamente el segmento parcial cuando cumple su límite', async () => {
    vi.useFakeTimers();
    instalarConexion('4g');
    const { result } = renderHook(() => useAudioCapture(vi.fn()));
    await act(async () => result.current.start());
    expect(grabadoras).toHaveLength(2);
    await act(async () => vi.advanceTimersByTime(4_000));
    expect(grabadoras[1].state).toBe('inactive');
    await act(async () => result.current.cancel());
    vi.useRealTimers();
  });

  it('no deja una excepción del consumidor atrapada en la grabación', async () => {
    const alFinal = vi.fn(() => { throw new Error('fallo de pantalla'); });
    const { result } = renderHook(() => useAudioCapture(alFinal));
    await act(async () => result.current.start());
    await act(async () => {
      ahora += 900;
      result.current.stop();
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.error).toBe('No se pudo conectar para transcribir.'));
    expect(result.current.status).toBe('idle');
  });
});
