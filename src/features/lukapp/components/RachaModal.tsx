import { IconoSimbolo } from './IconoSimbolo';
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, CheckCircle2, Clock, Flame, Loader2, Share2, X } from 'lucide-react';
import { HITOS_RACHA, type InfoRacha } from '../lib/racha';
import { useRecordatorioRacha } from '../data/usePreferencias';
import { enviarNotificacionRacha } from '../lib/recordatorioRacha';
import { RankingRacha } from './RankingRacha';
import { reclamarPremioRacha, type EstadoServidor, type PremioRacha } from '../data/useRachaServidor';
import { ligaDeRacha, PREMIOS_RACHA, siguienteLiga, textoParaCompartir, ultimosDias } from '../lib/rankingRacha';

interface RachaModalProps {
  infoRacha: InfoRacha;
  /** El día de hoy en Bogotá, para el calendario. */
  hoy: string;
  /** Protectores y premios, que viven en el servidor. */
  servidor: EstadoServidor;
  onCerrar: () => void;
}

const MENSAJES_RECLAMO: Record<string, string> = {
  tiene_premium_pagado: 'Ya tienes Premium pagado. Guarda este premio para cuando se termine.',
  no_alcanzado: 'Aún no: para los premios solo cuentan los días anotados a tiempo.',
  ya_reclamado: 'Este premio ya lo activaste.',
};

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', timeZone: 'America/Bogota' });

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Contenedor común: superficie opaca, sin el vidrio que deja ver lo de atrás. */
const Tarjeta: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`rounded-[var(--fin-r-card)] border border-[var(--fin-line)] bg-[var(--fin-bg)] ${className}`}>
    {children}
  </div>
);

const Titulo: React.FC<{ children: React.ReactNode; extra?: React.ReactNode }> = ({ children, extra }) => (
  <div className="mb-2 flex items-baseline justify-between gap-2">
    <h3 className="text-[15px] font-bold text-[var(--fin-ink)]">{children}</h3>
    {extra && <span className="text-[13px] text-[var(--fin-ink-soft)]">{extra}</span>}
  </div>
);

