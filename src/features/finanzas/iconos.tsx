import React from 'react';
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Banknote,
  Bus,
  Clapperboard,
  FileText,
  GraduationCap,
  Heart,
  Home,
  LayoutDashboard,
  Package,
  Pencil,
  PiggyBank,
  Plane,
  Receipt,
  Shield,
  ShoppingCart,
  Shirt,
  Sparkles,
  Target,
  TrendingUp,
  Umbrella,
  UtensilsCrossed,
  Wallet,
  Zap,
  Car,
  Gift,
  Gem,
  Laptop,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Category } from './types';
import type { CajitaMovKind } from './data/modelos';
import type { SectionId } from './sections';

/**
 * Every glyph in the app resolves through here.
 *
 * This file is deliberately separate from `types.ts`: the Netlify statement
 * templates import category labels from that module, and pulling React
 * components into it would drag the whole renderer into a serverless bundle.
 */

export const CATEGORY_ICON: Record<Category, LucideIcon> = {
  mercado: ShoppingCart,
  comida: UtensilsCrossed,
  transporte: Bus,
  servicios: Zap,
  salud: Heart,
  hogar: Home,
  entretenimiento: Clapperboard,
  ropa: Shirt,
  educacion: GraduationCap,
  transferencia: ArrowLeftRight,
  ahorro: PiggyBank,
  ingreso: Banknote,
  otros: Package,
};

export const SECTION_ICON: Record<SectionId, LucideIcon> = {
  resumen: LayoutDashboard,
  movimientos: Receipt,
  ahorro: PiggyBank,
  tendencias: TrendingUp,
  analista: FileText,
};

export const MOVIMIENTO_ICON: Record<CajitaMovKind, LucideIcon> = {
  deposito: ArrowUp,
  retiro: ArrowDown,
  rendimiento: Sparkles,
  ajuste: Pencil,
};

/**
 * The pocket icon picker. Stored by name rather than by component so a pocket's
 * choice survives in the database as a plain string.
 */
export const CAJITA_ICONOS = {
  alcancia: PiggyBank,
  viaje: Plane,
  carro: Car,
  casa: Home,
  estudio: GraduationCap,
  tecnologia: Laptop,
  regalo: Gift,
  emergencia: Umbrella,
  joya: Gem,
  meta: Target,
} as const;

export type CajitaIconoNombre = keyof typeof CAJITA_ICONOS;

export const CAJITA_ICONO_NOMBRES = Object.keys(CAJITA_ICONOS) as CajitaIconoNombre[];

/** Falls back rather than crashing on an icon name written before this list. */
export const iconoDeCajita = (nombre: string): LucideIcon =>
  CAJITA_ICONOS[nombre as CajitaIconoNombre] ?? PiggyBank;

export const APP_ICON = {
  finanzas: Wallet,
  admin: Shield,
} as const;

interface IconoProps {
  className?: string;
  strokeWidth?: number;
}

/**
 * A category's mark, tinted with that category's own hue.
 *
 * Colour is never the only channel: the icon shape differs per category too, so
 * the pair survives greyscale and colour-blindness — the same reasoning the
 * emoji served, now with a glyph that scales and inherits stroke weight.
 */
export const CategoriaIcono: React.FC<IconoProps & { categoria: Category }> = ({
  categoria,
  className = 'h-4 w-4',
  strokeWidth = 2.25,
}) => {
  const Icono = CATEGORY_ICON[categoria];
  return <Icono className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
};

export const SeccionIcono: React.FC<IconoProps & { seccion: SectionId }> = ({
  seccion,
  className = 'h-4 w-4',
  strokeWidth = 2.25,
}) => {
  const Icono = SECTION_ICON[seccion];
  return <Icono className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
};

export const MovimientoIcono: React.FC<IconoProps & { kind: CajitaMovKind }> = ({
  kind,
  className = 'h-4 w-4',
  strokeWidth = 2.25,
}) => {
  const Icono = MOVIMIENTO_ICON[kind];
  return <Icono className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
};

export const CajitaIcono: React.FC<IconoProps & { nombre: string }> = ({
  nombre,
  className = 'h-4 w-4',
  strokeWidth = 2.25,
}) => {
  const Icono = iconoDeCajita(nombre);
  return <Icono className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
};
