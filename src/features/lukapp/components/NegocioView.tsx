import React, { useEffect, useRef, useState } from 'react';
import { BriefcaseBusiness, Check, FilePlus2, HandCoins, Loader2, ReceiptText } from 'lucide-react';
import { formatCop } from '../lib/formatCop';
import { aplicarAbono, convertirCotizacion, saldoPendiente, totalesNegocio, type BaseNegocio, type DocumentoNegocio, type TipoDocumentoNegocio } from '../negocio/modelo';

interface NegocioViewProps {
  userId: string;
  documentos: DocumentoNegocio[];
  cargando: boolean;
  onGuardar: (documentos: readonly DocumentoNegocio[]) => Promise<boolean>;
}

const CLAVE_LOCAL = (userId: string) => `lukapp.negocio.${userId}`;

const hoyBogota = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
const nuevoId = (): string =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const NegocioView: React.FC<NegocioViewProps> = ({ userId, documentos, cargando, onGuardar }) => {
  const [base, setBase] = useState<BaseNegocio>('devengo');
  const [tipo, setTipo] = useState<TipoDocumentoNegocio>('por_cobrar');
  const [contraparte, setContraparte] = useState('');
  const [concepto, setConcepto] = useState('');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(hoyBogota);
  const [vence, setVence] = useState('');
  const [abono, setAbono] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const usuarioMigrado = useRef('');

  useEffect(() => {
    if (cargando || usuarioMigrado.current === userId) return;
    usuarioMigrado.current = userId;
    void Promise.resolve().then(async () => {
      try {
        const guardado = window.localStorage.getItem(CLAVE_LOCAL(userId));
        if (!guardado) return;
        const antiguos = JSON.parse(guardado) as DocumentoNegocio[];
        const idsActuales = new Set(documentos.map((documento) => documento.id));
        const faltantes = antiguos.filter((documento) => documento && typeof documento.id === 'string' && !idsActuales.has(documento.id));
        if (faltantes.length === 0) {
          window.localStorage.removeItem(CLAVE_LOCAL(userId));
          return;
        }
        const correcto = await onGuardar(faltantes);
        if (correcto) window.localStorage.removeItem(CLAVE_LOCAL(userId));
        else setMensaje('Tus registros anteriores siguen guardados en este dispositivo; vuelve a sincronizar para migrarlos.');
      } catch {
        setMensaje('No se pudieron migrar tus registros anteriores; siguen guardados en este dispositivo.');
      }
    });
  }, [cargando, documentos, onGuardar, userId]);

  const guardar = async (siguiente: DocumentoNegocio[]) => {
    const nuevasOActualizadas = siguiente.filter((documento) => {
      const anterior = documentos.find((fila) => fila.id === documento.id);
      return !anterior || JSON.stringify(anterior) !== JSON.stringify(documento);
    });
    if (nuevasOActualizadas.length > 0 && !await onGuardar(nuevasOActualizadas)) {
      throw new Error('No se pudo guardar el registro. Revisa el aviso de sincronización e inténtalo de nuevo.');
    }
  };

  const crear = async (evento: React.FormEvent) => {
    evento.preventDefault();
    const totalCop = Math.round(Number(monto.replace(/\./g, '').replace(',', '.')));
    if (!contraparte.trim() || !concepto.trim() || !Number.isSafeInteger(totalCop) || totalCop <= 0) {
      setMensaje('Completa el cliente o proveedor, el concepto y un total mayor que cero.');
      return;
    }
    setOcupado(true);
    setMensaje('');
    const documento: DocumentoNegocio = {
      id: nuevoId(),
      tipo,
      estado: tipo === 'cotizacion' ? 'borrador' : 'enviado',
      contraparte: contraparte.trim(),
      concepto: concepto.trim(),
      totalCop,
      fecha,
      vence: vence || null,
      abonos: [],
      cotizacionOrigenId: null,
    };
    try {
      await guardar([documento, ...documentos]);
      setContraparte('');
      setConcepto('');
      setMonto('');
      setVence('');
      setMensaje(tipo === 'cotizacion' ? 'Cotización guardada como borrador.' : 'Cuenta registrada.');
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : 'No se pudo guardar el documento.');
    } finally {
      setOcupado(false);
    }
  };

  const registrarAbono = async (documento: DocumentoNegocio) => {
    const montoCop = Math.round(Number((abono[documento.id] ?? '').replace(/\./g, '').replace(',', '.')));
    const actualizado = aplicarAbono(documento, { id: nuevoId(), montoCop, fecha: hoyBogota(), nota: 'Abono registrado' });
    if (!actualizado) {
      setMensaje('El abono debe ser mayor que cero y no puede superar el saldo pendiente.');
      return;
    }
    setOcupado(true);
    setMensaje('');
    try {
      await guardar(documentos.map((fila) => fila.id === documento.id ? actualizado : fila));
      setAbono((actual) => ({ ...actual, [documento.id]: '' }));
      setMensaje('Abono guardado. El saldo de la cuenta financiera no cambia: registra también el movimiento en Dinero.');
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : 'No se pudo guardar el abono.');
    } finally {
      setOcupado(false);
    }
  };

  const crearFacturaDesdeCotizacion = async (documento: DocumentoNegocio) => {
    const factura = convertirCotizacion(documento, nuevoId(), hoyBogota());
    if (!factura) return;
    setOcupado(true);
    setMensaje('');
    try {
      await guardar([
        { ...documento, estado: 'aceptado' },
        factura,
        ...documentos.filter((fila) => fila.id !== documento.id),
      ]);
      setMensaje('Cotización convertida en cuenta por cobrar; el original se conserva.');
    } catch (error) {
      setMensaje(error instanceof Error ? error.message : 'No se pudo convertir la cotización.');
    } finally {
      setOcupado(false);
    }
  };

  const totales = totalesNegocio(documentos, hoyBogota().slice(0, 7), base);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-1 pb-8">
      <header className="flex items-start gap-3">
        <span className="rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] p-3 text-[var(--fin-ink)]">
          <BriefcaseBusiness aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-xl font-bold text-[var(--fin-ink)]">💼 Tu trabajo, en orden</h2>
          <p className="mt-1 text-[16px] leading-relaxed text-[var(--fin-ink-soft)]">
            Lleva cotizaciones, cobros, pagos y abonos de tu actividad sin mezclarla con tus gastos personales.
          </p>
        </div>
      </header>

      <section className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold text-[var(--fin-ink)]">Resumen del mes</h3>
          <div className="flex rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] p-1" role="group" aria-label="Base de cálculo">
            <button
              type="button"
              aria-pressed={base === 'devengo'}
              onClick={() => setBase('devengo')}
              className={`min-h-11 rounded-[var(--fin-r-pill)] px-3 text-[13px] font-semibold ${base === 'devengo' ? 'bg-[var(--fin-card)] text-[var(--fin-ink)]' : 'text-[var(--fin-ink-soft)]'}`}
            >
              Devengo
            </button>
            <button
              type="button"
              aria-pressed={base === 'caja'}
              onClick={() => setBase('caja')}
              className={`min-h-11 rounded-[var(--fin-r-pill)] px-3 text-[13px] font-semibold ${base === 'caja' ? 'bg-[var(--fin-card)] text-[var(--fin-ink)]' : 'text-[var(--fin-ink-soft)]'}`}
            >
              Caja
            </button>
          </div>
        </div>
        <p className="mt-2 text-[13px] text-[var(--fin-ink-faint)]">
          {base === 'devengo'
            ? 'Cuenta el valor total en la fecha del documento.'
            : 'Cuenta únicamente los abonos recibidos o pagados este mes.'}{' '}
          Estos valores son de gestión y no se suman a tus reportes personales.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Resumen titulo={base === 'devengo' ? 'Ingresos emitidos' : 'Ingresos recibidos'} valor={totales.ingresosCop} />
          <Resumen titulo={base === 'devengo' ? 'Gastos recibidos' : 'Pagos realizados'} valor={totales.gastosCop} />
          <Resumen titulo="Por cobrar" valor={totales.porCobrarCop} />
          <Resumen titulo="Por pagar" valor={totales.porPagarCop} />
        </div>
      </section>

      <form onSubmit={(e) => void crear(e)} className="flex flex-col gap-3 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
        <h3 className="flex items-center gap-2 font-semibold text-[var(--fin-ink)]">
          <FilePlus2 className="h-5 w-5" />Nuevo registro
        </h3>
        <label className="text-[13px] font-semibold text-[var(--fin-ink-soft)]">
          ¿Qué vas a registrar?
          <select
            value={tipo}
            onChange={(evento) => setTipo(evento.target.value as TipoDocumentoNegocio)}
            className="mt-1 min-h-11 w-full rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-card)] px-3 text-[16px] text-[var(--fin-ink)]"
          >
            <option value="por_cobrar">Cuenta por cobrar / factura emitida</option>
            <option value="por_pagar">Cuenta por pagar / factura recibida</option>
            <option value="cotizacion">Cotización para un cliente</option>
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo titulo={tipo === 'por_pagar' ? 'Proveedor' : 'Cliente'} valor={contraparte} cambiar={setContraparte} />
          <Campo titulo="Concepto" valor={concepto} cambiar={setConcepto} />
          <Campo titulo="Total en pesos" valor={monto} cambiar={setMonto} tipo="text" />
          <Campo titulo="Fecha del documento" valor={fecha} cambiar={setFecha} tipo="date" />
          <Campo titulo="Fecha de vencimiento (opcional)" valor={vence} cambiar={setVence} tipo="date" />
        </div>
        <button
          type="submit"
          disabled={ocupado}
          className="flex min-h-12 items-center justify-center gap-2 rounded-[var(--fin-r-pill)] bg-[var(--fin-accent)] px-5 font-bold text-white disabled:opacity-50"
        >
          {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <ReceiptText className="h-4 w-4" />}
          Guardar
        </button>
      </form>

      <section className="flex flex-col gap-3">
        <h3 className="font-semibold text-[var(--fin-ink)]">📚 Cuentas y cotizaciones</h3>
        {cargando ? (
          <p className="flex items-center gap-2 text-[13px] text-[var(--fin-ink-soft)]">
            <Loader2 className="h-4 w-4 animate-spin" />Cargando…
          </p>
        ) : documentos.length === 0 ? (
          <p className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4 text-[16px] text-[var(--fin-ink-soft)]">
            Todavía no hay registros; crea una cotización o añade la primera cuenta por cobrar o pagar.
          </p>
        ) : documentos.map((documento) => (
          <article key={documento.id} className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-semibold text-[var(--fin-ink)]">
                  {documento.tipo === 'cotizacion' ? '🧾 Cotización' : documento.tipo === 'por_cobrar' ? '💸 Por cobrar' : '🧾 Por pagar'} · {documento.contraparte}
                </p>
                <p className="mt-1 text-[13px] text-[var(--fin-ink-soft)]">
                  {documento.concepto} · {documento.fecha}{documento.vence ? ` · vence ${documento.vence}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-[var(--fin-ink)]">{formatCop(documento.totalCop)}</p>
                <p className="text-[13px] text-[var(--fin-ink-soft)]">Pendiente: {formatCop(saldoPendiente(documento))}</p>
              </div>
            </div>
            {documento.tipo === 'cotizacion' && documento.estado !== 'aceptado' ? (
              <button
                type="button"
                onClick={() => void crearFacturaDesdeCotizacion(documento)}
                disabled={ocupado}
                className="mt-3 flex min-h-11 items-center gap-2 rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-4 text-[13px] font-semibold text-[var(--fin-ink)]"
              >
                <Check className="h-4 w-4" />Convertir en cuenta por cobrar
              </button>
            ) : documento.tipo !== 'cotizacion' && saldoPendiente(documento) > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  aria-label="Monto del abono"
                  inputMode="numeric"
                  value={abono[documento.id] ?? ''}
                  onChange={(evento) => setAbono((actual) => ({ ...actual, [documento.id]: evento.target.value }))}
                  placeholder="Monto del abono"
                  className="min-h-11 min-w-0 flex-1 rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-card)] px-3 text-[16px] text-[var(--fin-ink)]"
                />
                <button
                  type="button"
                  onClick={() => void registrarAbono(documento)}
                  disabled={ocupado}
                  className="flex min-h-11 items-center gap-2 rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-4 text-[13px] font-semibold text-[var(--fin-ink)]"
                >
                  <HandCoins className="h-4 w-4" />Registrar abono
                </button>
              </div>
            ) : documento.tipo !== 'cotizacion' ? (
              <p className="mt-3 text-[13px] font-semibold text-[var(--fin-in)]">✅ Saldo cubierto</p>
            ) : null}
          </article>
        ))}
      </section>
      {mensaje ? (
        <p role="status" className="rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] p-3 text-[13px] text-[var(--fin-ink-soft)]">
          {mensaje}
        </p>
      ) : null}
      <p className="text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
        Este registro ayuda a organizar tu actividad; no genera una factura electrónica validada por la DIAN ni sustituye tu contabilidad. Los abonos aquí se reflejan en este módulo; anota también el movimiento real en Dinero.
      </p>
    </div>
  );
};

const Resumen: React.FC<{ titulo: string; valor: number }> = ({ titulo, valor }) => (
  <div className="rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] p-3">
    <p className="text-[13px] text-[var(--fin-ink-soft)]">{titulo}</p>
    <p className="mt-1 text-[17px] font-bold text-[var(--fin-ink)]">{formatCop(valor)}</p>
  </div>
);

const Campo: React.FC<{ titulo: string; valor: string; cambiar: (valor: string) => void; tipo?: string }> = ({
  titulo,
  valor,
  cambiar,
  tipo = 'text',
}) => (
  <label className="text-[13px] font-semibold text-[var(--fin-ink-soft)]">
    {titulo}
    <input
      required={titulo !== 'Fecha de vencimiento (opcional)'}
      type={tipo}
      value={valor}
      onChange={(evento) => cambiar(evento.target.value)}
      className="mt-1 min-h-11 w-full rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-card)] px-3 text-[16px] text-[var(--fin-ink)]"
    />
  </label>
);
