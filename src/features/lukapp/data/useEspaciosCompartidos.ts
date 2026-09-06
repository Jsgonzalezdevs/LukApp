import { useState, useEffect, useCallback } from 'react';
import { obtenerSupabase } from './supabase';

export interface Integrante { id: string; nombre: string; avatarColor: string; emoji: string }
export interface GastoCompartido { id: string; descripcion: string; montoCop: number; fecha: string; pagadoPorId: string; categoria: string }
export interface EspacioCompartido { id: string; nombre: string; icono: string; color: string; integrantes: Integrante[]; gastos: GastoCompartido[]; createdAt: string }

const CLAVE = (id?: string | null) => `finanzas:espacios-compartidos:${id ?? 'local'}`;

export function useEspaciosCompartidos(userId?: string | null) {
  const cliente = obtenerSupabase();
  const clave = CLAVE(userId);
  const [espacios, setEspacios] = useState<EspacioCompartido[]>(() => { try { return JSON.parse(localStorage.getItem(clave) || '[]'); } catch { return []; } });
  const cargar = useCallback(async () => {
    if (!cliente || !userId) return;
    const { data } = await cliente.from('espacios_integrantes').select('espacio_id, espacios_compartidos(id,nombre,icono,color,created_at)').eq('user_id', userId);
    const filas = (data || []) as Array<{ espacio_id: string; espacios_compartidos: { id: string; nombre: string; icono: string; color: string; created_at: string }[] | null }>;
    const ids = filas.map((f) => f.espacio_id);
    const [{ data: miembros }, { data: gastos }] = await Promise.all([
      ids.length ? cliente.from('espacios_integrantes').select('espacio_id,user_id,nombre,emoji').in('espacio_id', ids) : Promise.resolve({ data: [] }),
      ids.length ? cliente.from('gastos_compartidos').select('id,espacio_id,descripcion,monto_cop,fecha,pagado_por,categoria').in('espacio_id', ids).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
    ]);
    const resultado = filas.flatMap((f) => { const e = f.espacios_compartidos?.[0]; if (!e) return []; return [{ id: e.id, nombre: e.nombre, icono: e.icono, color: e.color, createdAt: e.created_at, integrantes: (miembros || []).filter((m) => m.espacio_id === f.espacio_id).map((m) => ({ id: m.user_id === userId ? 'yo' : m.user_id, nombre: m.user_id === userId ? 'Tú' : m.nombre || 'Pareja', avatarColor: m.user_id === userId ? '#3b82f6' : '#ec4899', emoji: m.emoji || '🙂' })), gastos: (gastos || []).filter((g) => g.espacio_id === f.espacio_id).map((g) => ({ id: g.id, descripcion: g.descripcion, montoCop: Number(g.monto_cop), fecha: g.fecha, pagadoPorId: g.pagado_por === userId ? 'yo' : g.pagado_por, categoria: g.categoria })) }]; });
    setEspacios(resultado); localStorage.setItem(clave, JSON.stringify(resultado));
  }, [cliente, userId, clave]);
  useEffect(() => { void cargar(); if (!cliente || !userId) return; const canal = cliente.channel(`espacios-${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'gastos_compartidos' }, () => void cargar()).subscribe(); return () => { void cliente.removeChannel(canal); }; }, [cargar, cliente, userId]);
  const crearEspacio = useCallback(async (nombre: string, icono: string, color: string, _nombrePareja: string, _emojiPareja = '🙂') => { if (!cliente || !userId) return null; const { data, error } = await cliente.rpc('crear_espacio_compartido', { nombre_espacio: nombre, icono_espacio: icono, color_espacio: color }); if (error) return null; await cargar(); return { id: data, nombre, icono, color, integrantes: [{ id: 'yo', nombre: 'Tú', avatarColor: '#3b82f6', emoji: '👦🏼' }], gastos: [], createdAt: new Date().toISOString() }; }, [cliente, userId, cargar]);
  const agregarGasto = useCallback(async (espacioId: string, descripcion: string, montoCop: number, pagadoPorId: string, categoria = 'otros') => { if (!cliente || !userId) return false; const { error } = await cliente.from('gastos_compartidos').insert({ espacio_id: espacioId, creado_por: userId, pagado_por: pagadoPorId === 'yo' ? userId : pagadoPorId, descripcion, monto_cop: montoCop, categoria }); if (!error) await cargar(); return !error; }, [cliente, userId, cargar]);
  const borrarGasto = useCallback(async (_espacioId: string, gastoId: string) => { if (!cliente) return false; const { error } = await cliente.from('gastos_compartidos').delete().eq('id', gastoId); if (!error) await cargar(); return !error; }, [cliente, cargar]);
  const saldarCuentas = useCallback(async (espacioId: string) => { if (!cliente) return false; const { error } = await cliente.from('gastos_compartidos').delete().eq('espacio_id', espacioId); if (!error) await cargar(); return !error; }, [cliente, cargar]);
  const crearInvitacion = useCallback(async (espacioId: string) => { if (!cliente) return null; const { data, error } = await cliente.rpc('crear_invitacion_compartida', { espacio: espacioId }); return error ? null : `${window.location.origin}${window.location.pathname}?invitacion=${data}`; }, [cliente]);
  const aceptarInvitacion = useCallback(async (token: string, nombre = 'Pareja', emoji = '🙂') => { if (!cliente || !userId) return false; const { error } = await cliente.rpc('aceptar_invitacion_compartida', { token_invitacion: token, nombre_integrante: nombre, emoji_integrante: emoji }); if (!error) await cargar(); return !error; }, [cliente, userId, cargar]);
  return { espacios, crearEspacio, agregarGasto, borrarGasto, saldarCuentas, crearInvitacion, aceptarInvitacion };
}
