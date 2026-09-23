import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  CalendarDays,
  Check,
  CircleAlert,
  CreditCard,
  FileText,
  Loader2,
  Mic,
  RefreshCw,
  Share2,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { apiUrl } from '../../../lib/api';
import { obtenerSupabase } from '../data/supabase';

interface PlanConfirmado {
  codigo: 'normal' | 'premium';
  limites: {
    dictadosMensual: number | null;
    asesorIaMensual: number | null;
    extractosMensual: number | null;
    espaciosCompartidos: number | null;
    integrantesPorEspacio: number | null;
  };
  suscripcion: { ciclo: 'mensual' | 'anual' | 'cortesia'; venceEn: string } | null;
}

type EstadoConfirmacion = 'consultando' | 'esperando' | 'confirmado' | 'pendiente' | 'error' | 'sin-sesion';
type ResultadoConsulta = 'confirmado' | 'esperando' | 'error' | 'sin-sesion';

const DURACION_VERIFICACION_MS = 60_000;
const INTERVALO_VERIFICACION_MS = 5_000;

const fechaCorta = (valor: string): string =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'America/Bogota' }).format(new Date(valor));

const etiquetaCiclo = (ciclo: 'mensual' | 'anual' | 'cortesia'): string =>
  ciclo === 'anual' ? 'Premium anual' : ciclo === 'mensual' ? 'Premium mensual' : 'Premium de cortesía';

const cupoDestacado = (valor: number | null): string =>
  valor === null ? '∞' : new Intl.NumberFormat('es-CO').format(valor);

interface ConfirmacionPagoWompiProps {
  onIrACuenta: () => void;
  onIrAInicio: () => void;
}

/**
 * La vuelta de Wompi no otorga beneficios. Esta vista solo acompaña mientras
 * el webhook firmado crea la suscripción y muestra éxito cuando `/api/mi-plan`
 * ya puede leerla para la sesión que pagó.
 */
