import React, { useState } from 'react';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { useRankingRacha, useRetosEspacios } from '../data/useRankingRacha';
import {
  ligaDeRacha,
  mensajeRival,
  type AlcanceRanking,
  type FilaEspacio,
  type FilaRanking,
} from '../lib/rankingRacha';

const MEDALLA: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

const ALCANCES: ReadonlyArray<readonly [AlcanceRanking, string]> = [
  ['global', 'Racha'],
  ['semana', 'Semana'],
  ['amigos', 'Amigos'],
];

const Posicion: React.FC<{ n: number }> = ({ n }) => (
  <span className="w-8 shrink-0 text-center text-[15px] font-bold tabular-nums text-[var(--fin-ink-soft)]">
    {MEDALLA[n] ?? `#${n}`}
  </span>
);

const claseFila = (soyYo: boolean) =>
  `flex items-center gap-3 rounded-[var(--fin-r-card)] border px-3 py-2.5 ${
    soyYo ? 'border-[var(--fin-accent)]/40 bg-[var(--fin-soft)]' : 'border-[var(--fin-line)]/50 bg-[var(--fin-bg)]'
  }`;

const Fila: React.FC<{ fila: FilaRanking; semana: boolean }> = ({ fila, semana }) => {
  const liga = ligaDeRacha(fila.rachaActual);
  return (
    <li className={claseFila(fila.soyYo)}>
      <Posicion n={fila.posicion} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold text-[var(--fin-ink)]">
          {fila.soyYo ? `${fila.apodo} (tú)` : fila.apodo}
        </p>
        <p className="text-[13px] text-[var(--fin-ink-soft)]">
          {liga ? `${liga.emoji} ${liga.nombre}` : 'Sin liga'}
          {semana ? ` · racha ${fila.rachaActual}` : ` · récord ${fila.rachaMaxima}`}
        </p>
      </div>
      <span className="flex items-center gap-1 text-[17px] font-bold tabular-nums text-[var(--fin-warn-ink)]">
        {semana ? `📅 ${fila.diasSemana ?? 0}/7` : `🔥 ${fila.rachaActual}`}
      </span>
    </li>
  );
};

const FilaAmigo: React.FC<{ fila: FilaEspacio }> = ({ fila }) => (
  <li className={claseFila(fila.soyYo)}>
    <Posicion n={fila.posicion} />
    <span className="text-[20px]" aria-hidden="true">{fila.emoji}</span>
    <div className="min-w-0 flex-1">
      <p className="truncate text-[15px] font-bold text-[var(--fin-ink)]">
        {fila.soyYo ? 'Tú' : fila.nombre}
      </p>
      <p className="text-[13px] text-[var(--fin-ink-soft)]">
        Esta semana {fila.diasSemana}/7 · récord {fila.rachaMaxima}
      </p>
    </div>
    <span className="text-[17px] font-bold tabular-nums text-[var(--fin-warn-ink)]">🔥 {fila.rachaActual}</span>
  </li>
);

const Reintentar: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <div className="flex flex-col items-center gap-3 py-6 text-center">
    <p className="text-[13px] text-[var(--fin-ink-soft)]">No pudimos cargarlo.</p>
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] px-4 py-2 text-[13px] font-bold text-[var(--fin-ink)]"
    >
      <RefreshCw className="h-3.5 w-3.5" /> Reintentar
    </button>
  </div>
);

const SinConexion: React.FC = () => (
  <p className="rounded-[var(--fin-r-card)] bg-[var(--fin-soft)] p-4 text-[13px] text-[var(--fin-ink-soft)]">
    El ranking necesita tu cuenta de LukApp con conexión. Entra con tu sesión para ver cómo vas frente a los demás.
  </p>
);

