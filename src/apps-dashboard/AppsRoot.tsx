import React, { Suspense, lazy, useState, useEffect, useCallback, useMemo } from 'react';
import '../features/lukapp/lukapp.css';
import { useSesion } from '../features/lukapp/data/useSesion';
import { useTema } from '../features/lukapp/data/useTema';
import { obtenerSupabase } from '../features/lukapp/data/supabase';
import { LandingLukApp } from '../features/lukapp/components/LandingLukApp';
import { BASE_LUKAPP, segmentosDe, useRuta } from '../features/lukapp/data/useRuta';
import { Loader2, ShieldAlert, LogOut } from 'lucide-react';
import { registrarVisita } from '../lib/visita';
import { activarProteccionCodigo } from '../lib/proteccionCodigo';
import { apiUrl } from '../lib/api';

/* La portada es la única ruta pública. Separar las vistas privadas evita que
   quien apenas llega descargue OCR, analítica y el dashboard antes de decidir
   crear una cuenta, que es un coste directo para LCP e INP. */
const LoginPanel = lazy(() => import('../features/lukapp/components/LoginPanel').then(({ LoginPanel }) => ({ default: LoginPanel })));
const LukAppMain = lazy(() => import('../features/lukapp/LukAppApp').then(({ LukAppMain }) => ({ default: LukAppMain })));
const AppLauncher = lazy(() => import('./AppLauncher').then(({ AppLauncher }) => ({ default: AppLauncher })));
const SuperadminPanel = lazy(() => import('./SuperadminPanel').then(({ SuperadminPanel }) => ({ default: SuperadminPanel })));
const EstadisticasPanel = lazy(() => import('./EstadisticasPanel').then(({ EstadisticasPanel }) => ({ default: EstadisticasPanel })));

const VistaConCarga: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense
    fallback={(
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--fin-bg)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--fin-ink-faint)]" />
      </div>
    )}
  >
    {children}
  </Suspense>
);

const ADMIN_BACKUP_KEY = '__admin_session_backup__';

// `AppId` incluye `null`, y un objeto no puede tener `null` como llave -- por
// eso esto es una función y no un `Record<AppId, string>`.
const routeFor = (app: AppId): string => {
  switch (app) {
    case 'finanzas':
      return '/';
    case 'superadmin':
      return '/superadmin';
    case 'estadisticas':
      return '/estadisticas';
    default:
      return '/ecosistema';
  }
};

const titleFor = (app: AppId): string => {
  switch (app) {
    case 'finanzas':
      return 'App para Controlar Gastos en Colombia | LukApp';
    case 'superadmin':
      return 'LukApp — Superadmin';
    case 'estadisticas':
      return 'LukApp — Estadísticas';
    default:
      return 'LukApp — Ecosistema';
  }
};

function detectActiveAppFromPath(pathname: string): AppId {
  if (pathname.startsWith('/superadmin')) return 'superadmin';
  if (pathname.startsWith('/estadisticas')) return 'estadisticas';
  if (pathname.startsWith('/ecosistema')) return null;
  return 'finanzas';
}

/** Una PWA ya instalada puede conservar la URL raíz de un manifiesto antiguo. */
const esPwaInstalada = (): boolean =>
  window.matchMedia?.('(display-mode: standalone)').matches === true ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

interface AdminBackup {
  access_token: string;
  refresh_token: string;
  usuario?: string;
  email?: string;
}

export type AppId = 'finanzas' | 'superadmin' | 'estadisticas' | null;

