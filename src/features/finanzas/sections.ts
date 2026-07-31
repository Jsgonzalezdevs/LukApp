// Kept out of FinanzasShell.tsx so that file only exports a component — mixing
// constants with components breaks Fast Refresh, which oxlint flags via
// react/only-export-components.
export const SECTIONS = [
  { id: 'resumen', emoji: '📊', label: 'Resumen' },
  { id: 'movimientos', emoji: '🧾', label: 'Movimientos' },
  { id: 'analista', emoji: '📄', label: 'Analista' },
] as const;

export type SectionId = typeof SECTIONS[number]['id'];

export const sectionLabel = (section: SectionId): string =>
  SECTIONS.find((s) => s.id === section)?.label ?? '';
