// Kept out of FinanzasShell.tsx so that file only exports a component — mixing
// constants with components breaks Fast Refresh, which oxlint flags via
// react/only-export-components.
import { 
  BarChart2, 
  ReceiptText, 
  PiggyBank, 
  TrendingUp, 
  FileText,
  Target 
} from 'lucide-react';

/**
 * Five, not six. Pockets and goals live together under "Ahorro" because a bottom
 * tab bar stops being scannable past five targets — and because they are one
 * subject: a goal's progress is usually just a pocket's balance.
 */
export const SECTIONS = [
  { id: 'resumen', icon: BarChart2, label: 'Resumen', color: 'text-sky-500 dark:text-sky-400' },
  { id: 'movimientos', icon: ReceiptText, label: 'Movimientos', color: 'text-amber-500 dark:text-amber-400' },
  { id: 'ahorro', icon: PiggyBank, label: 'Ahorro', color: 'text-emerald-500 dark:text-emerald-400' },
  { id: 'tendencias', icon: TrendingUp, label: 'Tendencias', color: 'text-rose-500 dark:text-rose-400' },
  { id: 'analista', icon: FileText, label: 'Analista', color: 'text-indigo-500 dark:text-indigo-400' },
] as const;

export type SectionId = typeof SECTIONS[number]['id'];

export const sectionLabel = (section: SectionId): string =>
  SECTIONS.find((s) => s.id === section)?.label ?? '';

/** The two halves of the Ahorro section. */
export const PESTANAS_AHORRO = [
  { id: 'cajitas', icon: PiggyBank, label: 'Cajitas', color: 'text-emerald-500 dark:text-emerald-400' },
  { id: 'metas', icon: Target, label: 'Metas', color: 'text-violet-500 dark:text-violet-400' },
] as const;

export type PestanaAhorro = typeof PESTANAS_AHORRO[number]['id'];
