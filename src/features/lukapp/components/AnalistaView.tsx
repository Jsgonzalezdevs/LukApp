import { useGuardadoFinanciero, type ResultadoGuardado } from '../hooks/useGuardadoFinanciero';
import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  FileDown,
  FileText,
  FileUp,
  Loader2,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { Transaction } from '../types';
import type { Category } from '../types';
import type { RevisionDudosa } from '../data/revisiones';
import { planearImportacion } from '../analista/aMovimientos';
import { crearRevisionesImportacion } from '../analista/revisionesImportacion';
import type { Trabajo } from '../analista/useAnalista';
import { useAnalista } from '../analista/useAnalista';
import { AnalistaReporte } from './AnalistaReporte';
import { useArchivoPwa } from './useArchivoPwa';
import { obtenerSupabase } from '../data/supabase';
import { apiUrl } from '../../../lib/api';

interface AnalistaViewProps {
  cuentaInicialId?: string | null;
  existentes: readonly Transaction[];
  cuentas: readonly { id: string; nombre: string }[];
  onImportar: (nuevos: Transaction[], revisiones?: RevisionDudosa[]) => ResultadoGuardado;
  onCompletar: (movimiento: Transaction) => ResultadoGuardado;
}

const nuevoId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tx-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;

const segundosDe = (trabajo: Trabajo, ahora: number): number =>
  Math.max(0, Math.floor((ahora - trabajo.inicio) / 1000));
const FORMATO_FECHA_COMPROBANTE = new Intl.DateTimeFormat('es-CO');

interface ComprobanteCorreo {
  id: string;
  remitente: string;
  asunto: string;
  recibido_en: string;
  fechaLegible: string;
  adjuntos: Array<{ id: string; nombre: string; tipo: string }>;
}

