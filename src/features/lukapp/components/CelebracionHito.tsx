import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Share2 } from 'lucide-react';
import type { HitoRacha } from '../lib/racha';
import { textoParaCompartir } from '../lib/rankingRacha';

const CONFETI = ['🎉', '✨', '🔥', '🎊', '⭐'];

interface CelebracionHitoProps {
  hito: HitoRacha;
  /** Días de Premium que este hito dejó listos para reclamar, si hubo. */
  diasPremium?: number;
  /** Lleva a la racha, donde está el botón para activar el premio. */
  onVerPremio?: () => void;
  onCerrar: () => void;
}

/**
 * Tarjeta de felicitación al cruzar un hito de racha. El confeti es adorno
 * puro (aria-hidden) y se apaga con "reducir movimiento".
 */
export const CelebracionHito: React.FC<CelebracionHitoProps> = ({ hito, diasPremium, onVerPremio, onCerrar }) => {
  const piezas = useMemo(
    () => Array.from({ length: 22 }, (_, i) => ({
      id: i,
      emoji: CONFETI[i % CONFETI.length],
      izquierda: `${(i * 37) % 100}%`,
      retraso: (i % 7) * 0.12,
      duracion: 2.2 + (i % 5) * 0.3,
    })),
    [],
  );
  const reducido = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  const compartir = async () => {
    const texto = `${hito.emoji} ${hito.titulo}: ${textoParaCompartir(hito.dias)}`;
    try {
      if (navigator.share) await navigator.share({ text: texto });
      else await navigator.clipboard.writeText(texto);
    } catch {
      // Cancelar la hoja de compartir no es un error.
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={`Hito alcanzado: ${hito.titulo}`}
    >
      {!reducido && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {piezas.map((p) => (
            <motion.span
              key={p.id}
              className="absolute -top-8 text-[22px]"
              style={{ left: p.izquierda }}
              initial={{ y: -40, opacity: 1, rotate: 0 }}
              animate={{ y: '110vh', opacity: [1, 1, 0], rotate: 360 }}
              transition={{ duration: p.duracion, delay: p.retraso, ease: 'easeIn' }}
            >
              {p.emoji}
            </motion.span>
          ))}
        </div>
      )}
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-sm rounded-[var(--fin-r-sheet)] border border-[var(--fin-line)] bg-[var(--fin-surface)] p-6 text-center shadow-2xl"
      >
        <div className="text-[56px]" aria-hidden="true">{hito.emoji}</div>
        <h2 className="mt-2 text-[20px] font-bold text-[var(--fin-ink)]">{hito.titulo}</h2>
        <p className="mt-1 text-[15px] font-semibold text-[var(--fin-warn-ink)]">{hito.dias} días de racha</p>
        <p className="mt-2 text-[13px] leading-snug text-[var(--fin-ink-soft)]">{hito.descripcion}</p>
        {diasPremium ? (
          <div className="mt-3 rounded-[var(--fin-r-card)] bg-[var(--fin-soft)] p-3">
            <p className="text-[14px] font-bold text-[var(--fin-ink)]">🎁 Ganaste {diasPremium} días de Premium</p>
            <p className="mt-0.5 text-[13px] text-[var(--fin-ink-soft)]">Actívalos cuando quieras desde tu racha.</p>
          </div>
        ) : null}
        <div className="mt-5 flex flex-col gap-2">
          {diasPremium && onVerPremio ? (
            <button
              type="button"
              onClick={onVerPremio}
              className="rounded-[var(--fin-r-card)] bg-[var(--fin-accent)] py-3 text-[15px] font-bold text-[var(--fin-on-accent)]"
            >
              Reclamar mi Premium
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void compartir()}
            className="flex items-center justify-center gap-2 rounded-[var(--fin-r-card)] border border-[var(--fin-line)] py-2.5 text-[14px] font-bold text-[var(--fin-ink)]"
          >
            <Share2 className="h-4 w-4" /> Presumir mi logro
          </button>
          <button
            type="button"
            onClick={onCerrar}
            className={diasPremium && onVerPremio
              ? 'py-2 text-[14px] font-semibold text-[var(--fin-ink-soft)]'
              : 'rounded-[var(--fin-r-card)] bg-[var(--fin-accent)] py-3 text-[15px] font-bold text-[var(--fin-on-accent)]'}
          >
            {diasPremium && onVerPremio ? 'Ahora no' : '¡A seguir la racha!'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
