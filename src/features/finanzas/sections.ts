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
  { id: 'resumen', icon: BarChart2, label: 'Resumen' },
  { id: 'movimientos', icon: ReceiptText, label: 'Movimientos' },
  { id: 'ahorro', icon: PiggyBank, label: 'Ahorro' },
  { id: 'tendencias', icon: TrendingUp, label: 'Tendencias' },
  { id: 'analista', icon: FileText, label: 'Analista' },
] as const;

export type SectionId = typeof SECTIONS[number]['id'];

export const sectionLabel = (section: SectionId): string =>
  SECTIONS.find((s) => s.id === section)?.label ?? '';

/** The two halves of the Ahorro section. */
export const PESTANAS_AHORRO = [
  { id: 'cajitas', icon: PiggyBank, label: 'Cajitas' },
  { id: 'metas', icon: Target, label: 'Metas' },
] as const;

export type PestanaAhorro = typeof PESTANAS_AHORRO[number]['id'];
