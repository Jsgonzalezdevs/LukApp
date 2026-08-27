import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Transaction } from '../types';
import { analizarTopesRenta, calcularRetencionHonorarios, TOPES_RENTA_UVT } from '../lib/tributarioColombia';
import { formatCop } from '../lib/formatCop';
import { UVT_POR_DEFECTO } from '../lib/gmf';

interface HerramientasFiscalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  transacciones: readonly Transaction[];
}

type TabFiscal = 'renta' | '4x1000' | 'retencion';

export const HerramientasFiscalesModal: React.FC<HerramientasFiscalesModalProps> = ({
  isOpen,
  onClose,
  transacciones,
}) => {
  const [tab, setTab] = useState<TabFiscal>('renta');

  // Estado del simulador de retención
  const [montoBrutoStr, setMontoBrutoStr] = useState('3000000');
  const [esDeclarante, setEsDeclarante] = useState(false);
  const [tipoHonorario, setTipoHonorario] = useState<'honorarios' | 'servicios'>('honorarios');

  const estadoRenta = useMemo(() => {
    return analizarTopesRenta(transacciones, new Date().getFullYear(), UVT_POR_DEFECTO);
  }, [transacciones]);

  const liquidacionRetencion = useMemo(() => {
    const num = Number(montoBrutoStr.replace(/\D/g, '')) || 0;
    return calcularRetencionHonorarios(num, {
      declaraRenta: esDeclarante,
      tipo: tipoHonorario,
      tarifaReteIcaPorMil: 9.66,
    });
  }, [montoBrutoStr, esDeclarante, tipoHonorario]);

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
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-[17px] font-bold text-[var(--fin-ink)] leading-tight">
                  Asesor Fiscal Colombiano
                </h3>
                <span className="text-[12px] text-[var(--fin-ink-soft)]">
                  Topes DIAN {UVT_POR_DEFECTO.anio} · UVT {formatCop(UVT_POR_DEFECTO.pesos)}
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

          {/* Selector de pestañas */}
          <div className="flex p-2 bg-[var(--fin-soft)] gap-1 border-b border-[var(--fin-line)]">
            <button
              type="button"
              onClick={() => setTab('renta')}
              className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                tab === 'renta'
                  ? 'bg-[var(--fin-card)] text-[var(--fin-ink)] shadow-xs font-bold'
                  : 'text-[var(--fin-ink-soft)] hover:text-[var(--fin-ink)]'
              }`}
            >
              Semáforo Renta DIAN
            </button>
            <button
              type="button"
              onClick={() => setTab('retencion')}
              className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                tab === 'retencion'
                  ? 'bg-[var(--fin-card)] text-[var(--fin-ink)] shadow-xs font-bold'
                  : 'text-[var(--fin-ink-soft)] hover:text-[var(--fin-ink)]'
              }`}
            >
              Simulador Retefuente
            </button>
            <button
              type="button"
              onClick={() => setTab('4x1000')}
              className={`flex-1 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                tab === '4x1000'
                  ? 'bg-[var(--fin-card)] text-[var(--fin-ink)] shadow-xs font-bold'
                  : 'text-[var(--fin-ink-soft)] hover:text-[var(--fin-ink)]'
              }`}
            >
              4×1000 Tips
            </button>
          </div>

          {/* Contenido scrolleable */}
          <div className="p-6 overflow-y-auto space-y-6">
            {/* PESTAÑA 1: SEMÁFORO RENTA */}
            {tab === 'renta' && (
              <div className="space-y-5">
                {/* Banner de estado */}
                <div
                  className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
                    estadoRenta.semaforoGeneral === 'verde'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60'
                      : estadoRenta.semaforoGeneral === 'amarillo'
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60'
                        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60'
                  }`}
                >
                  {estadoRenta.semaforoGeneral === 'verde' ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="text-[15px] font-bold text-[var(--fin-ink)]">
                      {estadoRenta.semaforoGeneral === 'verde'
                        ? 'No obligado a declarar (Margen seguro)'
                        : estadoRenta.semaforoGeneral === 'amarillo'
                          ? 'Acercándote al tope de 1.400 UVT'
                          : 'Topes de declaración alcanzados'}
                    </h4>
                    <p className="mt-1 text-[13px] leading-relaxed text-[var(--fin-ink-soft)]">
                      {estadoRenta.mensajeConsejo}
                    </p>
                  </div>
                </div>

                {/* Métricas de consignaciones y compras */}
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-[13px] font-semibold mb-1.5">
                      <span className="text-[var(--fin-ink)]">Consignaciones / Ingresos {estadoRenta.anio}</span>
                      <span className="text-[var(--fin-ink-soft)] font-mono">
                        {formatCop(estadoRenta.acumuladoConsignacionesPesos)} / {formatCop(estadoRenta.topeConsignacionesPesos)}
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-[var(--fin-soft)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          estadoRenta.porcentajeConsignaciones >= 90
                            ? 'bg-rose-500'
                            : estadoRenta.porcentajeConsignaciones >= 70
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                        }`}
                        style={{ width: `${estadoRenta.porcentajeConsignaciones}%` }}
                      />
                    </div>
                    <span className="text-[11.5px] text-[var(--fin-ink-faint)] mt-1 block text-right">
                      {estadoRenta.porcentajeConsignaciones}% del umbral ({TOPES_RENTA_UVT.INGRESOS_BRUTOS} UVT)
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-[13px] font-semibold mb-1.5">
                      <span className="text-[var(--fin-ink)]">Compras y Consumos {estadoRenta.anio}</span>
                      <span className="text-[var(--fin-ink-soft)] font-mono">
                        {formatCop(estadoRenta.acumuladoComprasPesos)} / {formatCop(estadoRenta.topeComprasPesos)}
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-[var(--fin-soft)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          estadoRenta.porcentajeCompras >= 90
                            ? 'bg-rose-500'
                            : estadoRenta.porcentajeCompras >= 70
                              ? 'bg-amber-500'
                              : 'bg-blue-500'
                        }`}
                        style={{ width: `${estadoRenta.porcentajeCompras}%` }}
                      />
                    </div>
                    <span className="text-[11.5px] text-[var(--fin-ink-faint)] mt-1 block text-right">
                      {estadoRenta.porcentajeCompras}% del umbral ({TOPES_RENTA_UVT.COMPRAS_CONSUMOS} UVT)
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[var(--fin-soft)] text-[12.5px] text-[var(--fin-ink-soft)] leading-relaxed">
                  💡 <strong>Nota legal:</strong> Este cálculo es una estimación basada en tus registros en LukApp. La DIAN consolida reportes de todas las entidades financieras del país.
                </div>
              </div>
            )}

            {/* PESTAÑA 2: SIMULADOR DE RETENCIÓN */}
            {tab === 'retencion' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-[13px] font-semibold text-[var(--fin-ink)] mb-1.5">
                    Valor bruto de tu cuenta de cobro o contrato:
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--fin-ink-soft)] font-bold">
                      $
                    </span>
                    <input
                      type="text"
                      value={Number(montoBrutoStr).toLocaleString('es-CO')}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        setMontoBrutoStr(raw);
                      }}
                      className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-[var(--fin-line)] bg-[var(--fin-bg)] text-[16px] font-bold text-[var(--fin-ink)]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--fin-ink-soft)] mb-1">
                      Tipo de ingreso:
                    </label>
                    <select
                      value={tipoHonorario}
                      onChange={(e) => setTipoHonorario(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-[var(--fin-line)] bg-[var(--fin-bg)] text-[16px] font-semibold text-[var(--fin-ink)]"
                    >
                      <option value="honorarios">Honorarios (10% / 11%)</option>
                      <option value="servicios">Servicios (4% / 6%)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[var(--fin-ink-soft)] mb-1">
                      Declaras renta:
                    </label>
                    <select
                      value={esDeclarante ? 'si' : 'no'}
                      onChange={(e) => setEsDeclarante(e.target.value === 'si')}
                      className="w-full px-3 py-2 rounded-xl border border-[var(--fin-line)] bg-[var(--fin-bg)] text-[16px] font-semibold text-[var(--fin-ink)]"
                    >
                      <option value="no">No declarante (10%)</option>
                      <option value="si">Sí declarante (11%)</option>
                    </select>
                  </div>
                </div>

                {/* Desglose de liquidación */}
                <div className="p-4 rounded-2xl bg-[var(--fin-soft)] space-y-2.5 text-[13.5px]">
                  <div className="flex justify-between">
                    <span className="text-[var(--fin-ink-soft)]">Retención en la fuente ({liquidacionRetencion.tarifaRetefuentePct}%):</span>
                    <span className="font-semibold text-rose-600">-{formatCop(liquidacionRetencion.valorRetefuente)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--fin-ink-soft)]">ReteICA (9.66 x 1.000):</span>
                    <span className="font-semibold text-rose-600">-{formatCop(liquidacionRetencion.valorReteIca)}</span>
                  </div>
                  <div className="pt-2 border-t border-[var(--fin-line)] flex justify-between items-center">
                    <span className="font-extrabold text-[var(--fin-ink)]">Neto en tu cuenta:</span>
                    <span className="text-[17px] font-extrabold text-emerald-600">{formatCop(liquidacionRetencion.netoARecibir)}</span>
                  </div>
                </div>

                {/* Aportes Seguridad Social */}
                <div className="p-3.5 rounded-xl border border-[var(--fin-line)] bg-[var(--fin-bg)] space-y-1.5 text-[12.5px]">
                  <span className="font-bold text-[var(--fin-ink)] block">
                    Seguridad Social Sugerida (PILAS):
                  </span>
                  <div className="flex justify-between text-[var(--fin-ink-soft)]">
                    <span>IBC (40%): {formatCop(liquidacionRetencion.seguridadSocialSugerida.ibc)}</span>
                    <span>Salud (12.5%): {formatCop(liquidacionRetencion.seguridadSocialSugerida.salud)}</span>
                  </div>
                  <div className="flex justify-between text-[var(--fin-ink-soft)]">
                    <span>Pensión (16%): {formatCop(liquidacionRetencion.seguridadSocialSugerida.pension)}</span>
                    <span className="font-semibold text-[var(--fin-ink)]">Total Aportes: {formatCop(liquidacionRetencion.seguridadSocialSugerida.totalAportes)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* PESTAÑA 3: TIPS 4x1000 */}
            {tab === '4x1000' && (
              <div className="space-y-4 text-[13.5px] leading-relaxed text-[var(--fin-ink-soft)]">
                <div className="p-4 rounded-2xl bg-[var(--fin-soft)] border border-[var(--fin-line)]">
                  <h4 className="font-bold text-[var(--fin-ink)] text-[15px] mb-1">
                    ¿Cómo funciona la exención de 350 UVT?
                  </h4>
                  <p>
                    Tienes derecho por ley a <strong>1 cuenta bancaria exenta de 4×1000</strong> en todo el sistema financiero colombiano para retiros y transferencias de hasta <strong>$18.330.900 al mes</strong> (350 UVT).
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[var(--fin-soft)] border border-[var(--fin-line)]">
                  <h4 className="font-bold text-[var(--fin-ink)] text-[15px] mb-1">
                    Billeteras digitales (Nequi / Daviplata)
                  </h4>
                  <p>
                    Los depósitos de bajo monto tienen exención automática de hasta <strong>65 UVT mensuales (~$3.404.310)</strong> sin necesidad de trámites. Si mueves más, te cobrarán el 4×1000 a menos que la tengas marcada como tu cuenta exenta principal.
                  </p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
