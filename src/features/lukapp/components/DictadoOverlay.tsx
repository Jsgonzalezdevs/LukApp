import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Check, AlertTriangle, Square } from 'lucide-react';
import { COPY } from '../copy';

export type FaseDictado = 'escuchando' | 'procesando' | 'revelando' | 'error';

interface DictadoOverlayProps {
  abierto: boolean;
  fase: FaseDictado;
  /** 0 a 1. Mueve el pulso mientras se escucha; el resto del tiempo se ignora. */
  nivelAudio: number;
  /** El texto ya transcrito, listo para revelarse palabra por palabra. */
  texto: string;
  error?: string | null;
  onCancelar: () => void;
  /** "Ya terminé de hablar": corta la grabación y pasa a transcribir. */
  onTerminar: () => void;
  /** Confirma el texto definitivo y abre la revisión del movimiento. */
  onContinuar: () => void;
}

/**
 * La pantalla completa que se abre al tocar el micrófono.
 *
 * Antes "escuchando" era un círculo rojo latiendo en una barra flotante de
 * 64px -- se sentía como si el toque solo hubiera activado un interruptor, no
 * como si la app estuviera de verdad escuchando. Ahora, mientras se graba,
 * `useAudioCapture` corta la grabación en segmentos cortos e independientes
 * (ver `DURACION_SEGMENTO_MS` ahí), transcribe cada uno apenas termina y va
 * pegando el texto -- no es una conexión en vivo a un motor de voz en
 * streaming, es Groq respondiendo rapidísimo segmento tras segmento, pero el
 * resultado en pantalla es el mismo que buscaba: el texto aparece mientras se
 * habla, no de golpe al final.
 *
 * Por eso `texto` sirve para dos cosas con el mismo tratamiento visual: el
 * parcial que va creciendo mientras se escucha, y la versión definitiva que
 * Whisper confirma al terminar. La diferencia importante es que el check solo
 * aparece con esta última: primero se habla, después se lee lo entendido y
 * únicamente entonces se confirma para revisar el movimiento.
 */
