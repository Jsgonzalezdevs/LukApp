import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Bot, FileText, Mic, ShieldCheck, Sparkles, UsersRound, X } from 'lucide-react';
import { apiUrl } from '../../../lib/api';
import { useBloqueoScroll } from '../data/useBloqueoScroll';
import { obtenerSupabase } from '../data/supabase';

interface PlanParaInvitacion {
  codigo: 'normal' | 'premium';
  preciosPremium: { mensualCop: number; anualCop: number };
  limitesPremium: {
    dictadosMensual: number | null;
    asesorIaMensual: number | null;
    extractosMensual: number | null;
    espaciosCompartidos: number | null;
    integrantesPorEspacio: number | null;
  };
}

interface InvitacionPremiumProps {
  userId: string;
  puedeMostrarse: boolean;
  onVerOpciones: () => void;
}

const RETRASO_MOSTRAR_MS = 8_000;
const INTERVALO_INVITACION_MS = 14 * 24 * 60 * 60 * 1_000;

const pesos = (valor: number): string =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor);

const cupo = (valor: number | null): string =>
  valor === null ? '∞' : new Intl.NumberFormat('es-CO').format(valor);

const claveProximaInvitacion = (userId: string): string => `lukapp-proxima-invitacion-premium-v1:${userId}`;

const posponerInvitacion = (userId: string): void => {
  try {
    localStorage.setItem(claveProximaInvitacion(userId), String(Date.now() + INTERVALO_INVITACION_MS));
  } catch {
    // En navegadores que impiden guardar preferencias, no se muestra durante
    // esta sesión porque el componente no vuelve a programar otra invitación.
  }
};

const puedeInvitar = (userId: string): boolean => {
  try {
    const proxima = Number(localStorage.getItem(claveProximaInvitacion(userId)) ?? '0');
    return !Number.isFinite(proxima) || Date.now() >= proxima;
  } catch {
    // Si el navegador no deja recordar preferencias, se mantiene la invitación
    // fuera de esta sesión para que tampoco se vuelva invasiva.
    return false;
  }
};

/**
 * Invitación ocasional, no una barrera: el plan Normal sigue disponible y la
 * decisión de ver Premium se toma desde una pantalla con precios reales.
 */
