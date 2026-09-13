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

interface ParticipanteDivision {
  nombre: string;
  pagoConfirmado: boolean;
}

const crearParticipantes = (cantidad: number): ParticipanteDivision[] =>
  Array.from({ length: cantidad }, (_, indice) => ({ nombre: `Persona ${indice + 1}`, pagoConfirmado: false }));

export const DivisionCuentasModal: React.FC<DivisionCuentasModalProps> = ({
  onCerrar,
  onAnotarMiParte,
}) => {
  const haptic = useHapticFeedback();
  const audio = useAudioFeedback();

  const [totalTexto, setTotalTexto] = useState('');
  const [lugarTexto, setLugarTexto] = useState('');
  const [porcentajePropina, setPorcentajePropina] = useState<number>(10); // 10% propina típica en Colombia
  const [participantes, setParticipantes] = useState<ParticipanteDivision[]>(() => crearParticipantes(2));
  const [copiado, setCopiado] = useState(false);

  const totalBase = parseSaldoInput(totalTexto) ?? 0;
  const valorPropina = Math.round((totalBase * porcentajePropina) / 100);
  const totalConPropina = totalBase + valorPropina;
  const personas = participantes.length;
  const cuotaPorPersona = personas > 0 ? Math.ceil(totalConPropina / personas) : 0;

  const cambiarPersonas = (delta: number) => {
    haptic.trigger('light');
    audio.play('click');
    setParticipantes((prev) => {
      if (delta < 0) return prev.length > 1 ? prev.slice(0, -1) : prev;
      if (prev.length >= 50) return prev;
      return [...prev, { nombre: `Persona ${prev.length + 1}`, pagoConfirmado: false }];
    });
  };

  const cambiarNombre = (indice: number, nombre: string) => {
    setParticipantes((prev) => prev.map((participante, posicion) =>
      posicion === indice ? { ...participante, nombre } : participante,
    ));
  };

  const marcarPago = (indice: number) => {
    haptic.trigger('light');
    audio.play('click');
    setParticipantes((prev) => prev.map((participante, posicion) =>
      posicion === indice ? { ...participante, pagoConfirmado: !participante.pagoConfirmado } : participante,
    ));
  };

  const copiarMensaje = async () => {
    haptic.trigger('medium');
    audio.play('click');

    const lugar = lugarTexto.trim() ? ` en ${lugarTexto.trim()}` : '';
    const textoMensaje = `🧾 *División de cuenta${lugar}*\n` +
      `• Total cuenta: ${formatCop(totalBase)}\n` +
      (porcentajePropina > 0 ? `• Propina (${porcentajePropina}%): ${formatCop(valorPropina)}\n• Total con propina: ${formatCop(totalConPropina)}\n` : '') +
      `Dividido entre ${personas} personas: *${formatCop(cuotaPorPersona)} cada uno*\n\n` +
      `${participantes.map((participante) => `• ${participante.nombre || 'Sin nombre'}: ${participante.pagoConfirmado ? 'Pagó' : 'Pendiente'}`).join('\n')}\n\n` +
      `Creado con LukApp`;

    try {
      if (navigator.share) {
        await navigator.share({ title: 'División de cuenta', text: textoMensaje });
      } else {
        await navigator.clipboard.writeText(textoMensaje);
        window.open(`https://wa.me/?text=${encodeURIComponent(textoMensaje)}`, '_blank');
      }
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        await navigator.clipboard?.writeText(textoMensaje);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 3000);
      }
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
        className="division-sheet w-full max-w-lg overflow-hidden rounded-t-[var(--fin-r-sheet)] sm:rounded-[var(--fin-r-sheet)] p-5 sm:p-6"
      >
        {/* Cabecera */}
        <div className="division-header flex items-center justify-between pb-5">
          <div className="flex items-center gap-2.5">
            <div className="division-icon flex h-10 w-10 items-center justify-center rounded-xl">
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
            className="division-close flex h-8 w-8 items-center justify-center rounded-[var(--fin-r-pill)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="division-content mt-4 flex flex-col gap-5 max-h-[62vh] overflow-y-auto pr-1">
          {/* Monto total de la cuenta */}
          <div>
            <label className="block text-[13px] font-semibold text-[var(--fin-ink-soft)]">
              Monto total de la factura / cuenta
            </label>
            <div className="division-money-input mt-2 flex items-center rounded-[var(--fin-r-card)] px-4 py-3">
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
              className="division-text-input mt-2 w-full rounded-[var(--fin-r-card)] px-4 py-3 text-[16px] text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-ghost)] focus:outline-none"
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
                      ? 'division-tip-active'
                      : 'division-tip-idle'
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
            <div className="division-people mt-2 flex items-center justify-between rounded-[var(--fin-r-card)] p-2">
              <button
                type="button"
                onClick={() => cambiarPersonas(-1)}
                disabled={personas <= 1}
                className="division-stepper flex h-10 w-10 items-center justify-center rounded-xl disabled:opacity-40"
              >
                <Minus className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2 font-bold text-[16px] text-[var(--fin-ink)]">
                <Users className="division-people-icon h-4 w-4" />
                <span>{personas} {personas === 1 ? 'persona' : 'personas'}</span>
              </div>

              <button
                type="button"
                onClick={() => cambiarPersonas(1)}
                className="division-stepper flex h-10 w-10 items-center justify-center rounded-xl"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-[13px] font-semibold text-[var(--fin-ink-soft)]">¿Quién ya pagó?</label>
              <span className="text-[12px] text-[var(--fin-ink-faint)]">Edita los nombres si hace falta</span>
            </div>
            <div className="mt-1.5 space-y-2">
              {participantes.map((participante, indice) => (
                <div key={indice} className="division-person flex items-center gap-2 rounded-[var(--fin-r-card)] p-2.5">
                  <input
                    aria-label={`Nombre de la persona ${indice + 1}`}
                    value={participante.nombre}
                    onChange={(e) => cambiarNombre(indice, e.target.value)}
                    onBlur={(e) => {
                      if (!e.target.value.trim()) cambiarNombre(indice, `Persona ${indice + 1}`);
                    }}
                    className="min-w-0 flex-1 bg-transparent px-1 text-[14px] font-semibold text-[var(--fin-ink)] outline-none focus:border-b focus:border-orange-500"
                  />
                  <button
                    type="button"
                    onClick={() => marcarPago(indice)}
                    className={`division-payment shrink-0 rounded-[var(--fin-r-pill)] px-3 py-1.5 text-[12px] font-bold transition-colors ${
                      participante.pagoConfirmado
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                        : 'bg-[var(--fin-soft)] text-[var(--fin-ink-soft)] hover:text-[var(--fin-ink)]'
                    }`}
                  >
                    {participante.pagoConfirmado ? 'Pagó' : 'Marcar pagado'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Tarjeta de resultado */}
          <div className="division-result rounded-[var(--fin-r-card)] p-4 text-center">
            <p className="division-result-label text-[12.5px] font-semibold uppercase tracking-wide">
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
        <div className="division-actions mt-5 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={copiarMensaje}
            disabled={cuotaPorPersona <= 0}
            className="division-share flex-1 flex items-center justify-center gap-2 rounded-[var(--fin-r-card)] py-3 text-[14px] font-bold disabled:opacity-40"
          >
            {copiado ? (
              <>
                <Check className="h-4 w-4 text-emerald-500" />
                <span>¡Listo para enviar!</span>
              </>
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                <span>Enviar cobro</span>
              </>
            )}
          </button>

          <RippleButton
            type="button"
            onClick={handleAnotar}
            disabled={cuotaPorPersona <= 0}
            rippleColor="rgba(255,255,255,0.4)"
            className="division-save flex-1 flex items-center justify-center gap-2 rounded-[var(--fin-r-card)] py-3 text-[14.5px] font-bold disabled:opacity-40"
          >
            <Check className="h-4 w-4" strokeWidth={3} />
            Anotar mi parte ({formatCop(cuotaPorPersona)})
          </RippleButton>
        </div>
      </motion.div>
    </div>
  );
};
