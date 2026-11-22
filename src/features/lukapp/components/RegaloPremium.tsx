import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CalendarCheck, Gift, ShieldCheck, Sparkles } from 'lucide-react';
import { apiUrl } from '../../../lib/api';
import { useBloqueoScroll } from '../data/useBloqueoScroll';
import { obtenerSupabase } from '../data/supabase';
import {
  fechaVencimientoRegalo,
  leerRegaloPremium,
  palabraDias,
  type RegaloPremiumPendiente,
} from '../lib/regaloPremium';
import { ConfetiMarca } from './ConfetiMarca';

interface RegaloPremiumProps {
  userId: string;
  /** Falso mientras haya otra pantalla encima: la celebración espera su turno. */
  puedeMostrarse: boolean;
  /** Vista previa desde la consola: no consulta ni marca nada en el servidor. */
  vistaPrevia?: RegaloPremiumPendiente;
  onCerrar?: () => void;
}

const claveVisto = (userId: string, id: number) => `lukapp-regalo-premium-visto-v1:${userId}:${id}`;

const yaVistoAqui = (userId: string, id: number): boolean => {
  try {
    return localStorage.getItem(claveVisto(userId, id)) === '1';
  } catch {
    return false;
  }
};

const recordarVistoAqui = (userId: string, id: number): void => {
  try {
    localStorage.setItem(claveVisto(userId, id), '1');
  } catch {
    // Sin almacenamiento local queda el registro del servidor, que es el principal.
  }
};

/**
 * La celebración de cuando el equipo de LukApp le regala Premium a alguien.
 * Sale una sola vez por regalo: el servidor lo recuerda (vale para todos los
 * dispositivos) y el navegador también, por si la marca no alcanzó a guardarse.
 */
