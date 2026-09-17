import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, Mic, X } from 'lucide-react';
import type { Cajita } from '../data/modelos';
import { ES_PASIVO, etiquetaTipoCajita } from '../data/modelos';
import { conPuntos, formatAmountInput, formatCop, parseAmountInput, parseSaldoInput } from '../lib/formatCop';
import { bogotaDate } from '../lib/localDate';
import type { ComandoVoz, ComandoVozConfirmado } from '../lib/parseComandoVoz';

interface ConfirmarComandoVozProps {
  comando: ComandoVoz;
  cajitas: readonly Cajita[];
  saldos: ReadonlyMap<string, number>;
  onConfirmar: (comando: ComandoVozConfirmado) => void | Promise<void>;
  onCancelar: () => void;
  onReintentar?: () => void;
}

const TITULOS: Record<ComandoVoz['tipo'], string> = {
  transferencia: 'Confirmar transferencia',
  abono: 'Confirmar abono',
  saldo: 'Confirmar saldo',
  rendimiento: 'Confirmar rendimiento',
};

export const ConfirmarComandoVoz: React.FC<ConfirmarComandoVozProps> = ({
  comando,
  cajitas,
  saldos,
  onConfirmar,
  onCancelar,
  onReintentar,
}) => {
  const activas = useMemo(() => cajitas.filter((c) => c.archivedAt === null), [cajitas]);
  const activos = activas.filter((c) => !ES_PASIVO[c.tipo]);
  const cuentas = activos.filter((c) => c.tipo === 'cuenta');
  const pasivos = activas.filter((c) => ES_PASIVO[c.tipo]);
  const ahorros = activas.filter((c) => c.tipo === 'cajita');

  const [origenId, setOrigenId] = useState(comando.tipo === 'transferencia' ? comando.origenId ?? '' : '');
  const [destinoId, setDestinoId] = useState(comando.tipo === 'transferencia' ? comando.destinoId ?? '' : '');
  const [deudaId, setDeudaId] = useState(comando.tipo === 'abono' ? comando.deudaId ?? '' : '');
  const [cuentaId, setCuentaId] = useState(comando.tipo === 'abono' ? comando.cuentaId ?? '' : '');
  const [cajitaId, setCajitaId] = useState(
    comando.tipo === 'saldo' || comando.tipo === 'rendimiento' ? comando.cajitaId ?? '' : '',
  );
  const montoInicial = comando.tipo === 'saldo' ? comando.saldoCop : comando.montoCop;
  const [montoTexto, setMontoTexto] = useState(formatAmountInput(montoInicial));
  const [fecha, setFecha] = useState(comando.tipo === 'saldo' ? '' : comando.occurredOn ?? '');
  const [guardando, setGuardando] = useState(false);

  const monto = comando.tipo === 'saldo' ? parseSaldoInput(montoTexto) : parseAmountInput(montoTexto);
  const saldoOrigen = saldos.get(comando.tipo === 'abono' ? cuentaId : origenId) ?? 0;
  const deudaActual = Math.abs(saldos.get(deudaId) ?? 0);
  const mismaCuenta = comando.tipo === 'transferencia' && origenId !== '' && origenId === destinoId;
  const abonoExcedeDeuda = comando.tipo === 'abono' && monto !== null && deudaId !== '' && monto > deudaActual;
  const saldoInsuficiente =
    monto !== null &&
    (comando.tipo === 'transferencia' || comando.tipo === 'abono') &&
    (comando.tipo === 'abono' ? cuentaId : origenId) !== '' &&
    monto > saldoOrigen;

  const camposCompletos = (() => {
    if (monto === null) return false;
    if (comando.tipo === 'transferencia') return origenId !== '' && destinoId !== '' && !mismaCuenta;
    if (comando.tipo === 'abono') return deudaId !== '' && cuentaId !== '' && !abonoExcedeDeuda;
    return cajitaId !== '';
  })();

  const opciones = (lista: readonly Cajita[], excluir = '') => (
    <>
      <option value="">Selecciona una opción</option>
      {lista.filter((c) => c.id !== excluir).map((c) => (
        <option key={c.id} value={c.id}>{c.nombre} · {etiquetaTipoCajita(c)}</option>
      ))}
    </>
  );

  const confirmar = async () => {
    if (!camposCompletos || monto === null || guardando) return;
    setGuardando(true);
    try {
      const conFecha = fecha ? { occurredOn: fecha } : {};
      if (comando.tipo === 'transferencia') {
        await onConfirmar({ tipo: 'transferencia', origenId, destinoId, montoCop: monto, ...conFecha });
      } else if (comando.tipo === 'abono') {
        await onConfirmar({ tipo: 'abono', deudaId, cuentaId, montoCop: monto, ...conFecha });
      } else if (comando.tipo === 'saldo') {
        await onConfirmar({ tipo: 'saldo', cajitaId, saldoCop: monto });
      } else {
        await onConfirmar({ tipo: 'rendimiento', cajitaId, montoCop: monto, ...conFecha });
      }
    } finally {
      setGuardando(false);
    }
  };

  const etiquetaBoton = comando.tipo === 'transferencia'
    ? 'Transferir'
    : comando.tipo === 'abono'
      ? 'Registrar abono'
      : comando.tipo === 'saldo'
        ? 'Actualizar saldo'
        : 'Registrar rendimiento';

  return (
    <div className="fixed inset-0 z-[80] flex items-end bg-black/80 p-4 backdrop-blur-sm sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-labelledby="comando-voz-titulo">
      <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[var(--fin-r-sheet)] border-2 border-[var(--fin-line)] bg-[var(--fin-bg)] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--fin-accent)]">Orden por voz</p>
            <h2 id="comando-voz-titulo" className="mt-1 text-lg font-bold text-[var(--fin-ink)]">{TITULOS[comando.tipo]}</h2>
          </div>
          <button type="button" onClick={onCancelar} aria-label="Cerrar" className="rounded-full bg-[var(--fin-soft)] p-2 text-[var(--fin-ink-soft)]"><X className="h-4 w-4" /></button>
        </div>

        <div className="mt-4 rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-card)] px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--fin-ink-faint)]">Esto fue lo que entendí</p>
          <p className="mt-1 text-[15px] font-medium leading-relaxed text-[var(--fin-ink)]">“{comando.raw}”</p>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {comando.tipo === 'transferencia' ? (
            <>
              <label className="text-[13px] font-semibold text-[var(--fin-ink-soft)]">Cuenta de origen<select aria-label="Cuenta de origen" value={origenId} onChange={(e) => setOrigenId(e.target.value)} className="mt-1.5 w-full rounded-[var(--fin-r-control)] border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-2.5 text-[16px] text-[var(--fin-ink)]">{opciones(activos, destinoId)}</select></label>
              <label className="text-[13px] font-semibold text-[var(--fin-ink-soft)]">Cuenta o cajita de destino<select aria-label="Cuenta o cajita de destino" value={destinoId} onChange={(e) => setDestinoId(e.target.value)} className="mt-1.5 w-full rounded-[var(--fin-r-control)] border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-2.5 text-[16px] text-[var(--fin-ink)]">{opciones(activos, origenId)}</select></label>
            </>
          ) : comando.tipo === 'abono' ? (
            <>
              <label className="text-[13px] font-semibold text-[var(--fin-ink-soft)]">Tarjeta o deuda<select aria-label="Tarjeta o deuda" value={deudaId} onChange={(e) => setDeudaId(e.target.value)} className="mt-1.5 w-full rounded-[var(--fin-r-control)] border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-2.5 text-[16px] text-[var(--fin-ink)]">{opciones(pasivos)}</select></label>
              <label className="text-[13px] font-semibold text-[var(--fin-ink-soft)]">Pagar desde<select aria-label="Pagar desde" value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} className="mt-1.5 w-full rounded-[var(--fin-r-control)] border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-2.5 text-[16px] text-[var(--fin-ink)]">{opciones(cuentas)}</select></label>
            </>
          ) : (
            <label className="text-[13px] font-semibold text-[var(--fin-ink-soft)]">
              {comando.tipo === 'saldo' ? 'Cuenta, cajita, tarjeta o deuda' : 'Cajita que recibió el rendimiento'}
              <select aria-label={comando.tipo === 'saldo' ? 'Saldo de' : 'Cajita'} value={cajitaId} onChange={(e) => setCajitaId(e.target.value)} className="mt-1.5 w-full rounded-[var(--fin-r-control)] border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-2.5 text-[16px] text-[var(--fin-ink)]">{opciones(comando.tipo === 'saldo' ? activas : ahorros)}</select>
            </label>
          )}

          <label className="text-[13px] font-semibold text-[var(--fin-ink-soft)]">
            {comando.tipo === 'saldo' ? 'Nuevo saldo' : 'Monto'}
            <div className="mt-1.5 flex items-center gap-2 rounded-[var(--fin-r-control)] border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-2.5">
              <span className="text-[18px] text-[var(--fin-ink-faint)]">$</span>
              <input aria-label={comando.tipo === 'saldo' ? 'Nuevo saldo' : 'Monto'} value={montoTexto} onChange={(e) => setMontoTexto(conPuntos(e.target.value))} inputMode="numeric" placeholder="0" className="w-full bg-transparent text-[20px] font-bold tabular-nums text-[var(--fin-ink)] focus:outline-none" />
            </div>
          </label>
          {comando.tipo !== 'saldo' ? (
            <label className="text-[13px] font-semibold text-[var(--fin-ink-soft)]">
              Fecha
              <input aria-label="Fecha" type="date" value={fecha} max={bogotaDate()} onChange={(e) => setFecha(e.target.value)} className="mt-1.5 w-full rounded-[var(--fin-r-control)] border-2 border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-2.5 text-[16px] text-[var(--fin-ink)]" />
              <span className="mt-1 block text-[11px] font-normal text-[var(--fin-ink-faint)]">Vacía significa hoy.</span>
            </label>
          ) : null}
        </div>

        {mismaCuenta ? <p role="alert" className="mt-3 flex gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-out-bg)] px-3 py-2.5 text-[13px] text-[var(--fin-out-ink)]"><AlertTriangle className="h-4 w-4 shrink-0" />El origen y el destino deben ser distintos.</p> : null}
        {abonoExcedeDeuda ? <p role="alert" className="mt-3 flex gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-out-bg)] px-3 py-2.5 text-[13px] text-[var(--fin-out-ink)]"><AlertTriangle className="h-4 w-4 shrink-0" />El abono supera la deuda registrada de {formatCop(deudaActual)}. Actualiza primero el saldo si esa cifra está desactualizada.</p> : null}
        {saldoInsuficiente ? <p className="mt-3 flex gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-warn-bg)] px-3 py-2.5 text-[13px] text-[var(--fin-warn-ink)]"><AlertTriangle className="h-4 w-4 shrink-0" />La cuenta de origen tiene {formatCop(saldoOrigen)}. Puedes continuar si ese saldo aún no está actualizado.</p> : null}
        {monto === null ? <p role="alert" className="mt-3 text-[13px] text-[var(--fin-out)]">Escribe un monto válido antes de continuar.</p> : null}

        <p className="mt-4 text-[12px] leading-relaxed text-[var(--fin-ink-faint)]">
          Nada se aplica hasta que revises estos datos y confirmes.
        </p>
        <div className="mt-4 flex gap-2">
          {onReintentar ? <button type="button" onClick={onReintentar} className="flex items-center justify-center gap-1.5 rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] px-3 py-3 text-[14px] font-semibold text-[var(--fin-ink-soft)]"><Mic className="h-4 w-4" />Repetir</button> : null}
          <button type="button" onClick={onCancelar} className="flex-1 rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] py-3 font-semibold text-[var(--fin-ink-soft)]">Cancelar</button>
          <button type="button" onClick={() => void confirmar()} disabled={!camposCompletos || guardando} className="flex flex-1 items-center justify-center gap-1.5 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] py-3 font-semibold text-[var(--fin-on-accent)] disabled:opacity-35"><Check className="h-4 w-4" />{guardando ? 'Guardando…' : etiquetaBoton}</button>
        </div>
      </div>
    </div>
  );
};
