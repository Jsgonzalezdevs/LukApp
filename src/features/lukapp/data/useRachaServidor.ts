import { useEffect, useState } from 'react';
import { obtenerSupabase } from './supabase';

export interface PremioReclamado {
  hito: number;
  diasPremium: number;
}

export interface EstadoServidor {
  usuario: string | null;
  protectores: number;
  diasProtegidos: readonly string[];
  /** Hitos cuyo premio ya se entregó alguna vez. */
  premiosReclamados: readonly number[];
  /** Premios que se entregaron en esta sesión, para celebrarlos una vez. */
  premiosNuevos: readonly PremioReclamado[];
  protectorUsado: string | null;
  protectorGanado: boolean;
}

const VACIO: EstadoServidor = {
  usuario: null,
  protectores: 0,
  diasProtegidos: [],
  premiosReclamados: [],
  premiosNuevos: [],
  protectorUsado: null,
  protectorGanado: false,
};

// Vive a nivel de módulo porque la racha se pinta en dos pantallas (Inicio y
// la cabecera de Dinero) y no tiene sentido sincronizarla dos veces.
let estado: EstadoServidor = VACIO;
let claveSincronizada = '';
let enVuelo: Promise<void> | null = null;
const oyentes = new Set<() => void>();

const publicar = (siguiente: EstadoServidor) => {
  estado = siguiente;
  oyentes.forEach((o) => o());
};

const sincronizar = async (clave: string) => {
  const cliente = obtenerSupabase();
  if (!cliente) return;
  const { data: sesion } = await cliente.auth.getSession();
  const usuario = sesion.session?.user.id ?? null;
  if (!usuario) return;
  if (estado.usuario !== usuario) publicar({ ...VACIO, usuario });

  const { data, error } = await cliente.rpc('sincronizar_racha');
  const fila = Array.isArray(data) ? data[0] : null;
  if (error || !fila) return;
  claveSincronizada = clave;

  const { data: premios } = await cliente.rpc('reclamar_premios_racha');
  const nuevos = ((premios ?? []) as Array<{ premio_hito: number; premio_dias: number; premio_otorgado: boolean }>)
    .filter((p) => p.premio_otorgado)
    .map((p) => ({ hito: p.premio_hito, diasPremium: p.premio_dias }));

  const { data: reclamados } = await cliente.from('racha_premios').select('hito').eq('user_id', usuario);

  publicar({
    usuario,
    premiosReclamados: ((reclamados ?? []) as Array<{ hito: number }>).map((r) => r.hito),
    protectores: fila.protectores ?? 0,
    diasProtegidos: fila.dias_protegidos ?? [],
    premiosNuevos: nuevos.length ? nuevos : estado.premiosNuevos,
    protectorUsado: fila.protector_usado ?? estado.protectorUsado,
    protectorGanado: Boolean(fila.protector_ganado) || estado.protectorGanado,
  });
};

/**
 * Protectores, días protegidos y premios de la racha, que viven en el
 * servidor. `clave` cambia cuando conviene volver a sincronizar (otro día, o
 * ya anotó hoy): ahí se aplica un protector pendiente o se entrega un premio.
 */
export const useRachaServidor = (clave: string): EstadoServidor => {
  const [, forzar] = useState(0);

  useEffect(() => {
    const oyente = () => forzar((n) => n + 1);
    oyentes.add(oyente);
    return () => { oyentes.delete(oyente); };
  }, []);

  useEffect(() => {
    if (claveSincronizada === clave) return;
    // Si ya hay una sincronización en curso se encadena en vez de descartarse:
    // anotar el primer movimiento del día cambia la clave justo en ese momento.
    const previa = enVuelo ?? Promise.resolve();
    const actual: Promise<void> = previa
      .then(() => (claveSincronizada === clave ? undefined : sincronizar(clave)))
      .catch(() => undefined)
      .finally(() => { if (enVuelo === actual) enVuelo = null; });
    enVuelo = actual;
  }, [clave]);

  return estado;
};

/** Para las pruebas: vuelve al estado de recién abierta. */
export const reiniciarRachaServidor = () => {
  estado = VACIO;
  claveSincronizada = '';
  enVuelo = null;
};
