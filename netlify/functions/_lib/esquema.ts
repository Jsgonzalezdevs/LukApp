import { z } from 'zod';
import { CATEGORIES } from '../../../src/features/finanzas/types';

// Structured-output JSON Schema does NOT support numeric constraints
// (minimum/maximum/multipleOf) or string length constraints, and every object
// must be closed. So there are no .min()/.max()/.positive() calls here on
// purpose — the values are range-checked in TypeScript after parsing instead.

const MOTIVOS_EXCLUSION = [
  'traslado-propio',
  'pago-tarjeta',
  'reverso',
  'saldo-informativo',
] as const;

export const movimientoSchema = z
  .object({
    fecha: z.string().describe("Día del movimiento en formato 'YYYY-MM-DD'."),
    descripcion: z
      .string()
      .describe('Descripción corta y legible, sin códigos internos del banco.'),
    montoCop: z
      .number()
      .describe('Monto en pesos colombianos, SIEMPRE positivo y sin decimales.'),
    tipo: z.enum(['gasto', 'ingreso']).describe('Dirección del movimiento.'),
    categoria: z.enum(CATEGORIES).describe('Categoría del listado permitido.'),
    confianza: z
      .enum(['alta', 'media', 'baja'])
      .describe("'alta' solo si el texto del extracto era inequívoco."),
    exclusion: z
      .enum(MOTIVOS_EXCLUSION)
      .nullable()
      .describe(
        'null si es un movimiento económico real. Si no, el motivo por el que NO debe sumarse a los totales.',
      ),
  })
  .strict();

export const analisisSchema = z
  .object({
    periodo: z
      .object({
        desde: z.string().describe("Primer día cubierto, 'YYYY-MM-DD'."),
        hasta: z.string().describe("Último día cubierto, 'YYYY-MM-DD'."),
        etiqueta: z.string().describe("Nombre legible, por ejemplo 'julio 2026'."),
      })
      .strict(),

    veredicto: z
      .string()
      .describe(
        'Dos a cuatro frases describiendo qué pasó en el periodo. Descriptivo, en segunda persona, sin consejos de inversión.',
      ),

    metricas: z
      .array(
        z
          .object({
            etiqueta: z.string(),
            valorCop: z.number().describe('Valor en pesos. Usa 0 si no aplica.'),
            nota: z.string().nullable().describe('Aclaración breve o null.'),
          })
          .strict(),
      )
      .describe(
        'Tabla de métricas: ingreso neto, gasto total, y una fila por categoría con gasto.',
      ),

    alertas: z
      .array(
        z
          .object({
            severidad: z.enum(['alta', 'media', 'baja']),
            titulo: z.string(),
            detalle: z
              .string()
              .describe('Hecho concreto con cifras y fechas tomadas del extracto.'),
          })
          .strict(),
      )
      .describe('Observaciones factuales. Lista vacía si no hay nada que señalar.'),

    recomendaciones: z
      .array(
        z
          .object({
            titulo: z.string(),
            detalle: z.string(),
            ahorroMensualCop: z
              .number()
              .nullable()
              .describe('Ahorro mensual estimado en pesos, o null si no se puede calcular.'),
          })
          .strict(),
      )
      .describe(
        'Sugerencias de presupuesto sobre el gasto propio. NUNCA recomendaciones de inversión ni productos financieros.',
      ),

    movimientos: z.array(movimientoSchema).describe('Todas las líneas del extracto.'),

    advertencias: z
      .array(z.string())
      .describe('Lo que no se pudo leer con certeza. Preferible admitirlo a inventarlo.'),
  })
  .strict();

export type AnalisisValidado = z.infer<typeof analisisSchema>;
