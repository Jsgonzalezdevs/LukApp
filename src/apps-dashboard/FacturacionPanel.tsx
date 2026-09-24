import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, CreditCard, Loader2, Pencil, RefreshCw, Save, ShieldCheck, UserPlus, XCircle } from 'lucide-react';
import { obtenerSupabase } from '../features/lukapp/data/supabase';
import type { BeneficioPlan, ClaveBeneficioPlan } from '../features/lukapp/lib/beneficiosPlan';
import { apiUrl } from '../lib/api';

type CodigoPlan = 'normal' | 'premium';

interface PlanServidor {
  codigo: CodigoPlan;
  nombre: string;
  precio_mensual_cop: number;
  precio_anual_cop: number;
  limite_dictados_mensual: number | null;
  limite_asesor_ia_mensual: number | null;
  limite_extractos_mensual: number | null;
  limite_espacios_compartidos: number | null;
  limite_integrantes_por_espacio: number | null;
  activo: boolean;
  actualizado_en: string;
  beneficios: BeneficioPlan[];
}

interface FormaPlan {
  precioMensualCop: string;
  precioAnualCop: string;
  limiteDictadosMensual: string;
  limiteAsesorIaMensual: string;
  limiteExtractosMensual: string;
  limiteEspaciosCompartidos: string;
  limiteIntegrantesPorEspacio: string;
  activo: boolean;
  beneficios: Record<ClaveBeneficioPlan, boolean>;
}

type CampoForma = Exclude<keyof FormaPlan, 'beneficios'>;

interface SuscripcionActiva {
  id: number;
  user_id: string;
  ciclo: 'mensual' | 'anual' | 'cortesia';
  origen: 'manual' | 'pasarela';
  vence_en: string;
  cancelar_al_vencer: boolean;
  usuario: { email: string; usuario: string | null } | null;
}

interface RespuestaFacturacion {
  planes: PlanServidor[];
  resumen: {
    premiumActivas: number;
    mensuales: number;
    anuales: number;
    cortesia: number;
    estimadoMensualCop: number;
  };
  puedeAdministrar: boolean;
  pasarela: { codigo: 'wompi'; habilitada: boolean; ambiente: 'test' | 'prod' | null };
  suscripciones: SuscripcionActiva[];
  usuarios: Array<{ id: string; email: string; usuario: string | null }>;
}

const pesos = (valor: number): string =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(valor);

const fechaCorta = (valor: string): string =>
  new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'America/Bogota' }).format(new Date(valor));

const fechaParaCampo = (valor: string): string => {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(valor));
  const parte = (tipo: Intl.DateTimeFormatPartTypes): string => partes.find((item) => item.type === tipo)?.value || '';
  return `${parte('year')}-${parte('month')}-${parte('day')}`;
};

const aForma = (plan: PlanServidor): FormaPlan => ({
  precioMensualCop: String(Number(plan.precio_mensual_cop)),
  precioAnualCop: String(Number(plan.precio_anual_cop)),
  limiteDictadosMensual: plan.limite_dictados_mensual === null ? '' : String(plan.limite_dictados_mensual),
  limiteAsesorIaMensual: plan.limite_asesor_ia_mensual === null ? '' : String(plan.limite_asesor_ia_mensual),
  limiteExtractosMensual: plan.limite_extractos_mensual === null ? '' : String(plan.limite_extractos_mensual),
  limiteEspaciosCompartidos: plan.limite_espacios_compartidos === null ? '' : String(plan.limite_espacios_compartidos),
  limiteIntegrantesPorEspacio: plan.limite_integrantes_por_espacio === null ? '' : String(plan.limite_integrantes_por_espacio),
  activo: plan.activo,
  beneficios: Object.fromEntries(plan.beneficios.map((beneficio) => [beneficio.clave, beneficio.activo])) as Record<ClaveBeneficioPlan, boolean>,
});

