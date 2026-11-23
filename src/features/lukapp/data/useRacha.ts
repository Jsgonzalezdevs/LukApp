import { useMemo } from 'react';
import type { Transaction } from '../types';
import { calcularRacha, estadoRacha, type BonoRacha, type EstadoRacha, type InfoRacha } from '../lib/racha';
import { useRachaServidor, type EstadoServidor } from './useRachaServidor';

export interface Racha {
  info: InfoRacha;
  estado: EstadoRacha;
  servidor: EstadoServidor;
}

/**
 * La racha tal como la ve la persona: movimientos de todo el historial,
 * días salvados con protector y días regalados. Es la única puerta para
 * calcularla en el cliente; si una pantalla la armara por su cuenta, tarde o
 * temprano olvidaría alguno de los tres y mostraría otro número.
 */
export const useRacha = (
  historial: readonly Pick<Transaction, 'occurredOn'>[],
  hoy: string,
  bonos: readonly BonoRacha[] = [],
): Racha => {
  const anotadoHoy = useMemo(() => historial.some((m) => m.occurredOn === hoy), [historial, hoy]);
  // La clave cambia al pasar el día o al anotar el primer movimiento: ahí el
  // servidor puede aplicar un protector o liberar un premio.
  const servidor = useRachaServidor(`${hoy}:${anotadoHoy}`);
  const info = useMemo(
    () => calcularRacha(historial, hoy, bonos, servidor.diasProtegidos),
    [historial, hoy, bonos, servidor.diasProtegidos],
  );
  return { info, estado: estadoRacha(info), servidor };
};
