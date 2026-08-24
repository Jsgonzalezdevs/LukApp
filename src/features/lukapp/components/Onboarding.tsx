import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, Mic } from 'lucide-react';
import { formatAmountInput } from '../lib/formatCop';
import { TecladoNumerico } from './TecladoNumerico';

interface OnboardingProps {
  onTerminar: (datos: { nombre: string; banco: string | null; saldoCop: number | null }) => void;
  /** Abre la pantalla de dictado por voz para hablarle de inmediato. */
  onAnotarHablando: () => void;
  /** Abre la pantalla de anotación manual si prefiere escribir. */
  onAnotarManual?: () => void;
}

/** Los bancos que más se usan en Colombia, para no hacer escribir a nadie. */
const BANCOS = ['Nequi', 'Daviplata', 'Bancolombia', 'Nu', 'Efectivo', 'Otro'];

/**
 * La bienvenida: cuatro pantallas, UNA pregunta en cada una.
 */
export const Onboarding: React.FC<OnboardingProps> = ({
  onTerminar,
  onAnotarHablando,
  onAnotarManual,
}) => {
  const [paso, setPaso] = useState(0);
  const [nombre, setNombre] = useState('');
  const [banco, setBanco] = useState<string | null>(null);
  const [otroBanco, setOtroBanco] = useState('');
  const [digitos, setDigitos] = useState('');

  const bancoFinal = banco === 'Otro' ? otroBanco.trim() || null : banco;
  const saldoCop = digitos === '' ? null : Number(digitos);

  const siguiente = () => setPaso((p) => Math.min(p + 1, pasos.length - 1));
  const cerrar = () => onTerminar({ nombre: nombre.trim(), banco: bancoFinal, saldoCop });

  const pasos = [
    {
      titulo: '¿Cómo te llamas?',
      ayuda: 'Solo para saludarte al abrir. Se queda en tu cuenta.',
      cuerpo: (
        <input
          autoFocus
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && siguiente()}
          placeholder="Tu nombre"
          aria-label="Tu nombre"
          className="w-full rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] px-4 py-3.5 text-[17px] text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-ghost)] focus:outline-none"
        />
      ),
      boton: 'Continuar',
      salida: 'Prefiero no decirlo',
    },
    {
      titulo: '¿Dónde tienes tu plata?',
      ayuda: 'Escoge una para empezar. Después agregas las que quieras.',
      cuerpo: (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {BANCOS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBanco(b)}
                aria-pressed={banco === b}
                className={`rounded-[var(--fin-r-pill)] px-4 py-2.5 text-[15px] font-semibold transition-colors ${
                  banco === b
                    ? 'bg-[var(--fin-accent)] text-[var(--fin-on-accent)]'
                    : 'bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]'
                }`}
              >
                {b}
              </button>
            ))}
          </div>
          {banco === 'Otro' ? (
            <input
              autoFocus
              value={otroBanco}
              onChange={(e) => setOtroBanco(e.target.value)}
              placeholder="Ej: Davivienda"
              aria-label="Nombre del banco"
              className="w-full rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] px-4 py-3 text-[17px] text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-ghost)] focus:outline-none"
            />
          ) : null}
        </div>
      ),
      boton: 'Continuar',
      salida: 'Ninguna por ahora',
    },
    {
      titulo: bancoFinal ? `¿Cuánto tienes en ${bancoFinal}?` : '¿Cuánto tienes?',
      ayuda:
        'El saldo que ves en la app del banco. Si no lo sabes, sigue: lo arreglas cuando quieras.',
      cuerpo: (
        <div className="flex flex-col gap-4">
          <p
            className="tabular-nums"
            style={{
              font: 'var(--fin-t-cifra)',
              letterSpacing: 'var(--fin-track-cifra)',
              color: digitos === '' ? 'var(--fin-ink-ghost)' : 'var(--fin-ink)',
            }}
          >
            ${digitos === '' ? '0' : formatAmountInput(saldoCop)}
          </p>
          <TecladoNumerico
            onDigito={(d) => setDigitos((prev) => (prev + d).replace(/^0+(?=\d)/, '').slice(0, 12))}
            onBorrar={() => setDigitos((prev) => prev.slice(0, -1))}
          />
        </div>
      ),
      boton: 'Continuar',
      salida: 'Después',
    },
    {
      titulo: nombre.trim() ? `Listo, ${nombre.trim()}.` : 'Listo.',
      ayuda: 'Ahora anota un gasto como se lo dirías a un amigo.',
      cuerpo: (
        <p className="rounded-[var(--fin-r-card)] bg-[var(--fin-soft)] px-4 py-3.5 text-[17px] italic text-[var(--fin-ink-soft)]">
          «gasté 20 mil en el almuerzo»
        </p>
      ),
      boton: 'Decirlo en voz alta',
      salida: 'Prefiero escribirlo',
    },
  ];

  const indice = Math.min(Math.max(paso, 0), pasos.length - 1);
  const actual = pasos[indice];
  const ultimo = indice === pasos.length - 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--fin-scrim)] p-4 backdrop-blur-md sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenida"
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={indice}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="fin-glass w-full max-w-sm rounded-[var(--fin-r-sheet)] bg-[var(--fin-card)] p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] sm:pb-6"
        >
          <div className="flex gap-1.5" aria-label={`Paso ${indice + 1} de ${pasos.length}`}>
            {pasos.map((_, i) => (
              <span
                key={i}
                className="h-1 flex-1 rounded-[var(--fin-r-pill)] transition-colors"
                style={{
                  backgroundColor: i <= indice ? 'var(--fin-ink)' : 'var(--fin-line)',
                }}
              />
            ))}
          </div>

          <h2
            className="mt-6 text-[var(--fin-ink)]"
            style={{ font: 'var(--fin-t-titulo-xl)', letterSpacing: 'var(--fin-track-titulo-xl)' }}
          >
            {actual.titulo}
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-[var(--fin-ink-soft)]">
            {actual.ayuda}
          </p>

          <div className="mt-5">{actual.cuerpo}</div>

          <button
            type="button"
            onClick={() => {
              if (!ultimo) {
                siguiente();
                return;
              }
              cerrar();
              onAnotarHablando();
            }}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-5 py-3.5 text-[17px] font-semibold text-[var(--fin-on-accent)]"
          >
            {ultimo ? (
              <Mic className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
            ) : (
              <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
            )}
            {actual.boton}
            {!ultimo ? (
              <ArrowRight className="h-4 w-4 opacity-60" strokeWidth={2.5} aria-hidden="true" />
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => {
              if (ultimo) {
                cerrar();
                onAnotarManual?.();
              } else {
                siguiente();
              }
            }}
            className="mt-1 w-full rounded-[var(--fin-r-control)] py-2.5 text-[15px] text-[var(--fin-ink-faint)] transition-colors hover:text-[var(--fin-ink)]"
          >
            {actual.salida}
          </button>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
};