export const AppsRoot: React.FC = () => {
  useEffect(() => {
    registrarVisita();
    activarProteccionCodigo();
  }, []);

  const sesion = useSesion();
  const { tema, setTema } = useTema();
  const [activeApp, setActiveApp] = useState<AppId>(() => detectActiveAppFromPath(window.location.pathname));
  const [rol, setRol] = useState<'admin' | 'usuario'>('usuario');
  const [permisos, setPermisos] = useState<string[]>([]);
  const [loadingRol, setLoadingRol] = useState(true);

  const { ruta, ir } = useRuta();
  const enPortada =
    !esPwaInstalada() &&
    activeApp === 'finanzas' &&
    (segmentosDe(ruta).length === 0 || ruta === '/' || ruta === '/finanzas');

  // Además del `start_url` del manifiesto, esto repara instalaciones hechas
  // antes de que la PWA apuntara al Dashboard y deja la URL coherente al abrir.
  useEffect(() => {
    if (esPwaInstalada() && ruta === '/') ir('/app');
  }, [ir, ruta]);

  // Admin impersonation banner
  const [adminBackup, setAdminBackup] = useState<AdminBackup | null>(() => {
    try {
      const raw = localStorage.getItem(ADMIN_BACKUP_KEY);
      return raw ? (JSON.parse(raw) as AdminBackup) : null;
    } catch {
      return null;
    }
  });

  const [impersonatedUser, setImpersonatedUser] = useState<{ usuario: string | null; email: string } | null>(() => {
    try {
      const raw = localStorage.getItem('__impersonated_user__');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const volverAlAdmin = useCallback(async () => {
    if (!adminBackup) return;
    const cliente = obtenerSupabase();
    if (!cliente) return;
    await cliente.auth.setSession({
      access_token: adminBackup.access_token,
      refresh_token: adminBackup.refresh_token,
    });
    localStorage.removeItem(ADMIN_BACKUP_KEY);
    localStorage.removeItem('__impersonated_user__');
    setAdminBackup(null);
    setImpersonatedUser(null);
    setActiveApp('superadmin');
  }, [adminBackup]);

  const emailAutenticado = sesion.estado.modo === 'autenticado' ? sesion.estado.email : undefined;

  // Cargar rol de Supabase con retry logic
  useEffect(() => {
    let cancelado = false;
    let timeoutId: NodeJS.Timeout | undefined;

    const cargarRol = async (intentos = 0) => {
      if (sesion.estado.modo !== 'autenticado') {
        setRol('usuario');
        setPermisos([]);
        setLoadingRol(false);
        return;
      }

      try {
        const cliente = obtenerSupabase();

        let rolBD: 'admin' | 'usuario' = 'usuario';
        let permisosAsignados: string[] = [];

        if (cliente) {
          const {
            data: { session },
          } = await cliente.auth.getSession();

          // El rol y los permisos se piden a /api/mis-permisos, no directo a
          // Supabase: la tabla `roles` (permisos_por_rol incluida) es de
          // lectura admin-only por RLS a propósito (ver migración 0015), así
          // que un usuario con rol personalizado no podría leer sus propios
          // permisos con el cliente público aunque el nombre de columna fuera
          // correcto. Este endpoint corre con la llave de servicio y evita
          // abrir esa tabla a cualquiera con sesión.
          if (session?.access_token) {
            const res = await fetch(apiUrl('/api/mis-permisos'), {
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (!res.ok) throw new Error(`/api/mis-permisos respondió ${res.status}`);
            const data = await res.json();
            rolBD = data.rol === 'admin' ? 'admin' : 'usuario';
            permisosAsignados = Array.isArray(data.permisos) ? data.permisos : [];
          }
        }

        if (cancelado) return;
        setRol(rolBD);
        setPermisos(permisosAsignados);
      } catch (error) {
        if (cancelado) return;

        const maxIntentosReintento = 3;
        const esperaExponencial = Math.min(1000 * Math.pow(2, intentos), 10000);

        if (intentos < maxIntentosReintento) {
          console.warn(`Error loading user role, retrying (attempt ${intentos + 1}/${maxIntentosReintento}):`, error);
          timeoutId = setTimeout(() => cargarRol(intentos + 1), esperaExponencial);
          return;
        }

        console.error('Failed to load user role after retries:', error);
        setRol('usuario');
        setPermisos([]);
      } finally {
        if (!cancelado && intentos === 0) setLoadingRol(false);
      }
    };

    cargarRol();
    return () => {
      cancelado = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [sesion.estado.modo, emailAutenticado]);

  // Sync URL and document title based on active app
  useEffect(() => {
    const path = routeFor(activeApp);
    if (path && !window.location.pathname.startsWith(path)) {
      window.history.pushState(null, '', path);
    }
    document.title = titleFor(activeApp);
    // Cada vista principal empieza arriba. El navegador puede conservar el
    // offset anterior al cambiar con history.pushState, y en móvil eso se
    // ve como una carga incompleta o un salto de scroll.
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [activeApp]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setActiveApp(detectActiveAppFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Estos dos hooks tienen que vivir aquí, antes de cualquier `return`
  // condicional de más abajo. Un hook declarado después de un `if (...)
  // return` se salta en algunos renders y se ejecuta en otros -- distinto
  // número de hooks entre un render y el siguiente, que es justo lo que
  // React no permite (era el causante del "Error #310: Rendered more hooks
  // than during the previous render", disparado cada vez que `activeApp`
  // cambiaba entre 'finanzas'/'superadmin'/'estadisticas' y el lanzador).
  const esAdminOStaff = useMemo(() => rol === 'admin' || permisos.length > 0, [rol, permisos]);

  const handleSalir = useCallback(async () => {
    try {
      await sesion.salir();
    } catch (e) {
      console.error('Error during logout:', e);
    } finally {
      setActiveApp('finanzas');
      ir('/');
    }
  }, [ir, sesion]);

  const bannerAdmin = adminBackup ? (
    <div className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-between gap-3 border-b border-amber-400/30 bg-amber-500 px-4 py-2.5 shadow-md">
      <div className="flex items-center gap-2 text-white">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <p className="text-xs font-semibold">
          Modo asesoría — viendo como{' '}
          <span className="font-bold">
            {impersonatedUser?.usuario || impersonatedUser?.email || 'usuario'}
          </span>
        </p>
      </div>
      <button
        onClick={volverAlAdmin}
        className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-white/30"
      >
        <LogOut className="h-3.5 w-3.5" />
        Volver a mi cuenta
      </button>
    </div>
  ) : null;

  if (sesion.estado.modo === 'cargando' || (sesion.estado.modo === 'autenticado' && loadingRol)) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--fin-bg)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--fin-ink-faint)]" />
      </div>
    );
  }

  // Si el usuario llega por enlace de recuperación de contraseña: mostrar formulario de nueva clave
  if (sesion.enRecuperacion) {
    return (
      <VistaConCarga>
      <LoginPanel
        sesion={sesion}
        tema={tema}
        onCambiarTema={setTema}
        modoInicial="actualizar"
        onVolverInicio={() => ir('/')}
      />
      </VistaConCarga>
    );
  }

  // Si es anónimo: en portada muestra SIEMPRE LandingLukApp; en /entrar muestra LoginPanel
  if (sesion.estado.modo === 'anonimo') {
    if (enPortada) {
      const entrar = () => {
        ir(`${BASE_LUKAPP}/entrar`);
      };
      return <LandingLukApp onGetStarted={entrar} onLogin={entrar} sesion={sesion} />;
    }
    return (
      <VistaConCarga>
      <LoginPanel
        sesion={sesion}
        tema={tema}
        onCambiarTema={setTema}
        onVolverInicio={() => ir('/')}
      />
      </VistaConCarga>
    );
  }

  // La portada es pública incluso con una sesión activa. Forzar `/app` desde
  // aquí convertía el enlace raíz en un callejón sin salida para quien ya usa
  // LukApp; no añade seguridad y tampoco es necesario para la PWA.
  if (enPortada) {
    const abrirApp = () => ir(`${BASE_LUKAPP}/app`);
    return <LandingLukApp onGetStarted={abrirApp} onLogin={abrirApp} sesion={sesion} />;
  }

  if (!esAdminOStaff) {
    return (
      <VistaConCarga>
      <div className={adminBackup ? 'pt-11' : ''}>
        {bannerAdmin}
        <LukAppMain esAdmin={false} />
      </div>
      </VistaConCarga>
    );
  }

  if (activeApp === 'finanzas') {
    return (
      <VistaConCarga>
      <div className={adminBackup ? 'pt-11' : ''}>
        {bannerAdmin}
        <LukAppMain onBack={() => setActiveApp(null)} esAdmin={true} />
      </div>
      </VistaConCarga>
    );
  }

  if (activeApp === 'superadmin' && esAdminOStaff) {
    return (
      <VistaConCarga>
      <div className={adminBackup ? 'pt-11' : ''}>
        {bannerAdmin}
        <SuperadminPanel
          rol={rol}
          permisos={permisos}
          onBack={() => setActiveApp(null)}
          onNavigateTo={(app) => setActiveApp(app as any)}
          tema={tema}
          onCambiarTema={setTema}
        />
      </div>
      </VistaConCarga>
    );
  }

  if (activeApp === 'estadisticas' && (rol === 'admin' || permisos.includes('ver_visitantes'))) {
    return (
      <VistaConCarga>
      <div className={adminBackup ? 'pt-11' : ''}>
        {bannerAdmin}
        <EstadisticasPanel onBack={() => setActiveApp(null)} tema={tema} onCambiarTema={setTema} />
      </div>
      </VistaConCarga>
    );
  }

  return (
    <VistaConCarga>
    <div className={adminBackup ? 'pt-11' : ''}>
      {bannerAdmin}
      <AppLauncher
        rol={rol}
        tienePermisos={permisos.length > 0}
        onSelectApp={setActiveApp}
        tema={tema}
        onCambiarTema={setTema}
        onSalir={handleSalir}
      />
    </div>
    </VistaConCarga>
  );
};
