import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { Sesion } from '../data/useSesion';

interface CambioPasswordPanelProps {
  sesion: Sesion;
  /** Recovery links already prove identity, so they do not require the old password. */
  recuperacion?: boolean;
  onClose?: () => void;
}

/** Reused for a normal in-session change and the post-email recovery screen. */
export const CambioPasswordPanel: React.FC<CambioPasswordPanelProps> = ({
  sesion,
  recuperacion = false,
  onClose,
}) => {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const enviar = async (event: React.FormEvent) => {
    event.preventDefault();
    setMensaje(null);
    setErrorLocal(null);
    if (nueva.length < 6) return setErrorLocal('La contraseña debe tener al menos 6 caracteres.');
    if (nueva !== confirmacion) return setErrorLocal('Las contraseñas nuevas no coinciden.');
    const ok = await sesion.cambiarPassword(nueva, recuperacion ? undefined : actual);
    if (ok) {
      setMensaje('Contraseña actualizada. Ya puedes seguir usando tu cuenta.');
      setActual('');
      setNueva('');
      setConfirmacion('');
    }
  };

  return (
    <div className={onClose ? 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5' : 'min-h-[100dvh] bg-[var(--fin-bg)] px-5 py-10'}>
      <form onSubmit={enviar} className="w-full max-w-md rounded-3xl border border-[var(--fin-line)] bg-[var(--fin-card)] p-6 shadow-xl">
        <h1 className="text-xl font-extrabold text-[var(--fin-ink)]">{recuperacion ? 'Crea una nueva contraseña' : 'Cambiar contraseña'}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--fin-ink-soft)]">
          {recuperacion ? 'El enlace verificó tu identidad. Elige una contraseña nueva para continuar.' : 'Usa una contraseña nueva que no reutilices en otros servicios.'}
        </p>
        {!recuperacion ? (
          <label className="mt-5 block text-xs font-bold text-[var(--fin-ink-soft)]">Contraseña actual
            <input value={actual} onChange={(e) => setActual(e.target.value)} type="password" autoComplete="current-password" required className="mt-1.5 w-full rounded-xl border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-3 text-[var(--fin-ink)]" />
          </label>
        ) : null}
        <label className="mt-5 block text-xs font-bold text-[var(--fin-ink-soft)]">Nueva contraseña
          <input value={nueva} onChange={(e) => setNueva(e.target.value)} type="password" autoComplete="new-password" minLength={6} required className="mt-1.5 w-full rounded-xl border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-3 text-[var(--fin-ink)]" />
        </label>
        <label className="mt-4 block text-xs font-bold text-[var(--fin-ink-soft)]">Confirmar nueva contraseña
          <input value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} type="password" autoComplete="new-password" minLength={6} required className="mt-1.5 w-full rounded-xl border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-3 text-[var(--fin-ink)]" />
        </label>
        {errorLocal || sesion.error ? <p role="alert" className="mt-4 flex gap-2 rounded-xl bg-[var(--fin-out-bg)] p-3 text-xs text-[var(--fin-out-ink)]"><AlertTriangle className="h-4 w-4 shrink-0" />{errorLocal ?? sesion.error}</p> : null}
        {mensaje ? <p role="status" className="mt-4 rounded-xl bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-700">{mensaje}</p> : null}
        <div className="mt-6 flex gap-3">
          {onClose ? <button type="button" onClick={onClose} className="rounded-xl px-4 py-3 text-sm font-bold text-[var(--fin-ink-soft)]">Cancelar</button> : null}
          <button type="submit" disabled={sesion.ocupado} className="ml-auto flex items-center gap-2 rounded-xl bg-[var(--fin-accent)] px-5 py-3 text-sm font-bold text-[var(--fin-on-accent)] disabled:opacity-50">
            {sesion.ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Guardar contraseña
          </button>
        </div>
      </form>
    </div>
  );
};