export const ConfirmacionPagoWompi: React.FC<ConfirmacionPagoWompiProps> = ({ onIrACuenta, onIrAInicio }) => {
  const [estado, setEstado] = useState<EstadoConfirmacion>('consultando');
  const [plan, setPlan] = useState<PlanConfirmado | null>(null);
  const [ronda, setRonda] = useState(0);

  const consultarPlan = useCallback(async (): Promise<ResultadoConsulta> => {
    const cliente = obtenerSupabase();
    const sesion = cliente ? (await cliente.auth.getSession()).data.session : null;
    if (!sesion?.access_token) {
      setEstado('sin-sesion');
      return 'sin-sesion';
    }

    try {
      const respuesta = await fetch(apiUrl('/api/mi-plan'), {
        headers: { Authorization: `Bearer ${sesion.access_token}` },
      });
      const cuerpo = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(cuerpo.error || 'No se pudo consultar el estado del pago.');

      const siguientePlan = cuerpo as PlanConfirmado;
      setPlan(siguientePlan);
      if (siguientePlan.codigo === 'premium' && siguientePlan.suscripcion) {
        setEstado('confirmado');
        return 'confirmado';
      }
      setEstado('esperando');
      return 'esperando';
    } catch {
      setEstado('error');
      return 'error';
    }
  }, []);

  useEffect(() => {
    let finalizado = false;
    let intervalo: number | undefined;

    const terminar = () => {
      finalizado = true;
      if (intervalo !== undefined) window.clearInterval(intervalo);
    };

    const revisar = async () => {
      if (finalizado) return;
      const resultado = await consultarPlan();
      if (resultado === 'confirmado' || resultado === 'error' || resultado === 'sin-sesion') terminar();
    };

    void revisar();
    intervalo = window.setInterval(() => void revisar(), INTERVALO_VERIFICACION_MS);
    const limite = window.setTimeout(() => {
      if (!finalizado) {
        terminar();
        setEstado('pendiente');
      }
    }, DURACION_VERIFICACION_MS);

    return () => {
      terminar();
      window.clearTimeout(limite);
    };
  }, [consultarPlan, ronda]);

  useEffect(() => {
    document.title = estado === 'confirmado'
      ? 'Pago confirmado — LukApp'
      : 'Confirmando pago — LukApp';
  }, [estado]);

  const confirmado = estado === 'confirmado';
  const revisando = estado === 'consultando' || estado === 'esperando';
  const suscripcion = confirmado ? plan?.suscripcion : null;
  const beneficiosPremium = plan ? [
    {
      titulo: 'Registro por voz',
      detalle: 'registros al mes',
      valor: cupoDestacado(plan.limites.dictadosMensual),
      Icono: Mic,
    },
    {
      titulo: 'Asesor IA',
      detalle: 'consultas al mes',
      valor: cupoDestacado(plan.limites.asesorIaMensual),
      Icono: Bot,
    },
    {
      titulo: 'Extractos',
      detalle: 'extractos al mes',
      valor: cupoDestacado(plan.limites.extractosMensual),
      Icono: FileText,
    },
    {
      titulo: 'Espacios compartidos',
      detalle: 'para organizarte en compañía',
      valor: cupoDestacado(plan.limites.espaciosCompartidos),
      Icono: Share2,
    },
    {
      titulo: 'Personas por espacio',
      detalle: 'en cada espacio que compartes',
      valor: cupoDestacado(plan.limites.integrantesPorEspacio),
      Icono: UsersRound,
    },
  ] : [];

  const contenidoPrincipal = confirmado
    ? {
      etiqueta: 'Pago confirmado',
      titulo: 'Gracias por elegir Premium.',
      descripcion: 'Tu pago fue confirmado de forma segura y tus beneficios ya están activos.',
      icono: <BadgeCheck className="h-8 w-8" strokeWidth={2.2} aria-hidden="true" />,
    }
    : revisando
      ? {
        etiqueta: 'Confirmación segura',
        titulo: 'Estamos confirmando tu pago.',
        descripcion: 'Wompi está enviando la confirmación segura. Este paso puede tardar unos segundos.',
        icono: <Loader2 className="h-8 w-8 animate-spin" strokeWidth={2.2} aria-hidden="true" />,
      }
      : estado === 'sin-sesion'
        ? {
          etiqueta: 'Sesión requerida',
          titulo: 'Vuelve a entrar para ver tu pago.',
          descripcion: 'El pago seguirá verificándose de forma segura. Inicia sesión con la cuenta que usaste al pagar.',
          icono: <ShieldCheck className="h-8 w-8" strokeWidth={2.2} aria-hidden="true" />,
        }
        : estado === 'error'
          ? {
            etiqueta: 'Sin conexión por ahora',
            titulo: 'No pudimos consultar el estado.',
            descripcion: 'No hicimos ningún cambio. Puedes intentar la verificación de nuevo en un momento.',
            icono: <CircleAlert className="h-8 w-8" strokeWidth={2.2} aria-hidden="true" />,
          }
          : {
            etiqueta: 'Confirmación pendiente',
            titulo: 'Aún no recibimos la confirmación.',
            descripcion: 'Si Wompi aprobó el pago, puede tardar unos segundos más. No repitas el cobro: vuelve a verificar primero.',
            icono: <CircleAlert className="h-8 w-8" strokeWidth={2.2} aria-hidden="true" />,
          };

  return (
    <main className="relative isolate flex min-h-[100dvh] items-center overflow-hidden bg-[var(--fin-bg)] px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute -left-28 top-[-8rem] h-80 w-80 rounded-full bg-[#a855f7]/15 blur-3xl" />
        <div className="absolute -right-24 bottom-[-6rem] h-96 w-96 rounded-full bg-lime-300/15 blur-3xl" />
      </div>

      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto w-full max-w-[680px]"
        aria-live="polite"
      >
        <header className="mb-5 flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-[var(--fin-accent)] text-white shadow-lg shadow-purple-500/20">
              <CreditCard className="h-4.5 w-4.5" strokeWidth={2.4} aria-hidden="true" />
            </span>
            <span className="text-[15px] font-bold tracking-[-0.02em] text-[var(--fin-ink)]">LukApp</span>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-1.5 text-[11px] font-semibold text-[var(--fin-ink-soft)] shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--fin-in)]" strokeWidth={2.25} aria-hidden="true" />
            Pago protegido
          </span>
        </header>

        <div className="relative overflow-hidden rounded-[28px] bg-[#281146] p-6 text-white shadow-[0_32px_80px_-38px_rgba(59,22,105,0.72)] sm:p-8">
          <div className="pointer-events-none absolute inset-0 opacity-70" aria-hidden="true">
            <div className="absolute -right-20 -top-16 h-64 w-64 rounded-full bg-fuchsia-400/30 blur-3xl" />
            <div className="absolute bottom-[-7rem] left-[-4rem] h-72 w-72 rounded-full bg-lime-300/20 blur-3xl" />
            <div className="absolute right-9 top-12 h-28 w-28 rounded-full border border-white/10" />
            <div className="absolute right-16 top-19 h-14 w-14 rounded-full border border-white/10" />
          </div>

          <div className="relative">
            <div className="mb-8 flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold tracking-[0.08em] text-white/80 uppercase">
                <Sparkles className="h-3.5 w-3.5 text-lime-200" strokeWidth={2.3} aria-hidden="true" />
                {contenidoPrincipal.etiqueta}
              </span>
              <span className={`flex h-14 w-14 items-center justify-center rounded-[18px] border ${confirmado ? 'border-lime-200/30 bg-lime-200/15 text-lime-100' : 'border-white/15 bg-white/10 text-white'}`}>
                {contenidoPrincipal.icono}
              </span>
            </div>

            <h1 className="max-w-[13ch] text-balance text-[32px] font-semibold leading-[1.05] tracking-[-0.045em] sm:text-[42px]">
              {contenidoPrincipal.titulo}
            </h1>
            <p className="mt-4 max-w-[53ch] text-[15px] leading-relaxed text-white/72 sm:text-[16px]">
              {contenidoPrincipal.descripcion}
            </p>

            {suscripcion ? (
              <div className="mt-7 grid gap-2 border-t border-white/12 pt-5 sm:grid-cols-2">
                <div className="rounded-[16px] bg-black/15 px-4 py-3">
                  <p className="text-[11px] font-semibold tracking-[0.08em] text-white/50 uppercase">Plan activo</p>
                  <p className="mt-1 text-[15px] font-semibold text-white">{etiquetaCiclo(suscripcion.ciclo)}</p>
                </div>
                <div className="rounded-[16px] bg-black/15 px-4 py-3">
                  <p className="text-[11px] font-semibold tracking-[0.08em] text-white/50 uppercase">Vigencia</p>
                  <p className="mt-1 text-[15px] font-semibold text-white">Hasta {fechaCorta(suscripcion.venceEn)}</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="relative mt-4 overflow-hidden rounded-[24px] border border-[#ded2ef] bg-[linear-gradient(135deg,#ffffff_0%,#faf7ff_56%,#f4ffe6_145%)] p-4 shadow-[0_18px_45px_-34px_rgba(28,25,23,0.45)] sm:p-5">
          {confirmado && plan ? (
            <>
              <div className="pointer-events-none absolute -right-14 -top-16 h-40 w-40 rounded-full bg-purple-300/20 blur-3xl" aria-hidden="true" />
              <div className="relative flex items-start gap-3">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--fin-in)] text-white shadow-lg shadow-emerald-600/20">
                  <Check className="h-5 w-5" strokeWidth={2.75} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h2 className="text-[17px] font-semibold tracking-[-0.025em] text-[var(--fin-ink)]">Todo tu Premium ya está habilitado</h2>
                    <span className="rounded-full bg-[#e9ddff] px-2 py-0.5 text-[10px] font-bold tracking-[0.08em] text-[#5924a3] uppercase">5 beneficios ampliados</span>
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">Estos son los cupos que acabas de desbloquear para usar LukApp con más libertad.</p>
                </div>
              </div>
              <div className="relative mt-5 grid gap-2.5 sm:grid-cols-3">
                {beneficiosPremium.slice(0, 3).map(({ titulo, detalle, valor, Icono }) => (
                  <div key={titulo} className="relative overflow-hidden rounded-[18px] bg-[#2b1349] p-4 text-white shadow-[0_14px_28px_-16px_rgba(48,16,88,0.8)]">
                    <div className="absolute -right-7 -top-8 h-24 w-24 rounded-full bg-fuchsia-400/25 blur-2xl" aria-hidden="true" />
                    <div className="relative flex items-center justify-between gap-3">
                      <p className="text-[12px] font-semibold text-white/74">{titulo}</p>
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-white/15 bg-white/10 text-lime-200">
                        <Icono className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
                      </span>
                    </div>
                    <div className="relative mt-4 flex items-end gap-2">
                      <strong className="text-[34px] font-semibold leading-none tracking-[-0.06em] text-white">{valor}</strong>
                      <span className="mb-0.5 text-[11px] font-medium leading-tight text-white/62">{detalle}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="relative mt-2.5 grid gap-2.5 sm:grid-cols-2">
                {beneficiosPremium.slice(3).map(({ titulo, detalle, valor, Icono }) => (
                  <div key={titulo} className="flex items-center gap-3 rounded-[16px] border border-[#dfd4ef] bg-white/75 px-3.5 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#f0e8ff] text-[#6328be]">
                      <Icono className="h-4.5 w-4.5" strokeWidth={2.25} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold text-[var(--fin-ink)]">{titulo}</p>
                      <p className="mt-0.5 text-[11px] leading-snug text-[var(--fin-ink-soft)]">{detalle}</p>
                    </div>
                    <strong className="shrink-0 text-[28px] font-semibold leading-none tracking-[-0.06em] text-[#58219d]">{valor}</strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] bg-[var(--fin-soft)] text-[var(--fin-accent)]">
                {revisando ? <Loader2 className="h-4.5 w-4.5 animate-spin" strokeWidth={2.25} aria-hidden="true" /> : <CalendarDays className="h-4.5 w-4.5" strokeWidth={2.25} aria-hidden="true" />}
              </span>
              <div>
                <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-[var(--fin-ink)]">Tu acceso se actualiza automáticamente</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">No necesitas enviar comprobantes ni repetir el pago. LukApp espera la confirmación firmada antes de activar Premium.</p>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <button type="button" onClick={onIrAInicio} className="min-h-11 rounded-[var(--fin-r-control)] px-4 text-[14px] font-semibold text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]">
            Ir al inicio
          </button>
          {confirmado ? (
            <button type="button" onClick={onIrACuenta} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-5 text-[14px] font-semibold text-white shadow-lg shadow-purple-500/20 transition-colors hover:bg-[var(--fin-accent-hover)]">
              Ver mi plan
              <ArrowRight className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
            </button>
          ) : (
            <button type="button" onClick={() => { setEstado('consultando'); setRonda((valor) => valor + 1); }} disabled={revisando} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-5 text-[14px] font-semibold text-white shadow-lg shadow-purple-500/20 transition-colors hover:bg-[var(--fin-accent-hover)] disabled:cursor-wait disabled:opacity-60">
              {revisando ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.3} aria-hidden="true" /> : <RefreshCw className="h-4 w-4" strokeWidth={2.3} aria-hidden="true" />}
              Verificar de nuevo
            </button>
          )}
        </div>
      </motion.section>
    </main>
  );
};
