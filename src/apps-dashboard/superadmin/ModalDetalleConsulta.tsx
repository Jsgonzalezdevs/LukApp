import React from 'react';
import {
  X,
  Bot,
  User,
  Cog,
  Sparkles,
} from 'lucide-react';
import { type PeticionIA } from './tipos';
import { RespuestaIA } from './RespuestaIA';
import { type MetricasIAAdmin } from './metricasIA';
import { TextoMarkdown } from '../../components/TextoMarkdown';

export const ModalDetalleConsulta: React.FC<{ m: MetricasIAAdmin; consultaDetalle: PeticionIA }> = ({ m, consultaDetalle }) => {
  const { setConsultaDetalle } = m;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setConsultaDetalle(null)}
      />
      <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[var(--fin-line)] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--fin-ink)]">Historial del Chat con el Asesor IA</h3>
              <p className="text-xs text-[var(--fin-ink-soft)]">
                Usuario: <span className="font-bold text-[var(--fin-ink)]">{consultaDetalle.usuarioEmail}</span> · {new Date(consultaDetalle.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} ({new Date(consultaDetalle.timestamp).toLocaleDateString('es-CO')})
              </p>
            </div>
          </div>
          <button
            onClick={() => setConsultaDetalle(null)}
            className="rounded-xl p-2 text-[var(--fin-ink-faint)] hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Metrics Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--fin-line)]/50 bg-[var(--fin-soft)]/50 px-5 py-2.5 text-xs text-[var(--fin-ink-soft)]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[var(--fin-ink)]">{consultaDetalle.proveedor}</span>
            <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
              {consultaDetalle.modelo}
            </span>
          </div>
          <div className="flex items-center gap-3 tabular-nums">
            <span><strong>{consultaDetalle.totalTokens}</strong> tokens ({consultaDetalle.promptTokens} in / {consultaDetalle.completionTokens} out)</span>
            <span>·</span>
            <span><strong>{consultaDetalle.duracionMs}</strong> ms</span>
          </div>
        </div>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* User Query */}
          <div className="flex items-start gap-3 flex-row-reverse">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <User className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-blue-600 text-white px-4 py-3 text-sm leading-relaxed shadow-sm">
              <p className="font-semibold text-[11px] opacity-75 mb-1">Pregunta / Mensaje del Usuario</p>
              <TextoMarkdown texto={consultaDetalle.promptText || 'No se registró texto de entrada.'} />
            </div>
          </div>

          {/* AI Response */}
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
              <Bot className="h-4 w-4" strokeWidth={2.5} />
            </div>
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-[var(--fin-line)] bg-[var(--fin-card)] text-[var(--fin-ink)] px-4 py-3 text-sm leading-relaxed shadow-sm">
              <p className="font-semibold text-[11px] text-purple-600 dark:text-purple-400 mb-1.5 flex items-center justify-between">
                <span>Respuesta del Asesor IA</span>
                {consultaDetalle.exito ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
                    <Sparkles className="h-3 w-3" strokeWidth={2.5} /> Respuesta generada por LLM
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-bold">
                    <Cog className="h-3 w-3" strokeWidth={2.5} /> Motor Local ({consultaDetalle.motivo})
                  </span>
                )}
              </p>
              <div className="text-[13px] leading-relaxed">
                {consultaDetalle.respuestaTexto ? (
                  <RespuestaIA texto={consultaDetalle.respuestaTexto} />
                ) : (
                  consultaDetalle.exito ? 'Respuesta procesada exitosamente.' : 'Sin respuesta registrada.'
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end border-t border-[var(--fin-line)] bg-[var(--fin-bg-soft)] p-4">
          <button
            onClick={() => setConsultaDetalle(null)}
            className="rounded-xl bg-[var(--fin-soft)] px-4 py-2 text-xs font-bold text-[var(--fin-ink)] hover:bg-[var(--fin-line)] transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
