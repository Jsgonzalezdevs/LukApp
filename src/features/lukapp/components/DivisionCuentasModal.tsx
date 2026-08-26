import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Minus, Plus, Share2, Users, UtensilsCrossed, X } from 'lucide-react';
import { formatCop, parseSaldoInput, conPuntos } from '../lib/formatCop';
import { useHapticFeedback } from '../hooks/useHapticFeedback';
import { useAudioFeedback } from '../hooks/useAudioFeedback';
import { RippleButton } from './RippleButton';

interface DivisionCuentasModalProps {
  onCerrar: () => void;
  onAnotarMiParte: (montoCop: number, descripcion: string) => void;
}

export const DivisionCuentasModal: React.FC<DivisionCuentasModalProps> = ({
  onCerrar,
  onAnotarMiParte,
}) => {
  const haptic = useHapticFeedback();
  const audio = useAudioFeedback();

  const [totalTexto, setTotalTexto] = useState('');
  const [lugarTexto, setLugarTexto] = useState('');
  const [porcentajePropina, setPorcentajePropina] = useState<number>(10); // 10% propina típica en Colombia
  const [personas, setPersonas] = useState<number>(2);
  const [copiado, setCopiado] = useState(false);

  const totalBase = parseSaldoInput(totalTexto) ?? 0;
  const valorPropina = Math.round((totalBase * porcentajePropina) / 100);
  const totalConPropina = totalBase + valorPropina;
  const cuotaPorPersona = personas > 0 ? Math.ceil(totalConPropina / personas) : 0;

  const cambiarPersonas = (delta: number) => {
    haptic.trigger('light');
    audio.play('click');
    setPersonas((prev) => Math.max(1, Math.min(50, prev + delta)));
  };

  const copiarMensaje = async () => {
    haptic.trigger('medium');
    audio.play('click');

    const lugar = lugarTexto.trim() ? ` en ${lugarTexto.trim()}` : '';
    const textoMensaje = `🧾 *División de cuenta${lugar}*\n` +
      `• Total cuenta: ${formatCop(totalBase)}\n` +
      (porcentajePropina > 0 ? `• Propina (${porcentajePropina}%): ${formatCop(valorPropina)}\n• Total con propina: ${formatCop(totalConPropina)}\n` : '') +
      `👥 Dividido entre ${personas} personas: *${formatCop(cuotaPorPersona)} cada uno*\n\n` +
      `📲 ¡Gracias por pasarme tu parte por Nequi o Bancolombia!`;

    try {
      await navigator.clipboard.writeText(textoMensaje);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    } catch {
      // Fallback
    }
  };

  const handleAnotar = () => {
    if (cuotaPorPersona <= 0) return;
    haptic.trigger('medium');
    audio.play('click');
    const desc = lugarTexto.trim()
      ? `Mi parte en ${lugarTexto.trim()}`
      : `Mi parte de cuenta (${personas} personas)`;
    onAnotarMiParte(cuotaPorPersona, desc);
    onCerrar();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="w-full max-w-lg overflow-hidden rounded-t-[var(--fin-r-sheet)] sm:rounded-[var(--fin-r-sheet)] border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 sm:p-6 shadow-2xl"
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-[var(--fin-line)]/50 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15 text-orange-500">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-[var(--fin-ink)]">
                Dividir cuenta y propina
              </h2>
              <p className="text-[12px] text-[var(--fin-ink-soft)]">
                Calcula la cuota por persona y anota tu parte
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)] hover:text-[var(--fin-ink)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4 max-h-[65vh] overflow-y-auto pr-1">
          {/* Monto total de la cuenta */}
          <div>
            <label className="block text-[13px] font-semibold text-[var(--fin-ink-soft)]">
              Monto total de la factura / cuenta
            </label>
            <div className="mt-1.5 flex items-center rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3.5 py-2.5 focus-within:border-orange-500">
              <span className="text-[17px] font-bold text-[var(--fin-ink-faint)] mr-2">$</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Ej. 120.000"
                value={totalTexto}
                onChange={(e) => setTotalTexto(conPuntos(e.target.value))}
                className="w-full bg-transparent text-[18px] font-bold tabular-nums text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-ghost)] focus:outline-none"
              />
            </div>
          </div>

          {/* Lugar / Restaurante (Opcional) */}
          <div>
            <label className="block text-[13px] font-semibold text-[var(--fin-ink-soft)]">
              Lugar o motivo (opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. Crepes & Waffles, Asado, Almuerzo"
              value={lugarTexto}
              onChange={(e) => setLugarTexto(e.target.value)}
              className="mt-1.5 w-full rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3.5 py-2.5 text-[16px] text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-ghost)] focus:border-orange-500 focus:outline-none"
            />
          </div>

          {/* Selector de propina */}
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[13px] font-semibold text-[var(--fin-ink-soft)]">
                Propina
              </label>
              <span className="text-[13px] font-bold tabular-nums text-[var(--fin-ink)]">
                {formatCop(valorPropina)}
              </span>
            </div>
            <div className="mt-1.5 grid grid-cols-4 gap-2">
              {[0, 10, 15, 20].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => {
                    haptic.trigger('light');
                    audio.play('click');
                    setPorcentajePropina(pct);
                  }}
                  className={`rounded-[var(--fin-r-pill)] py-2 text-[13px] font-bold transition-all ${
                    porcentajePropina === pct
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'bg-[var(--fin-soft)] text-[var(--fin-ink-soft)] hover:text-[var(--fin-ink)]'
                  }`}
                >
                  {pct === 0 ? 'Sin propina' : `${pct}%${pct === 10 ? ' (CO)' : ''}`}
                </button>
              ))}
            </div>
          </div>

          {/* Número de personas */}
          <div>
            <label className="block text-[13px] font-semibold text-[var(--fin-ink-soft)]">
              Dividir entre personas
            </label>
            <div className="mt-1.5 flex items-center justify-between rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-bg)] p-2">
              <button
                type="button"
                onClick={() => cambiarPersonas(-1)}
                disabled={personas <= 1}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--fin-card)] text-[var(--fin-ink)] shadow-sm disabled:opacity-40"
              >
                <Minus className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2 font-bold text-[16px] text-[var(--fin-ink)]">
                <Users className="h-4 w-4 text-orange-500" />
                <span>{personas} {personas === 1 ? 'persona' : 'personas'}</span>
              </div>

              <button
                type="button"
                onClick={() => cambiarPersonas(1)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--fin-card)] text-[var(--fin-ink)] shadow-sm"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tarjeta de resultado */}
          <div className="rounded-[var(--fin-r-card)] bg-orange-500/10 border border-orange-500/20 p-4 text-center">
            <p className="text-[12.5px] font-semibold text-orange-500 uppercase tracking-wide">
              Cuota por persona
            </p>
            <p className="mt-1 text-[28px] font-extrabold tabular-nums text-[var(--fin-ink)]">
              {formatCop(cuotaPorPersona)}
            </p>
            <p className="mt-1 text-[12px] text-[var(--fin-ink-soft)]">
              Total cuenta {formatCop(totalConPropina)} entre {personas}
            </p>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={copiarMensaje}
            disabled={cuotaPorPersona <= 0}
            className="flex-1 flex items-center justify-center gap-2 rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-bg)] py-3 text-[14px] font-bold text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-soft)] disabled:opacity-40"
          >
            {copiado ? (
              <>
                <Check className="h-4 w-4 text-emerald-500" />
                <span>¡Copiado para WhatsApp!</span>
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                <span>Copiar cobro WhatsApp</span>
              </>
            )}
          </button>

          <RippleButton
            type="button"
            onClick={handleAnotar}
            disabled={cuotaPorPersona <= 0}
            rippleColor="rgba(255,255,255,0.4)"
            className="flex-1 flex items-center justify-center gap-2 rounded-[var(--fin-r-card)] bg-[var(--fin-accent)] py-3 text-[14.5px] font-bold text-[var(--fin-on-accent)] shadow-lg shadow-amber-500/25 transition-all hover:bg-[var(--fin-accent-hover)] disabled:opacity-40"
          >
            <Check className="h-4 w-4" strokeWidth={3} />
            Anotar mi parte ({formatCop(cuotaPorPersona)})
          </RippleButton>
        </div>
      </motion.div>
    </div>
  );
};
