import React, { useState, useEffect } from 'react';
import { useSesion } from '../features/finanzas/data/useSesion';
import { useTema } from '../features/finanzas/data/useTema';
import { obtenerSupabase } from '../features/finanzas/data/supabase';
import { LoginPanel } from '../features/finanzas/components/LoginPanel';
import { FinanzasApp } from '../features/finanzas/FinanzasApp';
import { AppLauncher } from './AppLauncher';
import { SuperadminPanel } from './SuperadminPanel';
import { Loader2 } from 'lucide-react';

export type AppId = 'finanzas' | 'superadmin' | null;

export const AppsRoot: React.FC = () => {
  const sesion = useSesion();
  const { tema, setTema } = useTema();
  const [activeApp, setActiveApp] = useState<AppId>(() => {
    const path = window.location.pathname;
    if (path.startsWith('/finanzas')) return 'finanzas';
    if (path.startsWith('/superadmin')) return 'superadmin';
    return null;
  });
  const [rol, setRol] = useState<'admin' | 'usuario'>('usuario');
  const [loadingRol, setLoadingRol] = useState(true);

  // Sync URL with state changes
  useEffect(() => {
    const path = activeApp === 'finanzas' ? '/finanzas' : activeApp === 'superadmin' ? '/superadmin' : '/ecosistema';
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  }, [activeApp]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/finanzas')) setActiveApp('finanzas');
      else if (path.startsWith('/superadmin')) setActiveApp('superadmin');
      else setActiveApp(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (sesion.estado.modo === 'autenticado') {
      const fetchRol = async () => {
        const cliente = obtenerSupabase();
        if (cliente && sesion.estado.modo === 'autenticado') {
          // Si el correo es el del admin principal, otorgar acceso directamente en la UI.
          if (sesion.estado.email === 'Jsgonzalez1658@gmail.com' || sesion.estado.email === 'jsgonzalez1658@gmail.com') {
            setRol('admin');
            setLoadingRol(false);
            return;
          }

          const { data } = await cliente
            .from('perfiles')
            .select('rol')
            .eq('id', sesion.estado.userId)
            .single();
          if (data?.rol) {
            setRol(data.rol);
          }
        }
        setLoadingRol(false);
      };
      fetchRol();
    } else {
      setLoadingRol(false);
    }
  }, [sesion.estado]);

  if (sesion.estado.modo === 'cargando' || (sesion.estado.modo === 'autenticado' && loadingRol)) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--fin-bg)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--fin-ink-faint)]" />
      </div>
    );
  }

  if (sesion.estado.modo === 'anonimo') {
    return <LoginPanel sesion={sesion} tema={tema} onCambiarTema={setTema} />;
  }

  if (activeApp === 'finanzas') {
    // Si el usuario NO es admin, no le mostramos el botón de "Volver al ecosistema"
    return <FinanzasApp onBack={rol === 'admin' ? () => setActiveApp(null) : undefined} />;
  }

  if (activeApp === 'superadmin') {
    if (rol !== 'admin') {
      // Bloquear acceso por URL si no es admin
      setActiveApp('finanzas');
      return null;
    }
    return <SuperadminPanel onBack={() => setActiveApp(null)} tema={tema} onCambiarTema={setTema} />;
  }

  // Launcher dashboard (solo para el admin)
  if (rol === 'admin') {
    return (
      <AppLauncher 
        rol={rol} 
        onSelectApp={setActiveApp} 
        tema={tema} 
        onCambiarTema={setTema}
        onSalir={() => sesion.salir()} 
      />
    );
  }

  // Si es un usuario normal y por alguna razón llega aquí (ej: a /ecosistema), lo mandamos a finanzas
  setActiveApp('finanzas');
  return null;
};