export const DictadoOverlay: React.FC<DictadoOverlayProps> = ({
  abierto,
  fase,
  nivelAudio,
  texto,
  error,
  onCancelar,
  onTerminar,
  onContinuar,
}) => {
  const palabras = useMemo(() => texto.trim().split(/\s+/).filter(Boolean), [texto]);

  // Cuánto se demora cada palabra en aparecer: rápido para una frase corta,
  // pero nunca tan lento que una frase larga tarde una eternidad en revelarse.
  const stagger = useMemo(() => Math.min(0.05, 1.1 / Math.max(1, palabras.length)), [palabras.length]);

  return (
    <AnimatePresence>
      {abierto ? (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          className="fin-dictado-bg pointer-events-auto fixed inset-0 z-50 flex flex-col overflow-hidden rounded-t-[28px]"
          role="dialog"
          aria-modal="true"
          aria-label="Dictando movimiento"
        >
          <div
            className="flex flex-1 flex-col items-center justify-center px-8 text-center"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
          >
            {fase === 'error' ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3"
              >
                <AlertTriangle className="h-8 w-8 text-white/90" strokeWidth={2} aria-hidden="true" />
                <p className="text-[19px] font-semibold leading-snug text-white">
                  {error ?? 'Algo no salió bien.'}
                </p>
              </motion.div>
            ) : palabras.length > 0 ? (
              <div className="flex flex-col items-center gap-5">
                <div
                  className="flex items-center gap-2 rounded-[var(--fin-r-pill)] bg-black/15 px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-white/85"
                  aria-live="polite"
                >
                  {fase === 'escuchando' ? (
                    <span className="h-2 w-2 animate-pulse rounded-[var(--fin-r-pill)] bg-white" aria-hidden="true" />
                  ) : null}
                  {fase === 'escuchando'
                    ? 'Sigo escuchando'
                    : fase === 'procesando'
                      ? 'Preparando el texto'
                      : 'Esto fue lo que entendí'}
                </div>
                <p
                  aria-label={fase === 'revelando' ? 'Transcripción final' : 'Transcripción en curso'}
                  aria-live="polite"
                  className={`max-h-[45vh] overflow-y-auto px-1 text-[26px] font-bold leading-tight sm:text-[30px] ${
                    fase === 'escuchando' || fase === 'procesando' ? 'text-white/60 italic' : 'text-white'
                  }`}
                >
                {/* Mientras se escucha o procesa, el texto es solo el mejor intento
 de cada segmento por separado -- puede tener palabras cortadas o
 directamente inventadas. Se muestra apagado e itálico a propósito,
 para que no se lea como la frase ya confirmada; solo al "revelar"
 (la transcripción de la grabación completa, sin cortes) se pone en
 blanco sólido, como corresponde a lo definitivo. */}
                {palabras.map((palabra, i) => (
                  <React.Fragment key={`${i}-${palabra}`}>
                    <motion.span
                      initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                      transition={{ duration: 0.32, delay: i * stagger, ease: 'easeOut' }}
                      className="inline-block"
                    >
                      {palabra}
                    </motion.span>
                    {i < palabras.length - 1 ? ' ' : ''}
                  </React.Fragment>
                ))}
                {/* El cursor que dice "sigo escuchando": solo tiene sentido
 mientras el parcial todavía puede seguir creciendo. En "revelando"
 ya no hay más que decir, y un punto latiendo ahí se vería raro. */}
                {fase === 'escuchando' ? (
                  <motion.span
                    className="ml-1 inline-block h-3 w-3 rounded-[var(--fin-r-pill)] bg-white/70 align-middle"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
                    aria-hidden="true"
                  />
                ) : null}
                </p>
                {fase === 'procesando' ? (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 rounded-[var(--fin-r-pill)] bg-black/15 px-4 py-2 text-sm font-semibold text-white/90"
                    aria-live="polite"
                  >
                    <span className="h-2.5 w-2.5 animate-pulse rounded-[var(--fin-r-pill)] bg-white" aria-hidden="true" />
                    Confirmando lo que dijiste…
                  </motion.div>
                ) : fase === 'escuchando' ? (
                  <p className="max-w-sm text-[14px] font-medium leading-relaxed text-white/70">
                    Puedes seguir hablando. Toca <strong className="font-bold text-white">Terminé</strong> cuando acabes.
                  </p>
                ) : (
                  <p className="max-w-sm text-[14px] font-medium leading-relaxed text-white/75">
                    Si quedó bien, confirma para revisar el movimiento antes de guardarlo.
                  </p>
                )}
              </div>
            ) : (
              <>
                <motion.p
                  key={fase}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.75 }}
                  transition={{ duration: 0.3 }}
                  className="text-[22px] font-semibold leading-snug text-white sm:text-[26px]"
                >
                  {fase === 'procesando' ? COPY.input.transcribiendo : COPY.input.dictadoPrompt}
                </motion.p>
                {fase === 'escuchando' ? (
                  <p className="mt-3 max-w-sm text-[14px] font-medium leading-relaxed text-white/65">
                    También puedes abonar tarjetas, mover plata entre cuentas y cajitas, actualizar saldos o registrar rendimientos.
                  </p>
                ) : null}

                {fase === 'escuchando' ? (
                  <p className="mt-5 rounded-[var(--fin-r-pill)] bg-black/15 px-4 py-2 text-[13px] font-semibold text-white/85">
                    Habla con calma. Al terminar, toca <strong className="text-white">Terminé</strong> para ver el texto.
                  </p>
                ) : null}

                {/* El pulso que reacciona a la voz: nada mientras procesa (ya no
 hay audio que medir), pero mientras escucha crece y se apaga con
 cada sílaba en vez de quedarse quieto. */}
                <div className="mt-10 flex h-16 items-center justify-center gap-2" aria-hidden="true">
                  {fase === 'procesando' ? (
                    [0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-3 w-3 rounded-[var(--fin-r-pill)] bg-white/80"
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                      />
                    ))
                  ) : (
                    [0, 1, 2, 3, 4].map((i) => {
                      const base = [0.35, 0.6, 1, 0.6, 0.35][i];
                      return (
                        <motion.span
                          key={i}
                          className="w-2 rounded-[var(--fin-r-pill)] bg-white"
                          animate={{ height: 14 + base * nivelAudio * 46 + base * 10 }}
                          transition={{ duration: 0.09, ease: 'easeOut' }}
                        />
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>

          <div
            className="flex items-center justify-between px-8 pb-6"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
          >
            <motion.button
              type="button"
              onClick={onCancelar}
              aria-label="Cancelar dictado"
              whileTap={{ scale: 0.9 }}
              className="flex h-14 w-14 items-center justify-center rounded-[var(--fin-r-pill)] bg-white/20 text-white backdrop-blur-sm"
            >
              <X className="h-6 w-6" strokeWidth={2.5} aria-hidden="true" />
            </motion.button>

            <AnimatePresence mode="wait">
              {fase === 'escuchando' ? (
                <motion.button
                  key="terminar"
                  type="button"
                  onClick={onTerminar}
                  aria-label="Terminé de hablar"
                  initial={{ opacity: 0, scale: 0.7, rotate: -90 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  exit={{ opacity: 0, scale: 0.7, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                  className="flex h-16 items-center justify-center gap-2 rounded-[var(--fin-r-pill)] px-5 text-[15px] font-bold text-white shadow-[0_10px_28px_-8px_rgb(0_0_0/0.35)]"
                  style={{ backgroundColor: 'var(--fin-out)' }}
                >
                  <Square className="h-4 w-4 fill-current" strokeWidth={2.5} aria-hidden="true" />
                  Terminé
                </motion.button>
              ) : fase === 'revelando' ? (
                <motion.button
                  key="continuar"
                  type="button"
                  onClick={onContinuar}
                  aria-label="Confirmar texto y revisar movimiento"
                  initial={{ opacity: 0, scale: 0.7, x: 12 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.7, x: 12 }}
                  whileTap={{ scale: 0.94 }}
                  transition={{ duration: 0.25 }}
                  className="flex h-16 items-center justify-center gap-2 rounded-[var(--fin-r-pill)] px-5 text-[15px] font-bold text-white shadow-[0_10px_28px_-8px_rgb(0_0_0/0.35)]"
                  style={{ backgroundColor: 'var(--fin-out)' }}
                >
                  <Check className="h-5 w-5" strokeWidth={3} aria-hidden="true" />
                  Revisar movimiento
                </motion.button>
              ) : (
                <span className="h-16 w-16" aria-hidden="true" />
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
