/**
 * Sonidos interactivos para retroalimentación de audio.
 * Genera tonos con Web Audio API (sin archivos externos).
 */

export type SoundType =
  | 'click'      // Click suave (300Hz, 50ms) - botones normales
  | 'success'    // Campana de éxito (800Hz subiendo a 1200Hz) - guardar
  | 'error'      // Buzzer de error (200Hz descendiendo) - validación
  | 'warning'    // Alerta (600Hz pulsante) - advertencia
  | 'selection'  // Tono suave (400Hz, 30ms) - cambios de selección
  | 'heavy'      // Golpe grave y corto - confirmaciones importantes (borrar, crear)
  | 'toggle'     // Blip doble muy corto - prender/apagar un interruptor
  | 'open'       // Barrido ascendente breve - abrir una hoja o modal
  | 'close';     // Barrido descendente breve - cerrar una hoja o modal

let audioContextInstance: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContextInstance) {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    audioContextInstance = new AudioContextClass();
  }
  return audioContextInstance;
};

/**
 * Subir el volumen de golpe a t=now (como hacía esto antes) suena a "clic" de
 * radio vieja -- un escalón instantáneo en la onda. Una rampa de ataque de
 * unos milisegundos antes de la caída evita ese chasquido y es lo que hace
 * que un tono generado por código se sienta suave en vez de "beepy".
 */
const ATAQUE_S = 0.006;
const VOLUMEN = 0.22;

const playTone = (frequency: number, duration: number, type: OscillatorType = 'sine') => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    osc.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(VOLUMEN, now + ATAQUE_S);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.start(now);
    osc.stop(now + duration);
  } catch (err) {
    console.debug('Audio feedback not available:', err);
  }
};

const playSoundPattern = (pattern: Array<{ freq: number; duration: number; type?: OscillatorType }>) => {
  try {
    const ctx = getAudioContext();
    let time = ctx.currentTime;

    pattern.forEach(({ freq, duration, type = 'sine' }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);
      osc.connect(gain);
      gain.connect(ctx.destination);

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(VOLUMEN, time + ATAQUE_S);
      gain.gain.exponentialRampToValueAtTime(0.01, time + duration);

      osc.start(time);
      osc.stop(time + duration);

      time += duration + 0.05; // Pequeña pausa entre tonos
    });
  } catch (err) {
    console.debug('Audio pattern not available:', err);
  }
};

/** Un barrido de frecuencia continuo, para "abrir"/"cerrar" -- sube o baja en vez de saltar entre tonos fijos. */
const playSweep = (desde: number, hasta: number, duration: number) => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(desde, now);
    osc.frequency.exponentialRampToValueAtTime(hasta, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(VOLUMEN, now + ATAQUE_S);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.start(now);
    osc.stop(now + duration);
  } catch (err) {
    console.debug('Audio sweep not available:', err);
  }
};

const SOUND_PATTERNS: Record<SoundType, () => void> = {
  click: () => playTone(300, 0.05, 'sine'),

  selection: () => playTone(400, 0.03, 'sine'),

  success: () => {
    playSoundPattern([
      { freq: 800, duration: 0.1 },
      { freq: 1200, duration: 0.2 },
    ]);
  },

  error: () => {
    playSoundPattern([
      { freq: 300, duration: 0.1 },
      { freq: 150, duration: 0.15 },
    ]);
  },

  warning: () => {
    playSoundPattern([
      { freq: 600, duration: 0.08 },
      { freq: 600, duration: 0.08 },
      { freq: 600, duration: 0.08 },
    ]);
  },

  heavy: () => playTone(180, 0.09, 'triangle'),

  toggle: () => {
    playSoundPattern([
      { freq: 500, duration: 0.025 },
      { freq: 700, duration: 0.025 },
    ]);
  },

  open: () => playSweep(500, 900, 0.09),

  close: () => playSweep(700, 400, 0.08),
};

/**
 * Hook para reproducir sonidos interactivos.
 * Compatible con todos los navegadores modernos.
 */
export const useAudioFeedback = () => {
  const supported =
    typeof window !== 'undefined' &&
    (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined');

  const play = (type: SoundType): void => {
    if (!supported) return;

    try {
      const soundFn = SOUND_PATTERNS[type];
      if (soundFn) {
        soundFn();
      }
    } catch (err) {
      console.debug('Sound playback error:', err);
    }
  };

  return { supported, play };
};

export default useAudioFeedback;
