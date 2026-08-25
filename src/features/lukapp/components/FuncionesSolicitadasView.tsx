import React, { useCallback, useEffect, useState } from 'react';
import { ChevronUp, Lightbulb, Loader2, Plus, X } from 'lucide-react';
import { obtenerSupabase } from '../data/supabase';

interface Funcion {
  id: string;
  titulo: string;
  descripcion: string | null;
  votos: number;
}

/**
 * Funciones solicitadas: cualquiera propone una idea, cualquiera vota las
 * de los demás. El conteo lo mantiene un trigger en la base de datos (ver
 * migración 0019), así que aquí solo se lee y se escribe, nunca se suma.
 *
 * El voto es optimista: la flecha cambia y el número se mueve antes de que
 * el servidor confirme, porque votar es la acción que más se repite en esta
 * pantalla y no debería sentirse más lenta que tocar un botón.
 */
export const FuncionesSolicitadasView: React.FC = () => {
  const [funciones, setFunciones] = useState<Funcion[] | null>(null);
  const [misVotos, setMisVotos] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [votando, setVotando] = useState<Set<string>>(new Set());

  const [formAbierto, setFormAbierto] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    const cliente = obtenerSupabase();
    if (!cliente) {
      setError('Necesitas iniciar sesión para ver esto.');
      return;
    }
    setError(null);
    try {
      const [funcionesRes, votosRes] = await Promise.all([
        cliente
          .from('funciones_solicitadas')
          .select('id, titulo, descripcion, votos')
          .order('votos', { ascending: false })
          .order('creada_en', { ascending: false }),
        cliente.from('funciones_solicitadas_votos').select('funcion_id'),
      ]);
      if (funcionesRes.error) throw funcionesRes.error;
      if (votosRes.error) throw votosRes.error;
      setFunciones(funcionesRes.data ?? []);
      setMisVotos(new Set((votosRes.data ?? []).map((v) => v.funcion_id as string)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las funciones solicitadas');
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const votar = async (id: string) => {
    const cliente = obtenerSupabase();
    if (!cliente || votando.has(id)) return;

    const yaVotado = misVotos.has(id);
    setVotando((prev) => new Set(prev).add(id));

    // Optimista: se ve el cambio antes de que el servidor responda.
    setMisVotos((prev) => {
      const next = new Set(prev);
      if (yaVotado) next.delete(id);
      else next.add(id);
      return next;
    });
    setFunciones((prev) =>
      (prev ?? []).map((f) =>
        f.id === id ? { ...f, votos: Math.max(f.votos + (yaVotado ? -1 : 1), 0) } : f,
      ),
    );

    try {
      const {
        data: { user },
      } = await cliente.auth.getUser();
      if (!user) throw new Error('Sesión no disponible');

      if (yaVotado) {
        const { error: fallo } = await cliente
          .from('funciones_solicitadas_votos')
          .delete()
          .eq('funcion_id', id)
          .eq('user_id', user.id);
        if (fallo) throw fallo;
      } else {
        const { error: fallo } = await cliente
          .from('funciones_solicitadas_votos')
          .insert({ funcion_id: id, user_id: user.id });
        if (fallo) throw fallo;
      }
    } catch (e) {
      // El voto no se guardó: revierte lo optimista para no mentirle a la pantalla.
      setMisVotos((prev) => {
        const next = new Set(prev);
        if (yaVotado) next.add(id);
        else next.delete(id);
        return next;
      });
      setFunciones((prev) =>
        (prev ?? []).map((f) =>
          f.id === id ? { ...f, votos: Math.max(f.votos + (yaVotado ? 1 : -1), 0) } : f,
        ),
      );
      setError(e instanceof Error ? e.message : 'No se pudo registrar el voto');
    } finally {
      setVotando((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const enviarIdea = async () => {
    const cliente = obtenerSupabase();
    if (!cliente || !titulo.trim()) return;
    setEnviando(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await cliente.auth.getUser();
      if (!user) throw new Error('Sesión no disponible');

      const { data, error: fallo } = await cliente
        .from('funciones_solicitadas')
        .insert({
          titulo: titulo.trim(),
          descripcion: descripcion.trim() || null,
          creada_por: user.id,
        })
        .select('id, titulo, descripcion, votos')
        .single();
      if (fallo) throw fallo;

      setFunciones((prev) => [data, ...(prev ?? [])]);
      setTitulo('');
      setDescripcion('');
      setFormAbierto(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la idea');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="flex items-center gap-1.5 px-1 text-[15px] font-semibold text-[var(--fin-ink-soft)]">
          <Lightbulb className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
          Funciones solicitadas
        </h2>
        <p className="mt-1 px-1 text-[13px] leading-relaxed text-[var(--fin-ink-faint)]">
          Vota las ideas que quieres ver, o propón una nueva. Lo más votado se construye primero.
        </p>
      </div>

      {error ? (
        <p className="rounded-[var(--fin-r-card)] bg-[var(--fin-out-bg)] px-3.5 py-3 text-[13px] leading-relaxed text-[var(--fin-out-ink)]">
          {error}
        </p>
      ) : null}

      {funciones === null ? (
        <p className="px-1 text-[13px] text-[var(--fin-ink-faint)]">Cargando…</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {funciones.map((f) => {
            const votado = misVotos.has(f.id);
            return (
              <li
                key={f.id}
                className="flex items-start gap-3 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-3.5"
              >
                <button
                  type="button"
                  onClick={() => void votar(f.id)}
                  disabled={votando.has(f.id)}
                  className={`flex shrink-0 flex-col items-center gap-0.5 rounded-[var(--fin-r-control)] px-2.5 py-2 text-[15px] font-bold tabular-nums transition-colors disabled:opacity-60 ${
                    votado
                      ? 'bg-[var(--fin-accent)] text-[var(--fin-on-accent)]'
                      : 'bg-[var(--fin-soft)] text-[var(--fin-ink)] hover:bg-[var(--fin-card-hover)]'
                  }`}
                  aria-pressed={votado}
                  aria-label={votado ? 'Quitar voto' : 'Votar esta idea'}
                >
                  <ChevronUp className="h-4 w-4" strokeWidth={3} aria-hidden="true" />
                  {f.votos}
                </button>
                <div className="min-w-0 flex-1 pt-1">
                  <p className="text-[15px] font-semibold text-[var(--fin-ink)]">{f.titulo}</p>
                  {f.descripcion ? (
                    <p className="mt-0.5 text-[13px] leading-snug text-[var(--fin-ink-soft)]">
                      {f.descripcion}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}

          <li>
            {formAbierto ? (
              <div className="flex flex-col gap-2.5 rounded-[var(--fin-r-card)] border border-dashed border-[var(--fin-line)] p-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-[var(--fin-ink)]">Otras ideas</p>
                  <button
                    type="button"
                    onClick={() => {
                      setFormAbierto(false);
                      setTitulo('');
                      setDescripcion('');
                    }}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[var(--fin-ink-faint)] hover:bg-[var(--fin-soft)]"
                    aria-label="Cerrar"
                  >
                    <X className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </div>
                <input
                  type="text"
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="¿Qué te gustaría que hiciera LukApp?"
                  autoFocus
                  className="rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-2.5 text-[16px] text-[var(--fin-ink)] outline-none focus:border-[var(--fin-accent)]"
                />
                <textarea
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Cuéntanos un poco más (opcional)"
                  rows={2}
                  className="resize-none rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-2.5 text-[16px] text-[var(--fin-ink)] outline-none focus:border-[var(--fin-accent)]"
                />
                <button
                  type="button"
                  onClick={() => void enviarIdea()}
                  disabled={!titulo.trim() || enviando}
                  className="flex items-center justify-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-4 py-2.5 text-[15px] font-semibold text-[var(--fin-on-accent)] disabled:opacity-50"
                >
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} /> : null}
                  {enviando ? 'Enviando…' : 'Enviar idea'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setFormAbierto(true)}
                className="flex w-full items-center justify-center gap-2 rounded-[var(--fin-r-card)] border border-dashed border-[var(--fin-line)] p-3.5 text-[15px] font-semibold text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-soft)]"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                ¿Otras ideas?
              </button>
            )}
          </li>
        </ul>
      )}
    </section>
  );
};
