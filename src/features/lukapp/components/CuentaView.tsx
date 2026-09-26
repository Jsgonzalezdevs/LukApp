import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCw,
  Trash2,
  User,
} from 'lucide-react';
import { apiUrl } from '../../../lib/api';
import { obtenerSupabase } from '../data/supabase';
import { VERSION_ETIQUETA } from '../../../version';
import { validarContrasenaSegura } from '../../../lib/seguridad';
import { beneficiosActivos, type BeneficioPlan } from '../lib/beneficiosPlan';

interface CuentaViewProps {
  userId: string | null;
  cuenta?: { email: string; onSalir: () => void };
  syncError: string | null;
  cambiosPendientes: number;
  onSincronizar: () => Promise<void>;
  /** Reutiliza la compra sin mezclarla con los ajustes de la cuenta. */
  soloPlan?: boolean;
}

interface EstadoPlan {
  codigo: 'normal' | 'premium';
  nombre: string;
  precios: { mensualCop: number; anualCop: number };
  preciosPremium: { mensualCop: number; anualCop: number };
  limites: {
    dictadosMensual: number | null;
    asesorIaMensual: number | null;
    extractosMensual: number | null;
    espaciosCompartidos: number | null;
    integrantesPorEspacio: number | null;
  };
  beneficios: BeneficioPlan[];
  beneficiosPremium: BeneficioPlan[];
  consumo: { dictados: number; asesorIa: number; extractos: number };
  suscripcion: { ciclo: 'mensual' | 'anual' | 'cortesia'; venceEn: string; cancelarAlVencer: boolean } | null;
}

interface CheckoutWompi {
  destino: string;
  campos: Record<string, string>;
}

interface PlanEnCache {
  actualizadoEn: number;
  plan: EstadoPlan;
}

const DURACION_CACHE_PLAN_MS = 5 * 60 * 1000;
// La versión separa la respuesta anterior, que llevaba el precio del plan
// actual y podía conservar $0 para una cuenta Normal en los botones Premium.
const claveCachePlan = (userId: string): string => `lukapp-plan-v3-${userId}`;

const planValido = (valor: unknown): valor is EstadoPlan => {
  if (!valor || typeof valor !== 'object') return false;
  const plan = valor as Partial<EstadoPlan>;
  return (plan.codigo === 'normal' || plan.codigo === 'premium')
    && typeof plan.nombre === 'string'
    && typeof plan.precios?.mensualCop === 'number'
    && typeof plan.precios?.anualCop === 'number'
    && typeof plan.preciosPremium?.mensualCop === 'number'
    && typeof plan.preciosPremium?.anualCop === 'number'
    && Array.isArray(plan.beneficios)
    && Array.isArray(plan.beneficiosPremium);
};

const leerPlanEnCache = (userId: string | null): EstadoPlan | null => {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const guardado = JSON.parse(sessionStorage.getItem(claveCachePlan(userId)) ?? 'null') as PlanEnCache | null;
    if (!guardado || Date.now() - guardado.actualizadoEn > DURACION_CACHE_PLAN_MS || !planValido(guardado.plan)) return null;
    return guardado.plan;
  } catch {
    return null;
  }
};

const guardarPlanEnCache = (userId: string, plan: EstadoPlan): void => {
  try {
    sessionStorage.setItem(claveCachePlan(userId), JSON.stringify({ actualizadoEn: Date.now(), plan } satisfies PlanEnCache));
  } catch {
    // El plan se sigue consultando normalmente si el navegador no deja usar caché de sesión.
  }
};

const pesos = (valor: number): string =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor);

const fechaCorta = (valor: string): string =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'America/Bogota' }).format(new Date(valor));

/** sha256 del userId, recortado a 20 caracteres -- se ve como un ID al azar,
 * pero es el mismo cada vez que se abre esta pantalla en vez de cambiar en
 * cada visita, y no exige guardar nada nuevo: sale del uuid que ya existe.
 *
 * `crypto.subtle` solo existe en contextos seguros (https, o localhost) --
 * null en vez de lanzar cubre a quien prueba la app por http en la red local. */
const idDeCuenta = async (userId: string): Promise<string | null> => {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;
  try {
    const datos = new TextEncoder().encode(userId);
    const hash = await crypto.subtle.digest('SHA-256', datos);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 20);
  } catch {
    return null;
  }
};

const conToken = async <T,>(hacer: (token: string) => Promise<T>): Promise<T> => {
  const cliente = obtenerSupabase();
  const session = cliente ? (await cliente.auth.getSession()).data.session : null;
  if (!session?.access_token) throw new Error('Sesión no disponible');
  return hacer(session.access_token);
};

