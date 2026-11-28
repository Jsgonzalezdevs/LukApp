import React from 'react';
import {
  Loader2,
  Cpu,
  Zap,
  Clock,
  CheckCircle2,
  RefreshCw,
  MessageSquare,
  Cog,
  Sparkles,
} from 'lucide-react';
import { formatearFechaHoraConsulta, safeNum, safeNumDesconocido } from './formato';
import { type MetricasIAAdmin } from './metricasIA';
import { ContextoIAPanel } from '../ContextoIAPanel';

export const PestanaIATokens: React.FC<{ m: MetricasIAAdmin; rol: 'admin' | 'usuario' }> = ({ m, rol }) => {
  const { metricasIA, loadingMetricasIA, setConsultaDetalle, fetchMetricasIA } = m;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Monitor de IA & Consumo de Tokens</h2>
          <p className="mt-1 text-xs text-[var(--fin-ink-soft)]">
            Telemetría en tiempo real del asesor financiero inteligente y cuotas de proveedor.
          </p>
        </div>
        <button
          onClick={fetchMetricasIA}
          className="flex items-center gap-1.5 rounded-xl border border-[var(--fin-line)] bg-[var(--fin-card)] px-3.5 py-2 text-xs font-bold text-[var(--fin-ink)] shadow-sm hover:bg-[var(--fin-soft)] transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingMetricasIA ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {rol === 'admin' && <ContextoIAPanel />}

      {loadingMetricasIA && !metricasIA ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--fin-ink-faint)]" />
        </div>
      ) : metricasIA ? (
        <>
          {metricasIA.diagnosticoTelemetria ? (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
              <strong>Telemetría pendiente de revisión.</strong> {metricasIA.diagnosticoTelemetria}
            </div>
          ) : (
            <p className="text-[11px] text-[var(--fin-ink-faint)]">
              Métricas de hoy leídas desde {metricasIA.origenMetricas === 'supabase' ? 'Supabase' : 'la memoria temporal del servidor'} · hora Colombia.
            </p>
          )}
          {/* Tarjetas Hero de Métricas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                <span>Tokens Usados Hoy</span>
                <Zap className="h-4 w-4 text-amber-500" />
              </div>
              <p className="mt-3 text-3xl font-extrabold tabular-nums tracking-tight text-[var(--fin-ink)]">
                {safeNum(metricasIA.tokensHoy)}{metricasIA.limiteTokensDiariosReferencia !== null ? ` / ${safeNum(metricasIA.limiteTokensDiariosReferencia)}` : ''}
              </p>
              <p className="mt-1 text-[11px] text-[var(--fin-ink-soft)]">
                {metricasIA.limiteTokensDiariosReferencia === null
                  ? 'Uso real de respuestas exitosas de LukApp'
                  : `${Math.min(100, Math.round(metricasIA.tokensHoy / metricasIA.limiteTokensDiariosReferencia * 100))}% de la referencia diaria del plan gratuito de Groq`}
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                <span>Tokens/min. disponibles</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <p className="mt-3 text-3xl font-extrabold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">
                {safeNumDesconocido(metricasIA.tokensProveedorRestantesMinuto)}
              </p>
              <p className="mt-1 text-[11px] text-[var(--fin-ink-soft)]">
                {metricasIA.limiteTokensProveedorMinuto === null
                  ? 'Se actualiza tras una respuesta de IA'
                  : `de ${safeNum(metricasIA.limiteTokensProveedorMinuto)} reportados por el proveedor`}
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                <span>Consultas IA Hoy</span>
                <Cpu className="h-4 w-4 text-purple-500" />
              </div>
              <p className="mt-3 text-3xl font-extrabold tabular-nums tracking-tight text-[var(--fin-ink)]">
                {metricasIA.llamadasHoy}
              </p>
              <p className="mt-1 text-[11px] text-[var(--fin-ink-soft)]">
                {metricasIA.llamadasExitosas} exitosas · {metricasIA.llamadasFallback} en local
              </p>
            </div>

            <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 shadow-sm">
              <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                <span>Latencia Promedio</span>
                <Clock className="h-4 w-4 text-sky-500" />
              </div>
              <p className="mt-3 text-3xl font-extrabold tabular-nums tracking-tight text-[var(--fin-ink)]">
                {metricasIA.latenciaPromedioMs} <span className="text-sm font-bold text-[var(--fin-ink-soft)]">ms</span>
              </p>
              <p className="mt-1 text-[11px] text-[var(--fin-ink-soft)]">
                {metricasIA.solicitudesProveedorRestantesDia === null
                  ? 'Sin cuota de solicitudes disponible'
                  : `${safeNum(metricasIA.solicitudesProveedorRestantesDia)} solicitudes disponibles hoy`}
              </p>
            </div>
          </div>

          {/* Estado del Proveedor & Barra de Cuota */}
          <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                  Proveedor & Modelo Activo
                </span>
                <div className="flex items-center gap-2 mt-1">
                  <h3 className="text-lg font-bold text-[var(--fin-ink)]">{metricasIA.proveedor}</h3>
                  <span className="rounded-md bg-purple-100 px-2 py-0.5 text-xs font-bold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                    {metricasIA.modelo}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {metricasIA.hayIA ? 'Servicio IA en Línea' : 'Modo Local Heurístico'}
                </span>
              </div>
            </div>

            {/* Barra de capacidad de tokens observada en la última respuesta */}
            <div className="mt-4">
              <div className="flex justify-between text-xs font-medium text-[var(--fin-ink-soft)] mb-2">
                <span>Capacidad de tokens por minuto</span>
                <span className="font-bold text-[var(--fin-ink)]">
                  {metricasIA.porcentajeCapacidadTokens === null
                    ? 'Pendiente de consulta'
                    : `${metricasIA.porcentajeCapacidadTokens}% usado`}
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-[var(--fin-soft)] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    (metricasIA.porcentajeCapacidadTokens ?? 0) >= 90 ? 'bg-red-500' : 'bg-purple-500'
                  }`}
                  style={{ width: `${Math.min(metricasIA.porcentajeCapacidadTokens ?? 0, 100)}%` }}
                />
              </div>
              <p className="mt-2 text-[10px] text-[var(--fin-ink-faint)]">
                {metricasIA.cuotaProveedorObservadaEn
                  ? `Última lectura del proveedor: ${formatearFechaHoraConsulta(metricasIA.cuotaProveedorObservadaEn)}. Los límites se renuevan según su ventana, no a medianoche de LukApp.`
                  : 'La capacidad real se muestra cuando el proveedor responde la próxima consulta.'}
              </p>
              {metricasIA.limiteTokensDiariosReferencia !== null && (
                <p className="mt-2 text-[10px] text-[var(--fin-ink-faint)]">
                  Referencia diaria: {safeNum(metricasIA.limiteTokensDiariosReferencia)} tokens para el plan gratuito de Groq con este modelo. Si tu cuenta tiene otro plan, confirma su cuota exacta en Groq; sus cabeceras no reportan TPD.
                </p>
              )}
            </div>
          </div>

          {metricasIA.consumoPorUsuario.length > 0 && (
            <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-sm">
              <div className="mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                  Consumo por usuario hoy
                </h3>
                <p className="mt-0.5 text-[10px] text-[var(--fin-ink-faint)]">
                  Tokens reales de respuestas exitosas; los respaldos locales no suman tokens.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--fin-soft)]/50 text-[10px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                    <tr>
                      <th className="px-4 py-3">Usuario</th>
                      <th className="px-4 py-3 text-right">Consultas</th>
                      <th className="px-4 py-3 text-right">IA</th>
                      <th className="px-4 py-3 text-right">Local</th>
                      <th className="px-4 py-3 text-right">Tokens reales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--fin-line)]">
                    {metricasIA.consumoPorUsuario.map((usuario) => (
                      <tr key={usuario.usuarioEmail}>
                        <td className="max-w-56 truncate px-4 py-3 font-medium text-[var(--fin-ink)]" title={usuario.usuarioEmail}>{usuario.usuarioEmail}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-[var(--fin-ink-soft)]">{safeNum(usuario.consultas)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{safeNum(usuario.exitosas)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400">{safeNum(usuario.locales)}</td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-[var(--fin-ink)]">{safeNum(usuario.tokens)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

            {/* Tabla de Peticiones Recientes */}
            <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                    Últimas Consultas Procesadas por la IA
                  </h3>
                  <p className="text-[10px] text-[var(--fin-ink-faint)] mt-0.5">
                    Haz clic en cualquier consulta para ver el chat completo del usuario con el asesor
                  </p>
                </div>
                <span className="rounded-lg bg-[var(--fin-soft)] px-2.5 py-1 text-[10px] font-bold text-[var(--fin-ink-soft)]">
                  {metricasIA.peticionesRecientes.length} registradas
                </span>
              </div>

              {metricasIA.peticionesRecientes.length === 0 ? (
                <p className="py-8 text-center text-xs text-[var(--fin-ink-faint)]">
                  No hay consultas registradas aún en esta sesión de servidor.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--fin-soft)]/50 text-[10px] font-bold uppercase tracking-wider text-[var(--fin-ink-soft)]">
                      <tr>
                        <th className="px-4 py-3">Fecha y hora</th>
                        <th className="px-4 py-3">Usuario</th>
                        <th className="px-4 py-3">Proveedor / Modelo</th>
                        <th className="px-4 py-3">Tokens</th>
                        <th className="px-4 py-3">Tiempo</th>
                        <th className="px-4 py-3 text-right">Conversación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--fin-line)]">
                      {metricasIA.peticionesRecientes.map((p) => (
                        <tr
                          key={p.id}
                          onClick={() => setConsultaDetalle(p)}
                          className="group cursor-pointer transition-colors hover:bg-purple-500/10"
                        >
                          <td className="px-4 py-3 text-[var(--fin-ink-soft)] tabular-nums">
                            {formatearFechaHoraConsulta(p.timestamp)}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[var(--fin-ink)]">{p.usuarioEmail}</span>
                              <span className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-purple-600 dark:text-purple-400 font-bold">
                                · Ver chat <MessageSquare className="h-3 w-3" strokeWidth={2.5} />
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[var(--fin-ink-soft)]">
                            {p.proveedor} <span className="text-[10px] opacity-75">({p.modelo})</span>
                          </td>
                          <td className="px-4 py-3 font-bold tabular-nums">
                            {p.totalTokens} <span className="text-[10px] font-normal text-[var(--fin-ink-faint)]">({p.promptTokens} in / {p.completionTokens} out)</span>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-[var(--fin-ink-soft)]">{p.duracionMs} ms</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {p.exito ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                  <Sparkles className="h-3 w-3" strokeWidth={2.5} /> Exitoso
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" title={p.motivo}>
                                  <Cog className="h-3 w-3" strokeWidth={2.5} /> Local
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setConsultaDetalle(p);
                                }}
                                className="flex items-center gap-1 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2 py-1 text-[10px] font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition-colors"
                                title="Ver historial del chat"
                              >
                                <MessageSquare className="h-3 w-3" />
                                <span>Chat</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
        </>
      ) : null}
    </div>
  );
};
