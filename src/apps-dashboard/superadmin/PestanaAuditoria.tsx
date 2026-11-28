import React from 'react';
import {
  Loader2,
  History,
  RefreshCw,
} from 'lucide-react';
import { type AuditoriaAdmin } from './auditoria';

export const PestanaAuditoria: React.FC<{ a: AuditoriaAdmin }> = ({ a }) => {
  const { logsAuditoria, loadingAuditoria, fetchAuditoria } = a;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Registro de Auditoría</h2>
          <p className="mt-1 text-xs text-[var(--fin-ink-soft)]">
            Historial permanente de seguridad: contraseñas, usuarios, roles, términos, planes y asesorías.
          </p>
        </div>
        <button
          onClick={fetchAuditoria}
          className="flex items-center gap-1.5 rounded-xl border border-[var(--fin-line)] bg-[var(--fin-card)] px-3.5 py-2 text-xs font-bold text-[var(--fin-ink)] shadow-sm hover:bg-[var(--fin-soft)] transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loadingAuditoria ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      <div className="rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-sm">
        {loadingAuditoria && logsAuditoria.length === 0 ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--fin-ink-faint)]" />
          </div>
        ) : logsAuditoria.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center text-center text-xs text-[var(--fin-ink-faint)]">
            <History className="h-8 w-8 mb-2 opacity-40" />
            <p>Todavía no hay eventos importantes para mostrar.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logsAuditoria.map((log) => (
              <div
                key={log.id}
                className="rounded-2xl border border-[var(--fin-line)] bg-[var(--fin-bg-soft)] p-4 text-xs"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-purple-600 dark:text-purple-400 text-sm">
                    {log.action}
                  </span>
                  <span className="text-[10px] text-[var(--fin-ink-faint)] tabular-nums">
                    {new Date(log.timestamp).toLocaleString('es-CO')}
                  </span>
                </div>
                {log.targetUser && (
                  <p className="text-[var(--fin-ink)] font-medium">
                    Objetivo: <span className="font-bold">{log.targetUser}</span>
                  </p>
                )}
                {log.details && (
                  <p className="text-[var(--fin-ink-soft)] text-[11px] mt-0.5">{log.details}</p>
                )}
                <p className="text-[10px] text-[var(--fin-ink-faint)] mt-2">
                  Ejecutado por Admin: <span className="font-medium">{log.adminEmail}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
