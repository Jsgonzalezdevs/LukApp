import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CalendarCheck, ChevronDown, Crown, Gift, RefreshCw, Sparkles } from 'lucide-react';
import { apiUrl } from '../../../lib/api';
import { useBloqueoScroll } from '../data/useBloqueoScroll';
import { obtenerSupabase } from '../data/supabase';
import { beneficiosActivos, iconoDeBeneficio, type BeneficioPlan } from '../lib/beneficiosPlan';
import { GUIA_BENEFICIOS, type DestinoBeneficio } from '../lib/guiaBeneficiosPremium';
import { fechaVencimientoRegalo } from '../lib/regaloPremium';
import { EstrellaAvatar } from './EstrellaAvatar';

interface PlanParaBeneficios {
  codigo: 'normal' | 'premium';
  beneficiosPremium: BeneficioPlan[];
  suscripcion: { ciclo: 'mensual' | 'anual' | 'cortesia'; venceEn: string } | null;
}

interface BeneficiosPremiumProps {
  onCerrar: () => void;
  /** Lleva a probar el beneficio: cierra esta página y abre su sitio en la app. */
  onIrA?: (destino: DestinoBeneficio) => void;
  /** Solo para quien aún no es Premium: abre los planes y precios de siempre. */
  onVerPlanes?: () => void;
}

type Estado =
  | { fase: 'cargando' }
  | { fase: 'error' }
  | { fase: 'listo'; plan: PlanParaBeneficios };

const leerPlan = (cuerpo: unknown): PlanParaBeneficios | null => {
  if (!cuerpo || typeof cuerpo !== 'object') return null;
  const plan = cuerpo as Partial<PlanParaBeneficios>;
  if ((plan.codigo !== 'normal' && plan.codigo !== 'premium') || !Array.isArray(plan.beneficiosPremium)) return null;
  return { codigo: plan.codigo, beneficiosPremium: plan.beneficiosPremium, suscripcion: plan.suscripcion ?? null };
};

const numero = new Intl.NumberFormat('es-CO');

/** El cupo en grande: un número, «Sin límite» o «Incluido». */
const valorEnGrande = (beneficio: BeneficioPlan): string => {
  if (beneficio.tipoValor === 'incluido') return 'Incluido';
  return beneficio.limite === null ? 'Sin límite' : numero.format(beneficio.limite);
};

/**
 * Todo lo que trae Premium, explicado con calma. Se abre desde la celebración
 * del regalo y desde la tarjeta del plan: lleva la misma piel morada de los
 * momentos Premium para que se sienta parte de ese mismo momento.
 */
