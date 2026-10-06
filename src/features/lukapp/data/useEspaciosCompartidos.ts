import { useState, useEffect, useCallback } from 'react';
import { obtenerSupabase } from './supabase';

export interface Integrante { id: string; nombre: string; avatarColor: string; emoji: string }
export interface GastoCompartido { id: string; descripcion: string; montoCop: number; fecha: string; pagadoPorId: string; categoria: string }
export interface EspacioCompartido { id: string; nombre: string; icono: string; color: string; integrantes: Integrante[]; gastos: GastoCompartido[]; createdAt: string }

const CLAVE = (id?: string | null) => `finanzas:espacios-compartidos:${id ?? 'local'}`;

const mensajeDeError = (error: { message?: string } | Error | null | undefined, accion: string): string => {
  const mensaje = error?.message?.trim() || `No se pudo ${accion}. Inténtalo de nuevo.`;
  const normalizado = mensaje.toLowerCase();
  if (normalizado.includes('row-level security') || normalizado.includes('permission denied') || normalizado.includes('42501')) return `No se pudo ${accion} porque tu sesión ya no tiene permiso. Cierra sesión, vuelve a entrar e inténtalo de nuevo.`;
  if (normalizado.includes('failed to fetch') || normalizado.includes('network') || normalizado.includes('load failed')) return `No se pudo ${accion} por un problema de conexión. Revisa tu internet e inténtalo de nuevo.`;
  return mensaje;
};

