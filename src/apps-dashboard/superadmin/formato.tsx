/**
 * Formatos de fecha y número, y catálogos de visitas que usan varias pestañas.
 */
import React from 'react';
import {
  Monitor,
  Smartphone,
  Tablet,
} from 'lucide-react';

export const RANGOS = [
  { dias: 7, texto: '7 días' },
  { dias: 30, texto: '30 días' },
  { dias: 90, texto: '90 días' },
];

export const ICONO_DISPOSITIVO: Record<string, React.ReactNode> = {
  movil: <Smartphone className="h-3.5 w-3.5" />,
  tablet: <Tablet className="h-3.5 w-3.5" />,
  escritorio: <Monitor className="h-3.5 w-3.5" />,
};

export const NOMBRE_DISPOSITIVO: Record<string, string> = {
  movil: 'Celular',
  tablet: 'Tableta',
  escritorio: 'Computador',
};

export const formatearFechaCorta = (iso: string): string => {
  const parts = iso.split('-');
  if (parts.length < 3) return iso;
  const mes = parseInt(parts[1], 10) - 1;
  const dia = parseInt(parts[2], 10);
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${dia} ${meses[mes] || parts[1]}`;
};

export const formatearUltimoAcceso = (iso: string | null): string => {
  if (!iso) return 'Aún no ha ingresado';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  }).format(new Date(iso));
};

export const formatearFechaHoraConsulta = (iso: string): string =>
  new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'America/Bogota',
  }).format(new Date(iso));

export const safeNum = (val: number | null | undefined): string => {
  if (val === null || val === undefined || isNaN(Number(val))) return '0';
  return Number(val).toLocaleString('es-CO');
};

export const safeNumDesconocido = (val: number | null | undefined): string =>
  val === null || val === undefined || isNaN(Number(val)) ? '—' : safeNum(val);
