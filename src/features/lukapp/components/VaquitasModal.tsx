import { SelectorApp } from './SelectorApp';
import { IconoSimbolo } from './IconoSimbolo';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Plus, CheckCircle2, ArrowRight, Trash2 } from 'lucide-react';
import {
  calcularResumenVaquita,
  repartirCuota,
  type Vaquita,
  type ParticipanteVaquita,
} from '../lib/vaquitasColombia';
import { formatCop } from '../lib/formatCop';

interface VaquitasModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string | null;
}

const STORAGE_KEY = 'lukapp_vaquitas_v1';

export const VaquitasModal: React.FC<VaquitasModalProps> = ({ isOpen, onClose, userId }) => {
  const claveStorage = `${STORAGE_KEY}:${userId ?? 'local'}`;
  const [claveCargada, setClaveCargada] = useState(claveStorage);
  const [vaquitas, setVaquitas] = useState<Vaquita[]>(() => {
    try {
      const guardadas = localStorage.getItem(claveStorage);
      if (guardadas) {
        return JSON.parse(guardadas);
      }
    } catch {
      // Ignorar errores de parsing
    }
    return [];
  });

  useEffect(() => {
    try {
      const guardadas = localStorage.getItem(claveStorage);
      setVaquitas(guardadas ? JSON.parse(guardadas) : []);
    } catch {
      setVaquitas([]);
    }
    setClaveCargada(claveStorage);
  }, [claveStorage]);

  const [vaquitaSeleccionadaId, setVaquitaSeleccionadaId] = useState<string>('');
  const [mostrarCrear, setMostrarCrear] = useState(false);
  const [mostrarGasto, setMostrarGasto] = useState(false);

  // Formulario crear vaquita
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaMetaStr, setNuevaMetaStr] = useState('');
  const [nombresAmigosStr, setNombresAmigosStr] = useState('');
  const [descripcionGasto, setDescripcionGasto] = useState('');
  const [montoGastoStr, setMontoGastoStr] = useState('');
  const [pagadoGastoPor, setPagadoGastoPor] = useState('Yo');

  // Persistir en localStorage
  useEffect(() => {
    if (claveCargada !== claveStorage) return;
    try {
      localStorage.setItem(claveStorage, JSON.stringify(vaquitas));
    } catch {
      // Ignorar errores de storage
    }
  }, [claveCargada, claveStorage, vaquitas]);

  const vaquitaActiva =
    vaquitas.find((v) => v.id === vaquitaSeleccionadaId) || (vaquitas.length > 0 ? vaquitas[0] : null);
  const resumen = vaquitaActiva ? calcularResumenVaquita(vaquitaActiva) : null;

  const handleAgregarGasto = (e: React.FormEvent) => {
    e.preventDefault();
    const montoCop = Number(montoGastoStr.replace(/\D/g, ''));
    if (!vaquitaActiva || !descripcionGasto.trim() || montoCop <= 0) return;
    const gasto = {
      id: `gasto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      descripcion: descripcionGasto.trim(),
      montoCop,
      pagadoPor: pagadoGastoPor,
      fecha: new Date().toISOString().slice(0, 10),
    };
    setVaquitas((anteriores) => anteriores.map((vaquita) => vaquita.id === vaquitaActiva.id ? { ...vaquita, gastos: [...vaquita.gastos, gasto] } : vaquita));
    setDescripcionGasto('');
    setMontoGastoStr('');
    setMostrarGasto(false);
  };

  const handleEliminarGasto = (gastoId: string) => {
    if (!vaquitaActiva || !window.confirm('¿Eliminar este gasto del proyecto?')) return;
    setVaquitas((anteriores) => anteriores.map((vaquita) => vaquita.id === vaquitaActiva.id ? { ...vaquita, gastos: vaquita.gastos.filter((gasto) => gasto.id !== gastoId) } : vaquita));
  };

  const handleCrearVaquita = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombre.trim()) return;

    const amigos = nombresAmigosStr
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);

    const todosParticipantes = ['Yo', ...amigos];
    const meta = Number(nuevaMetaStr.replace(/\D/g, '')) || 0;
    if (meta <= 0) return;
    const cuotas = repartirCuota(meta, todosParticipantes.length);

    const participantes: ParticipanteVaquita[] = todosParticipantes.map((p, indice) => ({
      nombre: p,
      cuotaComprometida: cuotas[indice],
      aportadoCop: 0,
    }));

    const nuevaVaca: Vaquita = {
      id: `vaca-${Date.now()}`,
      nombre: nuevoNombre,
      emoji: '🐮',
      metaCop: meta,
      participantes,
      gastos: [],
      creadaEn: new Date().toISOString().slice(0, 10),
    };

    setVaquitas([nuevaVaca, ...vaquitas]);
    setVaquitaSeleccionadaId(nuevaVaca.id);
    setMostrarCrear(false);
    setNuevoNombre('');
    setNuevaMetaStr('');
    setNombresAmigosStr('');
  };

  const handleEliminarVaquita = (id: string) => {
    const vaquita = vaquitas.find((item) => item.id === id);
    if (!vaquita || !window.confirm(`¿Eliminar “${vaquita.nombre}” y sus aportes de este dispositivo? Esta acción no se puede deshacer.`)) return;
    const filtradas = vaquitas.filter((v) => v.id !== id);
    setVaquitas(filtradas);
    if (filtradas.length > 0) {
      setVaquitaSeleccionadaId(filtradas[0].id);
    } else {
      setVaquitaSeleccionadaId('');
    }
  };

  const handleMarcarPagado = (nombreParticipante: string) => {
    if (!vaquitaActiva) return;
    setVaquitas((prev) =>
      prev.map((v) => {
        if (v.id !== vaquitaActiva.id) return v;
        return {
          ...v,
          participantes: v.participantes.map((p) => {
            if (p.nombre !== nombreParticipante) return p;
            return {
              ...p,
              aportadoCop: p.cuotaComprometida,
            };
          }),
        };
      }),
    );
  };

  if (!isOpen || claveCargada !== claveStorage) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg rounded-[var(--fin-r-card)] bg-[var(--fin-card)] border border-[var(--fin-line)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Cabecera */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--fin-line)]">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--fin-warn-bg)] bg-[var(--fin-warn-bg)] text-[var(--fin-warn-ink)]">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-[var(--fin-ink)] leading-tight">
                  Vaquitas y Gastos Compartidos
                </h3>
                <span className="text-[13px] text-[var(--fin-ink-soft)]">
                  Cuentas claras entre parceros y familia
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-6">
            {!mostrarCrear && (!vaquitaActiva || vaquitas.length === 0) && (
              <div className="py-8 px-4 text-center space-y-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-[var(--fin-r-card)] bg-[var(--fin-warn-bg)] bg-[var(--fin-warn-bg)] text-[var(--fin-warn-ink)] mx-auto text-2xl">
                  <IconoSimbolo valor="Users" className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-[17px] font-bold text-[var(--fin-ink)]">
                    Sin vaquitas activas
                  </h4>
                  <p className="text-[13px] text-[var(--fin-ink-soft)] max-w-sm mx-auto">
                    Arma una vaca con amigos para paseos, asados, regalos o salidas. LukApp calcula las cuotas y quién le debe a quién automáticamente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMostrarCrear(true)}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] text-[var(--fin-on-accent)] text-[15px] font-bold shadow-xs hover:opacity-90 transition-opacity"
                >
                  <Plus className="h-4 w-4" />
                  Armar mi primera vaquita
                </button>
              </div>
            )}

            {!mostrarCrear && vaquitaActiva && resumen && (
              <div className="space-y-5">
                {/* Selector de vaquitas si hay varias */}
                {vaquitas.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {vaquitas.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                          onClick={() => { setVaquitaSeleccionadaId(v.id); setMostrarGasto(false); setPagadoGastoPor('Yo'); }}
                        className={`px-3 py-2 rounded-[var(--fin-r-control)] text-[13px] font-semibold shrink-0 transition-all ${
                          v.id === vaquitaActiva.id
                            ? 'bg-[var(--fin-accent)] text-[var(--fin-on-accent)] shadow-xs'
                            : 'bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]'
                        }`}
                      >
                        {v.nombre}
                      </button>
                    ))}
                  </div>
                )}

                {/* Banner de balance de la vaquita */}
                <div className="p-4 rounded-[var(--fin-r-card)] bg-[var(--fin-soft)] border border-[var(--fin-line)] space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[17px] font-bold text-[var(--fin-ink)]">
                      {vaquitaActiva.nombre}
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-[var(--fin-warn-ink)]">
                        {resumen.porcentajeRecoleccion}% recolectado
                      </span>
                      <button
                        type="button"
                        title="Eliminar vaquita"
                        onClick={() => handleEliminarVaquita(vaquitaActiva.id)}
                        className="p-1 rounded-[var(--fin-r-control)] text-[var(--fin-ink-soft)] hover:text-[var(--fin-out)] hover:bg-[var(--fin-out-bg)] dark:hover:bg-[var(--fin-out-bg)] transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Barra de progreso */}
                  <div className="h-2.5 w-full bg-[var(--fin-bg)] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${resumen.porcentajeRecoleccion}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 text-[13px]">
                    <div>
                      <span className="text-[var(--fin-ink-faint)] block text-[13px]">🎯 Presupuesto:</span>
                      <span className="font-bold text-[var(--fin-ink)]">{formatCop(vaquitaActiva.metaCop)}</span>
                    </div>
                    <div>
                      <span className="text-[var(--fin-ink-faint)] block text-[13px]">🐮 Recolectado:</span>
                      <span className="font-bold text-[var(--fin-in)]">{formatCop(resumen.totalRecolectado)}</span>
                    </div>
                    <div>
                      <span className="text-[var(--fin-ink-faint)] block text-[13px]">🧾 Gastado:</span>
                      <span className="font-bold text-[var(--fin-ink)]">{formatCop(resumen.totalGastado)}</span>
                    </div>
                    <div>
                      <span className="text-[var(--fin-ink-faint)] block text-[13px]">💰 Disponible:</span>
                      <span className={`font-bold ${resumen.saldoDisponible < 0 ? 'text-[var(--fin-out)]' : 'text-[var(--fin-ink)]'}`}>{formatCop(resumen.saldoDisponible)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-card)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h5 className="text-[15px] font-bold text-[var(--fin-ink)]">🧾 Gastos del proyecto</h5>
                      <p className="mt-1 text-[13px] text-[var(--fin-ink-soft)]">{vaquitaActiva.gastos.length ? `${vaquitaActiva.gastos.length} gastos registrados` : 'Aún no han anotado gastos.'}</p>
                    </div>
                    <button type="button" onClick={() => setMostrarGasto((mostrar) => !mostrar)} className="shrink-0 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-3 py-2 text-[13px] font-bold text-[var(--fin-on-accent)]">{mostrarGasto ? 'Cancelar' : '＋ Anotar gasto'}</button>
                  </div>
                  {mostrarGasto && (
                    <form onSubmit={handleAgregarGasto} className="mt-3 grid gap-3 border-t border-[var(--fin-line)] pt-3">
                      <label className="grid gap-1 text-[13px] font-semibold text-[var(--fin-ink-soft)]">¿Qué pagaron?
                        <input value={descripcionGasto} onChange={(evento) => setDescripcionGasto(evento.target.value)} required placeholder="Ej. Transporte del paseo" className="w-full rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-2 text-[16px] font-normal text-[var(--fin-ink)]" />
                      </label>
                      <label className="grid gap-1 text-[13px] font-semibold text-[var(--fin-ink-soft)]">¿Cuánto costó?
                        <input type="number" inputMode="numeric" min="1" step="1" value={montoGastoStr} onChange={(evento) => setMontoGastoStr(evento.target.value)} required placeholder="Ej. 85000" className="w-full rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-2 text-[16px] font-normal text-[var(--fin-ink)]" />
                      </label>
                      <label className="grid gap-1 text-[13px] font-semibold text-[var(--fin-ink-soft)]">¿Quién pagó?
                        <SelectorApp value={pagadoGastoPor} onChange={(evento) => setPagadoGastoPor(evento.target.value)} className="w-full rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-2 text-[16px] font-normal text-[var(--fin-ink)]">{vaquitaActiva.participantes.map((persona) => <option key={persona.nombre} value={persona.nombre}>{persona.nombre}</option>)}</SelectorApp>
                      </label>
                      <button type="submit" className="justify-self-end rounded-[var(--fin-r-control)] bg-[var(--fin-ink)] px-4 py-2 text-[13px] font-bold text-[var(--fin-bg)]">Guardar gasto 🐮</button>
                    </form>
                  )}
                  {vaquitaActiva.gastos.length > 0 && <ul className="mt-3 divide-y divide-[var(--fin-line)]">{vaquitaActiva.gastos.map((gasto) => <li key={gasto.id} className="flex items-center justify-between gap-3 py-2 text-[13px]"><span className="min-w-0"><strong className="block truncate text-[var(--fin-ink)]">{gasto.descripcion}</strong><span className="text-[var(--fin-ink-soft)]">Pagó {gasto.pagadoPor} · {gasto.fecha}</span></span><span className="flex shrink-0 items-center gap-2 font-bold text-[var(--fin-ink)]">{formatCop(gasto.montoCop)}<button type="button" aria-label={`Eliminar gasto ${gasto.descripcion}`} title="Eliminar gasto" onClick={() => handleEliminarGasto(gasto.id)} className="rounded p-1 text-[var(--fin-ink-faint)] hover:text-[var(--fin-out)]"><Trash2 className="h-4 w-4" /></button></span></li>)}</ul>}
                </div>

                {/* Participantes y cuotas */}
                <div className="space-y-2.5">
                  <span className="text-[13px] font-bold text-[var(--fin-ink)] block">
                    Participantes ({vaquitaActiva.participantes.length}):
                  </span>
                  <div className="space-y-2">
                    {vaquitaActiva.participantes.map((p) => {
                      const pagoCompleto = p.aportadoCop >= p.cuotaComprometida;
                      return (
                        <div
                          key={p.nombre}
                          className="flex items-center justify-between p-3 rounded-[var(--fin-r-control)] bg-[var(--fin-bg)] border border-[var(--fin-line)]"
                        >
                          <div>
                            <span className="text-[15px] font-semibold text-[var(--fin-ink)] block">
                              {p.nombre}
                            </span>
                            <span className="text-[13px] text-[var(--fin-ink-soft)]">
                              Cuota: {formatCop(p.cuotaComprometida)} · Aportó: {formatCop(p.aportadoCop)}
                            </span>
                          </div>
                          {pagoCompleto ? (
                            <span className="flex items-center gap-1 text-[13px] font-bold text-[var(--fin-in)] bg-[var(--fin-in-bg)] bg-[var(--fin-in-bg)] px-3 py-1 rounded-full">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Al día
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleMarcarPagado(p.nombre)}
                              className="px-3 py-1 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] text-[var(--fin-on-accent)] text-[13px] font-bold hover:opacity-90"
                            >
                              Marcar pagado
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Liquidación sugerida (quién le debe a quién) */}
                {resumen.liquidacionesSugeridas.length > 0 && (
                  <div className="p-4 rounded-[var(--fin-r-card)] bg-[var(--fin-warn-bg)] bg-[var(--fin-warn-bg)] border border-[var(--fin-warn)]/30 dark:border-amber-900/60 space-y-2">
                    <span className="text-[13px] font-bold text-amber-900 dark:text-amber-300 block">
                      Para quedar a mano:
                    </span>
                    {resumen.liquidacionesSugeridas.map((liq, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-[13px] text-[var(--fin-ink)]">
                        <strong>{liq.deudor}</strong>
                        <ArrowRight className="h-3.5 w-3.5 text-[var(--fin-warn-ink)]" />
                        <span>le debe transferir</span>
                        <strong className="text-[var(--fin-warn-ink)] text-[var(--fin-warn-ink)]">{formatCop(liq.montoCop)}</strong>
                        <span>a <strong>{liq.acreedor}</strong></span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setMostrarCrear(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] text-[var(--fin-ink)] text-[15px] font-bold hover:bg-[var(--fin-card-hover)] transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Armar otra vaca
                </button>
              </div>
            )}

            {mostrarCrear && (
              <form onSubmit={handleCrearVaquita} className="space-y-4">
                <h4 className="text-[15px] font-bold text-[var(--fin-ink)]">
                  Armar una Vaquita nueva
                </h4>

                <div>
                  <label className="block text-[13px] font-semibold text-[var(--fin-ink)] mb-1">
                    ¿Para qué es la vaca?
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Paseo a Melgar, Asado, Regalo Mamá..."
                    value={nuevoNombre}
                    onChange={(e) => setNuevoNombre(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] text-[17px] text-[var(--fin-ink)]"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[var(--fin-ink)] mb-1">
                    Meta de plata total (COP):
                  </label>
                  <input
                    type="number"
                    placeholder="Ej. 200000"
                    value={nuevaMetaStr}
                    onChange={(e) => setNuevaMetaStr(e.target.value.replace(/\D/g, ''))}
                    required
                    min="1"
                    step="1"
                    className="w-full px-4 py-3 rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] text-[17px] text-[var(--fin-ink)] font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[var(--fin-ink)] mb-1">
                    Amigos que participan (separados por coma):
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Carlos, María, Juan..."
                    value={nombresAmigosStr}
                    onChange={(e) => setNombresAmigosStr(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] text-[17px] text-[var(--fin-ink)]"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setMostrarCrear(false)}
                    className="flex-1 py-3 rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] text-[var(--fin-ink)] text-[15px] font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] text-[var(--fin-on-accent)] text-[15px] font-bold"
                  >
                    Crear Vaquita
                  </button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