export const RachaModal: React.FC<RachaModalProps> = ({ infoRacha, hoy, servidor, onCerrar }) => {
  const recordatorio = useRecordatorioRacha();
  const [mensajePrueba, setMensajePrueba] = useState<string | null>(null);
  const [mensajeCompartir, setMensajeCompartir] = useState<string | null>(null);
  const [pestana, setPestana] = useState<'mia' | 'ranking'>('mia');
  const [reclamando, setReclamando] = useState<number | null>(null);
  const [avisoPremio, setAvisoPremio] = useState<{ hito: number; texto: string } | null>(null);

  const racha = infoRacha.rachaActual;
  const liga = ligaDeRacha(racha);
  const proximaLiga = siguienteLiga(racha);
  const dias = ultimosDias(infoRacha.diasAnotados, hoy, 28, infoRacha.diasProtegidos);
  const hito = infoRacha.proximoHito;
  const progresoHito = hito ? Math.min(100, Math.round((racha / hito.dias) * 100)) : 100;
  const mejor = Math.max(racha, infoRacha.rachaMaxima);
  const medallasGanadas = HITOS_RACHA.filter((h) => mejor >= h.dias).length;

  // Sin respuesta del servidor (sin conexión) se enseñan igual, pero sin botón.
  const premios: readonly PremioRacha[] = servidor.premios.length
    ? servidor.premios
    : PREMIOS_RACHA.map((p) => ({ ...p, alcanzado: false, reclamado: false, bloqueadoPorPago: false }));

  const compartir = async () => {
    const texto = textoParaCompartir(racha);
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

  const reclamar = async (hitoPremio: number) => {
    setReclamando(hitoPremio);
    setAvisoPremio(null);
    const resultado = await reclamarPremioRacha(hitoPremio);
    setReclamando(null);
    setAvisoPremio({
      hito: hitoPremio,
      texto: resultado.ok
        ? resultado.venceEn
          ? `¡Listo! Tienes Premium hasta el ${fechaCorta(resultado.venceEn)}. 🎉`
          : '¡Listo! Tu Premium ya está activo. 🎉'
        : MENSAJES_RECLAMO[resultado.motivo] ?? 'No pudimos activarlo. Revisa tu conexión e inténtalo de nuevo.',
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center sm:p-4"
      onClick={onCerrar}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Tu racha financiera"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[var(--fin-r-sheet)] bg-[var(--fin-surface)] shadow-2xl sm:rounded-[var(--fin-r-sheet)]"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-[var(--fin-r-pill)] bg-[var(--fin-line)] sm:hidden" aria-hidden="true" />

        {/* Cabecera: el número es lo que la persona viene a ver */}
        <div className="relative px-5 pb-4 pt-4 text-center">
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="absolute right-4 top-3 flex h-8 w-8 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)] hover:text-[var(--fin-ink)]"
          >
            <X className="h-4 w-4" />
          </button>
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-[var(--fin-r-pill)] ${infoRacha.anotadoHoy ? 'bg-[var(--fin-warn-bg)]' : 'bg-[var(--fin-soft)]'}`}>
            <Flame className={`h-8 w-8 ${infoRacha.anotadoHoy ? 'fill-amber-500 text-amber-500' : 'text-[var(--fin-ink-soft)] opacity-70'}`} />
          </div>
          <p className="mt-2 text-[40px] font-extrabold leading-none tabular-nums text-[var(--fin-ink)]">{racha}</p>
          <p className="mt-1 text-[15px] font-semibold text-[var(--fin-ink-soft)]">
            {racha === 1 ? 'día de racha' : 'días de racha'}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[13px]">
            <span className="rounded-[var(--fin-r-pill)] bg-[var(--fin-warn-bg)] px-2.5 py-1 font-bold text-[var(--fin-warn-ink)]">
              {liga ? `${liga.emoji} Liga ${liga.nombre}` : 'Aún sin liga'}
            </span>
            <span className="rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-2.5 py-1 font-semibold text-[var(--fin-ink-soft)]">
              Récord {infoRacha.rachaMaxima}
            </span>
            <span className="rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-2.5 py-1 font-semibold text-[var(--fin-ink-soft)]">
              {plural(infoRacha.diasAnotadosMes, 'día', 'días')} este mes
            </span>
          </div>
        </div>

        {/* Pestañas: lo mío / el ranking de todos */}
        <div className="px-5">
          <div role="tablist" className="grid grid-cols-2 gap-1 rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] p-1">
            {([['mia', '🔥 Mi racha'], ['ranking', '🏆 Ranking']] as const).map(([id, etiqueta]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={pestana === id}
                onClick={() => setPestana(id)}
                className={`rounded-[var(--fin-r-pill)] py-2 text-[14px] font-bold transition-colors ${
                  pestana === id ? 'bg-[var(--fin-surface)] text-[var(--fin-ink)] shadow-sm' : 'text-[var(--fin-ink-soft)]'
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-4">
          {pestana === 'ranking' ? <RankingRacha /> : (
            <div className="flex flex-col gap-5">
              {/* Hoy */}
              <div
                className={`flex items-center gap-3 rounded-[var(--fin-r-card)] p-3.5 ${
                  infoRacha.anotadoHoy ? 'bg-[var(--fin-soft)]' : 'bg-[var(--fin-warn-bg)]'
                }`}
              >
                {infoRacha.anotadoHoy ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--fin-ink-soft)]" />
                    <p className="text-[14px] leading-snug text-[var(--fin-ink)]">
                      <span className="font-bold">Hoy ya anotaste.</span> Tu racha está asegurada.
                    </p>
                  </>
                ) : (
                  <>
                    <Flame className="h-5 w-5 shrink-0 text-[var(--fin-warn-ink)]" />
                    <p className="text-[14px] leading-snug text-[var(--fin-ink)]">
                      <span className="font-bold text-[var(--fin-warn-ink)]">Anota algo hoy</span> para no perder
                      tus {plural(racha, 'día', 'días')}.
                    </p>
                  </>
                )}
              </div>

              {/* Próxima medalla */}
              {(hito || proximaLiga) && (
                <Tarjeta className="p-4">
                  {hito && (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[14px] font-bold text-[var(--fin-ink)]">
                          {hito.emoji} {hito.titulo}
                        </p>
                        <p className="text-[13px] tabular-nums text-[var(--fin-ink-soft)]">
                          {racha}/{hito.dias}
                        </p>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)]">
                        <div className="h-full rounded-[var(--fin-r-pill)] bg-amber-500 transition-all" style={{ width: `${progresoHito}%` }} />
                      </div>
                      <p className="mt-1.5 text-[13px] text-[var(--fin-ink-soft)]">
                        Te faltan {plural(infoRacha.diasParaProximoHito ?? 0, 'día', 'días')}
                        {proximaLiga ? ` · ${proximaLiga.emoji} ${proximaLiga.nombre} en ${plural(proximaLiga.desde - racha, 'día', 'días')}` : ''}
                      </p>
                    </>
                  )}
                  {!hito && proximaLiga && (
                    <p className="text-[14px] text-[var(--fin-ink)]">
                      {proximaLiga.emoji} {proximaLiga.nombre} en {plural(proximaLiga.desde - racha, 'día', 'días')}
                    </p>
                  )}
                </Tarjeta>
              )}

              {/* Premios: se activan con botón, no solos */}
              <section>
                <Titulo>🎁 Premios por tu constancia</Titulo>
                <Tarjeta className="divide-y divide-[var(--fin-line)]">
                  {premios.map((premio) => {
                    const faltan = premio.hito - racha;
                    const puedeReclamar = premio.alcanzado && !premio.reclamado && !premio.bloqueadoPorPago;
                    const aviso = avisoPremio?.hito === premio.hito ? avisoPremio.texto : null;
                    return (
                      <div key={premio.hito} className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[15px] font-bold text-[var(--fin-ink)]">
                              {premio.diasPremium} días de Premium
                            </p>
                            <p className="text-[13px] leading-snug text-[var(--fin-ink-soft)]">
                              {premio.reclamado
                                ? `Activado · premio de ${premio.hito} días`
                                : premio.alcanzado
                                  ? premio.bloqueadoPorPago
                                    ? 'Ganado. Actívalo cuando termine tu Premium actual'
                                    : `Ganado con ${premio.hito} días de racha`
                                  : faltan > 0
                                    ? `Al llegar a ${premio.hito} días · te faltan ${faltan}`
                                    : `Al llegar a ${premio.hito} días anotados a tiempo`}
                            </p>
                          </div>
                          {premio.reclamado ? (
                            <span className="flex shrink-0 items-center gap-1 rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-2.5 py-1 text-[13px] font-bold text-[var(--fin-ink-soft)]">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Activado
                            </span>
                          ) : puedeReclamar ? (
                            <button
                              type="button"
                              disabled={reclamando !== null}
                              onClick={() => void reclamar(premio.hito)}
                              className="flex shrink-0 items-center gap-1.5 rounded-[var(--fin-r-pill)] bg-[var(--fin-accent)] px-4 py-2 text-[14px] font-bold text-[var(--fin-on-accent)] transition-colors hover:bg-[var(--fin-accent-hover)] disabled:opacity-60"
                            >
                              {reclamando === premio.hito && <Loader2 className="h-4 w-4 animate-spin" />}
                              Reclamar
                            </button>
                          ) : premio.alcanzado ? (
                            <span className="shrink-0 rounded-[var(--fin-r-pill)] bg-[var(--fin-warn-bg)] px-2.5 py-1 text-[13px] font-bold text-[var(--fin-warn-ink)]">
                              Guardado
                            </span>
                          ) : (
                            <span className="shrink-0 text-[20px] grayscale opacity-50" aria-hidden="true">🔒</span>
                          )}
                        </div>
                        {!premio.alcanzado && faltan > 0 && (
                          <div className="mt-2 h-1.5 overflow-hidden rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)]">
                            <div
                              className="h-full rounded-[var(--fin-r-pill)] bg-amber-500"
                              style={{ width: `${Math.min(100, Math.round((racha / premio.hito) * 100))}%` }}
                            />
                          </div>
                        )}
                        {aviso && <p className="mt-2 text-[13px] font-semibold text-[var(--fin-ink)]" role="status">{aviso}</p>}
                      </div>
                    );
                  })}
                </Tarjeta>
              </section>

              {/* Últimos 28 días */}
              <section>
                <Titulo extra={`${dias.filter((d) => d.estado === 'anotado').length} de 28`}>Tus últimos 28 días</Titulo>
                <div className="grid grid-cols-7 gap-1.5" role="img" aria-label={`${dias.filter((d) => d.estado === 'anotado').length} de 28 días anotados`}>
                  {dias.map((d) => (
                    <div
                      key={d.fecha}
                      title={d.fecha}
                      className={`flex aspect-square items-center justify-center rounded-[var(--fin-r-control)] text-[11px] ${
                        d.estado === 'anotado'
                          ? 'bg-amber-500'
                          : d.estado === 'protegido'
                            ? 'border border-[var(--fin-line)] bg-[var(--fin-bg)]'
                            : d.estado === 'hoy-pendiente'
                              ? 'border-2 border-dashed border-amber-500'
                              : 'bg-[var(--fin-soft)]'
                      }`}
                    >
                      {d.estado === 'protegido' ? '🛡️' : null}
                    </div>
                  ))}
                </div>
              </section>

              {/* Medallas: una cuadrícula compacta en vez de una lista larga y lavada */}
              <section>
                <Titulo extra={`${medallasGanadas} de ${HITOS_RACHA.length}`}>Medallas</Titulo>
                <div className="grid grid-cols-4 gap-2">
                  {HITOS_RACHA.map((h) => {
                    const ganada = mejor >= h.dias;
                    return (
                      <div
                        key={h.dias}
                        title={`${h.titulo}: ${h.descripcion}`}
                        aria-label={`${h.titulo}, ${h.dias} días${ganada ? ', ganada' : ''}`}
                        className={`flex flex-col items-center gap-1 rounded-[var(--fin-r-card)] p-2.5 ${
                          ganada ? 'bg-[var(--fin-warn-bg)]' : 'bg-[var(--fin-soft)]'
                        }`}
                      >
                        <span className={ganada ? '' : 'opacity-35 grayscale'}>
                          <IconoSimbolo valor={h.emoji} className="h-7 w-7" />
                        </span>
                        <span className={`text-[12px] font-bold tabular-nums ${ganada ? 'text-[var(--fin-warn-ink)]' : 'text-[var(--fin-ink-faint)]'}`}>
                          {h.dias} días
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Protectores y recordatorio */}
              <Tarjeta className="divide-y divide-[var(--fin-line)]">
                <div className="flex items-center gap-3 p-3.5">
                  <span className="text-[22px]" aria-hidden="true">🛡️</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-bold text-[var(--fin-ink)]">
                      {servidor.protectores} {servidor.protectores === 1 ? 'protector' : 'protectores'}
                    </p>
                    <p className="text-[13px] leading-snug text-[var(--fin-ink-soft)]">
                      {servidor.protectorUsado
                        ? 'Usamos uno para salvar tu racha de ayer. 🎉'
                        : 'Ganas uno cada 7 días (máximo 2) y salva un día que se te pase.'}
                    </p>
                  </div>
                </div>

                <div className="p-3.5">
                  <div className="flex items-center gap-3">
                    <Bell className={`h-5 w-5 shrink-0 ${recordatorio.activo ? 'text-[var(--fin-warn-ink)]' : 'text-[var(--fin-ink-faint)]'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-bold text-[var(--fin-ink)]">Recordatorio diario</p>
                      <p className="text-[13px] text-[var(--fin-ink-soft)]">Te avisa si no has anotado hoy</p>
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
                      aria-label="Recordatorio diario"
                    >
                      <span
                        aria-hidden="true"
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-[var(--fin-r-pill)] bg-white shadow-md transition duration-200 ease-in-out ${
                          recordatorio.activo ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {recordatorio.activo && (
                    <div className="mt-3 flex flex-col gap-3 border-t border-[var(--fin-line)] pt-3">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-[13px] font-medium text-[var(--fin-ink-soft)]">
                          <Clock className="h-3.5 w-3.5 text-[var(--fin-warn-ink)]" />
                          Hora del recordatorio
                        </span>
                        <input
                          type="time"
                          value={recordatorio.hora}
                          onChange={(e) => recordatorio.cambiarHora(e.target.value)}
                          className="rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-surface)] px-3 py-1 text-[16px] font-bold tabular-nums text-[var(--fin-ink)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const ok = await enviarNotificacionRacha(racha, true);
                          setMensajePrueba(ok
                            ? 'Notificación de prueba enviada a tu dispositivo.'
                            : 'Revisa que las notificaciones estén permitidas en tu navegador.');
                          setTimeout(() => setMensajePrueba(null), 4000);
                        }}
                        className="self-start text-[13px] font-semibold text-[var(--fin-warn-ink)] underline"
                      >
                        Probar notificación ahora
                      </button>
                    </div>
                  )}
                  {mensajePrueba && <p className="mt-2 text-[13px] text-[var(--fin-ink-soft)]">{mensajePrueba}</p>}
                </div>
              </Tarjeta>

              {mensajeCompartir && <p className="text-center text-[13px] text-[var(--fin-ink-soft)]">{mensajeCompartir}</p>}
            </div>
          )}
        </div>

        {/* Pie fijo: presumir y cerrar siempre a mano */}
        <div className="flex gap-2 border-t border-[var(--fin-line)] px-5 pt-3 pb-[max(12px,var(--fin-safe-area-bottom))]">
          <button
            type="button"
            onClick={() => void compartir()}
            aria-label="Presumir mi racha"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--fin-r-card)] border border-[var(--fin-line)] text-[var(--fin-ink)] hover:bg-[var(--fin-soft)]"
          >
            <Share2 className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onCerrar}
            className="h-12 flex-1 rounded-[var(--fin-r-card)] bg-[var(--fin-accent)] text-[15px] font-bold text-[var(--fin-on-accent)] transition-colors hover:bg-[var(--fin-accent-hover)]"
          >
            ¡A seguir la racha!
          </button>
        </div>
      </motion.div>
    </div>
  );
};
