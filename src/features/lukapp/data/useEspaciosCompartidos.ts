import { useState, useEffect, useCallback } from 'react';
import { obtenerSupabase } from './supabase';

export interface Integrante {
  id: string;
  nombre: string;
  avatarColor: string;
  emoji: string;
}

export interface GastoCompartido {
  id: string;
  descripcion: string;
  montoCop: number;
  fecha: string;
  pagadoPorId: string;
  categoria: string;
}

export interface EspacioCompartido {
  id: string;
  nombre: string;
  icono: string;
  color: string;
  integrantes: Integrante[];
  gastos: GastoCompartido[];
  createdAt: string;
}

const CLAVE_STORAGE = 'finanzas:espacios-compartidos';

const ESPACIO_DEMO_INICIAL: EspacioCompartido = {
  id: 'espacio-pareja-demo',
  nombre: 'Mercado y Hogar',
  icono: '🥑',
  color: '#10b981',
  integrantes: [
    { id: 'yo', nombre: 'Tú', avatarColor: '#3b82f6', emoji: '👦🏼' },
    { id: 'pareja', nombre: 'Pareja', avatarColor: '#ec4899', emoji: '👩🏼' },
  ],
  gastos: [
    {
      id: 'gasto-1',
      descripcion: 'Mercado en Carulla',
      montoCop: 180000,
      fecha: new Date().toISOString().slice(0, 10),
      pagadoPorId: 'yo',
      categoria: 'mercado',
    },
    {
      id: 'gasto-2',
      descripcion: 'Frutas y verduras',
      montoCop: 45000,
      fecha: new Date().toISOString().slice(0, 10),
      pagadoPorId: 'pareja',
      categoria: 'mercado',
    },
  ],
  createdAt: new Date().toISOString(),
};

export function useEspaciosCompartidos() {
  const [espacios, setEspacios] = useState<EspacioCompartido[]>(() => {
    try {
      const guardado = localStorage.getItem(CLAVE_STORAGE);
      if (guardado) return JSON.parse(guardado);
    } catch {
      // Ignorar
    }
    return [ESPACIO_DEMO_INICIAL];
  });

  const guardarEspacios = useCallback((nuevos: EspacioCompartido[]) => {
    setEspacios(nuevos);
    try {
      localStorage.setItem(CLAVE_STORAGE, JSON.stringify(nuevos));
    } catch {
      // Ignorar
    }

    const supabase = obtenerSupabase();
    if (supabase) {
      void supabase.auth.getUser().then(({ data }) => {
        if (!data?.user) return;
        void supabase.auth.updateUser({
          data: { espaciosCompartidos: nuevos },
        });
      });
    }
  }, []);

  const crearEspacio = useCallback(
    (nombre: string, icono: string, color: string, nombrePareja: string, emojiPareja = '👩🏼') => {
      const nuevo: EspacioCompartido = {
        id: `espacio-${Date.now()}`,
        nombre,
        icono: icono || '🏠',
        color: color || '#8b5cf6',
        integrantes: [
          { id: 'yo', nombre: 'Tú', avatarColor: '#3b82f6', emoji: '👦🏼' },
          { id: `int-${Date.now()}`, nombre: nombrePareja || 'Compañero/a', avatarColor: '#ec4899', emoji: emojiPareja },
        ],
        gastos: [],
        createdAt: new Date().toISOString(),
      };
      const actualizados = [nuevo, ...espacios];
      guardarEspacios(actualizados);
      return nuevo;
    },
    [espacios, guardarEspacios],
  );

  const agregarGasto = useCallback(
    (espacioId: string, descripcion: string, montoCop: number, pagadoPorId: string, categoria = 'otros') => {
      const actualizados = espacios.map((esp) => {
        if (esp.id !== espacioId) return esp;
        const nuevoGasto: GastoCompartido = {
          id: `gasto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          descripcion,
          montoCop,
          fecha: new Date().toISOString().slice(0, 10),
          pagadoPorId,
          categoria,
        };
        return {
          ...esp,
          gastos: [nuevoGasto, ...esp.gastos],
        };
      });
      guardarEspacios(actualizados);
    },
    [espacios, guardarEspacios],
  );

  const borrarGasto = useCallback(
    (espacioId: string, gastoId: string) => {
      const actualizados = espacios.map((esp) => {
        if (esp.id !== espacioId) return esp;
        return {
          ...esp,
          gastos: esp.gastos.filter((g) => g.id !== gastoId),
        };
      });
      guardarEspacios(actualizados);
    },
    [espacios, guardarEspacios],
  );

  const saldarCuentas = useCallback(
    (espacioId: string) => {
      const actualizados = espacios.map((esp) => {
        if (esp.id !== espacioId) return esp;
        return {
          ...esp,
          gastos: [],
        };
      });
      guardarEspacios(actualizados);
    },
    [espacios, guardarEspacios],
  );

  const borrarEspacio = useCallback(
    (espacioId: string) => {
      const actualizados = espacios.filter((e) => e.id !== espacioId);
      guardarEspacios(actualizados);
    },
    [espacios, guardarEspacios],
  );

  // Sincronizar desde Supabase
  useEffect(() => {
    const supabase = obtenerSupabase();
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.user_metadata?.espaciosCompartidos) {
        const remotos = data.user.user_metadata.espaciosCompartidos as EspacioCompartido[];
        if (Array.isArray(remotos) && remotos.length > 0) {
          setEspacios(remotos);
          try {
            localStorage.setItem(CLAVE_STORAGE, JSON.stringify(remotos));
          } catch {
            // Ignorar
          }
        }
      }
    });
  }, []);

  return {
    espacios,
    crearEspacio,
    agregarGasto,
    borrarGasto,
    saldarCuentas,
    borrarEspacio,
  };
}