/**
 * Cuenta: quién eres, si tus datos están al día, y las dos salidas -- cerrar
 * sesión (te vas, todo sigue ahí) y eliminar cuenta (te vas y te llevas todo).
 * Por eso la segunda pide una confirmación aparte que la primera no necesita.
 */
export const CuentaView: React.FC<CuentaViewProps> = ({
  userId,
  cuenta,
  syncError,
  cambiosPendientes,
  onSincronizar,
  soloPlan = false,
}) => {
  const cuentaEmail = cuenta?.email ?? null;
  const [apodo, setApodo] = useState<string | null>(null);
  const [id, setId] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  const [cambiandoPassword, setCambiandoPassword] = useState(false);
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const [errorPassword, setErrorPassword] = useState<string | null>(null);
  const [passwordActualizada, setPasswordActualizada] = useState(false);
  const [plan, setPlan] = useState<EstadoPlan | null>(() => leerPlanEnCache(userId));
  const [cargandoPlan, setCargandoPlan] = useState(() => Boolean(cuentaEmail) && !leerPlanEnCache(userId));
  const [errorPlan, setErrorPlan] = useState<string | null>(null);
  const [pagandoCiclo, setPagandoCiclo] = useState<'mensual' | 'anual' | null>(null);
  const [verificandoPago, setVerificandoPago] = useState(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('id'));

  useEffect(() => {
    if (!userId) return;
    idDeCuenta(userId).then(setId);

    const cliente = obtenerSupabase();
    if (!cliente) return;
    cliente
      .from('perfiles')
      .select('usuario')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => setApodo(data?.usuario ?? null));
  }, [userId]);

  const cargarPlan = useCallback(async () => {
    if (!cuentaEmail || !userId) {
      setPlan(null);
      setCargandoPlan(false);
      return;
    }
    setCargandoPlan(true);
    setErrorPlan(null);
    try {
      const respuesta = await conToken((token) => fetch(apiUrl('/api/mi-plan'), {
        headers: { Authorization: `Bearer ${token}` },
      }));
      const cuerpo = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(cuerpo.error || 'No se pudo consultar tu plan.');
      const siguientePlan = cuerpo as EstadoPlan;
      setPlan(siguientePlan);
      guardarPlanEnCache(userId, siguientePlan);
      setErrorPlan(null);
    } catch (error) {
      setErrorPlan(error instanceof Error ? error.message : 'No se pudo consultar tu plan.');
    } finally {
      setCargandoPlan(false);
    }
  }, [cuentaEmail, userId]);

  useEffect(() => { void cargarPlan(); }, [cargarPlan]);

  useEffect(() => {
    if (!cuentaEmail) return undefined;
    const actualizarAlVolver = () => void cargarPlan();
    const intervalo = window.setInterval(actualizarAlVolver, 30_000);
    window.addEventListener('focus', actualizarAlVolver);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener('focus', actualizarAlVolver);
    };
  }, [cuentaEmail, cargarPlan]);

  // Wompi puede redirigir antes de que su webhook termine. Mientras espera, la
  // persona ve una confirmación honesta y esta vista consulta su plan durante
  // un minuto; jamás toma el `id` de la URL como prueba de que se pagó.
  useEffect(() => {
    if (!verificandoPago) return undefined;
    if (plan?.codigo === 'premium') {
      setVerificandoPago(false);
      return undefined;
    }
    const intervalo = window.setInterval(() => void cargarPlan(), 5000);
    const limite = window.setTimeout(() => setVerificandoPago(false), 60000);
    return () => {
      window.clearInterval(intervalo);
      window.clearTimeout(limite);
    };
  }, [verificandoPago, plan?.codigo, cargarPlan]);

  const iniciarCheckoutWompi = async (ciclo: 'mensual' | 'anual') => {
    setPagandoCiclo(ciclo);
    setErrorPlan(null);
    try {
      const respuesta = await conToken((token) => fetch(apiUrl('/api/pagos/wompi/checkout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ciclo }),
      }));
      const cuerpo = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(cuerpo.error || 'No se pudo iniciar el pago.');
      const checkout = cuerpo as Partial<CheckoutWompi>;
      if (checkout.destino !== 'https://checkout.wompi.co/p/' || !checkout.campos
        || Object.values(checkout.campos).some((valor) => typeof valor !== 'string')) {
        throw new Error('La respuesta del checkout no es válida.');
      }

      // Un formulario GET conserva el contrato oficial de Web Checkout y evita
      // que el frontend conozca el secreto usado para firmar estos campos.
      const formulario = document.createElement('form');
      formulario.method = 'GET';
      formulario.action = checkout.destino;
      for (const [nombre, valor] of Object.entries(checkout.campos)) {
        const campo = document.createElement('input');
        campo.type = 'hidden';
        campo.name = nombre;
        campo.value = valor;
        formulario.append(campo);
      }
      document.body.append(formulario);
      formulario.submit();
    } catch (error) {
      setErrorPlan(error instanceof Error ? error.message : 'No se pudo iniciar el pago.');
      setPagandoCiclo(null);
    }
  };

  const copiarId = async () => {
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles, el id sigue visible para copiarlo a mano.
    }
  };

  const sincronizar = async () => {
    setSincronizando(true);
    try {
      await onSincronizar();
    } finally {
      setSincronizando(false);
    }
  };

  const restablecerPassword = async () => {
    setErrorPassword(null);
    const errorSeguridad = validarContrasenaSegura(nuevaPassword, [apodo, cuenta?.email]);
    if (errorSeguridad) {
      setErrorPassword(errorSeguridad);
      return;
    }
    if (nuevaPassword !== confirmarPassword) {
      setErrorPassword('Las contraseñas no coinciden.');
      return;
    }
    setGuardandoPassword(true);
    try {
      const cliente = obtenerSupabase();
      if (!cliente) throw new Error('No se pudo conectar con el servidor.');
      const { error } = await cliente.auth.updateUser({ password: nuevaPassword });
      if (error) throw new Error(error.message || 'No se pudo cambiar la contraseña.');
      setNuevaPassword('');
      setConfirmarPassword('');
      setCambiandoPassword(false);
      setPasswordActualizada(true);
      setTimeout(() => setPasswordActualizada(false), 4000);
    } catch (e) {
      setErrorPassword(e instanceof Error ? e.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setGuardandoPassword(false);
    }
  };

  const eliminarCuenta = async () => {
    setEliminando(true);
    setErrorEliminar(null);
    try {
      await conToken(async (token) => {
        const res = await fetch(apiUrl('/api/mi-cuenta/eliminar'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'No se pudo eliminar la cuenta.');
        }
      });
      // La sesión ya no vale nada del lado del servidor -- salir y recargar
      // en la raíz es más confiable que confiar en que el estado local se
      // entere solo de que la cuenta detrás de él ya no existe.
      cuenta?.onSalir();
      window.location.href = '/';
    } catch (e) {
      setErrorEliminar(e instanceof Error ? e.message : 'No se pudo eliminar la cuenta.');
      setEliminando(false);
    }
  };

  const estadoSync = syncError
    ? { texto: 'Hubo un problema al sincronizar', color: 'var(--fin-out)' }
    : cambiosPendientes > 0
      ? { texto: `${cambiosPendientes} cambio${cambiosPendientes === 1 ? '' : 's'} por subir`, color: '#f59e0b' }
      : { texto: 'Todo bien', color: 'var(--fin-in)' };

  return (
    <section className={`flex flex-col gap-4 ${soloPlan ? '[&>:not([data-plan-premium])]:hidden' : ''}`}>
      <div className="flex items-center gap-3 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]">
          <User className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold text-[var(--fin-ink)]">
            {apodo || cuenta?.email || 'Tu cuenta'}
          </p>
          {apodo ? (
            <p className="truncate text-[14px] text-[var(--fin-ink-soft)]">{cuenta?.email}</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
        <p className="mb-1.5 text-[13px] font-semibold text-[var(--fin-ink-soft)]">ID de cuenta</p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-2.5 text-[13px] text-[var(--fin-ink)]">
            {id ?? '—'}
          </code>
          <button
            type="button"
            onClick={() => void copiarId()}
            disabled={!id}
            className="flex shrink-0 items-center gap-1.5 rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] px-3 py-2 text-[13px] font-semibold text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-card-hover)] disabled:opacity-50"
            aria-label="Copiar ID de cuenta"
          >
            {copiado ? (
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
            )}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>

      {cuentaEmail ? (
        <section data-plan-premium className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4" aria-live="polite">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-accent)]">
              <CreditCard className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-[var(--fin-ink)]">Tu plan</p>
              {cargandoPlan && !plan ? (
                <p className="mt-1 text-[13px] text-[var(--fin-ink-soft)]">Consultando tus beneficios…</p>
              ) : plan ? (
                <>
                  <p className="mt-0.5 text-[14px] text-[var(--fin-ink-soft)]">
                    {plan.codigo === 'premium'
                      ? `Premium${plan.suscripcion ? ` hasta ${fechaCorta(plan.suscripcion.venceEn)}` : ''}`
                      : 'Normal — gratis para siempre'}
                  </p>
                  <div className="mt-2">
                    <p className="text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
                      {plan.codigo === 'premium'
                        ? 'Estas son las prestaciones activas de tu Premium ahora mismo.'
                        : 'Estas son las prestaciones activas de tu plan Normal.'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Prestaciones incluidas">
                      {beneficiosActivos(plan.beneficios).map((beneficio) => (
                        <span key={beneficio.clave} className="rounded-full bg-[var(--fin-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--fin-ink-soft)]">{beneficio.titulo}</span>
                      ))}
                    </div>
                  </div>
                  {plan.codigo === 'premium' ? null : (
                    <>
                      <p className="mt-2 text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
                        Premium incluye {beneficiosActivos(plan.beneficiosPremium).length} prestaciones configuradas actualmente, con los precios que ves abajo.
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => void iniciarCheckoutWompi('mensual')}
                          disabled={pagandoCiclo !== null}
                          className="flex min-h-11 items-center justify-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-3 py-2.5 text-[14px] font-semibold text-[var(--fin-on-accent)] disabled:opacity-60"
                        >
                          {pagandoCiclo === 'mensual' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Premium mensual · {pesos(plan.preciosPremium.mensualCop)}
                        </button>
                        <button
                          type="button"
                          onClick={() => void iniciarCheckoutWompi('anual')}
                          disabled={pagandoCiclo !== null}
                          className="flex min-h-11 items-center justify-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] px-3 py-2.5 text-[14px] font-semibold text-[var(--fin-ink)] disabled:opacity-60"
                        >
                          {pagandoCiclo === 'anual' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Premium anual · {pesos(plan.preciosPremium.anualCop)}
                        </button>
                      </div>
                    </>
                  )}
                </>
              ) : null}
              {verificandoPago && plan?.codigo !== 'premium' ? (
                <p className="mt-3 text-[13px] font-semibold text-[var(--fin-accent)]">
                  Estamos verificando tu pago con Wompi. Esto puede tardar unos segundos.
                </p>
              ) : null}
              {errorPlan ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <p className="text-[13px] font-semibold text-[var(--fin-out-ink)]">{errorPlan}</p>
                  <button type="button" onClick={() => void cargarPlan()} className="text-[13px] font-semibold text-[var(--fin-accent)] underline">Reintentar</button>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <div
        className="flex items-center justify-between gap-3 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4"
        role="status"
        aria-live="polite"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="h-2 w-2 shrink-0 rounded-[var(--fin-r-pill)]"
            style={{ backgroundColor: estadoSync.color }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[var(--fin-ink-soft)]">Sincronización</p>
            <p className="truncate text-[15px] font-semibold text-[var(--fin-ink)]">{estadoSync.texto}</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--fin-ink-faint)]">
              {syncError
                ? 'Puedes reintentar ahora. Lo que ya ves en pantalla permanece en este dispositivo.'
                : cambiosPendientes > 0
                  ? 'Tus cambios locales siguen disponibles y se subirán automáticamente.'
                  : 'Tus datos locales y los de tu cuenta están al día.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void sincronizar()}
          disabled={sincronizando}
          className="flex shrink-0 items-center gap-1.5 rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] px-3.5 py-2 text-[13px] font-semibold text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-card-hover)] disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${sincronizando ? 'animate-spin' : ''}`} strokeWidth={2.5} aria-hidden="true" />
          Sincronizar
        </button>
      </div>

      {cuenta ? (
        <button
          type="button"
          onClick={cuenta.onSalir}
          className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] px-4 py-3.5 text-left text-[17px] font-semibold text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-soft)]"
        >
          Cerrar sesión
        </button>
      ) : null}

      {cuenta ? (
        <div className="flex flex-col gap-2.5">
          {!cambiandoPassword ? (
            <button
              type="button"
              onClick={() => {
                setCambiandoPassword(true);
                setErrorPassword(null);
              }}
              className="flex items-center gap-2.5 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] px-4 py-3.5 text-left text-[17px] font-semibold text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-soft)]"
            >
              <KeyRound className="h-4 w-4 shrink-0 text-[var(--fin-accent)]" strokeWidth={2.5} aria-hidden="true" />
              Restablecer contraseña
              {passwordActualizada ? (
                <span className="ml-auto flex items-center gap-1 text-[13px] font-semibold text-[var(--fin-in)]">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  Actualizada
                </span>
              ) : null}
            </button>
          ) : (
            <div className="flex flex-col gap-3 rounded-[var(--fin-r-card)] border border-[var(--fin-accent)]/25 bg-[var(--fin-card)] p-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 shrink-0 text-[var(--fin-accent)]" strokeWidth={2.5} aria-hidden="true" />
                <p className="text-[15px] font-semibold text-[var(--fin-ink)]">Nueva contraseña</p>
              </div>

              <div className="relative">
                <input
                  type={verPassword ? 'text' : 'password'}
                  value={nuevaPassword}
                  onChange={(e) => setNuevaPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                  disabled={guardandoPassword}
                  className="w-full rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-2.5 pr-10 text-[16px] text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--fin-accent)]/30"
                />
                <button
                  type="button"
                  onClick={() => setVerPassword((v) => !v)}
                  aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--fin-ink-faint)] hover:text-[var(--fin-ink)]"
                >
                  {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <input
                type={verPassword ? 'text' : 'password'}
                value={confirmarPassword}
                onChange={(e) => setConfirmarPassword(e.target.value)}
                placeholder="Confirmar contraseña"
                autoComplete="new-password"
                disabled={guardandoPassword}
                className="w-full rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-2.5 text-[16px] text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--fin-accent)]/30"
              />

              {errorPassword ? (
                <p className="text-[13px] font-semibold text-[var(--fin-out-ink)]">{errorPassword}</p>
              ) : null}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCambiandoPassword(false);
                    setNuevaPassword('');
                    setConfirmarPassword('');
                    setErrorPassword(null);
                  }}
                  disabled={guardandoPassword}
                  className="flex-1 rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] px-4 py-2.5 text-[15px] font-semibold text-[var(--fin-ink)] disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void restablecerPassword()}
                  disabled={guardandoPassword}
                  className="flex flex-1 items-center justify-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-4 py-2.5 text-[15px] font-semibold text-[var(--fin-on-accent)] disabled:opacity-60"
                >
                  {guardandoPassword ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} /> : null}
                  {guardandoPassword ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {cuenta ? (
      <div className="mt-2 flex flex-col gap-2.5">
        <p className="px-1 text-[13px] font-semibold text-[var(--fin-ink-faint)]">Zona de riesgo</p>
        {!confirmando ? (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="flex items-center gap-2 rounded-[var(--fin-r-card)] bg-[var(--fin-out-bg)] px-4 py-3.5 text-left text-[17px] font-semibold text-[var(--fin-out-ink)] transition-colors hover:opacity-90"
          >
            <Trash2 className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
            Eliminar cuenta
          </button>
        ) : (
          <div className="flex flex-col gap-3 rounded-[var(--fin-r-card)] border border-[var(--fin-out)]/40 bg-[var(--fin-out-bg)] p-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fin-out-ink)]" strokeWidth={2.5} aria-hidden="true" />
              <p className="text-[14px] leading-relaxed text-[var(--fin-out-ink)]">
                Esto borra tu cuenta y todos tus datos para siempre: movimientos, cuentas, metas,
                categorías propias. No se puede deshacer.
              </p>
            </div>
            {errorEliminar ? (
              <p className="text-[13px] font-semibold text-[var(--fin-out-ink)]">{errorEliminar}</p>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmando(false);
                  setErrorEliminar(null);
                }}
                disabled={eliminando}
                className="flex-1 rounded-[var(--fin-r-control)] bg-[var(--fin-card)] px-4 py-2.5 text-[15px] font-semibold text-[var(--fin-ink)] disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void eliminarCuenta()}
                disabled={eliminando}
                className="flex flex-1 items-center justify-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-out)] px-4 py-2.5 text-[15px] font-semibold text-white disabled:opacity-60"
              >
                {eliminando ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} /> : null}
                {eliminando ? 'Eliminando…' : 'Sí, eliminar mi cuenta'}
              </button>
            </div>
          </div>
        )}
      </div>
      ) : null}

      {/* La versión, al pie. Es el sitio donde alguien la va a buscar cuando
          reporte un problema: "estoy en la v1.0.0" ahorra media conversación. */}
      <p className="pt-2 text-center text-[12px] text-[var(--fin-ink-faint)]">
        LukApp {VERSION_ETIQUETA}
      </p>
    </section>
  );
};