export const RegaloPremium: React.FC<RegaloPremiumProps> = ({ userId, puedeMostrarse, vistaPrevia, onCerrar }) => {
  const [regalo, setRegalo] = useState<RegaloPremiumPendiente | null>(vistaPrevia ?? null);
  const [abierto, setAbierto] = useState(false);
  const consultado = useRef(false);
  const dialogoRef = useRef<HTMLDivElement>(null);

  useBloqueoScroll(abierto);

  useEffect(() => {
    if (vistaPrevia || consultado.current) return undefined;
    consultado.current = true;
    let cancelado = false;
    void (async () => {
      const cliente = obtenerSupabase();
      const sesion = cliente ? (await cliente.auth.getSession()).data.session : null;
      if (!sesion?.access_token || cancelado) return;
      try {
        const respuesta = await fetch(apiUrl('/api/mi-plan/regalo-premium'), {
          headers: { Authorization: `Bearer ${sesion.access_token}` },
        });
        if (!respuesta.ok || cancelado) return;
        const pendiente = leerRegaloPremium(await respuesta.json().catch(() => null));
        if (pendiente && !yaVistoAqui(userId, pendiente.id)) setRegalo(pendiente);
      } catch {
        // Una celebración nunca se convierte en un aviso de error.
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [userId, vistaPrevia]);

  // Se marca como visto al aparecer, no al cerrar: si la persona recarga o
  // cierra la app con el pop-up abierto, ya lo vio y no debe repetirse.
  useEffect(() => {
    if (!regalo || !puedeMostrarse || abierto) return;
    setAbierto(true);
    if (vistaPrevia) return;
    recordarVistoAqui(userId, regalo.id);
    void (async () => {
      const cliente = obtenerSupabase();
      const sesion = cliente ? (await cliente.auth.getSession()).data.session : null;
      if (!sesion?.access_token) return;
      await fetch(apiUrl(`/api/mi-plan/regalo-premium/${regalo.id}/visto`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${sesion.access_token}` },
      }).catch(() => undefined);
    })();
  }, [abierto, puedeMostrarse, regalo, userId, vistaPrevia]);

  const cerrar = useCallback(() => {
    setAbierto(false);
    setRegalo(null);
    onCerrar?.();
  }, [onCerrar]);

  useEffect(() => {
    if (!abierto) return undefined;
    const focoAnterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const alPulsarTecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        cerrar();
      }
      // Un solo botón: el foco no tiene a dónde más ir.
      if (evento.key === 'Tab') evento.preventDefault();
    };
    document.addEventListener('keydown', alPulsarTecla);
    requestAnimationFrame(() => dialogoRef.current?.querySelector<HTMLElement>('button')?.focus());
    return () => {
      document.removeEventListener('keydown', alPulsarTecla);
      focoAnterior?.focus();
    };
  }, [abierto, cerrar]);

  const dias = regalo?.dias ?? 0;

  return (
    <>
      <ConfetiMarca activo={abierto} />
      <AnimatePresence>
        {abierto && regalo ? (
          <motion.div
            key="regalo-premium"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[10010] flex items-center justify-center bg-[#0d0726]/75 px-4 py-[max(1rem,env(safe-area-inset-top))] font-[Poppins,ui-sans-serif,system-ui,sans-serif] backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="regalo-premium-titulo"
            aria-describedby="regalo-premium-descripcion"
            ref={dialogoRef}
            onClick={(evento) => {
              if (evento.target === evento.currentTarget) cerrar();
            }}
          >
            <motion.section
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="relative max-h-full w-full max-w-[400px] overflow-x-hidden overflow-y-auto overscroll-contain [scrollbar-width:none] rounded-[32px] border border-white/12 bg-[linear-gradient(165deg,#2a0f57_0%,#1a0838_55%,#120527_100%)] text-white shadow-[0_40px_120px_-30px_rgba(119,42,234,0.75)]"
            >
              <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                <div className="absolute -left-16 -top-20 h-60 w-60 rounded-full bg-[#772AEA]/55 blur-3xl" />
                <div className="absolute -right-16 top-24 h-48 w-48 rounded-full bg-[#D4025A]/30 blur-3xl" />
                <div className="absolute -bottom-20 left-10 h-52 w-52 rounded-full bg-[#B6F246]/15 blur-3xl" />
                <Destello className="absolute left-7 top-[150px] h-5 w-5 text-[#D4025A]" retraso={0.2} />
                <Destello className="absolute right-9 top-[70px] h-4 w-4 text-[#B6F246]" retraso={0.6} />
                <Destello className="absolute right-14 top-[200px] h-3 w-3 text-white/80" retraso={1} />
              </div>

              <div className="relative px-5 pb-5 pt-5 text-center sm:px-6 sm:pb-6 sm:pt-6">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-white/85">
                  <Gift className="h-3.5 w-3.5 text-[#B6F246]" strokeWidth={2.4} aria-hidden="true" />
                  Un regalo para ti
                </span>

                <motion.img
                  src="/brand/luki-saltando-transparente.webp"
                  alt="Luki, la mascota de LukApp, saltando de alegría"
                  width={512}
                  height={600}
                  className="mx-auto -mb-1 mt-1 h-[112px] w-auto sm:h-[150px] drop-shadow-[0_18px_30px_rgba(0,0,0,0.45)]"
                  initial={{ y: 30, opacity: 0, rotate: -6 }}
                  animate={{ y: [0, -12, 0], opacity: 1, rotate: [-3, 3, -3] }}
                  transition={{
                    y: { duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: 0.5 },
                    rotate: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
                    opacity: { duration: 0.4, delay: 0.15 },
                  }}
                />

                <h2 id="regalo-premium-titulo" className="text-balance text-[23px] font-extrabold leading-[1.15] tracking-[-0.03em] sm:text-[26px]">
                  ¡El equipo de LukApp te regaló{' '}
                  <span className="relative inline-block -rotate-3 rounded-xl bg-[#B6F246] px-2.5 py-0.5 text-[#1a0838] shadow-[0_8px_20px_-8px_rgba(182,242,70,0.8)]">
                    Premium!
                  </span>
                </h2>

                <motion.div
                  className="mx-auto mt-4 flex w-fit items-end justify-center gap-2.5 rounded-[24px] border border-white/12 bg-black/25 px-5 py-3 sm:mt-6 sm:px-6 sm:py-4"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 14, delay: 0.35 }}
                >
                  <strong className="bg-[linear-gradient(135deg,#B6F246_0%,#c9b8ff_55%,#772AEA_130%)] bg-clip-text text-[54px] font-black leading-[0.85] sm:text-[64px] tracking-[-0.06em] text-transparent">
                    {dias}
                  </strong>
                  <span className="pb-1 text-left text-[15px] font-semibold leading-tight text-white/80">
                    {palabraDias(dias)}
                    <br />
                    de Premium
                  </span>
                </motion.div>

                <p id="regalo-premium-descripcion" className="mx-auto mt-4 max-w-[30ch] text-[14px] leading-relaxed text-white/75 sm:mt-5 sm:text-[15px]">
                  Ya está activo en tu cuenta: aprovecha todo lo de Premium sin pagar nada.
                </p>

                <ul className="mt-4 grid gap-2 text-left text-[13px] font-medium text-white/80">
                  <li className="flex items-center gap-2.5 rounded-2xl bg-white/[0.06] px-3.5 py-2.5">
                    <CalendarCheck className="h-4 w-4 shrink-0 text-[#B6F246]" strokeWidth={2.3} aria-hidden="true" />
                    <span>Disfrútalo hasta el <strong className="font-semibold text-white">{fechaVencimientoRegalo(regalo.venceEn)}</strong></span>
                  </li>
                  <li className="flex items-center gap-2.5 rounded-2xl bg-white/[0.06] px-3.5 py-2.5">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-[#B6F246]" strokeWidth={2.3} aria-hidden="true" />
                    <span>Sin tarjeta y sin cobros al terminar</span>
                  </li>
                </ul>

                <button
                  type="button"
                  onClick={cerrar}
                  className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#772AEA] px-5 text-[16px] font-bold text-white shadow-[0_14px_32px_-12px_rgba(119,42,234,0.9)] transition-[background-color,transform] hover:bg-[#8a43f5] active:scale-[0.98]"
                >
                  <Sparkles className="h-4.5 w-4.5" strokeWidth={2.4} aria-hidden="true" />
                  ¡A disfrutarlo!
                </button>
              </div>
            </motion.section>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
};

/** El destello de cuatro puntas del manual de marca, titilando de fondo. */
const Destello: React.FC<{ className: string; retraso: number }> = ({ className, retraso }) => (
  <motion.svg
    viewBox="0 0 24 24"
    className={className}
    animate={{ scale: [0.8, 1.15, 0.8], rotate: [0, 20, 0], opacity: [0.6, 1, 0.6] }}
    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: retraso }}
  >
    <path fill="currentColor" d="M12 0c.9 6.2 5.8 11.1 12 12-6.2.9-11.1 5.8-12 12-.9-6.2-5.8-11.1-12-12C6.2 11.1 11.1 6.2 12 0Z" />
  </motion.svg>
);
