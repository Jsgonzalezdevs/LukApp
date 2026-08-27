import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Reveal } from './primitivas';

interface GastoDemo {
  icono: string;
  categoria: string;
  monto: string;
  color: string;
  bgColor: string;
}

const GASTOS_DEMO: GastoDemo[] = [
  { icono: '🚗', categoria: 'Transporte', monto: '$75,6K', color: '#ef4444', bgColor: '#fee2e2' },
  { icono: '🥑', categoria: 'Mercado', monto: '$143,5K', color: '#10b981', bgColor: '#d1fae5' },
  { icono: '🍔', categoria: 'Comida', monto: '$32,0K', color: '#f59e0b', bgColor: '#fef3c7' },
  { icono: '☕', categoria: 'Café & Snacks', monto: '$18,5K', color: '#8b5cf6', bgColor: '#ede9fe' },
  { icono: '💎', categoria: 'Suscripciones', monto: '$65,0K', color: '#06b6d4', bgColor: '#cffafe' },
];

const CATEGORIAS_PANORAMA = [
  { id: '1', icono: '🚗', categoria: 'Transporte', monto: '352,6K', altura: 148, color: '#ef4444' },
  { id: '2', icono: '🥑', categoria: 'Mercado', monto: '328,5K', altura: 136, color: '#10b981' },
  { id: '3', icono: '🍔', categoria: 'Comida', monto: '292,2K', altura: 122, color: '#f59e0b' },
  { id: '4', icono: '💎', categoria: 'Entretenimiento', monto: '130,8K', altura: 96, color: '#06b6d4' },
  { id: '5', icono: '💡', categoria: 'Servicios', monto: '185,0K', altura: 110, color: '#eab308' },
  { id: '6', icono: '☕', categoria: 'Snacks', monto: '94,2K', altura: 88, color: '#8b5cf6' },
  { id: '7', icono: '🏠', categoria: 'Hogar', monto: '420,0K', altura: 154, color: '#6366f1' },
];

