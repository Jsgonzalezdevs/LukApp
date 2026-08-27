import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Reveal } from './primitivas';

interface CicloPaso {
  gasto: {
    icono: string;
    categoria: string;
    monto: string;
    bgIcono: string;
  };
  diasMarcados: number;
  barras: Array<{
    icono: string;
    categoria: string;
    monto: string;
    alturaPct: number;
  }>;
}

const PASOS_SECUENCIA: CicloPaso[] = [
  {
    gasto: { icono: '🥑', categoria: 'Mercado', monto: '$143,5K', bgIcono: '#ecfccb' },
    diasMarcados: 4,
    barras: [
      { icono: '🥑', categoria: 'Mercado', monto: '748,5K', alturaPct: 100 },
      { icono: '🚗', categoria: 'Transporte', monto: '352,6K', alturaPct: 62 },
      { icono: '🍔', categoria: 'Comida', monto: '292,2K', alturaPct: 50 },
      { icono: '💎', categoria: 'Entretenimiento', monto: '233,5K', alturaPct: 40 },
    ],
  },
  {
    gasto: { icono: '🚗', categoria: 'Transporte', monto: '$185K', bgIcono: '#fee2e2' },
    diasMarcados: 9,
    barras: [
      { icono: '🥑', categoria: 'Mercado', monto: '748,5K', alturaPct: 100 },
      { icono: '🚗', categoria: 'Transporte', monto: '537,6K', alturaPct: 82 },
      { icono: '🍔', categoria: 'Comida', monto: '292,2K', alturaPct: 50 },
      { icono: '💎', categoria: 'Entretenimiento', monto: '233,5K', alturaPct: 40 },
    ],
  },
  {
    gasto: { icono: '🍔', categoria: 'Comida', monto: '$117K', bgIcono: '#ffedd5' },
    diasMarcados: 14,
    barras: [
      { icono: '🥑', categoria: 'Mercado', monto: '748,5K', alturaPct: 100 },
      { icono: '🚗', categoria: 'Transporte', monto: '537,6K', alturaPct: 82 },
      { icono: '🍔', categoria: 'Comida', monto: '409,2K', alturaPct: 68 },
      { icono: '💎', categoria: 'Entretenimiento', monto: '233,5K', alturaPct: 40 },
    ],
  },
  {
    gasto: { icono: '💎', categoria: 'Entretenimiento', monto: '$65,8K', bgIcono: '#e0f2fe' },
    diasMarcados: 20,
    barras: [
      { icono: '🥑', categoria: 'Mercado', monto: '748,5K', alturaPct: 100 },
      { icono: '🚗', categoria: 'Transporte', monto: '537,6K', alturaPct: 82 },
      { icono: '🍔', categoria: 'Comida', monto: '409,2K', alturaPct: 68 },
      { icono: '💎', categoria: 'Entretenimiento', monto: '299,3K', alturaPct: 54 },
    ],
  },
];

/**
 * Showcase interactivo animado en bucle continuo:
 * Registra sin esfuerzo -> Crea el hábito -> Ve el panorama completo
 */
