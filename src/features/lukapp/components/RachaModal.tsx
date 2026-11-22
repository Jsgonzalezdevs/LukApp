import { IconoSimbolo } from './IconoSimbolo';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, CheckCircle2, Clock, Flame, Share2, Trophy, X } from 'lucide-react';
import { HITOS_RACHA, type InfoRacha } from '../lib/racha';
import { useRecordatorioRacha } from '../data/usePreferencias';
import { enviarNotificacionRacha } from '../lib/recordatorioRacha';
import { RankingRacha } from './RankingRacha';
import type { EstadoServidor } from '../data/useRachaServidor';
import { ligaDeRacha, PREMIOS_RACHA, siguienteLiga, textoParaCompartir, ultimosDias } from '../lib/rankingRacha';

interface RachaModalProps {
  infoRacha: InfoRacha;
  /** El día de hoy en Bogotá, para el calendario. */
  hoy: string;
  /** Protectores y premios, que viven en el servidor. */
  servidor: EstadoServidor;
  onCerrar: () => void;
}

export const RachaModal: React.FC<RachaModalProps> = ({ infoRacha, hoy, servidor, onCerrar }) => {
  const recordatorio = useRecordatorioRacha();
  const [mensajePrueba, setMensajePrueba] = useState<string | null>(null);
  const [mensajeCompartir, setMensajeCompartir] = useState<string | null>(null);
  const [pestana, setPestana] = useState<'mia' | 'ranking'>('mia');
  const liga = ligaDeRacha(infoRacha.rachaActual);
  const proximaLiga = siguienteLiga(infoRacha.rachaActual);
  const dias = ultimosDias(infoRacha.diasAnotados, hoy, 28, infoRacha.diasProtegidos);
  const hito = infoRacha.proximoHito;
  const progresoHito = hito ? Math.min(100, Math.round((infoRacha.rachaActual / hito.dias) * 100)) : 100;

  const compartir = async () => {
    const texto = textoParaCompartir(infoRacha.rachaActual);
    try {
      if (navigator.share) await navigator.share({ text: texto });
      else {
        await navigator.clipboard.writeText(texto);
        setMensajeCompartir('Texto copiado, pégalo donde quieras.');
        setTimeout(() => setMensajeCompartir(null), 3000);
      }
    } catch {
      // Cerrar la hoja de compartir cuenta como cancelar; no es un error.
    }
  };
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
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[var(--fin-r-control)] bg-[var(--fin-warn-bg)] text-[var(--fin-warn-ink)]">
              <Flame className="h-6 w-6 fill-amber-500" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-[var(--fin-ink)]">
                Tu racha financiera
              </h2>
              <p className="text-[13px] text-[var(--fin-ink-soft)]">
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
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center justify-center rounded-[var(--fin-r-card)] bg-[var(--fin-warn-bg)] border border-[var(--fin-warn)]/30 p-3 text-center">
              <span className="text-[20px] font-bold text-[var(--fin-warn-ink)] tabular-nums">
                {infoRacha.rachaActual}
              </span>
              <span className="text-[13px] font-bold text-[var(--fin-ink-soft)] uppercase tracking-tight">
                Días de racha
              </span>
            </div>

            <div className="flex flex-col items-center justify-center rounded-[var(--fin-r-card)] bg-[var(--fin-bg)] border border-[var(--fin-line)] p-3 text-center">
              <span className="text-[20px] font-bold text-[var(--fin-ink)] tabular-nums">
                {infoRacha.rachaMaxima}
              </span>
              <span className="text-[13px] font-bold text-[var(--fin-ink-soft)] uppercase tracking-tight">
                Racha récord
              </span>
            </div>

            <div className="flex flex-col items-center justify-center rounded-[var(--fin-r-card)] bg-[var(--fin-bg)] border border-[var(--fin-line)] p-3 text-center">
              <span className="text-[20px] font-bold text-[var(--fin-ink)] tabular-nums">
                {infoRacha.diasAnotadosMes}
              </span>
              <span className="text-[13px] font-bold text-[var(--fin-ink-soft)] uppercase tracking-tight">
                Días este mes
              </span>
            </div>
          </div>

          {/* Pestañas: lo mío / el ranking de todos */}
          <div role="tablist" className="grid grid-cols-2 gap-1 rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] p-1">
            {([['mia', '🔥 Mi racha'], ['ranking', '🏆 Ranking']] as const).map(([id, etiqueta]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={pestana === id}
                onClick={() => setPestana(id)}
                className={`rounded-[var(--fin-r-pill)] py-2 text-[14px] font-bold transition-colors ${
                  pestana === id ? 'bg-[var(--fin-card)] text-[var(--fin-ink)] shadow-sm' : 'text-[var(--fin-ink-soft)]'
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>

          {pestana === 'ranking' ? <RankingRacha /> : (<>

          {/* Liga y progreso */}
          <div className="rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-bg)] p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[15px] font-bold text-[var(--fin-ink)]">
                {liga ? `${liga.emoji} Liga ${liga.nombre}` : 'Aún sin liga'}
              </p>
              {proximaLiga && (
                <p className="text-[13px] text-[var(--fin-ink-soft)]">
                  {proximaLiga.emoji} {proximaLiga.nombre} en {proximaLiga.desde - infoRacha.rachaActual} {proximaLiga.desde - infoRacha.rachaActual === 1 ? 'día' : 'días'}
                </p>
              )}
            </div>
            {hito && (
              <div className="mt-3">
                <div className="h-2 overflow-hidden rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)]">
                  <div className="h-full rounded-[var(--fin-r-pill)] bg-amber-500 transition-all" style={{ width: `${progresoHito}%` }} />
                </div>
                <p className="mt-1.5 text-[13px] text-[var(--fin-ink-soft)]">
                  {hito.emoji} {hito.titulo}: te faltan {infoRacha.diasParaProximoHito} {infoRacha.diasParaProximoHito === 1 ? 'día' : 'días'}
                </p>
              </div>
            )}
          </div>

          {/* Protectores: una red de seguridad, no una licencia para faltar */}
          <div className="flex items-center gap-3 rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-bg)] p-4">
            <span className="text-[24px]" aria-hidden="true">🛡️</span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-[var(--fin-ink)]">
                {servidor.protectores} {servidor.protectores === 1 ? 'protector' : 'protectores'} de racha
              </p>
              <p className="text-[13px] leading-snug text-[var(--fin-ink-soft)]">
                {servidor.protectorUsado
                  ? 'Usamos un protector para salvar tu racha de ayer. 🎉'
                  : 'Ganas uno cada 7 días de racha (máximo 2). Si un día se te pasa, salva tu racha solo.'}
              </p>
            </div>
          </div>

          {/* Últimos 28 días */}
          <div>
            <h3 className="mb-2 text-[15px] font-bold text-[var(--fin-ink)]">Tus últimos 28 días</h3>
            <div className="grid grid-cols-7 gap-1.5" role="img" aria-label={`${dias.filter((d) => d.estado === 'anotado').length} de 28 días anotados`}>
              {dias.map((d) => (
                <div
                  key={d.fecha}
                  title={d.fecha}
                  className={`flex aspect-square items-center justify-center rounded-[var(--fin-r-control)] text-[11px] ${
                    d.estado === 'anotado'
                      ? 'bg-amber-500'
                      : d.estado === 'protegido'
                        ? 'border border-[var(--fin-line)] bg-[var(--fin-card)]'
                        : d.estado === 'hoy-pendiente'
                          ? 'border-2 border-dashed border-amber-500 bg-transparent'
                          : 'bg-[var(--fin-soft)]'
                  }`}
                >
                  {d.estado === 'protegido' ? '🛡️' : null}
                </div>
              ))}
            </div>
          </div>

          {/* Estado de hoy */}
          <div
            className={`flex items-center gap-3 rounded-[var(--fin-r-card)] p-4 border ${
              infoRacha.anotadoHoy
                ? 'bg-[var(--fin-soft)] border-[var(--fin-accent)]/30 text-[var(--fin-ink)]'
                : 'bg-[var(--fin-warn-bg)] border-[var(--fin-warn)]/30 text-[var(--fin-warn-ink)]'
            }`}
          >
            {infoRacha.anotadoHoy ? (
              <>
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--fin-in)]" />
                <div className="text-[13px] leading-snug text-[var(--fin-ink)]">
                  <span className="font-bold text-[var(--fin-in)]">¡Meta de hoy cumplida!</span> Anotaste
                  movimientos hoy y tu racha está asegurada.
                </div>
              </>
            ) : (
              <>
                <Flame className="h-5 w-5 shrink-0 text-[var(--fin-warn-ink)]" />
                <div className="text-[13px] leading-snug text-[var(--fin-ink)]">
                  <span className="font-bold text-[var(--fin-warn-ink)]">Anota tu primer movimiento hoy</span> para
                  no perder tu racha de {infoRacha.rachaActual} días.
                </div>
              </>
            )}
          </div>

          {/* Recordatorio diario en este dispositivo / PWA */}
          <div className="rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-bg)] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-[var(--fin-r-control)] transition-colors ${
                    recordatorio.activo ? 'bg-[var(--fin-warn-bg)] text-[var(--fin-warn-ink)]' : 'bg-[var(--fin-soft)] text-[var(--fin-ink-faint)]'
                  }`}
                >
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-[15px] font-bold text-[var(--fin-ink)]">
                    Recordatorio diario
                  </h4>
                  <p className="text-[13px] text-[var(--fin-ink-soft)]">
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
                      setMensajePrueba('Recordatorio activado.');
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
              <div className="mt-3 border-t border-[var(--fin-line)]/60 pt-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-[var(--fin-ink-soft)] flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-[var(--fin-warn-ink)]" />
                    Hora del recordatorio:
                  </span>
                  <input
                    type="time"
                    value={recordatorio.hora}
                    onChange={(e) => recordatorio.cambiarHora(e.target.value)}
                    className="rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-card)] px-3 py-1 text-[17px] font-bold tabular-nums text-[var(--fin-ink)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await enviarNotificacionRacha(infoRacha.rachaActual, true);
                      if (ok) {
                        setMensajePrueba('Notificación de prueba enviada a tu dispositivo.');
                      } else {
                        setMensajePrueba('Revisa que las notificaciones estén permitidas en tu navegador.');
                      }
                      setTimeout(() => setMensajePrueba(null), 4000);
                    }}
                    className="text-[13px] font-semibold text-[var(--fin-warn-ink)] hover:text-[var(--fin-warn-ink)] underline"
                  >
                    Probar notificación ahora
                  </button>

                  {mensajePrueba && (
                    <span className="text-[13px] font-medium text-[var(--fin-ink-soft)] animate-fade-in">
                      {mensajePrueba}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Medallas e Hitos */}
          <div>
            <h3 className="flex items-center gap-2 text-[15px] font-bold text-[var(--fin-ink)] mb-3">
              <Trophy className="h-4 w-4 text-[var(--fin-warn-ink)]" />
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
                        ? 'border-[var(--fin-warn)]/30 bg-[var(--fin-warn-bg)]'
                        : 'border-[var(--fin-line)]/50 bg-[var(--fin-bg)] opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--fin-r-control)] text-[20px] ${
                          alcanzado ? 'bg-[var(--fin-warn-bg)]' : 'bg-[var(--fin-soft)] grayscale'
                        }`}
                      >
                        <IconoSimbolo valor={hito.emoji} className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-[15px] font-bold text-[var(--fin-ink)]">
                            {hito.titulo}
                          </p>
                          <span
                            className={`rounded-[var(--fin-r-pill)] px-2 py-1 text-[13px] font-bold ${
                              alcanzado
                                ? 'bg-amber-500 text-white'
                                : 'bg-[var(--fin-soft)] text-[var(--fin-ink-faint)]'
                            }`}
                          >
                            {hito.dias} días
                          </span>
                        </div>
                        <p className="text-[13px] text-[var(--fin-ink-soft)]">
                          {hito.descripcion}
                        </p>
                      </div>
                    </div>

                    {alcanzado && (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--fin-warn-ink)]" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Premios en Premium */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-[var(--fin-ink)]">
              <span aria-hidden="true">🎁</span> Premios por tu constancia
            </h3>
            <div className="flex flex-col gap-2">
              {PREMIOS_RACHA.map((premio) => {
                const reclamado = servidor.premiosReclamados.includes(premio.hito);
                const alcanzado = infoRacha.rachaActual >= premio.hito;
                return (
                  <div
                    key={premio.hito}
                    className={`flex items-center justify-between gap-3 rounded-[var(--fin-r-card)] border p-3 ${
                      reclamado ? 'border-[var(--fin-in)]/30 bg-[var(--fin-soft)]' : 'border-[var(--fin-line)]/60 bg-[var(--fin-bg)]'
                    }`}
                  >
                    <div>
                      <p className="text-[15px] font-bold text-[var(--fin-ink)]">
                        {premio.diasPremium} días de Premium
                      </p>
                      <p className="text-[13px] text-[var(--fin-ink-soft)]">
                        {reclamado
                          ? 'Ya lo reclamaste ✅'
                          : alcanzado
                            ? 'Lo recibes al abrir la app, si no tienes Premium activo'
                            : `Al llegar a ${premio.hito} días de racha (te faltan ${premio.hito - infoRacha.rachaActual})`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void compartir()}
            className="flex items-center justify-center gap-2 rounded-[var(--fin-r-card)] border border-[var(--fin-line)] py-2.5 text-[14px] font-bold text-[var(--fin-ink)] hover:bg-[var(--fin-soft)]"
          >
            <Share2 className="h-4 w-4" /> Presumir mi racha
          </button>
          {mensajeCompartir && <p className="text-center text-[13px] text-[var(--fin-ink-soft)]">{mensajeCompartir}</p>}
          </>)}
        </div>

        {/* Botón cerrar */}
        <div className="mt-5">
          <button
            type="button"
            onClick={onCerrar}
            className="w-full rounded-[var(--fin-r-card)] bg-[var(--fin-accent)] py-3 text-[15px] font-bold text-[var(--fin-on-accent)] shadow-md transition-all hover:bg-[var(--fin-accent-hover)]"
          >
            Entendido, ¡a seguir la racha!
          </button>
        </div>
      </motion.div>
    </div>
  );
};
