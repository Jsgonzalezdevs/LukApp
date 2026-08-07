// Kept out of FinanzasShell.tsx so that file only exports a component — mixing
// constants with components breaks Fast Refresh, which oxlint flags via
// react/only-export-components.
/**
 * Five, not six. Pockets and goals live together under "Ahorro" because a bottom
 * tab bar stops being scannable past five targets — and because they are one
 * subject: a goal's progress is usually just a pocket's balance.
 */
export const SECTIONS = [
  { id: 'resumen', emoji: '📊', label: 'Resumen' },
  { id: 'movimientos', emoji: '🧾', label: 'Movimientos' },
  { id: 'ahorro', emoji: '🐷', label: 'Ahorro' },
  { id: 'tendencias', emoji: '📈', label: 'Tendencias' },
  { id: 'analista', emoji: '📄', label: 'Analista' },
] as const;

export type SectionId = typeof SECTIONS[number]['id'];

export const sectionLabel = (section: SectionId): string =>
  SECTIONS.find((s) => s.id === section)?.label ?? '';

/** The two halves of the Ahorro section. */
export const PESTANAS_AHORRO = [
  { id: 'cajitas', emoji: '🐷', label: 'Cajitas' },
  { id: 'metas', emoji: '🎯', label: 'Metas' },
] as const;

export type PestanaAhorro = typeof PESTANAS_AHORRO[number]['id'];
