import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Play, Pause, Smartphone, Wand2, Zap } from 'lucide-react';
import { Reveal } from './primitivas';

const URL_ATAJO_ICLOUD = 'https://www.icloud.com/shortcuts/5331c6951e0e411c96a6bf39adaeb95c';

export const SeccionApplePay: React.FC = () => {
  const [versionIos, setVersionIos] = useState<'actual' | 'beta'>('actual');
  const [animandoDemo, setAnimandoDemo] = useState(true);
  const [pasoVisual, setPasoVisual] = useState(0);

  // Animación interactiva de la demo de pantalla de iPhone
  React.useEffect(() => {
    if (!animandoDemo) return;
    const interval = setInterval(() => {
      setPasoVisual((prev) => (prev + 1) % 4);
    }, 2800);
    return () => clearInterval(interval);
  }, [animandoDemo]);

  return (
    <section className="relative w-full overflow-hidden py-20 sm:py-28 bg-[var(--lp-bg)]" id="apple-pay">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        {/* ── 1. Hero Apple Pay ────────────────────────────────────────── */}
        <div className="flex flex-col items-center text-center">
          <Reveal>
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--lp-surface)] px-3.5 py-1.5 text-[13px] font-semibold text-[var(--lp-ink-soft)] border border-[var(--lp-line)] shadow-xs">
              <Smartphone className="h-4 w-4 text-[var(--lp-ink)]" />
              <span>Solo iPhone · Apple Pay</span>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <h2 className="mt-5 text-[32px] sm:text-[46px] font-extrabold tracking-tight text-[var(--lp-ink)] max-w-2xl leading-[1.15]">
              Cada pago con Apple Pay,{' '}
              <span className="text-[var(--lp-in)]">registrado solo</span>
            </h2>
          </Reveal>

          <Reveal delay={0.2}>
            <p className="mt-4 max-w-xl text-[16px] sm:text-[18px] leading-relaxed text-[var(--lp-ink-soft)]">
              Configurás el atajo una vez y listo: cada compra con Apple Pay entra a LukApp sin que
              hagas nada.
            </p>
          </Reveal>

          {/* Botón principal CTA */}
          <Reveal delay={0.3} className="mt-7 flex flex-col items-center">
            <a
              href={URL_ATAJO_ICLOUD}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2.5 rounded-full bg-[var(--lp-in)] hover:opacity-90 text-white font-bold px-7 py-3.5 text-[16px] shadow-lg shadow-emerald-600/25 transition-[transform,opacity] hover:scale-102 active:scale-98"
            >
              <Wand2 className="h-5 w-5" />
              <span>Instalar el atajo</span>
            </a>
            <span className="mt-2.5 text-[13px] text-[var(--lp-ink-faint)]">
              Elegí tu versión de iOS para el atajo correcto. Necesitás un iPhone con Apple Pay y la
              app LukApp instalada.
            </span>
          </Reveal>
        </div>

        {/* ── 2. Cómo activarlo (Menos de dos minutos, una sola vez) ──────── */}
        <div className="mt-20 sm:mt-24 pt-12 border-t border-[var(--lp-line)]/70">
          <div className="text-center max-w-xl mx-auto">
            <h3 className="text-[26px] sm:text-[34px] font-extrabold text-[var(--lp-ink)]">
              Cómo activarlo
            </h3>
            <p className="mt-2 text-[15px] sm:text-[16px] text-[var(--lp-ink-soft)]">
              Menos de dos minutos, una sola vez.
            </p>

            {/* Selector de versión de iOS */}
            <div className="mt-5 inline-flex items-center rounded-full bg-[var(--lp-surface)] p-1 border border-[var(--lp-line)] shadow-xs">
              <button
                type="button"
                onClick={() => setVersionIos('actual')}
                className={`rounded-full px-4 py-1.5 text-[13.5px] font-semibold transition-[color,background-color,box-shadow] ${
                  versionIos === 'actual'
                    ? 'bg-[var(--lp-bg)] text-[var(--lp-ink)] shadow-xs font-bold'
                    : 'text-[var(--lp-ink-soft)] hover:text-[var(--lp-ink)]'
                }`}
              >
                iOS 26 y anteriores
              </button>
              <button
                type="button"
                onClick={() => setVersionIos('beta')}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13.5px] font-semibold transition-[color,background-color,box-shadow] ${
                  versionIos === 'beta'
                    ? 'bg-[var(--lp-bg)] text-[var(--lp-ink)] shadow-xs font-bold'
                    : 'text-[var(--lp-ink-soft)] hover:text-[var(--lp-ink)]'
                }`}
              >
                <span>iOS 27</span>
                <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-800 dark:text-amber-300">
                  BETA
                </span>
              </button>
            </div>
          </div>

          {/* Contenedor del video demo vertical y los pasos interactivos */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-12 gap-10 items-center max-w-4xl mx-auto">
            {/* Teléfono vertical interactivo simulado */}
            <div className="md:col-span-5 flex flex-col items-center">
              <span className="text-[13px] font-semibold text-[var(--lp-ink-soft)] mb-3 flex items-center gap-1.5">
                <span>Mirá el paso a paso</span>
                <button
                  type="button"
                  onClick={() => setAnimandoDemo(!animandoDemo)}
                  className="p-1 rounded-full hover:bg-[var(--lp-surface)] transition-colors"
                  aria-label={animandoDemo ? 'Pausar animación' : 'Reanudar animación'}
                >
                  {animandoDemo ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </button>
              </span>

              <div className="relative w-[240px] sm:w-[260px] h-[480px] rounded-[44px] bg-[#101010] p-3 shadow-2xl ring-1 ring-white/20 border-4 border-[#252525]">
                {/* Isla dinámica del iPhone */}
                <div className="absolute top-5 left-1/2 -translate-x-1/2 w-20 h-4.5 bg-black rounded-full z-30" />

                {/* Pantalla interior */}
                <div className="w-full h-full rounded-[36px] bg-[var(--lp-bg)] overflow-hidden flex flex-col pt-9 px-4 pb-4 relative">
                  <AnimatePresence mode="wait">
                    {pasoVisual === 0 && (
                      <motion.div
                        key="paso0"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.3 }}
                        className="flex flex-col items-center justify-center h-full text-center"
                      >
                        <div className="h-14 w-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 mb-3 shadow-xs">
                          <Wand2 className="h-7 w-7" />
                        </div>
                        <span className="text-[14px] font-extrabold text-[var(--lp-ink)]">
                          Apple Wallet LukApp
                        </span>
                        <span className="text-[11.5px] text-[var(--lp-ink-soft)] mt-1">
                          Paso 1: Agregar atajo a tu iPhone
                        </span>
                        <div className="mt-5 rounded-full bg-[var(--lp-in)] px-4 py-1.5 text-[12px] font-bold text-white shadow-xs">
                          Obtener atajo
                        </div>
                      </motion.div>
                    )}

                    {pasoVisual === 1 && (
                      <motion.div
                        key="paso1"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.3 }}
                        className="flex flex-col h-full justify-between py-2 text-left"
                      >
                        <div>
                          <span className="text-[11px] font-bold text-[var(--lp-in)] uppercase tracking-wider">
                            Automatización
                          </span>
                          <h4 className="text-[13.5px] font-bold text-[var(--lp-ink)] mt-0.5">
                            Al usar Apple Pay
                          </h4>
                          <div className="mt-3 p-2.5 rounded-xl bg-[var(--lp-surface)] border border-[var(--lp-line)] text-[11.5px] space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[var(--lp-ink-soft)]">Tarjeta:</span>
                              <span className="font-semibold text-[var(--lp-ink)]">Cualquier tarjeta</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[var(--lp-ink-soft)]">Ejecutar:</span>
                              <span className="font-bold text-[var(--lp-in)]">De inmediato</span>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 p-2 text-center text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                          ✓ Se ejecutará en segundo plano
                        </div>
                      </motion.div>
                    )}

                    {pasoVisual === 2 && (
                      <motion.div
                        key="paso2"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.3 }}
                        className="flex flex-col items-center justify-center h-full text-center"
                      >
                        <div className="h-14 w-14 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-600 mb-3 shadow-xs">
                          <Smartphone className="h-7 w-7" />
                        </div>
                        <span className="text-[14px] font-extrabold text-[var(--lp-ink)]">
                          Pago con Apple Pay
                        </span>
                        <span className="text-[12px] text-[var(--lp-ink-soft)] mt-1">
                          Starbucks · $18.500 COP
                        </span>
                        <div className="mt-4 flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--lp-in)]">
                          <Zap className="h-3.5 w-3.5" />
                          <span>Detectado por Atajos</span>
                        </div>
                      </motion.div>
                    )}

                    {pasoVisual === 3 && (
                      <motion.div
                        key="paso3"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -15 }}
                        transition={{ duration: 0.3 }}
                        className="flex flex-col items-center justify-center h-full text-center"
                      >
                        <div className="h-14 w-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/30">
                          <Check className="h-8 w-8 stroke-[3]" />
                        </div>
                        <span className="text-[14px] font-extrabold text-[var(--lp-ink)]">
                          ¡Anotado en LukApp!
                        </span>
                        <span className="text-[11.5px] text-[var(--lp-ink-soft)] mt-1">
                          Categorizado como Café & Snacks
                        </span>
                        <div className="mt-3 rounded-full bg-[var(--lp-surface)] px-3 py-1 text-[11px] font-bold text-[var(--lp-ink)] border border-[var(--lp-line)]">
                          Saldo y métricas al día
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Barra de progreso inferior */}
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex">
                    {[0, 1, 2, 3].map((idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setPasoVisual(idx)}
                        className="grid h-8 w-8 place-items-center rounded-full"
                        aria-label={`Ver paso ${idx + 1}`}
                      >
                        <span
                          aria-hidden
                          className={`h-1.5 rounded-full transition-[width,background-color] ${
                            pasoVisual === idx
                              ? 'w-5 bg-[var(--lp-in)]'
                              : 'w-1.5 bg-[var(--lp-line)]'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Lista detallada de los 3 pasos */}
            <div className="md:col-span-7 flex flex-col gap-6">
              {/* Paso 1 */}
              <div className="flex items-start gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--lp-in)] text-white font-extrabold text-[15px] shadow-sm">
                  1
                </span>
                <div>
                  <h4 className="text-[17px] font-bold text-[var(--lp-ink)]">Importá el atajo</h4>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--lp-ink-soft)]">
                    Tocá <strong className="text-[var(--lp-ink)]">"Instalar el atajo"</strong> y
                    agrégalo cuando se abra la app Atajos en tu iPhone.
                  </p>
                </div>
              </div>

              {/* Paso 2 */}
              <div className="flex items-start gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--lp-in)] text-white font-extrabold text-[15px] shadow-sm">
                  2
                </span>
                <div>
                  <h4 className="text-[17px] font-bold text-[var(--lp-ink)]">
                    Configurá la automatización
                  </h4>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--lp-ink-soft)]">
                    En <strong className="text-[var(--lp-ink)]">Atajos → Automatización → Nueva automatización</strong>,
                    elegí <strong className="text-[var(--lp-ink)]">Wallet</strong>, agregá las tarjetas que quieras
                    automatizar y marcá <strong className="text-[var(--lp-in)]">"Ejecutar de inmediato"</strong>.
                    Tocá Siguiente y elegí el atajo que importaste.
                  </p>
                </div>
              </div>

              {/* Paso 3 */}
              <div className="flex items-start gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--lp-in)] text-white font-extrabold text-[15px] shadow-sm">
                  3
                </span>
                <div>
                  <h4 className="text-[17px] font-bold text-[var(--lp-ink)]">Probalo la primera vez</h4>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--lp-ink-soft)]">
                    Hacé el primer pago con el teléfono desbloqueado para conceder el permiso de red.
                    Después funciona siempre solo, sin tener que desbloquearlo.
                  </p>
                </div>
              </div>

              {/* Botón final */}
              <div className="mt-4 pt-2">
                <a
                  href={URL_ATAJO_ICLOUD}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--lp-in)] hover:opacity-90 text-white font-bold px-6 py-3 text-[15px] shadow-md shadow-emerald-600/20 transition-[transform,opacity] hover:scale-102 active:scale-98"
                >
                  <Wand2 className="h-4.5 w-4.5" />
                  <span>Instalar el atajo</span>
                </a>
                <p className="mt-2 text-[12.5px] text-[var(--lp-ink-faint)]">
                  Se abre en la app Atajos de tu iPhone · {versionIos === 'actual' ? 'iOS 26 y anteriores' : 'iOS 27'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