export const SecuenciaAnimada: React.FC = () => {
  const [pasoIdx, setPasoIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPasoIdx((prev) => (prev + 1) % PASOS_SECUENCIA.length);
    }, 2800);
    return () => clearInterval(timer);
  }, []);

  const paso = PASOS_SECUENCIA[pasoIdx];

  return (
    <section className="relative w-full overflow-hidden py-16 sm:py-24 bg-[var(--lp-surface)]/40 border-y border-[var(--lp-line)]/50">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="relative grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8 items-start">
          {/* Línea horizontal decorativa conectora entre columnas en desktop */}
          <div
            className="hidden md:block absolute top-[72px] left-[15%] right-[15%] h-[1px] -z-0 pointer-events-none"
            style={{
              backgroundImage: 'linear-gradient(to right, transparent, var(--lp-line) 15%, var(--lp-line) 85%, transparent)',
            }}
          />

          {/* Columna 1: Registra sin esfuerzo */}
          <div className="flex flex-col items-center text-center relative z-10">
            {/* Visual animado superior: Píldora de gasto */}
            <div className="h-36 w-full flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={paso.gasto.categoria + paso.gasto.monto}
                  initial={{ opacity: 0, y: 14, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -14, scale: 0.92 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center gap-3 rounded-full bg-[var(--lp-bg)] border border-[var(--lp-line)] px-4 py-2.5 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.08)] dark:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.4)]"
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[15px]"
                    style={{ backgroundColor: paso.gasto.bgIcono }}
                  >
                    {paso.gasto.icono}
                  </span>
                  <span className="text-[15px] font-semibold text-[var(--lp-ink)]">
                    {paso.gasto.categoria}
                  </span>
                  <span className="rounded-full bg-[var(--lp-surface)] px-2.5 py-0.5 text-[13.5px] font-bold text-[var(--lp-ink)]">
                    {paso.gasto.monto}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Textos explicativos */}
            <div className="mt-4 max-w-xs">
              <h3 className="text-[19px] sm:text-[21px] font-bold text-[var(--lp-ink)]">
                Registra sin esfuerzo
              </h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-[var(--lp-ink-soft)]">
                Escribe una nota, habla naturalmente, o deja que las automatizaciones lo hagan por ti. Sin formularios, sin fricción.
              </p>
            </div>
          </div>

          {/* Columna 2: Crea el hábito */}
          <div className="flex flex-col items-center text-center relative z-10">
            {/* Visual animado superior: Matriz de racha / consistencia */}
            <div className="h-36 w-full flex items-center justify-center">
              <div className="grid grid-cols-7 gap-1.5 p-3 rounded-2xl bg-[var(--lp-bg)] border border-[var(--lp-line)] shadow-[0_10px_25px_-5px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.35)]">
                {Array.from({ length: 21 }).map((_, i) => {
                  const marcado = i < paso.diasMarcados;
                  return (
                    <motion.div
                      key={i}
                      initial={false}
                      animate={{
                        scale: marcado ? [0.85, 1.08, 1] : 1,
                      }}
                      transition={{ duration: 0.3 }}
                      className={`h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center rounded-[5px] text-[11px] transition-colors duration-300 ${
                        marcado
                          ? 'bg-[#dcfce7] dark:bg-[#14532d] text-[#15803d] dark:text-[#86efac] font-bold'
                          : 'border border-[var(--lp-line)]/70 bg-[var(--lp-surface)]/50 text-transparent'
                      }`}
                    >
                      {marcado ? <Check className="h-3 w-3 stroke-[3]" /> : null}
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Textos explicativos */}
            <div className="mt-4 max-w-xs">
              <h3 className="text-[19px] sm:text-[21px] font-bold text-[var(--lp-ink)]">
                Crea el hábito
              </h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-[var(--lp-ink-soft)]">
                Cuando registrar toma segundos, realmente lo haces. La consistencia se vuelve natural.
              </p>
            </div>
          </div>

          {/* Columna 3: Ve el panorama completo */}
          <div className="flex flex-col items-center text-center relative z-10">
            {/* Visual animado superior: Barras dinámicas de categorías */}
            <div className="h-36 w-full flex items-end justify-center gap-2 sm:gap-2.5 pb-1">
              {paso.barras.map((b) => (
                <motion.div
                  key={b.categoria}
                  animate={{ height: `${Math.max(64, b.alturaPct * 1.3)}px` }}
                  transition={{ type: 'spring', stiffness: 130, damping: 17 }}
                  className="flex w-14 sm:w-16 flex-col items-center justify-between rounded-2xl border border-[var(--lp-line)] bg-[var(--lp-bg)] p-2 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.06)] dark:shadow-[0_10px_25px_-5px_rgba(0,0,0,0.35)]"
                >
                  <span className="text-[17px]">{b.icono}</span>
                  <span className="text-[11px] sm:text-[12px] font-bold tracking-tight text-[var(--lp-ink)]">
                    {b.monto}
                  </span>
                </motion.div>
              ))}
            </div>

            {/* Textos explicativos */}
            <div className="mt-4 max-w-xs">
              <h3 className="text-[19px] sm:text-[21px] font-bold text-[var(--lp-ink)]">
                Ve el panorama completo
              </h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-[var(--lp-ink-soft)]">
                Entiende tus patrones. Haz preguntas. Obtén información que nunca encontrarías en una hoja de cálculo.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};