const ListaGeneral: React.FC<{ alcance: 'global' | 'semana' }> = ({ alcance }) => {
  const { estado, ranking, recargar, fijarVisibilidad } = useRankingRacha(alcance);
  const [guardando, setGuardando] = useState(false);
  const semana = alcance === 'semana';

  if (estado === 'sin-conexion') return <SinConexion />;
  if (estado === 'cargando' && !ranking) {
    return <p className="py-6 text-center text-[13px] text-[var(--fin-ink-soft)]">Cargando el ranking…</p>;
  }
  if (estado === 'error' && !ranking) return <Reintentar onClick={() => void recargar()} />;

  const visibles = (ranking?.filas ?? []).filter((f) => f.visible);
  const yo = ranking?.yo ?? null;
  const yoEnLista = visibles.some((f) => f.soyYo);
  const rival = ranking ? mensajeRival(ranking) : null;

  const alternar = async () => {
    if (!yo) return;
    setGuardando(true);
    await fijarVisibilidad(!yo.visible);
    setGuardando(false);
  };

  return (
    <div className="flex flex-col gap-3">
      {!semana && rival && (
        <p className="rounded-[var(--fin-r-card)] border border-[var(--fin-warn)]/30 bg-[var(--fin-warn-bg)] p-3 text-[13px] font-semibold leading-snug text-[var(--fin-warn-ink)]">
          {rival}
        </p>
      )}
      <p className="text-[13px] text-[var(--fin-ink-soft)]">
        {semana
          ? 'Gana quien más días anote de lunes a domingo. Se reinicia cada lunes, así que todos arrancan de cero. 🏁'
          : `${ranking?.totalParticipantes ?? 0} ${ranking?.totalParticipantes === 1 ? 'persona con' : 'personas con'} racha activa en LukApp`}
      </p>

      {visibles.length === 0 ? (
        <p className="rounded-[var(--fin-r-card)] bg-[var(--fin-soft)] p-4 text-[13px] text-[var(--fin-ink-soft)]">
          {semana ? 'Nadie ha anotado esta semana todavía. ¡Sé el primero! 🌱' : 'Todavía nadie tiene racha activa. Anota un movimiento hoy y arranca de primero. 🌱'}
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {visibles.map((f) => <Fila key={f.userId} fila={f} semana={semana} />)}
        </ol>
      )}

      {yo && !yoEnLista && (
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold text-[var(--fin-ink-soft)]">
            {yo.visible ? 'Tu posición' : 'Tu posición (solo tú la ves)'}
          </p>
          <ol><Fila fila={yo} semana={semana} /></ol>
        </div>
      )}

      {!yo && estado === 'listo' && (
        <p className="rounded-[var(--fin-r-card)] bg-[var(--fin-soft)] p-3 text-[13px] text-[var(--fin-ink-soft)]">
          Aún no estás en el ranking: anota un movimiento {semana ? 'esta semana' : 'hoy'} para entrar. 🔥
        </p>
      )}

      {yo && (
        <button
          type="button"
          onClick={() => void alternar()}
          disabled={guardando}
          className="mt-1 flex items-center justify-center gap-2 text-[13px] font-semibold text-[var(--fin-ink-soft)] underline disabled:opacity-50"
        >
          {yo.visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {yo.visible ? 'Ocultarme del ranking' : 'Volver a aparecer en el ranking'}
        </button>
      )}
      <p className="text-[12px] leading-snug text-[var(--fin-ink-faint)]">
        Solo se muestra tu apodo y tus días, nunca tu correo ni tus montos.
      </p>
    </div>
  );
};

const ListaAmigos: React.FC = () => {
  const { estado, retos, recargar } = useRetosEspacios();

  if (estado === 'sin-conexion') return <SinConexion />;
  if (estado === 'cargando' && retos.length === 0) {
    return <p className="py-6 text-center text-[13px] text-[var(--fin-ink-soft)]">Cargando tus retos…</p>;
  }
  if (estado === 'error' && retos.length === 0) return <Reintentar onClick={() => void recargar()} />;

  if (retos.length === 0) {
    return (
      <p className="rounded-[var(--fin-r-card)] bg-[var(--fin-soft)] p-4 text-[13px] leading-snug text-[var(--fin-ink-soft)]">
        Aquí compites solo con tus amigos. Crea un espacio compartido (con tu pareja, tu parche o tu familia),
        invítalos con el enlace y verán quién lleva más días seguidos. 🤝
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {retos.map((reto) => (
        <section key={reto.espacioId} className="flex flex-col gap-2">
          <h4 className="text-[14px] font-bold text-[var(--fin-ink)]">
            <span aria-hidden="true">{reto.icono}</span> {reto.nombre}
          </h4>
          {reto.filas.length <= 1 ? (
            <p className="text-[13px] text-[var(--fin-ink-soft)]">Invita a alguien a este espacio para empezar el reto.</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {reto.filas.map((f) => <FilaAmigo key={f.userId} fila={f} />)}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
};

export const RankingRacha: React.FC = () => {
  const [alcance, setAlcance] = useState<AlcanceRanking>('global');
  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Tipo de ranking" className="grid grid-cols-3 gap-1">
        {ALCANCES.map(([id, etiqueta]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={alcance === id}
            onClick={() => setAlcance(id)}
            className={`rounded-[var(--fin-r-pill)] border py-1.5 text-[13px] font-bold transition-colors ${
              alcance === id
                ? 'border-[var(--fin-warn)]/40 bg-[var(--fin-warn-bg)] text-[var(--fin-warn-ink)]'
                : 'border-[var(--fin-line)] text-[var(--fin-ink-soft)]'
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>
      {alcance === 'amigos' ? <ListaAmigos /> : <ListaGeneral key={alcance} alcance={alcance} />}
    </div>
  );
};
