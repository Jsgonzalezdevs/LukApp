import React, { useState, useEffect, useCallback } from 'react';
import { useSesion } from '../features/lukapp/data/useSesion';
import { useTema } from '../features/lukapp/data/useTema';
import { obtenerSupabase } from '../features/lukapp/data/supabase';
import { LoginPanel } from '../features/lukapp/components/LoginPanel';
import { LukAppMain } from '../features/lukapp/LukAppApp';
import { AppLauncher } from './AppLauncher';
import { SuperadminPanel } from './SuperadminPanel';
import { EstadisticasPanel } from './EstadisticasPanel';
import { LandingLukApp } from '../features/lukapp/components/LandingLukApp';
import { BASE_LUKAPP, segmentosDe, useRuta } from '../features/lukapp/data/useRuta';
import { Loader2, ShieldAlert, LogOut } from 'lucide-react';
import { registrarVisita } from '../lib/visita';
import { activarProteccionCodigo } from '../lib/proteccionCodigo';

const ADMIN_BACKUP_KEY = '__admin_session_backup__';

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
  const [activeApp, setActiveApp] = useState<AppId>(() => {
    const path = window.location.pathname;
    if (path.startsWith('/superadmin')) return 'superadmin';
    if (path.startsWith('/estadisticas')) return 'estadisticas';
    if (path.startsWith('/ecosistema')) return null;
    return 'finanzas';
  });
  const [rol, setRol] = useState<'admin' | 'usuario'>('usuario');
  const [permisos, setPermisos] = useState<string[]>([]);
  const [loadingRol, setLoadingRol] = useState(true);

  const { ruta, ir, reemplazar } = useRuta();
  const enPortada = activeApp === 'finanzas' && (segmentosDe(ruta).length === 0 || ruta === '/' || ruta === '/finanzas');

  // Si ya tiene sesión activa y está en la portada, va directo a la app
  useEffect(() => {
    if (!enPortada) return;
    if (sesion.estado.modo === 'autenticado' || sesion.estado.modo === 'local') {
      reemplazar(`${BASE_LUKAPP}/app`);
    }
  }, [enPortada, reemplazar, sesion.estado.modo]);

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
    window.location.href = '/superadmin';
  }, [adminBackup]);

  // Cargar rol de Supabase
  useEffect(() => {
    let cancelado = false;
    const cargarRol = async () => {
      if (sesion.estado.modo !== 'autenticado') {
        setRol('usuario');
        setPermisos([]);
        setLoadingRol(false);
        return;
      }
      try {
        const cliente = obtenerSupabase();
        const emailSesion = (sesion.estado.email || '').toLowerCase();
        const esEmailAdmin = emailSesion === 'jsgonzalez1658@gmail.com' || emailSesion === 'jsgonzalez@gmail.com';

        let rolBD: 'admin' | 'usuario' = esEmailAdmin ? 'admin' : 'usuario';
        let permisosAsignados: string[] = [];

        if (cliente) {
          const {
            data: { user },
          } = await cliente.auth.getUser();

          if (user) {
            const userEmail = (user.email || '').toLowerCase();
            if (userEmail === 'jsgonzalez1658@gmail.com' || userEmail === 'jsgonzalez@gmail.com') {
              rolBD = 'admin';
            }

            const { data: perfil } = await cliente
              .from('perfiles')
              .select('rol, roles_personalizados(nombre, permisos)')
              .eq('id', user.id)
              .maybeSingle();

            if (perfil?.rol === 'admin') {
              rolBD = 'admin';
            }

            const rolPers = Array.isArray(perfil?.roles_personalizados)
              ? (perfil?.roles_personalizados[0] as { nombre?: string; permisos?: string[] } | undefined)
              : (perfil?.roles_personalizados as { nombre?: string; permisos?: string[] } | undefined);

            if (rolBD === 'admin') {
              permisosAsignados = [];
            } else if (Array.isArray(rolPers?.permisos)) {
              permisosAsignados = rolPers.permisos;
            }
          }
        }

        if (cancelado) return;
        setRol(rolBD);
        setPermisos(permisosAsignados);
      } catch {
        if (!cancelado) {
          const emailSesion = (sesion.estado.modo === 'autenticado' ? sesion.estado.email : '').toLowerCase();
          if (emailSesion === 'jsgonzalez1658@gmail.com' || emailSesion === 'jsgonzalez@gmail.com') {
            setRol('admin');
          } else {
            setRol('usuario');
          }
          setPermisos([]);
        }
      } finally {
        if (!cancelado) setLoadingRol(false);
      }
    };
    cargarRol();
    return () => {
      cancelado = true;
    };
  }, [sesion.estado.modo, sesion.estado]);

  // Sync URL and document title based on active app
  useEffect(() => {
    const RUTAS: Record<string, string> = {
      finanzas: '/',
      superadmin: '/superadmin',
      estadisticas: '/estadisticas',
    };
    const TITULOS: Record<string, string> = {
      finanzas: 'LukApp — Finanzas Personales Inteligentes',
      superadmin: 'LukApp — Superadmin',
      estadisticas: 'LukApp — Estadísticas',
    };

    const path = (activeApp && RUTAS[activeApp]) ?? '/';
    if (path !== '/' && !window.location.pathname.startsWith(path)) {
      window.history.pushState(null, '', path);
    }

    document.title = (activeApp && TITULOS[activeApp]) ?? 'LukApp — Finanzas Personales Inteligentes';
  }, [activeApp]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/superadmin')) setActiveApp('superadmin');
      else if (path.startsWith('/estadisticas')) setActiveApp('estadisticas');
      else setActiveApp('finanzas');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
      <LoginPanel
        sesion={sesion}
        tema={tema}
        onCambiarTema={setTema}
        modoInicial="actualizar"
        onVolverInicio={() => ir('/')}
      />
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
      <LoginPanel
        sesion={sesion}
        tema={tema}
        onCambiarTema={setTema}
        onVolverInicio={() => ir('/')}
      />
    );
  }

  const emailActual = sesion.estado.modo === 'autenticado' ? sesion.estado.email.toLowerCase() : '';
  const esAdminOStaff =
    rol === 'admin' ||
    permisos.length > 0 ||
    emailActual === 'jsgonzalez1658@gmail.com' ||
    emailActual === 'jsgonzalez@gmail.com';

  if (!esAdminOStaff) {
    return (
      <div className={adminBackup ? 'pt-11' : ''}>
        {bannerAdmin}
        <LukAppMain />
      </div>
    );
  }

  if (activeApp === 'finanzas') {
    return (
      <div className={adminBackup ? 'pt-11' : ''}>
        {bannerAdmin}
        <LukAppMain onBack={() => setActiveApp(null)} />
      </div>
    );
  }

  if (activeApp === 'superadmin' && esAdminOStaff) {
    return (
      <div className={adminBackup ? 'pt-11' : ''}>
        {bannerAdmin}
        <SuperadminPanel
          rol={rol}
          permisos={permisos}
          onBack={() => setActiveApp(null)}
          tema={tema}
          onCambiarTema={setTema}
        />
      </div>
    );
  }

  if (activeApp === 'estadisticas' && (rol === 'admin' || permisos.includes('ver_visitantes'))) {
    return (
      <div className={adminBackup ? 'pt-11' : ''}>
        {bannerAdmin}
        <EstadisticasPanel onBack={() => setActiveApp(null)} tema={tema} onCambiarTema={setTema} />
      </div>
    );
  }

  const handleSalir = async () => {
    await sesion.salir();
    setActiveApp('finanzas');
    setTimeout(() => {
      window.location.href = '/';
    }, 100);
  };

  return (
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
  );
};
