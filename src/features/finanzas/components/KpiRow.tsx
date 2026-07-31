import React from 'react';
import { motion } from 'framer-motion';
import type { MonthTotals } from '../lib/aggregate';
import { formatCop } from '../lib/formatCop';

interface KpiRowProps {
  totals: MonthTotals;
}

interface Kpi {
  emoji: string;
  label: string;
  value: string;
  hint: string;
  bg: string;
  ink: string;
}

/** Bands for the savings-rate tile. Paired with an emoji and words, never colour alone. */
const savingsBand = (rate: number | null): { emoji: string; hint: string; bg: string; ink: string } => {
  if (rate === null) return { emoji: '🫥', hint: 'sin ingresos aún', bg: '#f5f3f0', ink: '#78716c' };
  if (rate < 0) return { emoji: '🔴', hint: 'gastaste más de lo que entró', bg: '#fff1f2', ink: '#be123c' };
  if (rate < 10) return { emoji: '🟠', hint: 'muy justo', bg: '#fff7ed', ink: '#c2410c' };
  if (rate < 20) return { emoji: '🟡', hint: 'aceptable', bg: '#fefce8', ink: '#a16207' };
  return { emoji: '🟢', hint: 'buen colchón', bg: '#f0fdf4', ink: '#15803d' };
};

export const KpiRow: React.FC<KpiRowProps> = ({ totals }) => {
  const band = savingsBand(totals.tasaAhorro);
  const positivo = totals.balance >= 0;

  const kpis: Kpi[] = [
    {
      emoji: positivo ? '🤑' : '😬',
      label: 'Balance',
      value: formatCop(totals.balance),
      hint: positivo ? 'te sobró' : 'te faltó',
      bg: positivo ? '#f0fdf4' : '#fff1f2',
      ink: positivo ? '#15803d' : '#be123c',
    },
    {
      emoji: '💰',
      label: 'Ingresos',
      value: formatCop(totals.ingresos),
      hint: 'entró este mes',
      bg: '#f0fdf4',
      ink: '#15803d',
    },
    {
      emoji: '💸',
      label: 'Gastos',
      value: formatCop(totals.gastos),
      hint: 'salió este mes',
      bg: '#fff1f2',
      ink: '#be123c',
    },
    {
      emoji: band.emoji,
      label: 'Tasa de ahorro',
      // The null case must not read as 0%: "saved nothing" and "no income
      // recorded" are different facts.
      value: totals.tasaAhorro === null ? '—' : `${totals.tasaAhorro}%`,
      hint: band.hint,
      bg: band.bg,
      ink: band.ink,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {kpis.map((kpi, idx) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: idx * 0.05, ease: 'easeOut' }}
          className="rounded-2xl border border-[#ede9e3] bg-white p-4"
        >
          <div className="flex items-center gap-2">
            <span
              className="fin-emoji flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-base"
              style={{ backgroundColor: kpi.bg }}
              aria-hidden="true"
            >
              {kpi.emoji}
            </span>
            <span className="truncate text-[11px] font-bold text-[#78716c]">{kpi.label}</span>
          </div>

          <p
            className="mt-2.5 truncate text-xl font-extrabold tabular-nums"
            style={{ color: kpi.ink }}
          >
            {kpi.value}
          </p>
          <p className="mt-0.5 truncate text-[11px] font-medium text-[#a8a29e]">{kpi.hint}</p>
        </motion.div>
      ))}
    </div>
  );
};
