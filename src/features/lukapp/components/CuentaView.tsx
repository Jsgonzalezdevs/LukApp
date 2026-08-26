import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  RefreshCw,
  Trash2,
  User,
} from 'lucide-react';
import { apiUrl } from '../../../lib/api';
import { obtenerSupabase } from '../data/supabase';
import { VERSION_ETIQUETA } from '../../../version';

const MINIMO_PASSWORD = 6;

interface CuentaViewProps {
  userId: string | null;
  cuenta?: { email: string; onSalir: () => void };
  syncError: string | null;
  cambiosPendientes: number;
  onSincronizar: () => Promise<void>;
}

/** sha256 del userId, recortado a 20 caracteres -- se ve como un ID al azar,
 * pero es el mismo cada vez que se abre esta pantalla en vez de cambiar en
 * cada visita, y no exige guardar nada nuevo: sale del uuid que ya existe.
 *
 * `crypto.subtle` solo existe en contextos seguros (https, o localhost) --
 * null en vez de lanzar cubre a quien prueba la app por http en la red local. */
const idDeCuenta = async (userId: string): Promise<string | null> => {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;
  try {
    const datos = new TextEncoder().encode(userId);
    const hash = await crypto.subtle.digest('SHA-256', datos);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 20);
  } catch {
    return null;
  }
};

const conToken = async <T,>(hacer: (token: string) => Promise<T>): Promise<T> => {
  const cliente = obtenerSupabase();
  const session = cliente ? (await cliente.auth.getSession()).data.session : null;
  if (!session?.access_token) throw new Error('Sesión no disponible');
  return hacer(session.access_token);
};

/**
 * Cuenta: quién eres, si tus datos están al día, y las dos salidas -- cerrar
 * sesión (te vas, todo sigue ahí) y eliminar cuenta (te vas y te llevas todo).
 * Por eso la segunda pide una confirmación aparte que la primera no necesita.
 */
