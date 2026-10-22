import type { Cajita } from '../data/modelos';
import { entidadDeCuenta } from './entidadesFinancieras';

/** Separa especialmente rojos repetidos; amarillo y naranja pueden formar una pareja cálida. */
const cercaniaCromatica = (a: Cajita, b: Cajita): number => {
  const colorA = entidadDeCuenta(a)?.familiaColor;
  const colorB = entidadDeCuenta(b)?.familiaColor;
  if (!colorA || !colorB) return 0;
  if (colorA === colorB) return colorA === 'morado' ? 2 : 12;
  if (['morado', 'azul', 'verde', 'gris'].includes(colorA) || ['morado', 'azul', 'verde', 'gris'].includes(colorB)) return 0;
  if (colorA === 'rojo' || colorB === 'rojo') return colorA === 'naranja' || colorB === 'naranja' ? 8 : 6;
  return 3;
};

/** Mantiene primero la principal (o el mayor saldo), distribuyendo después los colores. */
export const componerCuentas = (cuentas: readonly Cajita[], favoritaId: string | null): Cajita[] => {
  const orden = [...cuentas];
  const favorita = orden.findIndex((cuenta) => cuenta.id === favoritaId);
  if (favorita > 0) orden.unshift(...orden.splice(favorita, 1));

  // Los intercambios solo se aceptan cuando mejoran el conjunto: mover el rojo al final
  // con una elección voraz simplemente trasladaría allí la acumulación de tonos cálidos.
  for (let pasada = 0; pasada < orden.length; pasada++) {
    let mejorCambio: [number, number] | null = null;
    let mejorDiferencia = 0;
    for (let i = 1; i < orden.length - 1; i++) {
      for (let j = i + 1; j < orden.length; j++) {
        const vecinos = [...new Set([i - 1, i, j - 1, j])].filter((indice) => indice < orden.length - 1);
        const coste = () => vecinos.reduce((total, indice) => total + cercaniaCromatica(orden[indice], orden[indice + 1]), 0);
        const antes = coste();
        [orden[i], orden[j]] = [orden[j], orden[i]];
        const diferencia = coste() - antes;
        [orden[i], orden[j]] = [orden[j], orden[i]];
        if (diferencia < mejorDiferencia) {
          mejorDiferencia = diferencia;
          mejorCambio = [i, j];
        }
      }
    }
    if (!mejorCambio) break;
    const [i, j] = mejorCambio;
    [orden[i], orden[j]] = [orden[j], orden[i]];
  }
  return orden;
};
