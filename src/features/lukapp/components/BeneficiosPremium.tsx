import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CalendarCheck, ChevronDown, Crown, Gift, RefreshCw, Sparkles } from 'lucide-react';
import { apiUrl } from '../../../lib/api';
import { useBloqueoScroll } from '../data/useBloqueoScroll';
import { obtenerSupabase } from '../data/supabase';
import { beneficiosActivos, iconoDeBeneficio, type BeneficioPlan, type ClaveBeneficioPlan } from '../lib/beneficiosPlan';
import { GUIA_BENEFICIOS, type DestinoBeneficio } from '../lib/guiaBeneficiosPremium';
import { diasDeRegalo, fechaVencimientoRegalo, palabraDias } from '../lib/regaloPremium';
import { EstrellaAvatar } from './EstrellaAvatar';

interface ConsumoDelMes {
  dictados: number;
  asesorIa: number;
  extractos: number;
}

interface PlanParaBeneficios {
  codigo: 'normal' | 'premium';
  beneficiosPremium: BeneficioPlan[];
  suscripcion: { ciclo: 'mensual' | 'anual' | 'cortesia'; venceEn: string } | null;
  consumo: ConsumoDelMes | null;
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

const numeroSeguro = (valor: unknown): number => (typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 ? valor : 0);

const leerPlan = (cuerpo: unknown): PlanParaBeneficios | null => {
  if (!cuerpo || typeof cuerpo !== 'object') return null;
  const plan = cuerpo as Partial<PlanParaBeneficios> & { consumo?: Partial<ConsumoDelMes> };
  if ((plan.codigo !== 'normal' && plan.codigo !== 'premium') || !Array.isArray(plan.beneficiosPremium)) return null;
  const consumo = plan.consumo && typeof plan.consumo === 'object'
    ? { dictados: numeroSeguro(plan.consumo.dictados), asesorIa: numeroSeguro(plan.consumo.asesorIa), extractos: numeroSeguro(plan.consumo.extractos) }
    : null;
  return { codigo: plan.codigo, beneficiosPremium: plan.beneficiosPremium, suscripcion: plan.suscripcion ?? null, consumo };
};

const numero = new Intl.NumberFormat('es-CO');

/** El cupo en grande: un número, «Sin límite» o «Incluido». */
const valorEnGrande = (beneficio: BeneficioPlan): string => {
  if (beneficio.tipoValor === 'incluido') return 'Incluido';
  return beneficio.limite === null ? 'Sin límite' : numero.format(beneficio.limite);
};

/** Solo estos tres cupos se gastan mes a mes; los demás son capacidad, no consumo. */
const USO_DEL_MES: Partial<Record<ClaveBeneficioPlan, { campo: keyof ConsumoDelMes; unidad: string }>> = {
  dictado: { campo: 'dictados', unidad: 'registros por voz' },
  asesor_ia: { campo: 'asesorIa', unidad: 'consultas al Asesor' },
  extracto: { campo: 'extractos', unidad: 'extractos' },
};

const ESTILO_BOTON_PRINCIPAL =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#8a43f5_0%,#772AEA_55%,#5b1bc4_100%)] px-5 text-[16px] font-bold text-white shadow-[0_14px_32px_-12px_rgba(119,42,234,0.9)] ring-1 ring-white/15 transition-[filter,transform] hover:brightness-110 active:scale-[0.98]';

/**
 * Todo lo que trae Premium, explicado con calma. Vive en /premium y se abre
 * desde la celebración del regalo, desde la tarjeta del plan o por enlace.
 * Lleva la misma piel morada de los momentos Premium para sentirse parte de él.
 */
export const BeneficiosPremium: React.FC<BeneficiosPremiumProps> = ({ onCerrar, onIrA, onVerPlanes }) => {
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' });
  const [intento, setIntento] = useState(0);
  const [conSombra, setConSombra] = useState(false);
  const dialogoRef = useRef<HTMLDivElement>(null);
  const cierreRef = useRef(onCerrar);
  const sinMovimiento = useReducedMotion() ?? false;

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
  const cupos = esPremium && plan?.consumo
    ? beneficios.filter((beneficio) => USO_DEL_MES[beneficio.clave] && beneficio.tipoValor === 'cupo')
    : [];
  const ofrecerPlanes = Boolean(plan && !esPremium && onVerPlanes);

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
      onScroll={(evento) => setConSombra(evento.currentTarget.scrollTop > 8)}
    >
      <FondoPremium sinMovimiento={sinMovimiento} />

      {/* Pegada arriba: en una página larga uno tiene que poder volver sin subir hasta el principio. */}
      <header
        className={`sticky top-0 z-20 transition-[background-color,border-color,backdrop-filter] duration-200 ${
          conSombra ? 'border-b border-white/10 bg-[#120527]/85 backdrop-blur-xl' : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className="mx-auto flex w-full max-w-[920px] items-center justify-between gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.875rem)] sm:px-6">
          <button
            type="button"
            onClick={onCerrar}
            className="group inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/10 py-1 pl-1 pr-4 text-[14px] font-semibold text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.8)] backdrop-blur-md transition-colors hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B6F246]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 transition-transform group-hover:-translate-x-0.5">
              <ArrowLeft className="h-4.5 w-4.5" strokeWidth={2.5} aria-hidden="true" />
            </span>
            Volver
          </button>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/85 backdrop-blur-md sm:text-[12px]">
            <Crown className="h-3.5 w-3.5 text-[#B6F246]" strokeWidth={2.4} aria-hidden="true" />
            LukApp Premium
          </span>
        </div>
      </header>

      <div className={`relative mx-auto w-full max-w-[920px] px-4 sm:px-6 ${ofrecerPlanes || esPremium ? 'pb-[calc(env(safe-area-inset-bottom)+7rem)] sm:pb-14' : 'pb-[calc(env(safe-area-inset-bottom)+2.5rem)]'}`}>
        {/* ------------------------------------------------------------ portada */}
        <section className="grid items-center gap-6 pt-2 sm:grid-cols-[1.15fr_1fr] sm:gap-10 sm:pt-6">
          <div className="text-center sm:text-left">
            <motion.p
              className="inline-flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[0.16em] text-[#c9b8ff]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <Sparkles className="h-3.5 w-3.5 text-[#B6F246]" strokeWidth={2.4} aria-hidden="true" />
              {esPremium ? 'Tu plan, al máximo' : 'Lleva tus finanzas más lejos'}
            </motion.p>
            <motion.h1
              id="beneficios-premium-titulo"
              className="mt-3 text-balance text-[34px] font-extrabold leading-[1.04] tracking-[-0.04em] sm:text-[48px]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              {esPremium ? 'Todo lo que trae tu ' : 'Todo lo que trae '}
              <span className="relative inline-block -rotate-2 rounded-xl bg-[#B6F246] px-2.5 py-0.5 text-[#1a0838] shadow-[0_10px_30px_-8px_rgba(182,242,70,0.75)]">
                Premium
              </span>
            </motion.h1>
            <motion.p
              className="mx-auto mt-4 max-w-[44ch] text-[15px] leading-relaxed text-white/75 sm:mx-0 sm:text-[17px]"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.4 }}
            >
              Más cupo para anotar por voz, hablar con el Asesor e importar extractos, y herramientas que te ayudan a decidir antes de gastar.
            </motion.p>
          </div>

          <TarjetaMembresia plan={plan} cargando={estado.fase === 'cargando'} sinMovimiento={sinMovimiento} />
        </section>

        {/* ------------------------------------------------------- uso del mes */}
        {cupos.length > 0 && plan?.consumo ? (
          <section className="mt-10" aria-labelledby="beneficios-premium-uso">
            <Encabezado id="beneficios-premium-uso" titulo="Tu mes en Premium" detalle="Se renueva el día 1" />
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {cupos.map((beneficio, indice) => (
                <MedidorUso
                  key={beneficio.clave}
                  beneficio={beneficio}
                  usado={plan.consumo![USO_DEL_MES[beneficio.clave]!.campo]}
                  unidad={USO_DEL_MES[beneficio.clave]!.unidad}
                  indice={indice}
                  sinMovimiento={sinMovimiento}
                />
              ))}
            </div>
          </section>
        ) : null}

        {/* --------------------------------------------------------- beneficios */}
        <section className="mt-10" aria-labelledby="beneficios-premium-lista">
          <Encabezado
            id="beneficios-premium-lista"
            titulo="Lo que incluye"
            detalle={plan ? `${beneficios.length} ${beneficios.length === 1 ? 'beneficio' : 'beneficios'}` : undefined}
          />

          {estado.fase === 'cargando' ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Cargando los beneficios">
              {[0, 1, 2, 3].map((n) => (
                <div key={n} className="h-[190px] animate-pulse rounded-[26px] border border-white/10 bg-white/[0.05]" />
              ))}
            </div>
          ) : estado.fase === 'error' ? (
            <div className="mt-3 rounded-[26px] border border-white/12 bg-white/[0.06] px-5 py-7 text-center" role="alert">
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
                  sinMovimiento={sinMovimiento}
                />
              ))}
            </ul>
          )}
        </section>

        {/* ---------------------------------------------------------- preguntas */}
        <section className="mt-10" aria-labelledby="beneficios-premium-preguntas">
          <Encabezado id="beneficios-premium-preguntas" titulo="Preguntas rápidas" />
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

        <p className="mt-10 text-center text-[13px] text-white/45">
          Hecho con 💜 por el equipo de LukApp
        </p>
      </div>

      {/* La acción principal queda siempre a la mano: abajo en el teléfono, al final en pantallas grandes. */}
      {plan ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 bg-[linear-gradient(to_top,#120527_55%,transparent)] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-8 sm:static sm:bg-none sm:px-6 sm:pb-12 sm:pt-0">
          <div className="pointer-events-auto mx-auto w-full max-w-[920px] sm:max-w-[420px]">
            {ofrecerPlanes ? (
              <button type="button" onClick={onVerPlanes} className={ESTILO_BOTON_PRINCIPAL}>
                Ver planes y precios
                <ArrowRight className="h-4.5 w-4.5" strokeWidth={2.4} aria-hidden="true" />
              </button>
            ) : (
              <button type="button" onClick={onCerrar} className={ESTILO_BOTON_PRINCIPAL}>
                <Sparkles className="h-4.5 w-4.5" strokeWidth={2.4} aria-hidden="true" />
                ¡A disfrutarlo!
              </button>
            )}
          </div>
        </div>
      ) : null}
    </motion.div>
  );
};

const Encabezado: React.FC<{ id: string; titulo: string; detalle?: string }> = ({ id, titulo, detalle }) => (
  <div className="flex items-end justify-between gap-3">
    <h2 id={id} className="text-[13px] font-bold uppercase tracking-[0.14em] text-[#c9b8ff]">
      {titulo}
    </h2>
    {detalle ? <span className="text-[13px] font-medium text-white/55">{detalle}</span> : null}
  </div>
);

/** Las manchas de color y los destellos de la marca, quietos si el sistema pide menos movimiento. */
const FondoPremium: React.FC<{ sinMovimiento: boolean }> = ({ sinMovimiento }) => (
  <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
    <motion.div
      className="absolute -left-32 -top-32 h-[26rem] w-[26rem] rounded-full bg-[#772AEA]/45 blur-3xl"
      animate={sinMovimiento ? undefined : { x: [0, 30, 0], y: [0, 20, 0] }}
      transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
    />
    <motion.div
      className="absolute -right-28 top-32 h-80 w-80 rounded-full bg-[#D4025A]/25 blur-3xl"
      animate={sinMovimiento ? undefined : { x: [0, -24, 0], y: [0, 30, 0] }}
      transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
    />
    <div className="absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-[#B6F246]/10 blur-3xl" />
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] [background-size:28px_28px] [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" />
  </div>
);

/** La "tarjeta de socio": dice de un vistazo qué plan tienes y hasta cuándo. */
const TarjetaMembresia: React.FC<{ plan: PlanParaBeneficios | null; cargando: boolean; sinMovimiento: boolean }> = ({
  plan,
  cargando,
  sinMovimiento,
}) => {
  const esPremium = plan?.codigo === 'premium';
  const esRegalo = plan?.suscripcion?.ciclo === 'cortesia';
  const venceEn = plan?.suscripcion?.venceEn;
  const diasRestantes = esPremium && venceEn ? diasDeRegalo(new Date(), venceEn) : null;

  return (
    <motion.div
      className="relative mx-auto w-full max-w-[380px] pt-[78px] sm:mr-0 sm:pt-[92px]"
      initial={{ opacity: 0, y: 24, rotate: sinMovimiento ? 0 : -4 }}
      animate={{ opacity: 1, y: 0, rotate: sinMovimiento ? 0 : -2 }}
      transition={{ type: 'spring', stiffness: 180, damping: 18, delay: 0.15 }}
    >
      <motion.img
        src="/brand/luki-saltando-transparente.webp"
        alt=""
        width={512}
        height={600}
        className="absolute right-5 top-0 z-10 h-[100px] w-auto drop-shadow-[0_18px_30px_rgba(0,0,0,0.5)] sm:h-[116px]"
        animate={sinMovimiento ? undefined : { y: [0, -8, 0], rotate: [-3, 3, -3] }}
        transition={{ y: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }, rotate: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } }}
      />
      <div className="relative overflow-hidden rounded-[28px] border border-white/20 bg-[linear-gradient(140deg,#8a43f5_0%,#5b1bc4_38%,#2a0f57_72%,#1a0838_100%)] p-5 shadow-[0_30px_80px_-30px_rgba(119,42,234,0.9)] ">
        {/* El brillo que cruza la tarjeta, como en una tarjeta física. */}
        {sinMovimiento ? null : (
          <motion.div
            className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)]"
            animate={{ x: ['0%', '320%'] }}
            transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 3.5, ease: 'easeInOut' }}
            aria-hidden="true"
          />
        )}
        <div className="pointer-events-none absolute -right-10 -bottom-12 h-40 w-40 rounded-full border border-white/10" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-2 -bottom-4 h-24 w-24 rounded-full border border-white/10" aria-hidden="true" />

        <div className="relative flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-[13px] font-bold tracking-[0.02em] text-white/90">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#B6F246] text-[#1a0838] shadow-[0_6px_16px_-6px_rgba(182,242,70,0.8)]">
              <Crown className="h-4.5 w-4.5" strokeWidth={2.5} aria-hidden="true" />
            </span>
            LukApp Premium
          </span>
          {plan ? (
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.1em] ${esPremium ? 'bg-[#B6F246] text-[#1a0838]' : 'bg-white/15 text-white/85'}`}>
              {esPremium ? 'Activo' : 'Plan Normal'}
            </span>
          ) : null}
        </div>

        <div className="relative mt-8 min-h-[72px]">
          {cargando ? (
            <div className="space-y-2" aria-hidden="true">
              <div className="h-9 w-24 animate-pulse rounded-lg bg-white/15" />
              <div className="h-4 w-44 animate-pulse rounded bg-white/10" />
            </div>
          ) : esPremium && diasRestantes !== null ? (
            <>
              <p className="flex items-end gap-2">
                <strong className="text-[52px] font-black leading-[0.85] tracking-[-0.06em]">{diasRestantes}</strong>
                <span className="pb-1 text-[15px] font-semibold leading-tight text-white/80">
                  {palabraDias(diasRestantes)}
                  <br />
                  {diasRestantes === 1 ? 'te queda' : 'te quedan'}
                </span>
              </p>
              <p className="mt-3 inline-flex items-center gap-1.5 text-[13px] text-white/80">
                {esRegalo ? (
                  <Gift className="h-4 w-4 shrink-0 text-[#B6F246]" strokeWidth={2.3} aria-hidden="true" />
                ) : (
                  <CalendarCheck className="h-4 w-4 shrink-0 text-[#B6F246]" strokeWidth={2.3} aria-hidden="true" />
                )}
                <span>
                  {esRegalo ? 'Regalo del equipo · activo' : 'Activo'} hasta el{' '}
                  <strong className="font-semibold text-white">{fechaVencimientoRegalo(venceEn!)}</strong>
                </span>
              </p>
            </>
          ) : esPremium ? (
            <p className="text-[22px] font-extrabold tracking-[-0.03em]">Todo activo para ti</p>
          ) : plan ? (
            <>
              <p className="text-[22px] font-extrabold leading-tight tracking-[-0.03em]">Hoy estás en el plan Normal</p>
              <p className="mt-2 text-[13px] text-white/75">Gratis para siempre. Premium suma lo que ves abajo.</p>
            </>
          ) : (
            <p className="text-[15px] text-white/75">Descubre lo que trae Premium.</p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

/** Cuánto llevas de un cupo este mes, con una barra que se llena al aparecer. */
const MedidorUso: React.FC<{
  beneficio: BeneficioPlan;
  usado: number;
  unidad: string;
  indice: number;
  sinMovimiento: boolean;
}> = ({ beneficio, usado, unidad, indice, sinMovimiento }) => {
  const Icono = iconoDeBeneficio(beneficio.clave);
  const limite = beneficio.limite;
  const proporcion = limite ? Math.min(1, usado / limite) : 0;
  const quedan = limite === null ? null : Math.max(0, limite - usado);

  return (
    <motion.div
      className="rounded-[22px] border border-white/12 bg-white/[0.06] p-4"
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.35, delay: 0.06 * indice }}
    >
      <div className="flex items-center gap-2 text-[13px] font-semibold text-white/70">
        <Icono className="h-4 w-4 text-[#c9b8ff]" strokeWidth={2.3} aria-hidden="true" />
        {beneficio.titulo}
      </div>
      <p className="mt-2 flex items-baseline gap-1.5">
        <strong className="text-[26px] font-extrabold tracking-[-0.04em]">{numero.format(usado)}</strong>
        <span className="text-[13px] text-white/55">{limite === null ? unidad : `de ${numero.format(limite)}`}</span>
      </p>
      {limite !== null ? (
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-label={`${beneficio.titulo}: ${usado} de ${limite} este mes`}
          aria-valuemin={0}
          aria-valuemax={limite}
          aria-valuenow={Math.min(usado, limite)}
        >
          <motion.div
            className="h-full rounded-full bg-[linear-gradient(90deg,#c9b8ff,#8a43f5)]"
            initial={{ width: sinMovimiento ? `${proporcion * 100}%` : '0%' }}
            whileInView={{ width: `${proporcion * 100}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.15 + 0.06 * indice }}
          />
        </div>
      ) : (
        <div className="mt-3 h-2 rounded-full bg-[linear-gradient(90deg,#c9b8ff33,#8a43f533)]" aria-hidden="true" />
      )}
      <p className="mt-2 text-[12px] text-white/55">
        {quedan === null ? 'Sin límite este mes' : quedan === 0 ? 'Ya usaste todo el cupo de este mes' : `Te quedan ${numero.format(quedan)} este mes`}
      </p>
    </motion.div>
  );
};

const TarjetaBeneficio: React.FC<{
  beneficio: BeneficioPlan;
  indice: number;
  onIrA?: (destino: DestinoBeneficio) => void;
  sinMovimiento: boolean;
}> = ({ beneficio, indice, onIrA, sinMovimiento }) => {
  const guia = GUIA_BENEFICIOS[beneficio.clave];
  const Icono = iconoDeBeneficio(beneficio.clave);
  // La Estrella es la cara de la IA: aparece en el Asesor y en ningún otro beneficio.
  const esAsesor = beneficio.clave === 'asesor_ia';

  return (
    <motion.li
      className="group relative flex flex-col overflow-hidden rounded-[26px] border border-white/12 bg-[linear-gradient(160deg,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0.03)_100%)] p-5 shadow-[0_18px_40px_-28px_rgba(0,0,0,0.9)] transition-[border-color,box-shadow] duration-300 hover:border-white/25 hover:shadow-[0_26px_60px_-28px_rgba(119,42,234,0.85)]"
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      whileHover={sinMovimiento ? undefined : { y: -4 }}
      transition={{ duration: sinMovimiento ? 0 : 0.4, delay: sinMovimiento ? 0 : 0.05 * (indice % 2), ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#772AEA]/0 blur-2xl transition-colors duration-300 group-hover:bg-[#772AEA]/35" aria-hidden="true" />
      <div className="relative flex items-start gap-3.5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[linear-gradient(140deg,#8a43f5,#3b1380)] text-[#B6F246] shadow-[0_10px_24px_-12px_rgba(119,42,234,0.9)] ring-1 ring-white/15">
          {esAsesor ? (
            <EstrellaAvatar size={44} emotion="happy" />
          ) : (
            <Icono className="h-5.5 w-5.5" strokeWidth={2.3} aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-bold leading-tight">{beneficio.titulo}</h3>
          <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 text-[13px] text-white/60">
            <strong className="bg-[linear-gradient(135deg,#ffffff_0%,#c9b8ff_100%)] bg-clip-text text-[20px] font-extrabold tracking-[-0.03em] text-transparent">
              {valorEnGrande(beneficio)}
            </strong>
            <span>{beneficio.detalle}</span>
          </p>
        </div>
      </div>
      {guia ? <p className="relative mt-3.5 flex-1 text-[14px] leading-relaxed text-white/75">{guia.explicacion}</p> : null}
      {guia && onIrA ? (
        <button
          type="button"
          onClick={() => onIrA(guia.destino)}
          className="relative mt-4 inline-flex min-h-10 w-fit items-center gap-1.5 rounded-full bg-white/10 px-4 text-[13px] font-semibold text-white ring-1 ring-white/10 transition-colors hover:bg-white/20"
        >
          {guia.accion}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} aria-hidden="true" />
        </button>
      ) : null}
    </motion.li>
  );
};

const Pregunta: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <details className="group rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3.5 transition-colors open:bg-white/[0.08] hover:border-white/20">
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
      {titulo}
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 transition-transform duration-200 group-open:rotate-180">
        <ChevronDown className="h-4 w-4 text-white/75" strokeWidth={2.4} aria-hidden="true" />
      </span>
    </summary>
    <p className="mt-2 text-[14px] leading-relaxed text-white/72">{children}</p>
  </details>
);