const BandejaCorreo: React.FC = () => {
  const [direccion, setDireccion] = useState('');
  const [comprobantes, setComprobantes] = useState<ComprobanteCorreo[]>([]);
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [descargando, setDescargando] = useState('');

  const cargar = async () => {
    setCargando(true);
    setMensaje('');
    const cliente = obtenerSupabase();
    if (!cliente) {
      setMensaje('Inicia sesión para activar tu dirección personal de comprobantes.');
      setCargando(false);
      return;
    }
    const { data: sesion } = await cliente.auth.getSession();
    const token = sesion.session?.access_token;
    if (!token) {
      setMensaje('Inicia sesión para activar tu dirección personal de comprobantes.');
      setCargando(false);
      return;
    }
    try {
      const respuesta = await fetch(apiUrl('/api/comprobantes-correo/destino'), {
        headers: { authorization: `Bearer ${token}` },
      });
      const datos = await respuesta.json() as { direccion?: string; error?: string };
      if (!respuesta.ok || !datos.direccion) throw new Error(datos.error || 'No se pudo preparar la dirección.');
      setDireccion(datos.direccion);
      const { data, error } = await cliente.from('comprobantes_correo')
        .select('id,remitente,asunto,recibido_en,adjuntos').order('recibido_en', { ascending: false }).limit(20);
      if (error) throw error;
      setComprobantes(((data ?? []) as Omit<ComprobanteCorreo, 'fechaLegible'>[]).map((fila) => ({
        ...fila,
        fechaLegible: FORMATO_FECHA_COMPROBANTE.format(new Date(fila.recibido_en)),
      })));
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : 'No se pudo cargar la bandeja de correo.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { void Promise.resolve().then(cargar); }, []);

  const descargar = async (comprobanteId: string, archivo: ComprobanteCorreo['adjuntos'][number]) => {
    const cliente = obtenerSupabase();
    const { data: sesion } = cliente ? await cliente.auth.getSession() : { data: { session: null } };
    const token = sesion.session?.access_token;
    if (!token) { setMensaje('Inicia sesión para descargar el adjunto.'); return; }
    setDescargando(archivo.id);
    try {
      const respuesta = await fetch(apiUrl(`/api/comprobantes-correo/${comprobanteId}/adjunto/${archivo.id}`), {
        headers: { authorization: `Bearer ${token}` },
      });
      const datos = await respuesta.json() as { url?: string; error?: string };
      if (!respuesta.ok || !datos.url) throw new Error(datos.error || 'No se pudo preparar la descarga.');
      window.location.assign(datos.url);
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : 'No se pudo descargar el adjunto.');
    } finally {
      setDescargando('');
    }
  };

  return (
    <section className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5">
      <h2 className="text-[17px] font-semibold text-[var(--fin-ink)]">📩 Recibe comprobantes por correo</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">
        Reenvía facturas o recibos a tu dirección personal; aparecerán aquí con su remitente y fecha. No se crean movimientos ni se cambia tu saldo sin que revises e importes el archivo.
      </p>
      {direccion ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] p-3">
          <code className="min-w-0 flex-1 break-all text-[13px] font-semibold text-[var(--fin-ink)]">{direccion}</code>
          <button type="button" onClick={() => void navigator.clipboard?.writeText(direccion)} className="min-h-11 rounded-[var(--fin-r-pill)] bg-[var(--fin-card)] px-4 text-[13px] font-semibold text-[var(--fin-ink)]">Copiar</button>
        </div>
      ) : null}
      {mensaje ? <p role="status" className="mt-3 text-[13px] text-[var(--fin-ink-soft)]">{mensaje}</p> : null}
      {cargando ? <p className="mt-3 text-[13px] text-[var(--fin-ink-faint)]">Cargando tu bandeja…</p> : null}
      {!cargando && comprobantes.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2">
          {comprobantes.map((item) => (
            <li key={item.id} className="rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] p-3">
              <p className="text-[13px] font-semibold text-[var(--fin-ink)]">{item.asunto || 'Comprobante recibido'}</p>
              <p className="mt-1 text-[13px] text-[var(--fin-ink-soft)]">De {item.remitente} · {item.fechaLegible}</p>
              {item.adjuntos.length ? (
                <ul className="mt-2 flex flex-col gap-1">
                  {item.adjuntos.map((archivo) => (
                    <li key={archivo.id} className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-[var(--fin-ink-faint)]">
                      <span className="break-all">📎 {archivo.nombre}</span>
                      <button type="button" disabled={descargando === archivo.id} onClick={() => void descargar(item.id, archivo)} className="min-h-11 rounded-[var(--fin-r-pill)] px-3 font-semibold text-[var(--fin-accent)] disabled:opacity-50">
                        {descargando === archivo.id ? 'Preparando…' : 'Descargar para revisar'}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-1 text-[13px] text-[var(--fin-ink-faint)]">Sin archivos adjuntos</p>}
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" onClick={() => void cargar()} disabled={cargando} className="mt-3 min-h-11 rounded-[var(--fin-r-pill)] px-4 text-[13px] font-semibold text-[var(--fin-accent)] disabled:opacity-50">Actualizar bandeja</button>
    </section>
  );
};

// -----------------------------------------------------------------------------

interface TrabajoEnCursoProps {
  trabajo: Trabajo;
  segundos: number;
}

const TrabajoEnCurso: React.FC<TrabajoEnCursoProps> = ({ trabajo, segundos }) => (
  <li className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5">
    <div className="flex items-center gap-3">
      <Loader2
        className="h-5 w-5 shrink-0 animate-spin text-[var(--fin-ink-faint)]"
        strokeWidth={3}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[17px] font-semibold">{trabajo.archivo.name}</p>
        <p className="text-[15px] text-[var(--fin-ink-soft)]">
          {segundos > 0 ? `Leyendo tu extracto… van ${segundos}s` : 'Leyendo tu extracto…'}
        </p>
      </div>
    </div>
  </li>
);

interface TrabajoConErrorProps {
  trabajo: Trabajo;
  onReintentar: (id: string) => void;
  onQuitar: (id: string) => ResultadoGuardado;
}

const TrabajoConError: React.FC<TrabajoConErrorProps> = ({ trabajo, onReintentar, onQuitar }) => (
  <li className="rounded-[var(--fin-r-card)] bg-[var(--fin-out-bg)] p-5">
    <div className="flex items-start gap-3">
      <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-[var(--fin-out)]" strokeWidth={3} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[var(--fin-out)]">
          {trabajo.archivo.name}
        </p>
        <p className="mt-1 text-[15px] leading-relaxed text-[var(--fin-out)]">
          {trabajo.error?.mensaje}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onReintentar(trabajo.id)}
            className="rounded-[var(--fin-r-pill)] bg-[var(--fin-card)] px-4 py-2 text-[13px] font-semibold text-[var(--fin-out)]"
          >
            Reintentar
          </button>
          <button
            type="button"
            onClick={() => onQuitar(trabajo.id)}
            className="rounded-[var(--fin-r-pill)] px-4 py-2 text-[13px] font-semibold text-[var(--fin-ink-soft)]"
          >
            Quitar
          </button>
        </div>
      </div>
    </div>
  </li>
);

interface TrabajoListoProps {
  trabajo: Trabajo;
  existentes: readonly Transaction[];
  cuentaId: string | null;
  onImportar: (nuevos: Transaction[], revisiones?: RevisionDudosa[]) => ResultadoGuardado;
  onCompletar: (movimiento: Transaction) => ResultadoGuardado;
  modoHistorico: boolean;
  onQuitar: (id: string) => ResultadoGuardado;
  contraido: boolean;
  onToggle: (id: string) => void;
}

const TrabajoListo: React.FC<TrabajoListoProps> = ({
  trabajo,
  existentes,
  cuentaId,
  onImportar,
  onCompletar,
  modoHistorico,
  onQuitar,
  contraido,
  onToggle,
}) => {
  const guardado = useGuardadoFinanciero();
  const [importado, setImportado] = useState(0);
  const [verPosibles, setVerPosibles] = useState(false);
  const [confirmarDudosos, setConfirmarDudosos] = useState(false);
  const [revisionesGuardadas, setRevisionesGuardadas] = useState(false);
  const [aceptados, setAceptados] = useState<ReadonlySet<string>>(new Set());
  if (!trabajo.resultado) return null;

  // Recomputed on every render from the CURRENT ledger, not memoized against a
  // stale snapshot — importing job A must immediately stop job B from also
  // offering the same overlapping rows as "new".
  const plan = planearImportacion(trabajo.resultado.movimientos, existentes, nuevoId, undefined, cuentaId);
  const movimientosDudosos = trabajo.resultado.movimientos.filter((m) => m.confianza !== 'alta');

  return (
    <li className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5">
      {guardado.error ? <p role="alert" className="text-sm text-[var(--fin-out)]">{guardado.error}</p> : null}
      <button
        type="button"
        onClick={() => onToggle(trabajo.id)}
        className="flex w-full items-center gap-3 text-left"
      >
        <CheckCircle2
          className="h-5 w-5 shrink-0 text-[var(--fin-in)]"
          strokeWidth={2.5}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold">{trabajo.archivo.name}</p>
          <p className="truncate text-[13px] font-semibold text-[var(--fin-ink-faint)] capitalize">
            {trabajo.resultado.periodo.etiqueta}
            {importado > 0 ? ` · ${importado} importado${importado === 1 ? '' : 's'}` : ''}
          </p>
          <p className="mt-1 text-[13px] font-semibold text-[var(--fin-ink-soft)]">
            {trabajo.resultado.entidad ? `Banco identificado: ${trabajo.resultado.entidad}` : 'Banco no identificado con certeza'}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--fin-ink-faint)] transition-transform ${contraido ? '' : 'rotate-180'}`}
          strokeWidth={3}
        />
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onQuitar(trabajo.id);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              onQuitar(trabajo.id);
            }
          }}
          aria-label={`Quitar ${trabajo.archivo.name} de la lista`}
          className="shrink-0 rounded-[var(--fin-r-pill)] p-2 text-[var(--fin-ink-ghost)] hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]"
        >
          <X className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      </button>

      {!contraido ? (
        <div className="mt-4 flex flex-col gap-5 border-t border-[var(--fin-line)] pt-4">
          <section className="rounded-[var(--fin-r-card)] bg-[var(--fin-soft)] p-4">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold text-[var(--fin-ink-soft)]">
              <Download className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
              Importar a tu historial
            </h3>

            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Nuevos', n: plan.nuevos.length, ink: 'var(--fin-in)' },
                { label: 'Quizá repetidos', n: plan.posibles.length, ink: 'var(--fin-warn-ink)' },
                { label: 'Ya estaban', n: plan.duplicados.length, ink: 'var(--fin-ink-soft)' },
                { label: 'No cuentan', n: plan.excluidos.length, ink: 'var(--fin-baja-ink)' },
              ].map((c) => (
                <div
                  key={c.label}
                  className="rounded-[var(--fin-r-control)] bg-[var(--fin-card)] px-2 py-3"
                >
                  <p className="text-[20px] font-semibold tabular-nums" style={{ color: c.ink }}>
                    {c.n}
                  </p>
                  <p className="text-[13px] font-semibold text-[var(--fin-ink-soft)]">{c.label}</p>
                </div>
              ))}
            </div>

            {plan.posibles.length > 0 && importado === 0 ? (
              <div className="mt-3 rounded-[var(--fin-r-card)] bg-[var(--fin-warn-bg)] p-3">
                <p className="text-[13px] leading-relaxed text-[var(--fin-warn-ink)]">
                  {plan.posibles.length} movimiento{plan.posibles.length === 1 ? '' : 's'} del
                  extracto {plan.posibles.length === 1 ? 'cae' : 'caen'} el mismo día y por el mismo
                  monto que algo que ya tienes, pero con otro texto. Puede ser lo mismo que anotaste
                  a mano — o dos gastos iguales de verdad.
                </p>
                <button
                  type="button"
                  onClick={() => setVerPosibles((v) => !v)}
                  aria-expanded={verPosibles}
                  className="mt-2 text-[13px] font-semibold text-[var(--fin-warn-ink)] underline underline-offset-2"
                >
                  {verPosibles ? 'Ocultar' : 'Revisarlos uno por uno'}
                </button>

                {verPosibles ? (
                  <ul className="mt-3 flex flex-col gap-2">
                    {plan.posibles.map((p) => {
                      const marcado = aceptados.has(p.clave);
                      return (
                        <li
                          key={p.clave}
                          className="rounded-[var(--fin-r-control)] bg-[var(--fin-card)] p-3"
                        >
                          <p className="text-[13px] text-[var(--fin-ink-soft)]">
                            Ya tienes:{' '}
                            <b className="text-[var(--fin-ink)]">{p.yaTengo.description}</b>
                          </p>
                          <p className="text-[13px] text-[var(--fin-ink-soft)]">
                            El extracto dice:{' '}
                            <b className="text-[var(--fin-ink)]">{p.movimiento.descripcion}</b>
                          </p>
                          <label className="mt-2 flex items-center gap-2 text-[13px] font-semibold text-[var(--fin-ink)]">
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() =>
                                setAceptados((prev) => {
                                  const siguiente = new Set(prev);
                                  if (marcado) siguiente.delete(p.clave);
                                  else siguiente.add(p.clave);
                                  return siguiente;
                                })
                              }
                            />
                            Son distintos, impórtalo también
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              guardado.ejecutar(() => onCompletar({
                                ...p.yaTengo,
                                description: p.movimiento.descripcion,
                                category: p.movimiento.categoria as Category,
                                cuentaId: p.yaTengo.cuentaId ?? cuentaId,
                                rawTranscript: `${p.yaTengo.rawTranscript} · extracto: ${p.movimiento.descripcion}`.trim(),
                              }))
                            }
                            className="mt-2 rounded-[var(--fin-r-pill)] bg-[var(--fin-in-bg)] px-3 py-2 text-[13px] font-semibold text-[var(--fin-in)]"
                          >
                            Completar este movimiento
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {movimientosDudosos.length > 0 && importado === 0 ? (
              <div className="mt-3 rounded-[var(--fin-r-card)] bg-[var(--fin-out-bg)] p-3">
                <p className="text-[13px] leading-relaxed text-[var(--fin-out)]">
                  La foto puede haber confundido {movimientosDudosos.length === 1 ? 'esta cifra' : 'algunas cifras'}. Comprueba fecha, detalle y monto en cada fila antes de importar.
                </p>
                <label className="mt-3 flex items-start gap-2 text-[13px] font-semibold text-[var(--fin-out)]">
                  <input type="checkbox" checked={confirmarDudosos} onChange={(evento) => setConfirmarDudosos(evento.target.checked)} className="mt-0.5 h-4 w-4" />
                  Revisé los movimientos reconocidos y quiero importarlos
                </label>
              </div>
            ) : null}

            {revisionesGuardadas ? (
              <p role="status" className="mt-3 rounded-[var(--fin-r-control)] bg-[var(--fin-in-bg)] px-3 py-3 text-[15px] font-semibold text-[var(--fin-in)]">
                {importado > 0 ? `Importaste ${importado} movimiento${importado === 1 ? '' : 's'} y guardaste lo pendiente en Revisar movimientos.` : 'Guardamos las filas dudosas en Revisar movimientos para que puedas volver a ellas.'}
              </p>
            ) : importado > 0 ? (
              <p className="mt-3 rounded-[var(--fin-r-control)] bg-[var(--fin-in-bg)] px-3 py-3 text-[15px] font-semibold text-[var(--fin-in)]">
                Importaste {importado} movimiento{importado === 1 ? '' : 's'}.
              </p>
            ) : (
              <button
                type="button"
                disabled={guardado.ocupado || !cuentaId || (plan.nuevos.length + aceptados.size === 0 && !plan.excluidos.some((fila) => fila.exclusion === 'traslado-propio')) || (movimientosDudosos.length > 0 && !confirmarDudosos)}
                onClick={async () => {
                  if (!cuentaId) return;
                  const extra = plan.posibles
                    .filter((p) => aceptados.has(p.clave))
                    .map((p) => p.transaccion);
                  const total = [...plan.nuevos, ...extra].map((tx) => ({ ...tx, afectaSaldo: modoHistorico ? false : tx.afectaSaldo !== false }));
                  const revisiones = crearRevisionesImportacion({
                    trabajoId: trabajo.id,
                    documento: trabajo.archivo.name,
                    transacciones: total,
                    movimientosDudosos,
                    posiblesConfirmados: plan.posibles.filter((fila) => aceptados.has(fila.clave)),
                    transferenciasExcluidas: plan.excluidos.filter((fila) => fila.exclusion === 'traslado-propio'),
                    ahora: new Date().toISOString(),
                  });
                  if (await guardado.ejecutar(() => onImportar(total, revisiones))) {
                    setImportado(total.length);
                    setRevisionesGuardadas(revisiones.length > 0);
                  }
                }}
                className="mt-3 w-full rounded-[var(--fin-r-pill)] bg-[var(--fin-accent)] px-6 py-3 text-[13px] font-semibold text-[var(--fin-on-accent)] transition-colors hover:bg-[var(--fin-accent-hover)] disabled:opacity-30"
              >
                {movimientosDudosos.length > 0 && !confirmarDudosos
                  ? 'Revisa las filas antes de importar'
                  : !cuentaId
                  ? 'Elige la cuenta para importar'
                  : plan.nuevos.length + aceptados.size === 0 && plan.excluidos.some((fila) => fila.exclusion === 'traslado-propio')
                  ? 'Guardar transferencias para revisar'
                  : plan.nuevos.length + aceptados.size === 0
                  ? 'Nada nuevo por importar'
                  : `${modoHistorico ? 'Guardar en historial' : 'Importar'} ${plan.nuevos.length + aceptados.size} movimiento${
                      plan.nuevos.length + aceptados.size === 1 ? '' : 's'
                    }`}
              </button>
            )}

            {plan.duplicados.length > 0 && plan.nuevos.length > 0 ? (
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
                {plan.duplicados.length} ya estaban en tu historial y no se van a duplicar.
              </p>
            ) : null}
          </section>

          <AnalistaReporte resultado={trabajo.resultado} />
        </div>
      ) : null}
    </li>
  );
};

interface TrabajoConContrasenaProps {
  trabajo: Trabajo;
  onDesbloquear: (id: string, contrasena: string) => void;
  onQuitar: (id: string) => ResultadoGuardado;
}

const TrabajoConContrasena: React.FC<TrabajoConContrasenaProps> = ({ trabajo, onDesbloquear, onQuitar }) => {
  const [contrasena, setContrasena] = useState('');

  const enviar = (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!contrasena) return;
    // Se vacía antes de enviarla: nunca queda asociada al trabajo ni se reutiliza
    // en otros extractos. Cada PDF pide su propia clave cuando la necesita.
    const clave = contrasena;
    setContrasena('');
    onDesbloquear(trabajo.id, clave);
  };

  return (
    <li className="rounded-[var(--fin-r-card)] bg-[var(--fin-warn-bg)] p-5">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-[var(--fin-warn-ink)]" strokeWidth={3} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-[var(--fin-ink)]">{trabajo.archivo.name}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">
            {trabajo.error?.mensaje} La usamos solo para abrir este PDF; no se guarda en LukApp.
          </p>
          <form onSubmit={enviar} className="mt-3 flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor={`contrasena-extracto-${trabajo.id}`}>Contraseña del extracto</label>
            <input
              id={`contrasena-extracto-${trabajo.id}`}
              type="password"
              value={contrasena}
              onChange={(evento) => setContrasena(evento.target.value)}
              autoComplete="off"
              placeholder="Contraseña del extracto"
              className="min-w-0 flex-1 rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-2 text-base text-[var(--fin-ink)]"
            />
            <button
              type="submit"
              disabled={!contrasena}
              className="rounded-[var(--fin-r-pill)] bg-[var(--fin-accent)] px-4 py-2 text-[13px] font-semibold text-[var(--fin-on-accent)] disabled:opacity-40"
            >
              Desbloquear PDF
            </button>
          </form>
          <button
            type="button"
            onClick={() => onQuitar(trabajo.id)}
            className="mt-2 text-[13px] font-semibold text-[var(--fin-ink-soft)] underline underline-offset-2"
          >
            Quitar extracto
          </button>
        </div>
      </div>
    </li>
  );
};

// -----------------------------------------------------------------------------

export const AnalistaView: React.FC<AnalistaViewProps> = ({ existentes, cuentas, cuentaInicialId, onImportar, onCompletar }) => {
  const analista = useAnalista();
  useArchivoPwa(analista.analizarArchivos);
  const [cuentaId, setCuentaId] = useState<string | null>(() => cuentas.some((c) => c.id === cuentaInicialId) ? cuentaInicialId! : cuentas.length === 1 ? cuentas[0].id : null);
  const [arrastrando, setArrastrando] = useState(false);
  const [modoHistorico, setModoHistorico] = useState(false);
  const [contraidos, setContraidos] = useState<Set<string>>(new Set());
  const inputArchivo = useRef<HTMLInputElement>(null);
  const contadorArrastre = useRef(0);

  const toggleContraido = (id: string) => {
    setContraidos((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  };

  const enCurso = analista.trabajos.filter((t) => t.fase === 'subiendo');
  const esperandoContrasena = analista.trabajos.filter((t) => t.fase === 'esperando-contrasena');
  const conError = analista.trabajos.filter((t) => t.fase === 'error');
  const listos = analista.trabajos.filter((t) => t.fase === 'listo');

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <BandejaCorreo />
      {/* ---------- Dropzone: always visible, so more files can be added anytime ---------- */}
      <section
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          // A counter rather than a boolean: dragging over a CHILD element fires
          // dragleave on the parent, which would flicker the highlight off
          // mid-drag if tracked with a plain flag.
          contadorArrastre.current += 1;
          setArrastrando(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          contadorArrastre.current = Math.max(0, contadorArrastre.current - 1);
          if (contadorArrastre.current === 0) setArrastrando(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          contadorArrastre.current = 0;
          setArrastrando(false);
          const archivos = [...e.dataTransfer.files];
          if (archivos.length > 0) analista.analizarArchivos(archivos);
        }}
        className={`rounded-[var(--fin-r-card)] border-2 border-dashed px-6 py-9 text-center transition-colors ${
          arrastrando
            ? 'border-[var(--fin-ink)] bg-[var(--fin-soft)]'
            : 'border-[var(--fin-line)] bg-[var(--fin-card)]'
        }`}
      >
        {arrastrando ? (
          <FileDown
            className="mx-auto h-9 w-9 text-[var(--fin-ink)]"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        ) : (
          <FileText
            className="mx-auto h-9 w-9 text-[var(--fin-ink-faint)]"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        )}
        <h2 className="mt-3 text-[20px] font-semibold tracking-tight">
          {arrastrando ? 'Suelta aquí' : 'Sube tus extractos'}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">
          Arrastra PDF, fotos, Excel .xlsx o CSV; también puedes elegir varios. Hasta 4 MB cada archivo.
        </p>

        <input
          ref={inputArchivo}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp,image/tiff,.xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          multiple
          className="hidden"
          onChange={(e) => {
            const archivos = e.target.files ? [...e.target.files] : [];
            if (archivos.length > 0) analista.analizarArchivos(archivos);
            // Reset so picking the same file(s) twice still fires onChange.
            e.target.value = '';
          }}
        />

        <motion.button
          type="button"
          onClick={() => inputArchivo.current?.click()}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-[var(--fin-r-pill)] bg-[var(--fin-accent)] px-7 py-4 text-[17px] font-semibold text-[var(--fin-on-accent)] transition-colors hover:bg-[var(--fin-accent-hover)]"
        >
          <FileUp className="h-4 w-4" strokeWidth={3} />
          Elegir archivos
        </motion.button>

        <p className="mx-auto mt-4 flex max-w-sm items-start gap-2 text-left text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
          <ShieldCheck
            className="mt-px h-3.5 w-3.5 shrink-0"
            strokeWidth={2.5}
            aria-hidden="true"
          />
            <span>
            Los PDF se leen con el analista; las fotos, hojas Excel y CSV se procesan en este dispositivo. Revisa cada fila y sus posibles duplicados antes de guardar. Las plantillas locales siguen disponibles para Nequi, Nu, Bancolombia y Davivienda. Si un PDF tiene contraseña, te la pediremos aquí mismo y no la guardamos.
          </span>
        </p>
      </section>

      <section className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-5">
        <label className="block text-[15px] font-semibold text-[var(--fin-ink)]" htmlFor="cuenta-extracto">
          ¿A qué cuenta de LukApp pertenece este extracto?
        </label>
        <select
          id="cuenta-extracto"
          value={cuentaId ?? ''}
          onChange={(e) => setCuentaId(e.target.value || null)}
          className="mt-2 w-full rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] px-3 py-3 text-base text-[var(--fin-ink)]"
        >
          <option value="" disabled>Selecciona una cuenta</option>
          {cuentas.map((cuenta) => <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre}</option>)}
        </select>
        <p className="mt-2 text-[13px] text-[var(--fin-ink-faint)]">
          Elige la cuenta a la que pertenece el extracto. Puedes importar los movimientos como actividad actual o conservar un historial antiguo sin alterar el saldo de hoy.
        </p>
        <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] p-3 text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">
          <input type="checkbox" checked={modoHistorico} onChange={(evento) => setModoHistorico(evento.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--fin-accent)]" />
          <span><b className="text-[var(--fin-ink)]">Importar como historial antiguo</b><br />Los movimientos aparecerán en tus reportes, pero no sumarán ni restarán del saldo actual de la cuenta.</span>
        </label>
      </section>

      {/* ---------- Jobs in flight ---------- */}
      {enCurso.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {enCurso.map((trabajo) => (
            <TrabajoEnCurso
              key={trabajo.id}
              trabajo={trabajo}
              segundos={segundosDe(trabajo, analista.ahora)}
            />
          ))}
        </ul>
      ) : null}

      {esperandoContrasena.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {esperandoContrasena.map((trabajo) => (
            <TrabajoConContrasena
              key={trabajo.id}
              trabajo={trabajo}
              onDesbloquear={analista.desbloquear}
              onQuitar={analista.quitarTrabajo}
            />
          ))}
        </ul>
      ) : null}

      {/* ---------- Failed jobs ---------- */}
      {conError.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {conError.map((trabajo) => (
            <TrabajoConError
              key={trabajo.id}
              trabajo={trabajo}
              onReintentar={analista.reintentar}
              onQuitar={analista.quitarTrabajo}
            />
          ))}
        </ul>
      ) : null}

      {/* ---------- Finished jobs, newest first (already the array order) ---------- */}
      {listos.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {listos.map((trabajo) => (
            <TrabajoListo
              key={trabajo.id}
              trabajo={trabajo}
              existentes={existentes}
              cuentaId={cuentaId}
              onImportar={onImportar}
              onCompletar={onCompletar}
              modoHistorico={modoHistorico}
              onQuitar={analista.quitarTrabajo}
              contraido={contraidos.has(trabajo.id)}
              onToggle={toggleContraido}
            />
          ))}
        </ul>
      ) : null}

      {analista.trabajos.length > 0 ? (
        <p className="flex items-center justify-center gap-2 text-[13px] text-[var(--fin-ink-faint)]">
          <RotateCcw className="h-3 w-3" strokeWidth={3} />
          Puedes seguir arrastrando más extractos mientras estos terminan.
        </p>
      ) : null}

    </div>
  );
};