export const SecuenciaAnimada: React.FC = () => {
  const [pasoIdx, setPasoIdx] = useState(0);
  const [cuadrosLlenos, setCuadrosLlenos] = useState(1);

  // Ciclo para los gastos deslizantes (3.6 segundos)
  useEffect(() => {
    const timer = setInterval(() => {
      setPasoIdx((prev) => (prev + 1) % GASTOS_DEMO.length);
    }, 3600);
    return () => clearInterval(timer);
  }, []);

  // Animación al ritmo perfecto cuadrito por cuadrito (420ms por cuadrito)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    if (cuadrosLlenos >= 21) {
      // Pausa de 1.2s al completar antes de reiniciar
      timer = setTimeout(() => {
        setCuadrosLlenos(0);
      }, 1200);
    } else {
      // Ritmo fluido y claro (420ms)
      timer = setTimeout(() => {
        setCuadrosLlenos((prev) => prev + 1);
      }, 420);
    }

    return () => clearTimeout(timer);
  }, [cuadrosLlenos]);

  const gastoActual = GASTOS_DEMO[pasoIdx];

  return (
    <section className="relative w-full overflow-hidden py-16 sm:py-24 bg-[var(--lp-surface)]/30 border-y border-[var(--lp-line)]/50">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <Reveal className="relative grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8 items-start">
          {/* Línea horizontal decorativa conectora entre columnas en desktop */}
          <div
            className="hidden md:block absolute top-[72px] left-[15%] right-[15%] h-[1px] -z-0 pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(to right, transparent, var(--lp-line) 15%, var(--lp-line) 85%, transparent)',
            }}
          />

          {/* ── Columna 1: Registra sin esfuerzo ──────────────────────────── */}
          <div className="flex flex-col items-center text-center relative z-10">
            {/* Visual animado: Cápsula deslizante */}
            <div className="h-40 w-full flex items-center justify-center overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={gastoActual.categoria + gastoActual.monto}
                  initial={{ opacity: 0, x: -35, scale: 0.94 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    scale: 1,
                    transition: {
                      type: 'spring',
                      stiffness: 260,
                      damping: 20,
                    },
                  }}
                  exit={{
                    opacity: 0,
                    x: 35,
                    scale: 0.94,
                    transition: { duration: 0.25, ease: 'easeIn' },
                  }}
                  className="flex items-center gap-3 rounded-full bg-[var(--lp-bg)] border border-[var(--lp-line)] py-2 px-4 shadow-[0_12px_30px_-6px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_30px_-6px_rgba(0,0,0,0.45)]"
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[16px] shadow-xs"
                    style={{ backgroundColor: gastoActual.bgColor }}
                  >
                    {gastoActual.icono}
                  </span>
                  <span className="text-[15px] font-bold text-[var(--lp-ink)]">
                    {gastoActual.categoria}
                  </span>
                  <span className="rounded-full bg-[var(--lp-surface)] px-2.5 py-1 text-[13.5px] font-extrabold tabular-nums text-[var(--lp-ink)] border border-[var(--lp-line)]/60">
                    {gastoActual.monto}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-2 max-w-xs">
              <h3 className="text-[19px] sm:text-[21px] font-bold text-[var(--lp-ink)]">
                Registra sin esfuerzo
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--lp-ink-soft)]">
                Escribe una nota, habla naturalmente, o deja que las automatizaciones lo hagan por ti. Sin formularios, sin fricción.
              </p>
            </div>
          </div>

          {/* ── Columna 2: Crea el hábito (Llenado progresivo cuadrito por cuadrito) ── */}
          <div className="flex flex-col items-center text-center relative z-10">
            {/* Visual animado: Matriz de 21 días que se llena individualmente cuadrito a cuadrito */}
            <div className="h-40 w-full flex items-center justify-center">
              <div className="grid grid-cols-7 gap-1.5 p-3.5 rounded-2xl bg-[var(--lp-bg)] border border-[var(--lp-line)] shadow-[0_12px_30px_-6px_rgba(0,0,0,0.06)] dark:shadow-[0_12px_30px_-6px_rgba(0,0,0,0.35)]">
                {Array.from({ length: 21 }).map((_, i) => {
                  const marcado = i < cuadrosLlenos;
                  const esElRecienMarcado = i === cuadrosLlenos - 1;

                  return (
                    <motion.div
                      key={i}
                      initial={false}
                      animate={{
                        scale: esElRecienMarcado ? [0.7, 1.25, 1] : 1,
                        backgroundColor: marcado ? '#dcfce7' : 'rgba(0,0,0,0.02)',
                      }}
                      transition={{
                        duration: 0.25,
                        ease: 'easeOut',
                      }}
                      className={`h-5 w-5 sm:h-5.5 sm:w-5.5 flex items-center justify-center rounded-[6px] text-[11px] border transition-colors ${
                        marcado
                          ? 'border-emerald-400 dark:border-emerald-600 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-300 font-extrabold shadow-xs ring-1 ring-emerald-400/30'
                          : 'border-[var(--lp-line)]/70 text-transparent'
                      }`}
                    >
                      <AnimatePresence>
                        {marcado && (
                          <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            transition={{
                              type: 'spring',
                              stiffness: 500,
                              damping: 20,
                            }}
                          >
                            <Check className="h-3 w-3 stroke-[3]" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <div className="mt-2 max-w-xs">
              <h3 className="text-[19px] sm:text-[21px] font-bold text-[var(--lp-ink)]">
                Crea el hábito
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--lp-ink-soft)]">
                Cuando registrar toma segundos, realmente lo haces. La consistencia se vuelve natural.
              </p>
            </div>
          </div>

          {/* ── Columna 3: Ve el panorama completo (Deslizamiento continuo) ─ */}
          <div className="flex flex-col items-center text-center relative z-10">
            {/* Visual animado: Carrusel deslizable de tarjetas de categorías */}
            <div
              className="h-40 w-full flex items-end justify-center overflow-hidden"
              style={{
                WebkitMaskImage:
                  'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
                maskImage:
                  'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
              }}
            >
              <motion.div
                animate={{
                  x: [0, -82, -164, -246, 0],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 14,
                  ease: 'easeInOut',
                }}
                className="flex items-end gap-2.5 px-2 pb-1"
              >
                {/* Duplicamos para loop infinito continuo de desplazamiento */}
                {[...CATEGORIAS_PANORAMA, ...CATEGORIAS_PANORAMA].map((cat, idx) => (
                  <motion.div
                    key={`${cat.id}-${idx}`}
                    style={{ height: `${cat.altura}px` }}
                    whileHover={{ y: -4 }}
                    className="flex w-[68px] sm:w-[76px] shrink-0 flex-col items-center justify-between rounded-[22px] sm:rounded-[24px] border border-[var(--lp-line)] bg-[var(--lp-bg)] p-2.5 shadow-[0_12px_30px_-6px_rgba(0,0,0,0.07)] dark:shadow-[0_12px_30px_-6px_rgba(0,0,0,0.4)]"
                  >
                    {/* Emoji superior con fondo circular tintado */}
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-2xl text-[17px] shadow-xs"
                      style={{ backgroundColor: `${cat.color}18` }}
                    >
                      {cat.icono}
                    </div>

                    {/* Cifra inferior */}
                    <span className="text-[12px] sm:text-[13px] font-extrabold tabular-nums tracking-tight text-[var(--lp-ink)]">
                      {cat.monto}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            </div>

            <div className="mt-2 max-w-xs">
              <h3 className="text-[19px] sm:text-[21px] font-bold text-[var(--lp-ink)]">
                Ve el panorama completo
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--lp-ink-soft)]">
                Entiende tus patrones. Haz preguntas. Obtén información que nunca encontrarías en una hoja de cálculo.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};
