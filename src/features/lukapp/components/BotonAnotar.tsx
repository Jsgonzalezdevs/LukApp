import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Mic, Plus, Search, Square } from 'lucide-react';
import { useDictation } from '../hooks/useDictation';
import { useImageOCR } from '../hooks/useImageOCR';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useAudioFeedback } from '../hooks/useAudioFeedback';
import { RippleButton } from './RippleButton';
import { DictadoOverlay } from './DictadoOverlay';
import type { FaseDictado } from './DictadoOverlay';

interface BotonAnotarProps {
  /** Se llama con lo que la persona dijo, ya transcrito. */
  onDictado: (texto: string) => void;
  /** Abrir la pantalla de anotar en blanco, para escribir a mano. */
  onManual: () => void;
  /** Abrir el buscador. */
  onBuscar: () => void;
  /** Si cambia con un timestamp > 0, dispara el dictado por voz y abre el overlay inmediatamente. */
  autoStartTrigger?: number;
}

/**
 * La barra flotante de abajo: anotar a mano, buscar, escanear foto y el micrófono.
 */
export const BotonAnotar: React.FC<BotonAnotarProps> = ({
  onDictado,
  onManual,
  onBuscar,
  autoStartTrigger,
}) => {
  const haptic = useHapticFeedback();
  const audio = useAudioFeedback();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [overlayAbierto, setOverlayAbierto] = useState(false);
  const [textoRevelado, setTextoRevelado] = useState<string | null>(null);
  const descartadoRef = useRef(false);

  const manejarTextoFinal = useCallback((texto: string) => {
    if (descartadoRef.current) {
      descartadoRef.current = false;
      return;
    }
    setTextoRevelado(texto);
  }, []);

  const dictation = useDictation(manejarTextoFinal);
  const { scanImage, isScanning, progress: ocrProgress, error: ocrError } = useImageOCR((ocrText) => {
    haptic.trigger('medium');
    audio.play('click');
    onDictado(ocrText);
  });

  const escuchando = dictation.status === 'listening';
  const procesando = dictation.status === 'processing';

  // Si se solicita el inicio automático desde el onboarding u otra acción
  useEffect(() => {
    if (!autoStartTrigger) return;
    if (procesando) return;

    if (!dictation.supported) {
      onManual();
      return;
    }

    if (!escuchando) {
      haptic.trigger('heavy');
      audio.play('warning');
      setOverlayAbierto(true);
      dictation.start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStartTrigger]);

  const alTocarMicrofono = () => {
    if (procesando) return;

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
    descartadoRef.current = true;
    dictation.cancel();
    setTextoRevelado(null);
    setOverlayAbierto(false);
  };

  const confirmarDictado = () => {
    haptic.trigger('medium');
    audio.play('click');
    dictation.stop();
  };

  const revelarCompleto = () => {
    const texto = textoRevelado;
    setTextoRevelado(null);
    setOverlayAbierto(false);
    if (texto) onDictado(texto);
  };

  const faseOverlay: FaseDictado =
    textoRevelado !== null ? 'revelando' : procesando ? 'procesando' : dictation.error ? 'error' : 'escuchando';

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-30 flex flex-col items-center gap-2"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + var(--fin-nav-h) + 0.75rem)' }}
      aria-hidden={overlayAbierto}
    >
      <DictadoOverlay
        abierto={overlayAbierto}
        fase={faseOverlay}
        nivelAudio={dictation.level}
        texto={textoRevelado ?? dictation.interim}
        error={dictation.error}
        onCancelar={cancelarDictado}
        onConfirmar={confirmarDictado}
        onRevelado={revelarCompleto}
      />

      {/* Hidden File Input for Receipt/Photo Scanning */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
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
        <div className="pointer-events-auto mb-1 flex items-center gap-2.5 rounded-[var(--fin-r-pill)] border border-amber-500/30 bg-[var(--fin-card)] px-4 py-2 shadow-xl backdrop-blur-xl animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
          <span className="text-[13px] font-semibold text-[var(--fin-ink)]">
            Escaneando comprobante… {Math.round(ocrProgress * 100)}%
          </span>
        </div>
      ) : ocrError ? (
        <div className="pointer-events-auto mb-1 flex items-center gap-2 rounded-[var(--fin-r-pill)] border border-red-500/30 bg-[var(--fin-card)] px-4 py-2 text-[12.5px] font-medium text-red-400 shadow-xl backdrop-blur-xl">
          {ocrError}
        </div>
      ) : null}

      <div data-guia="anotar" className="pointer-events-auto flex items-center gap-2.5">
        <div className="fin-glass flex gap-1 rounded-[var(--fin-r-pill)] bg-[var(--fin-card)] p-1.5">
          <button
            type="button"
            onClick={() => {
              haptic.trigger('light');
              audio.play('click');
              onManual();
            }}
            aria-label="Anotar a mano"
            title="Anotar a mano"
            className="flex h-11 w-11 items-center justify-center rounded-[var(--fin-r-pill)] text-[var(--fin-ink)] transition-transform active:scale-90"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              haptic.trigger('light');
              audio.play('click');
              fileInputRef.current?.click();
            }}
            aria-label="Escanear comprobante o foto"
            title="Escanear recibo o comprobante de Nequi / Bancolombia"
            disabled={isScanning}
            className="flex h-11 w-11 items-center justify-center rounded-[var(--fin-r-pill)] text-[var(--fin-ink)] transition-transform active:scale-90 disabled:opacity-50"
          >
            {isScanning ? (
              <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
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
            aria-label="Buscar un movimiento"
            title="Buscar movimientos"
            className="flex h-11 w-11 items-center justify-center rounded-[var(--fin-r-pill)] text-[var(--fin-ink)] transition-transform active:scale-90"
          >
            <Search className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>

        <div className="relative">
          {dictation.status === 'blocked' && (
            <span
              className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-warn)] text-white text-[10px] font-bold"
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
            className={`flex h-16 w-16 items-center justify-center rounded-[var(--fin-r-pill)] text-white shadow-[0_10px_28px_-8px_rgb(190_18_60/0.6)] transition-transform active:scale-95 ${
              escuchando ? 'animate-pulse' : ''
            }`}
            style={{ backgroundColor: 'var(--fin-out)', opacity: procesando || dictation.status === 'blocked' ? 0.5 : 1 }}
          >
            {procesando ? (
              <Loader2 className="h-6 w-6 animate-spin" strokeWidth={2.5} aria-hidden="true" />
            ) : escuchando ? (
              <Square className="h-6 w-6" strokeWidth={3} aria-hidden="true" />
            ) : (
              <Mic className="h-7 w-7" strokeWidth={2.5} aria-hidden="true" />
            )}
          </RippleButton>
        </div>
      </div>
    </div>
  );
};