const numeroPositivoOInfinito = (valor: string, etiqueta: string): number | null => {
  if (valor.trim() === '') return null;
  if (!/^\d+$/.test(valor) || Number(valor) < 1) throw new Error(`${etiqueta} debe ser un entero mayor que cero o dejarse vacío para ilimitado.`);
  return Number(valor);
};

const precioEntero = (valor: string, etiqueta: string): number => {
  if (!/^\d+$/.test(valor) || Number(valor) < 0) throw new Error(`${etiqueta} debe ser un valor entero en pesos colombianos.`);
  return Number(valor);
};

const etiquetaCiclo = (ciclo: SuscripcionActiva['ciclo']): string =>
  ciclo === 'cortesia' ? 'Cortesía' : ciclo === 'anual' ? 'Anual' : 'Mensual';

export const FacturacionPanel: React.FC = () => {
  const [datos, setDatos] = useState<RespuestaFacturacion | null>(null);
  const [formas, setFormas] = useState<Partial<Record<CodigoPlan, FormaPlan>>>({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<CodigoPlan | null>(null);
  const [otorgando, setOtorgando] = useState(false);
  const [cancelando, setCancelando] = useState<number | null>(null);
  const [suscripcionEditando, setSuscripcionEditando] = useState<SuscripcionActiva | null>(null);
  const [venceEnEdicion, setVenceEnEdicion] = useState('');
  const [notaEdicion, setNotaEdicion] = useState('');
  const [actualizandoSuscripcion, setActualizandoSuscripcion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState('');
  const [venceEn, setVenceEn] = useState('');
  const [nota, setNota] = useState('');

  const tokenSesion = async (): Promise<string> => {
    const cliente = obtenerSupabase();
    if (!cliente) throw new Error('No hay una sesión de Supabase configurada.');
    const { data: { session } } = await cliente.auth.getSession();
    if (!session) throw new Error('No hay una sesión activa.');
    return session.access_token;
  };

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const token = await tokenSesion();
      const respuesta = await fetch(apiUrl('/api/superadmin/facturacion'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const cuerpo = await respuesta.json();
      if (!respuesta.ok) throw new Error(cuerpo.error || 'No se pudo cargar la facturación.');
      const siguiente = cuerpo as RespuestaFacturacion;
      setDatos(siguiente);
      setFormas(Object.fromEntries(siguiente.planes.map((plan) => [plan.codigo, aForma(plan)])));
    } catch (causa: any) {
      setDatos(null);
      setError(causa?.message || 'No se pudo cargar la facturación.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  const premium = useMemo(() => datos?.planes.find((plan) => plan.codigo === 'premium') ?? null, [datos]);

  const actualizarForma = (codigo: CodigoPlan, campo: CampoForma, valor: string | boolean) => {
    setFormas((actual) => ({
      ...actual,
      [codigo]: { ...(actual[codigo] ?? aForma(datos!.planes.find((plan) => plan.codigo === codigo)!)), [campo]: valor },
    }));
  };

  const actualizarBeneficio = (codigo: CodigoPlan, clave: ClaveBeneficioPlan, activo: boolean) => {
    setFormas((actual) => {
      const forma = actual[codigo] ?? aForma(datos!.planes.find((plan) => plan.codigo === codigo)!);
      const beneficios = { ...forma.beneficios, [clave]: activo };
      if (clave === 'espacios_compartidos' && !activo) beneficios.integrantes_espacio = false;
      if (clave === 'asesor_ia' && !activo) beneficios.pulso_premium = false;
      return { ...actual, [codigo]: { ...forma, beneficios } };
    });
  };

  const guardarPlan = async (codigo: CodigoPlan) => {
    const forma = formas[codigo];
    if (!forma) return;
    setGuardando(codigo);
    setError(null);
    setAviso(null);
    try {
      const token = await tokenSesion();
      const respuesta = await fetch(apiUrl(`/api/superadmin/planes/${codigo}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          precioMensualCop: precioEntero(forma.precioMensualCop, 'El precio mensual'),
          precioAnualCop: precioEntero(forma.precioAnualCop, 'El precio anual'),
          limiteDictadosMensual: numeroPositivoOInfinito(forma.limiteDictadosMensual, 'El límite de dictados'),
          limiteAsesorIaMensual: numeroPositivoOInfinito(forma.limiteAsesorIaMensual, 'El límite del Asesor IA'),
          limiteExtractosMensual: numeroPositivoOInfinito(forma.limiteExtractosMensual, 'El límite de extractos'),
          limiteEspaciosCompartidos: numeroPositivoOInfinito(forma.limiteEspaciosCompartidos, 'El límite de espacios'),
          limiteIntegrantesPorEspacio: numeroPositivoOInfinito(forma.limiteIntegrantesPorEspacio, 'El límite de integrantes'),
          activo: forma.activo,
          beneficios: forma.beneficios,
        }),
      });
      const cuerpo = await respuesta.json();
      if (!respuesta.ok) throw new Error(cuerpo.error || 'No se pudo guardar el plan.');
      setAviso(`El plan ${codigo === 'normal' ? 'Normal' : 'Premium'} quedó actualizado.`);
      await cargar();
    } catch (causa: any) {
      setError(causa?.message || 'No se pudo guardar el plan.');
    } finally {
      setGuardando(null);
    }
  };

  const otorgarPremium = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!usuarioSeleccionado || !venceEn) {
      setError('Elige una persona y la fecha de vencimiento.');
      return;
    }
    setOtorgando(true);
    setError(null);
    setAviso(null);
    try {
      const token = await tokenSesion();
      const respuesta = await fetch(apiUrl('/api/superadmin/suscripciones/otorgar'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          userId: usuarioSeleccionado,
          venceEn: new Date(`${venceEn}T23:59:59-05:00`).toISOString(),
          nota,
        }),
      });
      const cuerpo = await respuesta.json();
      if (!respuesta.ok) throw new Error(cuerpo.error || 'No se pudo otorgar Premium.');
      setUsuarioSeleccionado('');
      setVenceEn('');
      setNota('');
      setAviso('Premium de cortesía otorgado y registrado en la auditoría.');
      await cargar();
    } catch (causa: any) {
      setError(causa?.message || 'No se pudo otorgar Premium.');
    } finally {
      setOtorgando(false);
    }
  };

  const cancelarPremium = async (suscripcion: SuscripcionActiva) => {
    const persona = suscripcion.usuario?.usuario || suscripcion.usuario?.email || 'esta cuenta';
    if (!window.confirm(`¿Retirar Premium para ${persona} ahora? Esto cambia su acceso a Normal, pero no reembolsa ni borra el pago registrado en Wompi.`)) return;
    setCancelando(suscripcion.id);
    setError(null);
    setAviso(null);
    try {
      const token = await tokenSesion();
      const respuesta = await fetch(apiUrl(`/api/superadmin/suscripciones/${suscripcion.id}/cancelar`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nota: 'Cancelada desde el panel de superadmin.' }),
      });
      const cuerpo = await respuesta.json();
      if (!respuesta.ok) throw new Error(cuerpo.error || 'No se pudo cancelar Premium.');
      setAviso('Premium se retiró y la cuenta volvió al plan Normal. El pago histórico se conserva para conciliación.');
      await cargar();
    } catch (causa: any) {
      setError(causa?.message || 'No se pudo cancelar Premium.');
    } finally {
      setCancelando(null);
    }
  };

  const abrirEdicion = (suscripcion: SuscripcionActiva) => {
    setSuscripcionEditando(suscripcion);
    setVenceEnEdicion(fechaParaCampo(suscripcion.vence_en));
    setNotaEdicion('');
    setError(null);
    setAviso(null);
  };

  const guardarVigencia = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!suscripcionEditando || !venceEnEdicion) return;
    setActualizandoSuscripcion(true);
    setError(null);
    setAviso(null);
    try {
      const token = await tokenSesion();
      const respuesta = await fetch(apiUrl(`/api/superadmin/suscripciones/${suscripcionEditando.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          venceEn: new Date(`${venceEnEdicion}T23:59:59-05:00`).toISOString(),
          nota: notaEdicion,
        }),
      });
      const cuerpo = await respuesta.json();
      if (!respuesta.ok) throw new Error(cuerpo.error || 'No se pudo actualizar la vigencia de Premium.');
      setSuscripcionEditando(null);
      setAviso('La vigencia de Premium se actualizó y quedó registrada en la auditoría.');
      await cargar();
    } catch (causa: any) {
      setError(causa?.message || 'No se pudo actualizar la vigencia de Premium.');
    } finally {
      setActualizandoSuscripcion(false);
    }
  };

  if (cargando && !datos) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[var(--fin-ink-faint)]" /></div>;
  }

  if (!datos) {
    return (
      <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6">
        <h2 className="text-lg font-extrabold text-[var(--fin-ink)]">No se pudo abrir la facturación</h2>
        <p className="mt-1 text-sm text-[var(--fin-ink-soft)]">{error || 'Inténtalo de nuevo.'}</p>
        <button onClick={() => void cargar()} className="mt-4 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700">Reintentar</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Planes y facturación</h2>
          <p className="mt-1 text-xs text-[var(--fin-ink-soft)]">
            Dos planes: Normal gratuito y Premium. Los cobros de la pasarela se conectan aquí sin exponer datos de pago.
          </p>
        </div>
        <button onClick={() => void cargar()} className="flex items-center justify-center gap-2 rounded-xl border border-[var(--fin-line)] bg-[var(--fin-card)] px-3.5 py-2 text-xs font-bold text-[var(--fin-ink)] hover:bg-[var(--fin-soft)]">
          <RefreshCw className={`h-3.5 w-3.5 ${cargando ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-700 dark:text-red-300">{error}</p>}
      {aviso && <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{aviso}</p>}

      <section className={`flex items-start gap-3 rounded-2xl border p-4 ${datos.pasarela.habilitada ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
        {datos.pasarela.habilitada ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
        <div>
          <p className="text-sm font-extrabold text-[var(--fin-ink)]">Wompi {datos.pasarela.habilitada ? 'está listo para recibir pagos' : 'todavía no está configurado'}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--fin-ink-soft)]">
            {datos.pasarela.habilitada
              ? `Ambiente activo: ${datos.pasarela.ambiente === 'prod' ? 'producción' : 'sandbox'}. Premium se activa únicamente después del webhook firmado.`
              : 'Faltan las variables privadas de Wompi o la URL HTTPS de redirección en Render. Revisa la guía de Freemium y pagos antes de cobrar.'}
          </p>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta titulo="Premium activos" valor={String(datos.resumen.premiumActivas)} detalle="vigentes ahora" icono={<CreditCard className="h-4 w-4 text-purple-500" />} />
        <Tarjeta titulo="Ciclo mensual" valor={String(datos.resumen.mensuales)} detalle="suscripciones activas" icono={<CheckCircle2 className="h-4 w-4 text-sky-500" />} />
        <Tarjeta titulo="Ciclo anual" valor={String(datos.resumen.anuales)} detalle="suscripciones activas" icono={<ShieldCheck className="h-4 w-4 text-emerald-500" />} />
        <Tarjeta titulo="Ingreso mensual estimado" valor={pesos(datos.resumen.estimadoMensualCop)} detalle={`${datos.resumen.cortesia} cortesía sin cobro`} icono={<CreditCard className="h-4 w-4 text-amber-500" />} />
      </div>

      {datos.puedeAdministrar ? (
        <>
          <section className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm sm:p-6">
            <h3 className="text-base font-extrabold">Configuración de los dos planes</h3>
            <p className="mt-1 text-xs text-[var(--fin-ink-soft)]">Un campo de límite vacío significa ilimitado. Normal se mantiene gratis siempre.</p>
            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              {(['normal', 'premium'] as const).map((codigo) => {
                const forma = formas[codigo];
                if (!forma) return null;
                const plan = datos.planes.find((candidato) => candidato.codigo === codigo)!;
                return <FormularioPlan key={codigo} codigo={codigo} forma={forma} beneficios={plan.beneficios} guardando={guardando === codigo} alCambiar={(campo, valor) => actualizarForma(codigo, campo, valor)} alCambiarBeneficio={(clave, activo) => actualizarBeneficio(codigo, clave, activo)} alGuardar={() => void guardarPlan(codigo)} />;
              })}
            </div>
          </section>

          <section className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <form onSubmit={otorgarPremium} className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2"><UserPlus className="h-4 w-4 text-purple-500" /><h3 className="text-base font-extrabold">Otorgar Premium de cortesía</h3></div>
              <p className="mt-1 text-xs text-[var(--fin-ink-soft)]">Solo el superadmin fijo puede dar o retirar beneficios manualmente.</p>
              <label className="mt-4 block text-xs font-bold text-[var(--fin-ink-soft)]">Cuenta
                <select value={usuarioSeleccionado} onChange={(evento) => setUsuarioSeleccionado(evento.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--fin-line)] bg-[var(--fin-soft)] px-3 py-2.5 text-[16px] text-[var(--fin-ink)] sm:text-sm">
                  <option value="">Selecciona una persona</option>
                  {datos.usuarios.map((usuario) => <option key={usuario.id} value={usuario.id}>{usuario.usuario ? `${usuario.usuario} — ${usuario.email}` : usuario.email}</option>)}
                </select>
              </label>
              <label className="mt-3 block text-xs font-bold text-[var(--fin-ink-soft)]">Vence el
                <input required type="date" value={venceEn} onChange={(evento) => setVenceEn(evento.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--fin-line)] bg-[var(--fin-soft)] px-3 py-2.5 text-[16px] text-[var(--fin-ink)] sm:text-sm" />
              </label>
              <label className="mt-3 block text-xs font-bold text-[var(--fin-ink-soft)]">Nota interna opcional
                <textarea value={nota} maxLength={280} onChange={(evento) => setNota(evento.target.value)} rows={2} className="mt-1.5 w-full resize-none rounded-xl border border-[var(--fin-line)] bg-[var(--fin-soft)] px-3 py-2.5 text-[16px] text-[var(--fin-ink)] sm:text-sm" />
              </label>
              <button disabled={otorgando} type="submit" className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-60">
                {otorgando ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Otorgar Premium
              </button>
            </form>

            <div className="overflow-hidden rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] shadow-sm">
              <div className="border-b border-[var(--fin-line)] p-5 sm:px-6">
                <h3 className="text-base font-extrabold">Premium vigente</h3>
                <p className="mt-1 text-xs text-[var(--fin-ink-soft)]">Puedes ajustar la vigencia o retirar el acceso de cualquier cuenta. El cobro y su referencia de Wompi se conservan.</p>
              </div>
              {datos.suscripciones.length === 0 ? <p className="p-8 text-center text-sm text-[var(--fin-ink-faint)]">Todavía no hay suscripciones Premium vigentes.</p> : (
                <div className="divide-y divide-[var(--fin-line)]">
                  {datos.suscripciones.map((suscripcion) => {
                    const estaEditando = suscripcionEditando?.id === suscripcion.id;
                    return (
                      <div key={suscripcion.id} className="p-4 sm:px-6">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-bold">{suscripcion.usuario?.usuario || suscripcion.usuario?.email || 'Cuenta eliminada'}</p>
                            <p className="mt-0.5 text-xs text-[var(--fin-ink-soft)]">{etiquetaCiclo(suscripcion.ciclo)} · vence {fechaCorta(suscripcion.vence_en)}{suscripcion.origen === 'pasarela' ? ' · pago confirmado por Wompi' : ' · cortesía'}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => abrirEdicion(suscripcion)} className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--fin-line)] px-3 py-2 text-xs font-bold text-[var(--fin-ink)] hover:bg-[var(--fin-soft)]">
                              <Pencil className="h-3.5 w-3.5" /> Editar vigencia
                            </button>
                            <button disabled={cancelando === suscripcion.id} onClick={() => void cancelarPremium(suscripcion)} className="flex items-center justify-center gap-1.5 rounded-xl border border-red-500/30 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-500/10 disabled:opacity-60 dark:text-red-300">
                              {cancelando === suscripcion.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />} Retirar Premium
                            </button>
                          </div>
                        </div>
                        {estaEditando && (
                          <form onSubmit={guardarVigencia} className="mt-4 rounded-2xl border border-purple-500/25 bg-purple-500/5 p-4">
                            <p className="text-xs font-bold text-[var(--fin-ink)]">Modificar acceso Premium</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-[var(--fin-ink-soft)]">El ciclo y el valor del pago no cambian aquí; ajusta solo hasta cuándo tendrá acceso la cuenta.</p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
                              <label className="block text-xs font-bold text-[var(--fin-ink-soft)]">Nueva fecha de vencimiento
                                <input required type="date" value={venceEnEdicion} onChange={(evento) => setVenceEnEdicion(evento.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-2 text-[16px] text-[var(--fin-ink)] sm:text-sm" />
                              </label>
                              <label className="block text-xs font-bold text-[var(--fin-ink-soft)]">Nota interna opcional
                                <input maxLength={280} value={notaEdicion} onChange={(evento) => setNotaEdicion(evento.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-2 text-[16px] text-[var(--fin-ink)] sm:text-sm" />
                              </label>
                            </div>
                            <div className="mt-3 flex flex-wrap justify-end gap-2">
                              <button type="button" onClick={() => setSuscripcionEditando(null)} className="rounded-xl px-3 py-2 text-xs font-bold text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)]">Cancelar</button>
                              <button disabled={actualizandoSuscripcion} type="submit" className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-60">
                                {actualizandoSuscripcion ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Guardar vigencia
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        <section className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 text-sm text-[var(--fin-ink-soft)]">
          Tienes permiso para ver el resumen, no para modificar precios ni beneficios. La administración de planes queda reservada al superadmin fijo.
        </section>
      )}

      {premium && <p className="text-center text-[11px] text-[var(--fin-ink-faint)]">Precio vigente Premium: {pesos(Number(premium.precio_mensual_cop))}/mes o {pesos(Number(premium.precio_anual_cop))}/año. La pasarela se debe activar después de probar su webhook en sandbox.</p>}
    </div>
  );
};

const Tarjeta: React.FC<{ titulo: string; valor: string; detalle: string; icono: React.ReactNode }> = ({ titulo, valor, detalle, icono }) => (
  <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm">
    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]"><span>{titulo}</span>{icono}</div>
    <p className="mt-3 text-2xl font-extrabold tracking-tight text-[var(--fin-ink)]">{valor}</p>
    <p className="mt-1 text-[11px] text-[var(--fin-ink-soft)]">{detalle}</p>
  </div>
);

const FormularioPlan: React.FC<{
  codigo: CodigoPlan;
  forma: FormaPlan;
  beneficios: BeneficioPlan[];
  guardando: boolean;
  alCambiar: (campo: CampoForma, valor: string | boolean) => void;
  alCambiarBeneficio: (clave: ClaveBeneficioPlan, activo: boolean) => void;
  alGuardar: () => void;
}> = ({ codigo, forma, beneficios, guardando, alCambiar, alCambiarBeneficio, alGuardar }) => {
  const normal = codigo === 'normal';
  const campos: Array<{ campo: keyof Pick<FormaPlan, 'limiteDictadosMensual' | 'limiteAsesorIaMensual' | 'limiteExtractosMensual' | 'limiteEspaciosCompartidos' | 'limiteIntegrantesPorEspacio'>; etiqueta: string }> = [
    { campo: 'limiteDictadosMensual', etiqueta: 'Registros por voz / mes' },
    { campo: 'limiteAsesorIaMensual', etiqueta: 'Consultas Asesor IA / mes' },
    { campo: 'limiteExtractosMensual', etiqueta: 'Extractos PDF / mes' },
    { campo: 'limiteEspaciosCompartidos', etiqueta: 'Espacios compartidos' },
    { campo: 'limiteIntegrantesPorEspacio', etiqueta: 'Integrantes por espacio' },
  ];
  return (
    <div className={`rounded-2xl border p-4 ${normal ? 'border-sky-500/25 bg-sky-500/5' : 'border-purple-500/25 bg-purple-500/5'}`}>
      <div className="flex items-center justify-between gap-3"><h4 className="font-extrabold">{normal ? 'Normal · Gratis' : 'Premium'}</h4><span className="rounded-full bg-[var(--fin-card)] px-2 py-0.5 text-[10px] font-bold text-[var(--fin-ink-soft)]">{forma.activo ? 'Activo' : 'Inactivo'}</span></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <CampoNumerico etiqueta="Precio mensual (COP)" valor={forma.precioMensualCop} bloqueado={normal} alCambiar={(valor) => alCambiar('precioMensualCop', valor)} />
        <CampoNumerico etiqueta="Precio anual (COP)" valor={forma.precioAnualCop} bloqueado={normal} alCambiar={(valor) => alCambiar('precioAnualCop', valor)} />
        {campos.map(({ campo, etiqueta }) => <CampoNumerico key={campo} etiqueta={etiqueta} valor={forma[campo]} alCambiar={(valor) => alCambiar(campo, valor)} ayuda="Vacío = ilimitado" />)}
      </div>
      <fieldset className="mt-4 border-t border-[var(--fin-line)] pt-4">
        <legend className="text-[11px] font-bold text-[var(--fin-ink-soft)]">Prestaciones incluidas</legend>
        <p className="mt-1 text-[10px] leading-relaxed text-[var(--fin-ink-faint)]">Esta selección actualiza lo que se muestra y lo que cada cuenta puede usar.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {beneficios.map((beneficio) => {
            const deshabilitado = (beneficio.clave === 'integrantes_espacio' && !forma.beneficios.espacios_compartidos)
              || (beneficio.clave === 'pulso_premium' && !forma.beneficios.asesor_ia);
            return (
              <label key={beneficio.clave} className={`flex cursor-pointer items-start gap-2 rounded-xl border px-2.5 py-2 text-[11px] transition-colors ${forma.beneficios[beneficio.clave] ? 'border-purple-500/35 bg-purple-500/10' : 'border-[var(--fin-line)] bg-[var(--fin-card)]'} ${deshabilitado ? 'cursor-not-allowed opacity-50' : ''}`}>
                <input
                  type="checkbox"
                  checked={forma.beneficios[beneficio.clave]}
                  disabled={deshabilitado}
                  onChange={(evento) => alCambiarBeneficio(beneficio.clave, evento.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 accent-purple-600"
                />
                <span>
                  <span className="block font-bold text-[var(--fin-ink)]">{beneficio.titulo}</span>
                  <span className="block leading-snug text-[var(--fin-ink-faint)]">{beneficio.detalle}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <button disabled={guardando} onClick={alGuardar} className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--fin-ink)] px-3.5 py-2 text-xs font-bold text-[var(--fin-bg)] hover:opacity-90 disabled:opacity-60">{guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Guardar {normal ? 'Normal' : 'Premium'}</button>
    </div>
  );
};

const CampoNumerico: React.FC<{ etiqueta: string; valor: string; bloqueado?: boolean; ayuda?: string; alCambiar: (valor: string) => void }> = ({ etiqueta, valor, bloqueado = false, ayuda, alCambiar }) => (
  <label className="block text-[11px] font-bold text-[var(--fin-ink-soft)]">{etiqueta}
    <input disabled={bloqueado} inputMode="numeric" pattern="[0-9]*" value={valor} onChange={(evento) => alCambiar(evento.target.value)} className="mt-1 block w-full rounded-lg border border-[var(--fin-line)] bg-[var(--fin-card)] px-2.5 py-2 text-[16px] font-semibold text-[var(--fin-ink)] disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm" />
    {ayuda && <span className="mt-1 block text-[10px] font-normal text-[var(--fin-ink-faint)]">{ayuda}</span>}
  </label>
);
