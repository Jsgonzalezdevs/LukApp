// Grouping is done by hand rather than through Intl so the output is identical
// across Node and every browser regardless of the ICU build available.
const groupThousands = (digits: string): string =>
  digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Colombian pesos, no decimals: 1234567 -> "$1.234.567". */
export const formatCop = (value: number): string => {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}$${groupThousands(String(Math.abs(rounded)))}`;
};

/** Same, prefixed with an explicit direction sign for ledger rows. */
export const formatSigned = (value: number, kind: 'gasto' | 'ingreso'): string =>
  `${kind === 'ingreso' ? '+' : '−'}${formatCop(Math.abs(value))}`;

/** Digits only, for a controlled numeric input: 1234567 -> "1.234.567". */
export const formatAmountInput = (value: number | null): string =>
  value === null ? '' : groupThousands(String(Math.abs(Math.round(value))));

/** Inverse of formatAmountInput — tolerates whatever grouping the user types. */
export const parseAmountInput = (text: string): number | null => {
  const digits = text.replace(/\D/g, '');
  if (digits === '') return null;
  const value = Number(digits);
  return Number.isFinite(value) && value > 0 ? value : null;
};
