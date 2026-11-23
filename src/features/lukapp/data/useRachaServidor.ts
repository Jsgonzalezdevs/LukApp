import { useEffect, useState } from 'react';
import { obtenerSupabase } from './supabase';

export interface PremioRacha {
  hito: number;
  diasPremium: number;
  alcanzado: boolean;
  reclamado: boolean;
  /** Tiene Premium pagado vigente: el premio espera a que se le acabe. */
  bloqueadoPorPago: boolean;
}

/** Lo escucha quien muestra el plan, para enterarse sin esperar al sondeo. */
export const EVENTO_PLAN_CAMBIADO = 'lukapp:plan-cambiado';

export interface EstadoServidor {
  usuario: string | null;
  protectores: number;
  diasProtegidos: readonly string[];
  /** Los premios de Premium por hito, tal como los ve el servidor. */
  premios: readonly PremioRacha[];
  protectorUsado: string | null;
  protectorGanado: boolean;
}

const VACIO: EstadoServidor = {
  usuario: null,
  protectores: 0,
  diasProtegidos: [],
  premios: [],
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

interface FilaPremio {
  premio_hito: number;
  premio_dias: number;
  alcanzado: boolean;
  reclamado: boolean;
  bloqueado_por_pago: boolean;
}

const leerPremios = async (): Promise<PremioRacha[] | null> => {
  const cliente = obtenerSupabase();
  if (!cliente) return null;
  const { data, error } = await cliente.rpc('estado_premios_racha');
  if (error || !Array.isArray(data)) return null;
  return (data as FilaPremio[]).map((f) => ({
    hito: f.premio_hito,
    diasPremium: f.premio_dias,
    alcanzado: Boolean(f.alcanzado),
    reclamado: Boolean(f.reclamado),
    bloqueadoPorPago: Boolean(f.bloqueado_por_pago),
  }));
};

export type ResultadoReclamo =
  | { ok: true; venceEn: string | null }
  | { ok: false; motivo: string };

/**
 * Activa el Premium de un hito. Solo pasa cuando la persona toca el botón: el
 * servidor ya no lo regala al abrir la app.
 */
export const reclamarPremioRacha = async (hito: number): Promise<ResultadoReclamo> => {
  const cliente = obtenerSupabase();
  if (!cliente) return { ok: false, motivo: 'sin_conexion' };
  const { data, error } = await cliente.rpc('reclamar_premio_racha', { p_hito: hito });
  const fila = Array.isArray(data) ? (data[0] as { otorgado: boolean; motivo: string | null; vence_en: string | null } | undefined) : undefined;
  if (error || !fila) return { ok: false, motivo: 'sin_conexion' };

  const premios = await leerPremios();
  if (premios) publicar({ ...estado, premios });
  if (!fila.otorgado) return { ok: false, motivo: fila.motivo ?? 'desconocido' };

  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO_PLAN_CAMBIADO));
  return { ok: true, venceEn: fila.vence_en };
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

  const premios = await leerPremios();

  publicar({
    usuario,
    premios: premios ?? estado.premios,
    protectores: fila.protectores ?? 0,
    diasProtegidos: fila.dias_protegidos ?? [],
    protectorUsado: fila.protector_usado ?? estado.protectorUsado,
    protectorGanado: Boolean(fila.protector_ganado) || estado.protectorGanado,
  });
};

/**
 * Protectores, días protegidos y premios de la racha, que viven en el
 * servidor. `clave` cambia cuando conviene volver a sincronizar (otro día, o
 * ya anotó hoy): ahí se aplica un protector pendiente y se mira qué premios hay.
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