export const InvitacionPremium: React.FC<InvitacionPremiumProps> = ({ userId, puedeMostrarse, onVerOpciones }) => {
  const [plan, setPlan] = useState<PlanParaInvitacion | null>(null);
  const [abierta, setAbierta] = useState(false);
  const consultada = useRef(false);
  const dialogoRef = useRef<HTMLDivElement>(null);

  useBloqueoScroll(abierta);

  const cerrar = useCallback(() => {
    posponerInvitacion(userId);
    setAbierta(false);
  }, [userId]);

  useEffect(() => {
    if (!puedeMostrarse || consultada.current || !puedeInvitar(userId)) return undefined;
    consultada.current = true;
    let cancelado = false;

    const temporizador = window.setTimeout(async () => {
      const cliente = obtenerSupabase();
      const sesion = cliente ? (await cliente.auth.getSession()).data.session : null;
      if (!sesion?.access_token || cancelado) return;

      try {
        const respuesta = await fetch(apiUrl('/api/mi-plan'), {
          headers: { Authorization: `Bearer ${sesion.access_token}` },
        });
        const cuerpo = await respuesta.json().catch(() => ({}));
        if (!respuesta.ok || cancelado) return;
        const siguientePlan = cuerpo as Partial<PlanParaInvitacion>;
        if (siguientePlan.codigo !== 'normal' || !siguientePlan.preciosPremium || !siguientePlan.limitesPremium) return;
        setPlan(siguientePlan as PlanParaInvitacion);
        // El intervalo se guarda al mostrarse, no solo al cerrarse: si se
        // recarga la página, una invitación ya vista no vuelve a interrumpir.
        posponerInvitacion(userId);
        setAbierta(true);
      } catch {
        // Una invitación comercial no debe convertirse en un aviso de error.
      }
    }, RETRASO_MOSTRAR_MS);

    return () => {
      cancelado = true;
      window.clearTimeout(temporizador);
    };
  }, [puedeMostrarse, userId]);

  useEffect(() => {
    if (!abierta) return undefined;
    const focoAnterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const selectoresFoco = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const alPulsarTecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        cerrar();
        return;
      }
      if (evento.key !== 'Tab') return;

      const focos = Array.from(dialogoRef.current?.querySelectorAll<HTMLElement>(selectoresFoco) ?? []);
      if (focos.length === 0) return;
      const primero = focos[0];
      const ultimo = focos[focos.length - 1];
      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener('keydown', alPulsarTecla);
    requestAnimationFrame(() => dialogoRef.current?.querySelector<HTMLElement>('button')?.focus());
    return () => {
      document.removeEventListener('keydown', alPulsarTecla);
      focoAnterior?.focus();
    };
  }, [abierta, cerrar]);

  const verOpciones = () => {
    cerrar();
    onVerOpciones();
  };

  const beneficios = plan ? [
    { titulo: 'Registro por voz', detalle: 'al mes', valor: cupo(plan.limitesPremium.dictadosMensual), Icono: Mic },
    { titulo: 'Asesor IA', detalle: 'consultas al mes', valor: cupo(plan.limitesPremium.asesorIaMensual), Icono: Bot },
    { titulo: 'Extractos', detalle: 'al mes', valor: cupo(plan.limitesPremium.extractosMensual), Icono: FileText },
  ] : [];

  return (
    <AnimatePresence>
      {abierta && plan ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[110] flex items-end justify-center bg-[#160922]/65 p-0 backdrop-blur-md sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invitacion-premium-titulo"
          aria-describedby="invitacion-premium-descripcion"
          ref={dialogoRef}
        >
          <motion.section
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 310, damping: 28 }}
            className="relative w-full max-w-[620px] overflow-hidden rounded-t-[28px] border border-white/15 bg-[#261044] text-white shadow-[0_35px_100px_-28px_rgba(12,4,28,0.85)] sm:rounded-[28px]"
          >
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-fuchsia-400/35 blur-3xl" />
              <div className="absolute -bottom-24 -left-12 h-64 w-64 rounded-full bg-lime-300/20 blur-3xl" />
              <div className="absolute right-8 top-24 h-36 w-36 rounded-full border border-white/10" />
              <div className="absolute right-16 top-32 h-20 w-20 rounded-full border border-white/10" />
            </div>

            <div className="relative max-h-[calc(100dvh-1rem)] overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-[calc(env(safe-area-inset-top)+1.25rem)] sm:max-h-[calc(100dvh-2.5rem)] sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold tracking-[0.08em] text-white/85 uppercase">
                  <Sparkles className="h-3.5 w-3.5 text-lime-200" strokeWidth={2.35} aria-hidden="true" />
                  LukApp Premium
                </span>
                <button
                  type="button"
                  onClick={cerrar}
                  aria-label="Seguir usando el plan Normal"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
                >
                  <X className="h-4.5 w-4.5" strokeWidth={2.5} aria-hidden="true" />
                </button>
              </div>

              <div className="mt-7 max-w-[490px]">
                <h2 id="invitacion-premium-titulo" className="text-balance text-[31px] font-semibold leading-[1.05] tracking-[-0.045em] sm:text-[39px]">
                  Más espacio para tus finanzas, sin complicarlas.
                </h2>
                <p id="invitacion-premium-descripcion" className="mt-4 text-[15px] leading-relaxed text-white/76 sm:text-[16px]">
                  Premium amplía los cupos que acompañan tu rutina: registra, consulta y organiza más cuando lo necesitas. Tu plan Normal sigue siendo gratis; tú eliges cuándo cambiar.
                </p>
              </div>

              <div className="mt-6 grid gap-2.5 sm:grid-cols-3">
                {beneficios.map(({ titulo, detalle, valor, Icono }) => (
                  <div key={titulo} className="rounded-[18px] border border-white/10 bg-black/15 p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] font-semibold text-white/65">{titulo}</p>
                      <Icono className="h-4 w-4 shrink-0 text-lime-200" strokeWidth={2.25} aria-hidden="true" />
                    </div>
                    <div className="mt-3 flex items-end gap-1.5">
                      <strong className="text-[29px] font-semibold leading-none tracking-[-0.06em]">{valor}</strong>
                      <span className="mb-0.5 text-[10px] leading-tight text-white/58">{detalle}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-2.5 flex items-center gap-2 rounded-[15px] border border-lime-200/15 bg-lime-200/10 px-3.5 py-3 text-[12px] leading-snug text-lime-50">
                <UsersRound className="h-4 w-4 shrink-0 text-lime-200" strokeWidth={2.25} aria-hidden="true" />
                También amplías los espacios compartidos y las personas que puedes invitar.
              </div>

              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="rounded-[14px] border border-white/10 bg-white/10 px-3.5 py-2.5">
                  <p className="text-[10px] font-bold tracking-[0.08em] text-white/55 uppercase">Desde</p>
                  <p className="mt-0.5 text-[15px] font-semibold text-white">{pesos(plan.preciosPremium.mensualCop)} <span className="text-[12px] font-medium text-white/65">/ mes</span></p>
                  <p className="mt-0.5 text-[11px] text-white/58">Anual: {pesos(plan.preciosPremium.anualCop)}</p>
                </div>
                <button
                  type="button"
                  onClick={verOpciones}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--fin-r-control)] bg-[#8f32ff] px-5 text-[14px] font-semibold text-white shadow-lg shadow-purple-950/40 transition-colors hover:bg-[#a247ff]"
                >
                  Ver planes y precios
                  <ArrowRight className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4">
                <p className="inline-flex items-center gap-1.5 text-[11px] text-white/55"><ShieldCheck className="h-3.5 w-3.5 text-lime-200" strokeWidth={2.25} aria-hidden="true" /> Sin compromiso ni urgencia.</p>
                <button type="button" onClick={cerrar} className="text-[12px] font-semibold text-white/75 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white">
                  Seguir con Normal
                </button>
              </div>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
