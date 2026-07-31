import React from 'react';
import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { COPY } from '../copy';
import { formatCop } from '../lib/formatCop';

interface BalanceSummaryProps {
  ingresos: number;
  gastos: number;
  month: string;
}

export const BalanceSummary: React.FC<BalanceSummaryProps> = ({ ingresos, gastos, month }) => {
  const balance = ingresos - gastos;
  const positivo = balance >= 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="rounded-3xl border border-[#ede9e3] bg-white p-5 shadow-[0_1px_2px_rgb(28_25_23/0.04)]"
      aria-label={COPY.balance.balance}
    >
      {/* Month + the one number that matters */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-[#a8a29e] capitalize">{month}</p>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{
            backgroundColor: positivo ? 'rgb(22 163 74 / 0.12)' : 'rgb(225 29 72 / 0.12)',
            color: positivo ? '#15803d' : '#be123c',
          }}
        >
          {positivo ? '↑ vas bien' : '↓ en rojo'}
        </span>
      </div>

      <p className="mt-2 font-display text-[2.75rem] leading-none font-extrabold tracking-tight text-[#1c1917] tabular-nums">
        {formatCop(balance)}
      </p>

      {/* Income / spend. Each side carries an arrow icon and its own label, so the
          colour is never the only thing distinguishing them. */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-[#f0fdf4] p-3">
          <div className="flex items-center gap-1.5">
            <ArrowUpRight className="h-3.5 w-3.5 text-[#16a34a]" strokeWidth={3} />
            <span className="text-[11px] font-bold text-[#15803d]">{COPY.balance.ingresos}</span>
          </div>
          <p className="mt-1 truncate text-lg font-extrabold text-[#15803d] tabular-nums">
            {formatCop(ingresos)}
          </p>
        </div>

        <div className="rounded-2xl bg-[#fff1f2] p-3">
          <div className="flex items-center gap-1.5">
            <ArrowDownRight className="h-3.5 w-3.5 text-[#e11d48]" strokeWidth={3} />
            <span className="text-[11px] font-bold text-[#be123c]">{COPY.balance.gastos}</span>
          </div>
          <p className="mt-1 truncate text-lg font-extrabold text-[#be123c] tabular-nums">
            {formatCop(gastos)}
          </p>
        </div>
      </div>
    </motion.section>
  );
};
