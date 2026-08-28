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

const sinDemo = (valor: unknown): EspacioCompartido[] =>
  Array.isArray(valor) ? (valor as EspacioCompartido[]).filter((espacio) => espacio.id !== 'espacio-pareja-demo') : [];

const claveParaUsuario = (userId?: string | null) => `${CLAVE_STORAGE}:${userId ?? 'local'}`;

export function useEspaciosCompartidos(userId?: string | null) {
  const claveStorage = claveParaUsuario(userId);
  const [espacios, setEspacios] = useState<EspacioCompartido[]>(() => {
    try {
      const guardado = localStorage.getItem(claveStorage);
      if (guardado) return sinDemo(JSON.parse(guardado));
    } catch {
      // Ignorar
    }
    return [];
  });

  const guardarEspacios = useCallback(async (nuevos: EspacioCompartido[]) => {
    const anteriores = espacios;
    setEspacios(nuevos);
    try {
      localStorage.setItem(claveStorage, JSON.stringify(nuevos));
    } catch {
      // Ignorar
    }

    const supabase = obtenerSupabase();
    if (!supabase || !userId) return true;
    const { error } = await supabase.auth.updateUser({ data: { espaciosCompartidos: nuevos } });
    if (error) {
      setEspacios(anteriores);
      try {
        localStorage.setItem(claveStorage, JSON.stringify(anteriores));
      } catch {
        // Ignorar
      }
      return false;
    }
    return true;
  }, [claveStorage, espacios, userId]);

  const crearEspacio = useCallback(
    async (nombre: string, icono: string, color: string, nombrePareja: string, emojiPareja = '👩🏼') => {
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
      return (await guardarEspacios(actualizados)) ? nuevo : null;
    },
    [espacios, guardarEspacios],
  );

  const agregarGasto = useCallback(
    async (espacioId: string, descripcion: string, montoCop: number, pagadoPorId: string, categoria = 'otros') => {
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
      return guardarEspacios(actualizados);
    },
    [espacios, guardarEspacios],
  );

  const borrarGasto = useCallback(
    async (espacioId: string, gastoId: string) => {
      const actualizados = espacios.map((esp) => {
        if (esp.id !== espacioId) return esp;
        return {
          ...esp,
          gastos: esp.gastos.filter((g) => g.id !== gastoId),
        };
      });
      return guardarEspacios(actualizados);
    },
    [espacios, guardarEspacios],
  );

  const saldarCuentas = useCallback(
    async (espacioId: string) => {
      const actualizados = espacios.map((esp) => {
        if (esp.id !== espacioId) return esp;
        return {
          ...esp,
          gastos: [],
        };
      });
      return guardarEspacios(actualizados);
    },
    [espacios, guardarEspacios],
  );

  const borrarEspacio = useCallback(
    async (espacioId: string) => {
      const actualizados = espacios.filter((e) => e.id !== espacioId);
      return guardarEspacios(actualizados);
    },
    [espacios, guardarEspacios],
  );

  // Sincronizar desde Supabase
  useEffect(() => {
    if (!userId) return;
    const supabase = obtenerSupabase();
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      if (data?.user?.id === userId && Array.isArray(data.user.user_metadata?.espaciosCompartidos)) {
        const remotos = sinDemo(data.user.user_metadata.espaciosCompartidos);
        setEspacios(remotos);
          try {
            localStorage.setItem(claveStorage, JSON.stringify(remotos));
          } catch {
            // Ignorar
          }
      }
    });
  }, [claveStorage, userId]);

  return {
    espacios,
    crearEspacio,
    agregarGasto,
    borrarGasto,
    saldarCuentas,
    borrarEspacio,
  };
}
