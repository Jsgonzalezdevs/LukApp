import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Mic, Keyboard, Search, Square } from 'lucide-react';
import { useDictation } from '../hooks/useDictation';
import { useImageOCR } from '../hooks/useImageOCR';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useAudioFeedback } from '../hooks/useAudioFeedback';
import { RippleButton } from './RippleButton';
import { DictadoOverlay } from './DictadoOverlay';
import type { FaseDictado } from './DictadoOverlay';

interface BotonAnotarProps {
  esPremium?: boolean;
  /** Se llama con lo que la persona dijo, ya transcrito. */
  onDictado: (texto: string) => void;
  /** Abrir la pantalla de anotar en blanco, para escribir a mano. */
  onManual: () => void;
  /** Abrir el buscador. */
  onBuscar: () => void;
  /** Si cambia con un timestamp > 0, dispara el dictado por voz y abre el overlay inmediatamente. */
  autoStartTrigger?: number;
  /** Nombres propios que el motor debe distinguir aunque sean poco comunes. */
  vocabulario?: readonly string[];
}

/**
 * La barra flotante de abajo: anotar a mano, buscar, escanear foto y el micrófono.
 */
export const BotonAnotar: React.FC<BotonAnotarProps> = ({
  esPremium = false,
  onDictado,
  onManual,
  onBuscar,
  autoStartTrigger,
  vocabulario = [],
}) => {
  const haptic = useHapticFeedback();
  const audio = useAudioFeedback();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectorFotosAbiertoRef = useRef(false);

  const [overlayAbierto, setOverlayAbierto] = useState(false);
  const [textoRevelado, setTextoRevelado] = useState<string | null>(null);
  // El estado de React se actualiza en el siguiente render. Este ref protege
  // los dos toques que un móvil puede entregar antes de que aparezca la fase
  // de procesamiento: solo el primero puede detener la grabación.
  const confirmacionEnCursoRef = useRef(false);
  // En iOS el cambio a `idle` puede llegar después de la transcripción final.
  // Esta bandera mantiene la sesión cerrada hasta que el texto haya pasado al
  // formulario, evitando que una actualización tardía reactive el micrófono.
  const transcripcionFinalizandoRef = useRef(false);

  useEffect(() => {
    const liberarSelectorAlVolver = () => {
      if (!selectorFotosAbiertoRef.current) return;
      selectorFotosAbiertoRef.current = false;
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    window.addEventListener('focus', liberarSelectorAlVolver);
    return () => window.removeEventListener('focus', liberarSelectorAlVolver);
  }, []);

  const manejarTextoFinal = useCallback((texto: string) => {
    if (transcripcionFinalizandoRef.current) return;
    transcripcionFinalizandoRef.current = true;
    // El texto definitivo permanece en el overlay para que la persona pueda
    // leerlo antes de confirmar. Antes este callback abría el formulario de
    // inmediato y obligaba a tocar el check sin saber aún qué se entendió.
    setTextoRevelado(texto);
  }, []);

  const dictation = useDictation(manejarTextoFinal, vocabulario);
  const { scanImage, isScanning, progress: ocrProgress, error: ocrError } = useImageOCR((ocrText) => {
    haptic.trigger('medium');
    audio.play('click');
    onDictado(ocrText);
  });

  const escuchando = dictation.status === 'listening';
  const procesando = dictation.status === 'processing';

  const actualizarReflejoCristal = (evento: React.PointerEvent<HTMLDivElement>) => {
    if (!esPremium) return;
    const limites = evento.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (evento.clientX - limites.left) / limites.width));
    const y = Math.min(1, Math.max(0, (evento.clientY - limites.top) / limites.height));
    evento.currentTarget.style.setProperty('--cristal-x', `${(x * 100).toFixed(1)}%`);
    evento.currentTarget.style.setProperty('--cristal-y', `${(y * 100).toFixed(1)}%`);
  };

  const centrarReflejoCristal = (evento: React.PointerEvent<HTMLDivElement>) => {
    if (!esPremium) return;
    evento.currentTarget.style.setProperty('--cristal-x', '50%');
    evento.currentTarget.style.setProperty('--cristal-y', '50%');
  };

  useEffect(() => {
    if (!escuchando) confirmacionEnCursoRef.current = false;
  }, [escuchando]);

  // Si se solicita el inicio automático desde el onboarding u otra acción
  useEffect(() => {
    if (!autoStartTrigger) return;
    if (procesando) return;

    if (!dictation.supported) {
      onManual();
      return;
    }

    if (!escuchando && !transcripcionFinalizandoRef.current) {
      haptic.trigger('heavy');
      audio.play('warning');
      setOverlayAbierto(true);
      dictation.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartTrigger]);

  const alTocarMicrofono = () => {
    if (procesando || transcripcionFinalizandoRef.current) return;

    if (!dictation.supported) {
      haptic.trigger('light');
      audio.play('click');
      onManual();
      return;
    }

    if (escuchando) {
      haptic.trigger('light');
      audio.play('click');
      dictation.stop();
    } else {
      haptic.trigger('heavy');
      audio.play('warning');
      setOverlayAbierto(true);
      dictation.start();
    }
  };

  const cancelarDictado = () => {
    haptic.trigger('light');
    audio.play('click');
    transcripcionFinalizandoRef.current = false;
    dictation.cancel();
    setTextoRevelado(null);
    setOverlayAbierto(false);
  };

  const confirmarDictado = () => {
    if (!escuchando || confirmacionEnCursoRef.current) return;
    confirmacionEnCursoRef.current = true;
    haptic.trigger('medium');
    audio.play('click');
    dictation.stop();
  };

  const continuarConTexto = () => {
    const texto = textoRevelado;
    if (!texto) return;
    setTextoRevelado(null);
    setOverlayAbierto(false);
    try {
      onDictado(texto);
    } finally {
      // Se libera después de entregar el texto para ignorar cualquier callback
      // tardío de la misma grabación sin bloquear la próxima toma.
      void Promise.resolve().then(() => {
        transcripcionFinalizandoRef.current = false;
      });
    }
  };

  const faseOverlay: FaseDictado =
    textoRevelado !== null ? 'revelando' : procesando ? 'procesando' : dictation.error ? 'error' : 'escuchando';

  const controlesRapidos = (
    <div className="fin-premium-lens-controls flex gap-1 p-2">
      <button
        type="button"
        onClick={() => {
          haptic.trigger('light');
          audio.play('click');
          onManual();
        }}
        aria-label="Anotar a mano"
        title="Anotar a mano"
        className="flex h-12 w-14 flex-col gap-1 items-center justify-center rounded-[var(--fin-r-pill)] text-[var(--fin-ink)] transition-transform active:scale-90"
      >
        <Keyboard className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => {
          haptic.trigger('light');
          audio.play('click');
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
            selectorFotosAbiertoRef.current = true;
            fileInputRef.current.click();
          }
        }}
        aria-label="Escanear comprobante o foto"
        title="Escanear recibo o comprobante de Nequi / Bancolombia"
        disabled={isScanning}
        className="flex h-12 w-14 flex-col gap-1 items-center justify-center rounded-[var(--fin-r-pill)] text-[var(--fin-ink)] transition-transform active:scale-90 disabled:opacity-50"
      >
        {isScanning ? (
          <Loader2 className="h-5 w-5 animate-spin text-[var(--fin-warn-ink)]" />
        ) : (
          <Camera className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        onClick={() => {
          haptic.trigger('light');
          audio.play('click');
          onBuscar();
        }}
        aria-label="Buscar movimientos y funciones"
        title="Buscar movimientos y funciones"
        className="flex h-12 w-14 flex-col gap-1 items-center justify-center rounded-[var(--fin-r-pill)] text-[var(--fin-ink)] transition-transform active:scale-90"
      >
        <Search className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-30 flex flex-col items-center gap-2"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + var(--fin-nav-h) + 0.75rem)' }}
    >
      <DictadoOverlay
        abierto={overlayAbierto}
        fase={faseOverlay}
        nivelAudio={dictation.level}
        texto={textoRevelado ?? dictation.interim}
        error={dictation.error}
        onCancelar={cancelarDictado}
        onTerminar={confirmarDictado}
        onContinuar={continuarConTexto}
        onEscribir={() => { cancelarDictado(); onManual(); }}
      />

      {/* Hidden File Input for Receipt/Photo Scanning */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          selectorFotosAbiertoRef.current = false;
          const file = e.target.files?.[0];
          if (file) {
            haptic.trigger('medium');
            audio.play('click');
            void scanImage(file);
            e.target.value = '';
          }
        }}
      />

      {/* Floating Scanning Progress Toast */}
      {isScanning ? (
        <div className="pointer-events-auto mb-1 flex items-center gap-3 rounded-[var(--fin-r-pill)] border border-[var(--fin-warn)]/30 bg-[var(--fin-card)] px-4 py-2 shadow-xl backdrop-blur-xl animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--fin-warn-ink)]" />
          <span className="text-[13px] font-semibold text-[var(--fin-ink)]">
            Escaneando comprobante… {Math.round(ocrProgress * 100)}%
          </span>
        </div>
      ) : ocrError ? (
        <div className="pointer-events-auto mb-1 flex items-center gap-2 rounded-[var(--fin-r-pill)] border border-[var(--fin-out)]/30 bg-[var(--fin-card)] px-4 py-2 text-[13px] font-medium text-[var(--fin-out)] shadow-xl backdrop-blur-xl">
          {ocrError}
        </div>
      ) : null}

      <div
        data-guia="anotar"
        aria-hidden={overlayAbierto}
        inert={overlayAbierto ? true : undefined}
        className="pointer-events-auto flex items-center gap-2"
        role="group"
        aria-label="Registrar movimiento"
      >
        {esPremium ? (
          <div
            className="fin-premium-lens"
            style={{
              borderRadius: 'var(--fin-r-pill)',
              position: 'relative',
              overflow: 'hidden',
              background: 'transparent',
              border: '1px solid var(--fin-premium-lens-border, rgb(255 255 255 / 30%))',
              boxShadow: 'inset 0 1px 0 var(--fin-premium-lens-rim, rgb(255 255 255 / 56%)), inset 0 -1px 0 var(--fin-premium-lens-bottom-rim, rgb(84 48 121 / 14%)), 0 12px 28px -20px rgb(28 25 23 / 25%), var(--fin-premium-lens-glow, 0 8px 28px -17px rgb(129 67 194 / 36%))',
            }}
            onPointerMove={actualizarReflejoCristal}
            onPointerLeave={centrarReflejoCristal}
          >
            <span
              aria-hidden="true"
              className="fin-premium-lens-material"
              style={{
                position: 'absolute',
                zIndex: 0,
                inset: 0,
                borderRadius: 'inherit',
                // El blur vive en su propia capa transparente, separada del
                // reflejo y de los botones para difuminar filas de verdad.
                backdropFilter: 'blur(48px) saturate(1.65) contrast(1.06)',
                WebkitBackdropFilter: 'blur(48px) saturate(1.65) contrast(1.06)',
                background: 'var(--fin-premium-lens-fill, linear-gradient(140deg, rgb(255 255 255 / 3%), rgb(126 34 206 / 6%) 48%, rgb(139 92 246 / 3%)))',
                pointerEvents: 'none',
              }}
            />
            <span
              aria-hidden="true"
              className="fin-premium-lens-light"
              style={{
                position: 'absolute',
                zIndex: 1,
                inset: '1px',
                borderRadius: 'inherit',
                backgroundImage: 'radial-gradient(155px circle at var(--cristal-x) var(--cristal-y), var(--fin-premium-lens-specular, rgb(255 255 255 / 18%)), rgb(217 190 255 / 10%) 31%, transparent 75%), linear-gradient(145deg, rgb(255 255 255 / 14%), transparent 34%, rgb(199 164 255 / 8%) 72%, transparent), linear-gradient(180deg, rgb(255 255 255 / 7%), transparent 28%)',
                backgroundSize: 'auto, 220% 220%, 100% 100%',
                backgroundPosition: 'center, 0% 35%, center',
                mixBlendMode: 'screen',
                pointerEvents: 'none',
              }}
            />
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                zIndex: 2,
                inset: '1px',
                borderRadius: 'inherit',
                borderTop: '1px solid var(--fin-premium-lens-rim, rgb(255 255 255 / 56%))',
                boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 12%)',
                pointerEvents: 'none',
              }}
            />
            <div style={{ position: 'relative', zIndex: 4 }}>{controlesRapidos}</div>
          </div>
        ) : (
          <div className="fin-glass rounded-[var(--fin-r-pill)] bg-[var(--fin-card)]">
            {controlesRapidos}
          </div>
        )}

        <div className="relative">
          {dictation.status === 'blocked' && (
            <span
              className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-warn)] text-white text-[13px] font-bold"
              aria-label="Micrófono bloqueado"
              title="Permiso del micrófono denegado"
            >
              ✕
            </span>
          )}
          <RippleButton
            type="button"
            onClick={alTocarMicrofono}
            aria-pressed={escuchando}
            aria-busy={procesando}
            rippleColor="rgba(255,255,255,0.55)"
            aria-label={
              procesando ? 'Transcribiendo' : escuchando ? 'Dejar de escuchar' : 'Anotar hablando'
            }
            className={`flex h-16 w-16 items-center justify-center rounded-[var(--fin-r-pill)] text-[var(--fin-on-out)] ${esPremium ? '' : 'shadow-[0_10px_28px_-8px_rgb(190_18_60/0.6)]'} transition-transform active:scale-95 ${
              escuchando ? 'animate-pulse' : ''
            }`}
            style={{ backgroundColor: esPremium ? 'transparent' : 'var(--fin-out)', opacity: procesando || dictation.status === 'blocked' ? 0.5 : 1 }}
          >
            {esPremium ? <span className="dictado-premium-fondo" aria-hidden="true" /> : null}
            {procesando ? (
              <Loader2 className="relative z-10 h-6 w-6 animate-spin" strokeWidth={2.5} aria-hidden="true" />
            ) : escuchando ? (
              <Square className="relative z-10 h-6 w-6" strokeWidth={3} aria-hidden="true" />
            ) : (
              <Mic className="relative z-10 h-7 w-7" strokeWidth={2.5} aria-hidden="true" />
            )}
          </RippleButton>
        </div>
      </div>
    </div>
  );
};
