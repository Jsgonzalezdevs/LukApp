import type { BloqueAsesor, SolicitudBloqueAsesor } from '../src/lib/bloquesAsesor.ts';

interface MesPerfil {
  mes: string;
  ingresosCop: number;
  gastosCop: number;
  balanceCop: number;
}

interface CategoriaPerfil {
  clave: string;
  montoCop: number;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const nombreMes = (mes: string, corto = false): string => {
  const [anio, numero] = mes.split('-');
  const indice = Number(numero) - 1;
  const nombre = (corto ? MESES_CORTOS : MESES)[indice];
  if (!nombre) return mes;
  return corto ? `${nombre} ${anio.slice(2)}` : `${nombre} ${anio}`;
};

const numero = (valor: unknown): number =>
  typeof valor === 'number' && Number.isFinite(valor) ? Math.round(valor) : 0;

const leerMeses = (perfil: Record<string, unknown>): MesPerfil[] => {
  const historial = perfil.historialCompleto as { porMes?: unknown } | undefined;
  if (!Array.isArray(historial?.porMes)) return [];
  return historial.porMes
    .filter((fila): fila is Record<string, unknown> => Boolean(fila) && typeof fila === 'object')
    .map((fila) => ({
      mes: typeof fila.mes === 'string' ? fila.mes : '',
      ingresosCop: numero(fila.ingresosCop),
      gastosCop: numero(fila.gastosCop),
      balanceCop: numero(fila.balanceCop),
    }))
    .filter((fila) => /^\d{4}-\d{2}$/.test(fila.mes))
    .sort((a, b) => a.mes.localeCompare(b.mes));
};

const leerCategorias = (valor: unknown): CategoriaPerfil[] =>
  Array.isArray(valor)
    ? valor
      .filter((fila): fila is Record<string, unknown> => Boolean(fila) && typeof fila === 'object')
      .map((fila) => ({ clave: typeof fila.clave === 'string' ? fila.clave : '', montoCop: numero(fila.montoCop) }))
      .filter((fila) => fila.clave && fila.montoCop > 0)
    : [];

/** Las transferencias entre cuentas propias no son gasto real y taparían las barras. */
const esTraslado = (nombre: string): boolean =>
  /transfer|traslado|movimiento entre cuentas/i.test(nombre.normalize('NFD').replace(/[̀-ͯ]/g, ''));

/**
 * Convierte lo que pidió el modelo en bloques con cifras del expediente. Si el
 * dato no existe (un mes sin movimientos, un usuario sin sesión), el bloque se
 * descarta: preferimos no mostrar una tarjeta antes que mostrar una inventada.
 */
export const resolverBloquesAsesor = (
  solicitudes: readonly SolicitudBloqueAsesor[],
  perfil: Record<string, unknown> | null,
): BloqueAsesor[] => {
  const meses = perfil ? leerMeses(perfil) : [];
  const ultimoMes = meses.at(-1)?.mes;
  const historial = (perfil?.historialCompleto ?? {}) as { gastosPorCategoria?: unknown; gastosPorCategoriaPorMes?: unknown };
  const panorama = (perfil?.panoramaHistorico ?? null) as Record<string, unknown> | null;
  const bloques: BloqueAsesor[] = [];

  for (const solicitud of solicitudes) {
    switch (solicitud.tipo) {
      case 'alerta':
      case 'accion':
        bloques.push(solicitud);
        break;
      case 'cifras': {
        if (solicitud.mes === 'historico') {
          if (!panorama || meses.length === 0) break;
          bloques.push({
            tipo: 'cifras',
            periodo: 'Todo tu historial',
            ingresosCop: numero(panorama.ingresosCop),
            gastosCop: numero(panorama.gastosCop),
            balanceCop: numero(panorama.balanceCop),
          });
          break;
        }
        const fila = meses.find((item) => item.mes === (solicitud.mes ?? ultimoMes));
        if (!fila) break;
        bloques.push({ tipo: 'cifras', periodo: nombreMes(fila.mes), ingresosCop: fila.ingresosCop, gastosCop: fila.gastosCop, balanceCop: fila.balanceCop });
        break;
      }
      case 'barras_categorias': {
        const mes = solicitud.mes ?? ultimoMes;
        if (!mes) break;
        const fuente = mes === 'historico'
          ? historial.gastosPorCategoria
          : (historial.gastosPorCategoriaPorMes as Record<string, unknown> | undefined)?.[mes];
        const items = leerCategorias(fuente)
          .filter((fila) => !esTraslado(fila.clave))
          .slice(0, solicitud.top ?? 4)
          .map((fila) => ({ nombre: fila.clave.slice(0, 60), valorCop: fila.montoCop }));
        if (items.length === 0) break;
        bloques.push({ tipo: 'barras_categorias', periodo: mes === 'historico' ? 'Todo tu historial' : nombreMes(mes), items });
        break;
      }
      case 'tendencia': {
        const items = meses.slice(-(solicitud.meses ?? 4)).map((fila) => ({ ...fila, etiqueta: nombreMes(fila.mes, true) }));
        if (items.length < 2) break;
        bloques.push({ tipo: 'tendencia', items });
        break;
      }
    }
  }
  return bloques;
};