export const BeneficiosPremium: React.FC<BeneficiosPremiumProps> = ({ onCerrar, onIrA, onVerPlanes }) => {
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' });
  const [intento, setIntento] = useState(0);
  const dialogoRef = useRef<HTMLDivElement>(null);
  const cierreRef = useRef(onCerrar);

  useBloqueoScroll(true);

  useEffect(() => {
    cierreRef.current = onCerrar;
  }, [onCerrar]);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      try {
        const cliente = obtenerSupabase();
        const sesion = cliente ? (await cliente.auth.getSession()).data.session : null;
        if (!sesion?.access_token) throw new Error('sin sesión');
        const respuesta = await fetch(apiUrl('/api/mi-plan'), {
          headers: { Authorization: `Bearer ${sesion.access_token}` },
        });
        const plan = respuesta.ok ? leerPlan(await respuesta.json().catch(() => null)) : null;
        if (cancelado) return;
        setEstado(plan ? { fase: 'listo', plan } : { fase: 'error' });
      } catch {
        if (!cancelado) setEstado({ fase: 'error' });
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [intento]);

  const reintentar = useCallback(() => {
    setEstado({ fase: 'cargando' });
    setIntento((n) => n + 1);
  }, []);

  useEffect(() => {
    const focoAnterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const selectoresFoco = 'button:not([disabled]), [href], summary, [tabindex]:not([tabindex="-1"])';
    const alPulsarTecla = (evento: KeyboardEvent) => {
      const dialogos = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (dialogos[dialogos.length - 1] !== dialogoRef.current) return;
      if (evento.key === 'Escape') {
        evento.preventDefault();
        cierreRef.current();
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
  }, []);

  const plan = estado.fase === 'listo' ? estado.plan : null;
  const esPremium = plan?.codigo === 'premium';
  const esRegalo = plan?.suscripcion?.ciclo === 'cortesia';
  const beneficios = plan ? beneficiosActivos(plan.beneficiosPremium) : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[10020] overflow-y-auto overscroll-contain bg-[#120527] font-[Poppins,ui-sans-serif,system-ui,sans-serif] text-white"
      role="dialog"
      aria-modal="true"
      aria-labelledby="beneficios-premium-titulo"
      ref={dialogoRef}
      tabIndex={-1}
    >
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#772AEA]/45 blur-3xl" />
        <div className="absolute -right-24 top-40 h-72 w-72 rounded-full bg-[#D4025A]/22 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-[#B6F246]/10 blur-3xl" />
      </div>

      {/* Pegada arriba: en una página larga uno tiene que poder volver sin subir hasta el principio. */}
      <header className="sticky top-0 z-10 bg-[#120527]/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[860px] items-center justify-between gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.875rem)] sm:px-6">
          <button
            type="button"
            onClick={onCerrar}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/12 bg-white/10 pl-2.5 pr-3.5 text-[14px] font-semibold text-white/90 transition-colors hover:bg-white/20"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
            Volver
          </button>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.12em] text-white/85">
            <Crown className="h-3.5 w-3.5 text-[#B6F246]" strokeWidth={2.4} aria-hidden="true" />
            LukApp Premium
          </span>
        </div>
      </header>

      <div className="relative mx-auto w-full max-w-[860px] px-4 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] sm:px-6">
        <section className="mt-4 grid items-center gap-4 sm:mt-8 sm:grid-cols-[1fr_auto]">
          <div className="text-center sm:text-left">
            <h1 id="beneficios-premium-titulo" className="text-balance text-[30px] font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-[40px]">
              {esPremium ? 'Todo lo que trae tu ' : 'Todo lo que trae '}
              <span className="relative inline-block -rotate-2 rounded-xl bg-[#B6F246] px-2.5 py-0.5 text-[#1a0838] shadow-[0_8px_20px_-8px_rgba(182,242,70,0.8)]">
                Premium
              </span>
            </h1>
            <p className="mx-auto mt-4 max-w-[46ch] text-[15px] leading-relaxed text-white/75 sm:mx-0 sm:text-[17px]">
              Más cupo para anotar por voz, hablar con el Asesor e importar extractos, y herramientas que te ayudan a decidir antes de gastar.
            </p>
            {esPremium && plan?.suscripcion ? (
              <p className="mx-auto mt-4 inline-flex items-center gap-2 rounded-2xl text-left border border-white/12 bg-white/[0.07] px-3.5 py-2 text-[13px] font-medium text-white/85 sm:mx-0">
                {esRegalo ? (
                  <Gift className="h-4 w-4 shrink-0 text-[#B6F246]" strokeWidth={2.3} aria-hidden="true" />
                ) : (
                  <CalendarCheck className="h-4 w-4 shrink-0 text-[#B6F246]" strokeWidth={2.3} aria-hidden="true" />
                )}
                <span>
                  {esRegalo ? 'Regalo del equipo · activo' : 'Activo'} hasta el{' '}
                  <strong className="font-semibold text-white">{fechaVencimientoRegalo(plan.suscripcion.venceEn)}</strong>
                </span>
              </p>
            ) : null}
          </div>
          <motion.img
            src="/brand/luki-saltando-transparente.webp"
            alt=""
            width={512}
            height={600}
            className="order-first mx-auto h-[104px] w-auto sm:order-none sm:h-[190px] drop-shadow-[0_18px_30px_rgba(0,0,0,0.45)]"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: [0, -10, 0], opacity: 1 }}
            transition={{ y: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.4 } }}
          />
        </section>

        <section className="mt-8" aria-labelledby="beneficios-premium-lista">
          <div className="flex items-end justify-between gap-3">
            <h2 id="beneficios-premium-lista" className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#c9b8ff]">
              Lo que incluye
            </h2>
            {plan ? (
              <span className="text-[13px] font-medium text-white/55">
                {beneficios.length} {beneficios.length === 1 ? 'beneficio' : 'beneficios'}
              </span>
            ) : null}
          </div>

          {estado.fase === 'cargando' ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Cargando los beneficios">
              {[0, 1, 2, 3].map((n) => (
                <div key={n} className="h-[178px] animate-pulse rounded-[24px] border border-white/10 bg-white/[0.05]" />
              ))}
            </div>
          ) : estado.fase === 'error' ? (
            <div className="mt-3 rounded-[24px] border border-white/12 bg-white/[0.06] px-5 py-6 text-center" role="alert">
              <p className="text-[15px] font-semibold">No pudimos cargar los beneficios.</p>
              <p className="mt-1 text-[13px] text-white/65">Revisa tu conexión e inténtalo otra vez.</p>
              <button
                type="button"
                onClick={reintentar}
                className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full bg-white/12 px-4 text-[14px] font-semibold transition-colors hover:bg-white/20"
              >
                <RefreshCw className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
                Reintentar
              </button>
            </div>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {beneficios.map((beneficio, indice) => (
                <TarjetaBeneficio
                  key={beneficio.clave}
                  beneficio={beneficio}
                  indice={indice}
                  onIrA={esPremium ? onIrA : undefined}
                />
              ))}
            </ul>
          )}
        </section>

        <section className="mt-8" aria-labelledby="beneficios-premium-preguntas">
          <h2 id="beneficios-premium-preguntas" className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#c9b8ff]">
            Preguntas rápidas
          </h2>
          <div className="mt-3 grid gap-2">
            {esRegalo ? (
              <Pregunta titulo="¿Me van a cobrar algo?">
                No. Es un regalo del equipo: no pedimos tarjeta y cuando termine no se cobra nada.
              </Pregunta>
            ) : null}
            <Pregunta titulo={esPremium ? '¿Qué pasa cuando se termine?' : '¿Y si después vuelvo al plan Normal?'}>
              Tu cuenta sigue en el plan Normal, que es gratis. Tus movimientos, cuentas y metas no se borran: lo que cambia son los cupos.
            </Pregunta>
            <Pregunta titulo="¿Los cupos se renuevan?">
              Sí. Los cupos de cada mes —registros por voz, consultas al Asesor y extractos— vuelven a empezar el primer día del mes.
            </Pregunta>
            <Pregunta titulo="¿Dónde veo mi plan?">
              En Más → Cuenta, en la tarjeta «Tu plan». Ahí ves hasta cuándo te dura y qué tienes activo.
            </Pregunta>
          </div>
        </section>

        <div className="mt-8">
          {plan && !esPremium && onVerPlanes ? (
            <button
              type="button"
              onClick={onVerPlanes}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#772AEA] px-5 text-[16px] font-bold text-white shadow-[0_14px_32px_-12px_rgba(119,42,234,0.9)] transition-[background-color,transform] hover:bg-[#8a43f5] active:scale-[0.98]"
            >
              Ver planes y precios
              <ArrowRight className="h-4.5 w-4.5" strokeWidth={2.4} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onCerrar}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#772AEA] px-5 text-[16px] font-bold text-white shadow-[0_14px_32px_-12px_rgba(119,42,234,0.9)] transition-[background-color,transform] hover:bg-[#8a43f5] active:scale-[0.98]"
            >
              <Sparkles className="h-4.5 w-4.5" strokeWidth={2.4} aria-hidden="true" />
              ¡A disfrutarlo!
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const TarjetaBeneficio: React.FC<{
  beneficio: BeneficioPlan;
  indice: number;
  onIrA?: (destino: DestinoBeneficio) => void;
}> = ({ beneficio, indice, onIrA }) => {
  const guia = GUIA_BENEFICIOS[beneficio.clave];
  const Icono = iconoDeBeneficio(beneficio.clave);
  // La Estrella es la cara de la IA: aparece en el Asesor y en ningún otro beneficio.
  const esAsesor = beneficio.clave === 'asesor_ia';

  return (
    <motion.li
      className="flex flex-col rounded-[24px] border border-white/12 bg-[linear-gradient(160deg,rgba(255,255,255,0.09)_0%,rgba(255,255,255,0.03)_100%)] p-4 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.9)]"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 * indice, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#772AEA]/35 text-[#B6F246] ring-1 ring-white/10">
          {esAsesor ? (
            <EstrellaAvatar size={40} emotion="happy" />
          ) : (
            <Icono className="h-5 w-5" strokeWidth={2.3} aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-bold leading-tight">{beneficio.titulo}</h3>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-1.5 text-[13px] text-white/60">
            <strong className="text-[18px] font-extrabold tracking-[-0.03em] text-white">{valorEnGrande(beneficio)}</strong>
            <span>{beneficio.detalle}</span>
          </p>
        </div>
      </div>
      {guia ? <p className="mt-3 flex-1 text-[14px] leading-relaxed text-white/75">{guia.explicacion}</p> : null}
      {guia && onIrA ? (
        <button
          type="button"
          onClick={() => onIrA(guia.destino)}
          className="mt-3 inline-flex min-h-10 w-fit items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/20"
        >
          {guia.accion}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
        </button>
      ) : null}
    </motion.li>
  );
};

const Pregunta: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <details className="group rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 open:bg-white/[0.08]">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
      {titulo}
      <ChevronDown className="h-4 w-4 shrink-0 text-white/60 transition-transform group-open:rotate-180" strokeWidth={2.4} aria-hidden="true" />
    </summary>
    <p className="mt-2 text-[14px] leading-relaxed text-white/72">{children}</p>
  </details>
);
