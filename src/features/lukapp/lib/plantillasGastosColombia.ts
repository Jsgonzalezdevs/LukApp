/**
 * Plantillas preconfiguradas de gastos recurrentes y fijos para Colombia.
 * Permiten un onboarding ultra-rápido y registro en 1 clic.
 */

export interface PlantillaGastoColombia {
  id: string;
  nombre: string;
  categoria: string;
  emoji: string;
  montoSugerido: number;
  frecuencia: 'mensual' | 'quincenal' | 'semanal';
  descripcion: string;
  proveedoresPopulares?: string[];
}

export const PLANTILLAS_GASTOS_COLOMBIA: readonly PlantillaGastoColombia[] = [
  {
    id: 'arriendo',
    nombre: 'Arriendo / Hipoteca',
    categoria: 'hogar',
    emoji: '🏠',
    montoSugerido: 1_200_000,
    frecuencia: 'mensual',
    descripcion: 'Pago mensual de arriendo o cuota de vivienda',
  },
  {
    id: 'servicios_publicos',
    nombre: 'Servicios Públicos',
    categoria: 'servicios',
    emoji: '💡',
    montoSugerido: 220_000,
    frecuencia: 'mensual',
    descripcion: 'Agua, luz y gas',
    proveedoresPopulares: ['EPM', 'Enel Codensa', 'Vanti', 'Acueducto', 'Celsia', 'Afinia'],
  },
  {
    id: 'internet_celular',
    nombre: 'Internet & Celular',
    categoria: 'servicios',
    emoji: '📶',
    montoSugerido: 110_000,
    frecuencia: 'mensual',
    descripcion: 'Plan de datos y fibra óptica',
    proveedoresPopulares: ['Claro', 'Tigo', 'Movistar', 'Wom', 'ETB'],
  },
  {
    id: 'mercado_quincenal',
    nombre: 'Mercado',
    categoria: 'mercado',
    emoji: '🥑',
    montoSugerido: 350_000,
    frecuencia: 'quincenal',
    descripcion: 'Mercado para la casa y víveres',
    proveedoresPopulares: ['D1', 'Ara', 'Éxito', 'Jumbo', 'Carulla', 'Olímpica'],
  },
  {
    id: 'transporte_publico',
    nombre: 'Transporte / Pasajes',
    categoria: 'transporte',
    emoji: '🚌',
    montoSugerido: 140_000,
    frecuencia: 'mensual',
    descripcion: 'Tarjeta de transporte masivo o gasolina',
    proveedoresPopulares: ['Transmilenio', 'Metro de Medellín', 'MIO', 'Gasolina Terpel/Primax'],
  },
  {
    id: 'salud_prepagada',
    nombre: 'Salud & Prepagada',
    categoria: 'salud',
    emoji: '🩺',
    montoSugerido: 180_000,
    frecuencia: 'mensual',
    descripcion: 'Medicina prepagada, póliza o copagos',
    proveedoresPopulares: ['Sura', 'Colsánitas', 'Sanitas', 'Coomeva', 'Medisanitas'],
  },
  {
    id: 'cuota_tarjeta',
    nombre: 'Cuota de Tarjeta / Crédito',
    categoria: 'otros',
    emoji: '💳',
    montoSugerido: 250_000,
    frecuencia: 'mensual',
    descripcion: 'Abono o cuota de tarjeta bancaria',
    proveedoresPopulares: ['Bancolombia', 'Nu Colombia', 'Davivienda', 'Falabella', 'Scotiabank'],
  },
];
