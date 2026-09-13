import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Plus, CheckCircle2, ArrowRight, Trash2 } from 'lucide-react';
import {
  calcularResumenVaquita,
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

  const [vaquitaSeleccionadaId, setVaquitaSeleccionadaId] = useState<string>('');
  const [mostrarCrear, setMostrarCrear] = useState(false);

  // Formulario crear vaquita
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevaMetaStr, setNuevaMetaStr] = useState('');
  const [nombresAmigosStr, setNombresAmigosStr] = useState('');

  // Persistir en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(claveStorage, JSON.stringify(vaquitas));
    } catch {
      // Ignorar errores de storage
    }
  }, [claveStorage, vaquitas]);

  const vaquitaActiva =
    vaquitas.find((v) => v.id === vaquitaSeleccionadaId) || (vaquitas.length > 0 ? vaquitas[0] : null);
  const resumen = vaquitaActiva ? calcularResumenVaquita(vaquitaActiva) : null;

  const handleCrearVaquita = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoNombre.trim()) return;

    const amigos = nombresAmigosStr
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);

    const todosParticipantes = ['Yo', ...amigos];
    const meta = Number(nuevaMetaStr.replace(/\D/g, '')) || 0;
    const cuotaPorPersona = todosParticipantes.length > 0 ? Math.round(meta / todosParticipantes.length) : meta;

    const participantes: ParticipanteVaquita[] = todosParticipantes.map((p) => ({
      nombre: p,
      cuotaComprometida: cuotaPorPersona,
      aportadoCop: p === 'Yo' ? cuotaPorPersona : 0,
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

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg rounded-[28px] bg-[var(--fin-card)] border border-[var(--fin-line)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Cabecera */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--fin-line)]">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-[var(--fin-ink)] leading-tight">
                  Vaquitas y Gastos Compartidos
                </h3>
                <span className="text-[12px] text-[var(--fin-ink-soft)]">
                  Cuentas claras entre parceros y familia
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-[var(--fin-ink-soft)] hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)] transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-6">
            {!mostrarCrear && (!vaquitaActiva || vaquitas.length === 0) && (
              <div className="py-8 px-4 text-center space-y-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 mx-auto text-2xl">
                  🐮
                </div>
                <div className="space-y-1">
                  <h4 className="text-[16px] font-bold text-[var(--fin-ink)]">
                    Sin vaquitas activas
                  </h4>
                  <p className="text-[13px] text-[var(--fin-ink-soft)] max-w-sm mx-auto">
                    Arma una vaca con amigos para paseos, asados, regalos o salidas. LukApp calcula las cuotas y quién le debe a quién automáticamente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMostrarCrear(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--fin-accent)] text-[var(--fin-on-accent)] text-[14px] font-bold shadow-xs hover:opacity-90 transition-opacity"
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
                        onClick={() => setVaquitaSeleccionadaId(v.id)}
                        className={`px-3 py-1.5 rounded-xl text-[13px] font-semibold shrink-0 transition-all ${
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
                <div className="p-4 rounded-2xl bg-[var(--fin-soft)] border border-[var(--fin-line)] space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[16px] font-bold text-[var(--fin-ink)]">
                      {vaquitaActiva.nombre}
                    </h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-amber-600">
                        {resumen.porcentajeRecoleccion}% recolectado
                      </span>
                      <button
                        type="button"
                        title="Eliminar vaquita"
                        onClick={() => handleEliminarVaquita(vaquitaActiva.id)}
                        className="p-1 rounded-lg text-[var(--fin-ink-soft)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
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
                      <span className="text-[var(--fin-ink-faint)] block text-[11.5px]">Meta Total:</span>
                      <span className="font-bold text-[var(--fin-ink)]">{formatCop(vaquitaActiva.metaCop)}</span>
                    </div>
                    <div>
                      <span className="text-[var(--fin-ink-faint)] block text-[11.5px]">Recolectado:</span>
                      <span className="font-bold text-emerald-600">{formatCop(resumen.totalRecolectado)}</span>
                    </div>
                  </div>
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
                          className="flex items-center justify-between p-3 rounded-xl bg-[var(--fin-bg)] border border-[var(--fin-line)]"
                        >
                          <div>
                            <span className="text-[14px] font-semibold text-[var(--fin-ink)] block">
                              {p.nombre}
                            </span>
                            <span className="text-[12px] text-[var(--fin-ink-soft)]">
                              Cuota: {formatCop(p.cuotaComprometida)} · Aportó: {formatCop(p.aportadoCop)}
                            </span>
                          </div>
                          {pagoCompleto ? (
                            <span className="flex items-center gap-1 text-[12px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Al día
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleMarcarPagado(p.nombre)}
                              className="px-2.5 py-1 rounded-lg bg-[var(--fin-accent)] text-[var(--fin-on-accent)] text-[12px] font-bold hover:opacity-90"
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
                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 space-y-2">
                    <span className="text-[13px] font-bold text-amber-900 dark:text-amber-300 block">
                      🤝 Para quedar a mano sin enredos:
                    </span>
                    {resumen.liquidacionesSugeridas.map((liq, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-[13px] text-[var(--fin-ink)]">
                        <strong>{liq.deudor}</strong>
                        <ArrowRight className="h-3.5 w-3.5 text-amber-600" />
                        <span>le debe transferir</span>
                        <strong className="text-amber-700 dark:text-amber-400">{formatCop(liq.montoCop)}</strong>
                        <span>a <strong>{liq.acreedor}</strong></span>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setMostrarCrear(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--fin-soft)] text-[var(--fin-ink)] text-[14px] font-bold hover:bg-[var(--fin-card-hover)] transition-colors"
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--fin-line)] bg-[var(--fin-bg)] text-[16px] text-[var(--fin-ink)]"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-semibold text-[var(--fin-ink)] mb-1">
                    Meta de plata total (COP):
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. 200000"
                    value={nuevaMetaStr}
                    onChange={(e) => setNuevaMetaStr(e.target.value.replace(/\D/g, ''))}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--fin-line)] bg-[var(--fin-bg)] text-[16px] text-[var(--fin-ink)] font-bold"
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
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--fin-line)] bg-[var(--fin-bg)] text-[16px] text-[var(--fin-ink)]"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setMostrarCrear(false)}
                    className="flex-1 py-2.5 rounded-xl bg-[var(--fin-soft)] text-[var(--fin-ink)] text-[14px] font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-[var(--fin-accent)] text-[var(--fin-on-accent)] text-[14px] font-bold"
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