export function useEspaciosCompartidos(userId?: string | null) {
  const cliente = obtenerSupabase();
  const clave = CLAVE(userId);
  const [espacios, setEspacios] = useState<EspacioCompartido[]>(() => { try { return JSON.parse(localStorage.getItem(clave) || '[]'); } catch { return []; } });
  const [error, setError] = useState<string | null>(null);
  const guardarEnCache = useCallback((siguientes: EspacioCompartido[]) => { setEspacios(siguientes); localStorage.setItem(clave, JSON.stringify(siguientes)); }, [clave]);
  const cargar = useCallback(async () => {
    if (!cliente || !userId) return;
    try {
      const { data, error: errorEspacios } = await cliente.from('espacios_integrantes').select('espacio_id, espacios_compartidos(id,nombre,icono,color,created_at)').eq('user_id', userId);
      if (errorEspacios) { setError(mensajeDeError(errorEspacios, 'cargar tus espacios compartidos')); return; }
      const filas = (data || []) as Array<{ espacio_id: string; espacios_compartidos: { id: string; nombre: string; icono: string; color: string; created_at: string }[] | null }>;
      const ids = filas.map((f) => f.espacio_id);
      const [{ data: miembros, error: errorMiembros }, { data: gastos, error: errorGastos }] = await Promise.all([
        ids.length ? cliente.from('espacios_integrantes').select('espacio_id,user_id,nombre,emoji').in('espacio_id', ids) : Promise.resolve({ data: [], error: null }),
        ids.length ? cliente.from('gastos_compartidos').select('id,espacio_id,descripcion,monto_cop,fecha,pagado_por,categoria').in('espacio_id', ids).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
      ]);
      if (errorMiembros || errorGastos) { setError(mensajeDeError(errorMiembros || errorGastos, 'cargar los datos de tus espacios')); return; }
      const resultado = filas.flatMap((f) => { const e = f.espacios_compartidos?.[0]; if (!e) return []; return [{ id: e.id, nombre: e.nombre, icono: e.icono, color: e.color, createdAt: e.created_at, integrantes: (miembros || []).filter((m) => m.espacio_id === f.espacio_id).map((m) => ({ id: m.user_id === userId ? 'yo' : m.user_id, nombre: m.user_id === userId ? 'Tú' : m.nombre || 'Pareja', avatarColor: m.user_id === userId ? '#3b82f6' : '#ec4899', emoji: m.emoji || '🙂' })), gastos: (gastos || []).filter((g) => g.espacio_id === f.espacio_id).map((g) => ({ id: g.id, descripcion: g.descripcion, montoCop: Number(g.monto_cop), fecha: g.fecha, pagadoPorId: g.pagado_por === userId ? 'yo' : g.pagado_por, categoria: g.categoria })) }]; });
      guardarEnCache(resultado);
      setError(null);
    } catch (errorDeCarga) { setError(mensajeDeError(errorDeCarga instanceof Error ? errorDeCarga : null, 'cargar tus espacios compartidos')); }
  }, [cliente, userId, guardarEnCache]);
  useEffect(() => { void cargar(); if (!cliente || !userId) return; const canal = cliente.channel(`espacios-${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'gastos_compartidos' }, () => void cargar()).subscribe(); return () => { void cliente.removeChannel(canal); }; }, [cargar, cliente, userId]);
  const crearEspacio = useCallback(async (nombre: string, icono: string, color: string, _nombrePareja: string, _emojiPareja = '🙂') => {
    if (!cliente || !userId) { setError('Inicia sesión para crear un espacio compartido.'); return null; }
    setError(null);
    try {
      const { data, error: errorCreacion } = await cliente.rpc('crear_espacio_compartido', { nombre_espacio: nombre, icono_espacio: icono, color_espacio: color });
      if (errorCreacion || !data) { setError(mensajeDeError(errorCreacion, 'crear el espacio compartido')); return null; }
      const nuevo: EspacioCompartido = { id: data, nombre, icono, color, integrantes: [{ id: 'yo', nombre: 'Tú', avatarColor: '#3b82f6', emoji: '👦🏼' }], gastos: [], createdAt: new Date().toISOString() };
      setEspacios((anteriores) => { const siguientes = anteriores.some((espacio) => espacio.id === nuevo.id) ? anteriores : [nuevo, ...anteriores]; localStorage.setItem(clave, JSON.stringify(siguientes)); return siguientes; });
      // El RPC ya confirmó la creación. La recarga solo reconcilia detalles y no puede ocultar ese resultado.
      void cargar();
      return nuevo;
    } catch (errorDeCreacion) { setError(mensajeDeError(errorDeCreacion instanceof Error ? errorDeCreacion : null, 'crear el espacio compartido')); return null; }
  }, [cliente, userId, clave, cargar]);
  const agregarGasto = useCallback(async (espacioId: string, descripcion: string, montoCop: number, pagadoPorId: string, categoria = 'otros') => { if (!cliente || !userId) return false; const { error: errorGasto } = await cliente.from('gastos_compartidos').insert({ espacio_id: espacioId, creado_por: userId, pagado_por: pagadoPorId === 'yo' ? userId : pagadoPorId, descripcion, monto_cop: montoCop, categoria }); if (!errorGasto) await cargar(); return !errorGasto; }, [cliente, userId, cargar]);
  const borrarGasto = useCallback(async (_espacioId: string, gastoId: string) => { if (!cliente) return false; const { error: errorBorrado } = await cliente.from('gastos_compartidos').delete().eq('id', gastoId); if (!errorBorrado) await cargar(); return !errorBorrado; }, [cliente, cargar]);
  const saldarCuentas = useCallback(async (espacioId: string) => { if (!cliente) return false; const { error: errorSaldo } = await cliente.from('gastos_compartidos').delete().eq('espacio_id', espacioId); if (!errorSaldo) await cargar(); return !errorSaldo; }, [cliente, cargar]);
  const crearInvitacion = useCallback(async (espacioId: string) => { if (!cliente) return null; const { data, error: errorInvitacion } = await cliente.rpc('crear_invitacion_compartida', { espacio: espacioId }); return errorInvitacion ? null : `${window.location.origin}${window.location.pathname}?invitacion=${data}`; }, [cliente]);
  const aceptarInvitacion = useCallback(async (token: string, nombre = 'Pareja', emoji = '🙂') => { if (!cliente || !userId) return false; const { error: errorAceptacion } = await cliente.rpc('aceptar_invitacion_compartida', { token_invitacion: token, nombre_integrante: nombre, emoji_integrante: emoji }); if (!errorAceptacion) await cargar(); return !errorAceptacion; }, [cliente, userId, cargar]);
  return { espacios, error, limpiarError: () => setError(null), crearEspacio, agregarGasto, borrarGasto, saldarCuentas, crearInvitacion, aceptarInvitacion };
}
