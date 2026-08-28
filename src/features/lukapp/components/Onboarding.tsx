import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { formatAmountInput } from '../lib/formatCop';
import type { ClaseCuenta } from '../data/modelos';
import { TecladoNumerico } from './TecladoNumerico';
import { TypingText } from './TypingText';

interface OnboardingProps {
  onTerminar: (datos: {
    nombre: string;
    banco: string | null;
    claseCuenta: ClaseCuenta | null;
    saldoCop: number | null;
  }) => void;
}

interface FuenteDinero {
  nombre: string;
  claseCuenta: ClaseCuenta;
}

/** Bancos, billeteras y efectivo son medios distintos aunque compartan saldo. */
const FUENTES: readonly FuenteDinero[] = [
  { nombre: 'Bancolombia', claseCuenta: 'banco' },
  { nombre: 'Nu', claseCuenta: 'banco' },
  { nombre: 'Nequi', claseCuenta: 'billetera' },
  { nombre: 'Daviplata', claseCuenta: 'billetera' },
  { nombre: 'Davivienda', claseCuenta: 'banco' },
  { nombre: 'Lulo Bank', claseCuenta: 'banco' },
  { nombre: 'BBVA', claseCuenta: 'banco' },
  { nombre: 'Falabella', claseCuenta: 'banco' },
  { nombre: 'Efectivo', claseCuenta: 'efectivo' },
  { nombre: 'Otro', claseCuenta: 'banco' },
];

const ETIQUETA_CLASE: Record<ClaseCuenta, string> = {
  efectivo: 'Efectivo',
  banco: 'Cuenta bancaria',
  billetera: 'Billetera digital',
};

/**
 * La bienvenida: cuatro pantallas, UNA pregunta en cada una.
 */
export const Onboarding: React.FC<OnboardingProps> = ({
  onTerminar,
}) => {
  const [paso, setPaso] = useState(0);
  const [nombre, setNombre] = useState('');
  const [fuente, setFuente] = useState<FuenteDinero | null>(null);
  const [otroBanco, setOtroBanco] = useState('');
  const [digitos, setDigitos] = useState('');

  const bancoFinal = fuente?.nombre === 'Otro' ? otroBanco.trim() || null : (fuente?.nombre ?? null);
  const claseCuentaFinal = bancoFinal ? (fuente?.claseCuenta ?? 'banco') : null;
  const saldoCop = digitos === '' ? null : Number(digitos);

  const siguiente = () => setPaso((p) => Math.min(p + 1, pasos.length - 1));
  const cerrar = () =>
    onTerminar({
      nombre: nombre.trim(),
      banco: bancoFinal,
      claseCuenta: claseCuentaFinal,
      saldoCop,
    });

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
            {FUENTES.map((opcion) => (
              <button
                key={opcion.nombre}
                type="button"
                onClick={() => setFuente(opcion)}
                aria-pressed={fuente?.nombre === opcion.nombre}
                className={`rounded-[var(--fin-r-pill)] px-4 py-2.5 text-[15px] font-semibold transition-colors ${
                  fuente?.nombre === opcion.nombre
                    ? 'bg-[var(--fin-accent)] text-[var(--fin-on-accent)]'
                    : 'bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]'
                }`}
              >
                {opcion.nombre}
              </button>
            ))}
          </div>
          {fuente?.nombre === 'Otro' ? (
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
      titulo: nombre.trim() ? `Listo, ${nombre.trim()}.` : 'Todo listo.',
      ayuda: 'Revisa lo que se guardará. Puedes volver a corregir el saldo antes de terminar.',
      cuerpo: (
        <div className="rounded-[var(--fin-r-card)] bg-[var(--fin-soft)] px-4 py-4">
          {bancoFinal && claseCuentaFinal ? (
            <>
              <p className="text-[13px] text-[var(--fin-ink-faint)]">Crearás 1 cuenta</p>
              <p className="mt-1 text-[17px] font-semibold text-[var(--fin-ink)]">
                {bancoFinal} · {ETIQUETA_CLASE[claseCuentaFinal]}
              </p>
              <p className="mt-1 tabular-nums text-[15px] text-[var(--fin-ink-soft)]">
                Saldo inicial: ${formatAmountInput(saldoCop)}
              </p>
              <button
                type="button"
                onClick={() => setPaso(2)}
                className="mt-3 text-[14px] font-semibold text-[var(--fin-accent)]"
              >
                Editar saldo inicial
              </button>
            </>
          ) : (
            <>
              <p className="text-[17px] font-semibold text-[var(--fin-ink)]">No crearás cuentas todavía</p>
              <p className="mt-1 text-[14px] text-[var(--fin-ink-soft)]">
                LukApp empezará completamente vacía y podrás agregar una cuenta desde Dinero.
              </p>
            </>
          )}
        </div>
      ),
      boton: 'Entrar a LukApp',
      salida: 'Volver',
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
            <TypingText text={actual.titulo} speed={40} />
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
            }}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-5 py-3.5 text-[17px] font-semibold text-[var(--fin-on-accent)]"
          >
            <Check className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
            {actual.boton}
            {!ultimo ? (
              <ArrowRight className="h-4 w-4 opacity-60" strokeWidth={2.5} aria-hidden="true" />
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => {
              if (ultimo) {
                setPaso((p) => Math.max(0, p - 1));
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
