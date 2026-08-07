import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { monthKeyLabel } from '../lib/localDate';

interface MonthNavProps {
  month: string;
  onChange: (month: string) => void;
  /** Newest month the user may navigate to — the current Bogota month. */
  maxMonth: string;
  shift: (month: string, delta: number) => string;
}

export const MonthNav: React.FC<MonthNavProps> = ({ month, onChange, maxMonth, shift }) => {
  // There is nothing to see in the future, so forward stops at the current month
  // rather than letting the user wander into empty months.
  const canGoForward = month < maxMonth;

  return (
    <div className="flex items-center justify-between gap-2 rounded-full border border-[var(--fin-line)] bg-[var(--fin-card)] px-1.5 py-1.5 lg:w-auto lg:justify-start">
      <button
        type="button"
        onClick={() => onChange(shift(month, -1))}
        aria-label="Mes anterior"
        className="rounded-full p-2 text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)]"
      >
        <ChevronLeft className="h-4 w-4" strokeWidth={3} />
      </button>

      <span className="min-w-[7.5rem] text-center text-sm font-bold capitalize tabular-nums">
        {monthKeyLabel(month)}
      </span>

      <button
        type="button"
        onClick={() => onChange(shift(month, 1))}
        disabled={!canGoForward}
        aria-label="Mes siguiente"
        className="rounded-full p-2 text-[var(--fin-ink-soft)] transition-colors hover:bg-[var(--fin-soft)] hover:text-[var(--fin-ink)] disabled:opacity-25 disabled:hover:bg-transparent"
      >
        <ChevronRight className="h-4 w-4" strokeWidth={3} />
      </button>
    </div>
  );
};