export const CuentaView: React.FC<CuentaViewProps> = ({
  userId,
  cuenta,
  syncError,
  cambiosPendientes,
  onSincronizar,
}) => {
  const [apodo, setApodo] = useState<string | null>(null);
  const [id, setId] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  const [cambiandoPassword, setCambiandoPassword] = useState(false);
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [guardandoPassword, setGuardandoPassword] = useState(false);
  const [errorPassword, setErrorPassword] = useState<string | null>(null);
  const [passwordActualizada, setPasswordActualizada] = useState(false);

  useEffect(() => {
    if (!userId) return;
    idDeCuenta(userId).then(setId);

    const cliente = obtenerSupabase();
    if (!cliente) return;
    cliente
      .from('perfiles')
      .select('usuario')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => setApodo(data?.usuario ?? null));
  }, [userId]);

  const copiarId = async () => {
    if (!id) return;
    try {
      await navigator.clipboard.writeText(id);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sin permiso de portapapeles, el id sigue visible para copiarlo a mano.
    }
  };

  const sincronizar = async () => {
    setSincronizando(true);
    try {
      await onSincronizar();
    } finally {
      setSincronizando(false);
    }
  };

  const restablecerPassword = async () => {
    setErrorPassword(null);
    if (nuevaPassword.length < MINIMO_PASSWORD) {
      setErrorPassword(`La contraseña debe tener al menos ${MINIMO_PASSWORD} caracteres.`);
      return;
    }
    if (nuevaPassword !== confirmarPassword) {
      setErrorPassword('Las contraseñas no coinciden.');
      return;
    }
    setGuardandoPassword(true);
    try {
      const cliente = obtenerSupabase();
      if (!cliente) throw new Error('No se pudo conectar con el servidor.');
      const { error } = await cliente.auth.updateUser({ password: nuevaPassword });
      if (error) throw new Error(error.message || 'No se pudo cambiar la contraseña.');
      setNuevaPassword('');
      setConfirmarPassword('');
      setCambiandoPassword(false);
      setPasswordActualizada(true);
      setTimeout(() => setPasswordActualizada(false), 4000);
    } catch (e) {
      setErrorPassword(e instanceof Error ? e.message : 'No se pudo cambiar la contraseña.');
    } finally {
      setGuardandoPassword(false);
    }
  };

  const eliminarCuenta = async () => {
    setEliminando(true);
    setErrorEliminar(null);
    try {
      await conToken(async (token) => {
        const res = await fetch(apiUrl('/api/mi-cuenta/eliminar'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'No se pudo eliminar la cuenta.');
        }
      });
      // La sesión ya no vale nada del lado del servidor -- salir y recargar
      // en la raíz es más confiable que confiar en que el estado local se
      // entere solo de que la cuenta detrás de él ya no existe.
      cuenta?.onSalir();
      window.location.href = '/';
    } catch (e) {
      setErrorEliminar(e instanceof Error ? e.message : 'No se pudo eliminar la cuenta.');
      setEliminando(false);
    }
  };

  const estadoSync = syncError
    ? { texto: 'Hubo un problema al sincronizar', color: 'var(--fin-out)' }
    : cambiosPendientes > 0
      ? { texto: `${cambiosPendientes} cambio${cambiosPendientes === 1 ? '' : 's'} por subir`, color: '#f59e0b' }
      : { texto: 'Todo bien', color: 'var(--fin-in)' };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--fin-r-pill)] bg-[var(--fin-soft)] text-[var(--fin-ink-soft)]">
          <User className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold text-[var(--fin-ink)]">
            {apodo || cuenta?.email || 'Tu cuenta'}
          </p>
          {apodo ? (
            <p className="truncate text-[14px] text-[var(--fin-ink-soft)]">{cuenta?.email}</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
        <p className="mb-1.5 text-[13px] font-semibold text-[var(--fin-ink-soft)]">ID de cuenta</p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-2.5 text-[13px] text-[var(--fin-ink)]">
            {id ?? '—'}
          </code>
          <button
            type="button"
            onClick={() => void copiarId()}
            disabled={!id}
            className="flex shrink-0 items-center gap-1.5 rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] px-3 py-2 text-[13px] font-semibold text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-card-hover)] disabled:opacity-50"
            aria-label="Copiar ID de cuenta"
          >
            {copiado ? (
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
            )}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="h-2 w-2 shrink-0 rounded-[var(--fin-r-pill)]"
            style={{ backgroundColor: estadoSync.color }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[var(--fin-ink-soft)]">Sincronización</p>
            <p className="truncate text-[15px] font-semibold text-[var(--fin-ink)]">{estadoSync.texto}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void sincronizar()}
          disabled={sincronizando}
          className="flex shrink-0 items-center gap-1.5 rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] px-3.5 py-2 text-[13px] font-semibold text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-card-hover)] disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${sincronizando ? 'animate-spin' : ''}`} strokeWidth={2.5} aria-hidden="true" />
          Sincronizar
        </button>
      </div>

      {cuenta ? (
        <button
          type="button"
          onClick={cuenta.onSalir}
          className="rounded-[var(--fin-r-card)] bg-[var(--fin-card)] px-4 py-3.5 text-left text-[17px] font-semibold text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-soft)]"
        >
          Cerrar sesión
        </button>
      ) : null}

      {cuenta ? (
        <div className="flex flex-col gap-2.5">
          {!cambiandoPassword ? (
            <button
              type="button"
              onClick={() => {
                setCambiandoPassword(true);
                setErrorPassword(null);
              }}
              className="flex items-center gap-2.5 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] px-4 py-3.5 text-left text-[17px] font-semibold text-[var(--fin-ink)] transition-colors hover:bg-[var(--fin-soft)]"
            >
              <KeyRound className="h-4 w-4 shrink-0 text-[var(--fin-accent)]" strokeWidth={2.5} aria-hidden="true" />
              Restablecer contraseña
              {passwordActualizada ? (
                <span className="ml-auto flex items-center gap-1 text-[13px] font-semibold text-[var(--fin-in)]">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                  Actualizada
                </span>
              ) : null}
            </button>
          ) : (
            <div className="flex flex-col gap-3 rounded-[var(--fin-r-card)] border border-[var(--fin-accent)]/25 bg-[var(--fin-card)] p-4">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 shrink-0 text-[var(--fin-accent)]" strokeWidth={2.5} aria-hidden="true" />
                <p className="text-[15px] font-semibold text-[var(--fin-ink)]">Nueva contraseña</p>
              </div>

              <div className="relative">
                <input
                  type={verPassword ? 'text' : 'password'}
                  value={nuevaPassword}
                  onChange={(e) => setNuevaPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                  disabled={guardandoPassword}
                  className="w-full rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-2.5 pr-10 text-[16px] text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--fin-accent)]/30"
                />
                <button
                  type="button"
                  onClick={() => setVerPassword((v) => !v)}
                  aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--fin-ink-faint)] hover:text-[var(--fin-ink)]"
                >
                  {verPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <input
                type={verPassword ? 'text' : 'password'}
                value={confirmarPassword}
                onChange={(e) => setConfirmarPassword(e.target.value)}
                placeholder="Confirmar contraseña"
                autoComplete="new-password"
                disabled={guardandoPassword}
                className="w-full rounded-[var(--fin-r-control)] border border-[var(--fin-line)] bg-[var(--fin-bg)] px-3 py-2.5 text-[16px] text-[var(--fin-ink)] placeholder:text-[var(--fin-ink-faint)] focus:outline-none focus:ring-2 focus:ring-[var(--fin-accent)]/30"
              />

              {errorPassword ? (
                <p className="text-[13px] font-semibold text-[var(--fin-out-ink)]">{errorPassword}</p>
              ) : null}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCambiandoPassword(false);
                    setNuevaPassword('');
                    setConfirmarPassword('');
                    setErrorPassword(null);
                  }}
                  disabled={guardandoPassword}
                  className="flex-1 rounded-[var(--fin-r-control)] bg-[var(--fin-soft)] px-4 py-2.5 text-[15px] font-semibold text-[var(--fin-ink)] disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void restablecerPassword()}
                  disabled={guardandoPassword}
                  className="flex flex-1 items-center justify-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-accent)] px-4 py-2.5 text-[15px] font-semibold text-[var(--fin-on-accent)] disabled:opacity-60"
                >
                  {guardandoPassword ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} /> : null}
                  {guardandoPassword ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {cuenta ? (
      <div className="mt-2 flex flex-col gap-2.5">
        <p className="px-1 text-[13px] font-semibold text-[var(--fin-ink-faint)]">Zona de riesgo</p>
        {!confirmando ? (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="flex items-center gap-2 rounded-[var(--fin-r-card)] bg-[var(--fin-out-bg)] px-4 py-3.5 text-left text-[17px] font-semibold text-[var(--fin-out-ink)] transition-colors hover:opacity-90"
          >
            <Trash2 className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
            Eliminar cuenta
          </button>
        ) : (
          <div className="flex flex-col gap-3 rounded-[var(--fin-r-card)] border border-[var(--fin-out)]/40 bg-[var(--fin-out-bg)] p-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fin-out-ink)]" strokeWidth={2.5} aria-hidden="true" />
              <p className="text-[14px] leading-relaxed text-[var(--fin-out-ink)]">
                Esto borra tu cuenta y todos tus datos para siempre: movimientos, cuentas, metas,
                categorías propias. No se puede deshacer.
              </p>
            </div>
            {errorEliminar ? (
              <p className="text-[13px] font-semibold text-[var(--fin-out-ink)]">{errorEliminar}</p>
            ) : null}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmando(false);
                  setErrorEliminar(null);
                }}
                disabled={eliminando}
                className="flex-1 rounded-[var(--fin-r-control)] bg-[var(--fin-card)] px-4 py-2.5 text-[15px] font-semibold text-[var(--fin-ink)] disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void eliminarCuenta()}
                disabled={eliminando}
                className="flex flex-1 items-center justify-center gap-2 rounded-[var(--fin-r-control)] bg-[var(--fin-out)] px-4 py-2.5 text-[15px] font-semibold text-white disabled:opacity-60"
              >
                {eliminando ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.5} /> : null}
                {eliminando ? 'Eliminando…' : 'Sí, eliminar mi cuenta'}
              </button>
            </div>
          </div>
        )}
      </div>
      ) : null}

      {/* La versión, al pie. Es el sitio donde alguien la va a buscar cuando
          reporte un problema: "estoy en la v1.0.0" ahorra media conversación. */}
      <p className="pt-2 text-center text-[12px] text-[var(--fin-ink-faint)]">
        LukApp {VERSION_ETIQUETA}
      </p>
    </section>
  );
};
