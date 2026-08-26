import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, CheckCircle2, Clock, Flame, Trophy, X } from 'lucide-react';
import { HITOS_RACHA, type InfoRacha } from '../lib/racha';
import { useRecordatorioRacha } from '../data/usePreferencias';
import { enviarNotificacionRacha } from '../lib/recordatorioRacha';

interface RachaModalProps {
  infoRacha: InfoRacha;
  onCerrar: () => void;
}

export const RachaModal: React.FC<RachaModalProps> = ({ infoRacha, onCerrar }) => {
  const recordatorio = useRecordatorioRacha();
  const [mensajePrueba, setMensajePrueba] = useState<string | null>(null);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="w-full max-w-lg overflow-hidden rounded-t-[var(--fin-r-sheet)] sm:rounded-[var(--fin-r-sheet)] border border-[var(--fin-line)] bg-[var(--fin-card)] p-5 sm:p-6 shadow-2xl"
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-[var(--fin-line)]/50 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
              <Flame className="h-6 w-6 fill-amber-500" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-[var(--fin-ink)]">
                Tu racha financiera
              </h2>
              <p className="text-[12px] text-[var(--fin-ink-soft)]">
                La consistencia crea libertad financiera
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)] hover:text-[var(--fin-ink)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1">
          {/* Tarjetas de estadísticas */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="flex flex-col items-center justify-center rounded-[var(--fin-r-card)] bg-amber-500/10 border border-amber-500/20 p-3 text-center">
              <span className="text-[24px] font-extrabold text-amber-500 tabular-nums">
                {infoRacha.rachaActual}
              </span>
              <span className="text-[11px] font-bold text-[var(--fin-ink-soft)] uppercase tracking-tight">
                Días de racha
              </span>
            </div>

            <div className="flex flex-col items-center justify-center rounded-[var(--fin-r-card)] bg-[var(--fin-bg)] border border-[var(--fin-line)] p-3 text-center">
              <span className="text-[24px] font-extrabold text-[var(--fin-ink)] tabular-nums">
                {infoRacha.rachaMaxima}
              </span>
              <span className="text-[11px] font-bold text-[var(--fin-ink-soft)] uppercase tracking-tight">
                Racha récord
              </span>
            </div>

            <div className="flex flex-col items-center justify-center rounded-[var(--fin-r-card)] bg-[var(--fin-bg)] border border-[var(--fin-line)] p-3 text-center">
              <span className="text-[24px] font-extrabold text-[var(--fin-ink)] tabular-nums">
                {infoRacha.diasAnotadosMes}
              </span>
              <span className="text-[11px] font-bold text-[var(--fin-ink-soft)] uppercase tracking-tight">
                Días este mes
              </span>
            </div>
          </div>

          {/* Estado de hoy */}
          <div
            className={`flex items-center gap-3 rounded-[var(--fin-r-card)] p-3.5 border ${
              infoRacha.anotadoHoy
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-500'
            }`}
          >
            {infoRacha.anotadoHoy ? (
              <>
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
                <div className="text-[13px] leading-snug text-[var(--fin-ink)]">
                  <span className="font-bold text-emerald-500">¡Meta de hoy cumplida!</span> Anotaste
                  movimientos hoy y tu racha está asegurada.
                </div>
              </>
            ) : (
              <>
                <Flame className="h-5 w-5 shrink-0 text-amber-500" />
                <div className="text-[13px] leading-snug text-[var(--fin-ink)]">
                  <span className="font-bold text-amber-500">Anota tu primer movimiento hoy</span> para
                  no perder tu racha de {infoRacha.rachaActual} días.
                </div>
              </>
            )}
          </div>

          {/* Recordatorio diario en este dispositivo / PWA */}
          <div className="rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-bg)] p-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                    recordatorio.activo ? 'bg-amber-500/20 text-amber-500' : 'bg-[var(--fin-soft)] text-[var(--fin-ink-faint)]'
                  }`}
                >
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-[13.5px] font-bold text-[var(--fin-ink)]">
                    Recordatorio diario
                  </h4>
                  <p className="text-[11.5px] text-[var(--fin-ink-soft)]">
                    Te avisa si no has anotado hoy
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  if (recordatorio.activo) {
                    recordatorio.desactivarRecordatorio();
                  } else {
                    const ok = await recordatorio.activarRecordatorio();
                    if (ok) {
                      setMensajePrueba('✅ ¡Recordatorio activado!');
                      setTimeout(() => setMensajePrueba(null), 3000);
                    }
                  }
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-[var(--fin-r-pill)] border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  recordatorio.activo ? 'bg-amber-500' : 'bg-[var(--fin-line)]'
                }`}
                role="switch"
                aria-checked={recordatorio.activo}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-[var(--fin-r-pill)] bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    recordatorio.activo ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {recordatorio.activo && (
              <div className="mt-3 border-t border-[var(--fin-line)]/60 pt-3 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-medium text-[var(--fin-ink-soft)] flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                    Hora del recordatorio:
                  </span>
                  <input
                    type="time"
                    value={recordatorio.hora}
                    onChange={(e) => recordatorio.cambiarHora(e.target.value)}
                    className="rounded-lg border border-[var(--fin-line)] bg-[var(--fin-card)] px-2.5 py-1 text-[16px] font-bold tabular-nums text-[var(--fin-ink)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await enviarNotificacionRacha(infoRacha.rachaActual, true);
                      if (ok) {
                        setMensajePrueba('🔔 Notificación de prueba enviada a tu dispositivo');
                      } else {
                        setMensajePrueba('⚠️ Revisa que las notificaciones estén permitidas en tu navegador');
                      }
                      setTimeout(() => setMensajePrueba(null), 4000);
                    }}
                    className="text-[12px] font-semibold text-amber-500 hover:text-amber-600 underline"
                  >
                    Probar notificación ahora
                  </button>

                  {mensajePrueba && (
                    <span className="text-[11px] font-medium text-[var(--fin-ink-soft)] animate-fade-in">
                      {mensajePrueba}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Medallas e Hitos */}
          <div>
            <h3 className="flex items-center gap-1.5 text-[14px] font-bold text-[var(--fin-ink)] mb-2.5">
              <Trophy className="h-4 w-4 text-amber-500" />
              Medallas de consistencia
            </h3>

            <div className="flex flex-col gap-2">
              {HITOS_RACHA.map((hito) => {
                const alcanzado = Math.max(infoRacha.rachaActual, infoRacha.rachaMaxima) >= hito.dias;
                return (
                  <div
                    key={hito.dias}
                    className={`flex items-center justify-between gap-3 rounded-[var(--fin-r-card)] border p-3 transition-all ${
                      alcanzado
                        ? 'border-amber-500/40 bg-amber-500/5'
                        : 'border-[var(--fin-line)]/50 bg-[var(--fin-bg)] opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[20px] ${
                          alcanzado ? 'bg-amber-500/20' : 'bg-[var(--fin-soft)] grayscale'
                        }`}
                      >
                        {hito.emoji}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[14px] font-bold text-[var(--fin-ink)]">
                            {hito.titulo}
                          </p>
                          <span
                            className={`rounded-[var(--fin-r-pill)] px-2 py-0.5 text-[10.5px] font-extrabold ${
                              alcanzado
                                ? 'bg-amber-500 text-white'
                                : 'bg-[var(--fin-soft)] text-[var(--fin-ink-faint)]'
                            }`}
                          >
                            {hito.dias} días
                          </span>
                        </div>
                        <p className="text-[12px] text-[var(--fin-ink-soft)]">
                          {hito.descripcion}
                        </p>
                      </div>
                    </div>

                    {alcanzado && (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-amber-500" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Botón cerrar */}
        <div className="mt-5">
          <button
            type="button"
            onClick={onCerrar}
            className="w-full rounded-[var(--fin-r-card)] bg-[var(--fin-accent)] py-3 text-[14.5px] font-bold text-[var(--fin-on-accent)] shadow-md transition-all hover:bg-[var(--fin-accent-hover)]"
          >
            Entendido, ¡a seguir la racha!
          </button>
        </div>
      </motion.div>
    </div>
  );
};
