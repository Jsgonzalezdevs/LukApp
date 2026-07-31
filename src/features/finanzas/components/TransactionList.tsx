import React from 'react';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { CATEGORY_COLOR, CATEGORY_EMOJI, CATEGORY_LABELS, tint } from '../types';
import type { Transaction } from '../types';
import { COPY } from '../copy';
import { formatCop, formatSigned } from '../lib/formatCop';
import { dayLabel } from '../lib/localDate';

interface TransactionListProps {
  transactions: readonly Transaction[];
  onDelete: (id: string) => void;
}

interface DayGroup {
  date: string;
  items: Transaction[];
  net: number;
}

const groupByDay = (transactions: readonly Transaction[]): DayGroup[] => {
  const byDate = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    const bucket = byDate.get(tx.occurredOn);
    if (bucket) bucket.push(tx);
    else byDate.set(tx.occurredOn, [tx]);
  }

  return [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, items]) => ({
      date,
      items: [...items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
      net: items.reduce((sum, tx) => sum + (tx.kind === 'ingreso' ? tx.amountCop : -tx.amountCop), 0),
    }));
};

export const TransactionList: React.FC<TransactionListProps> = ({ transactions, onDelete }) => {
  if (transactions.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-[#ede9e3] px-6 py-12 text-center">
        <span className="fin-emoji block text-4xl" aria-hidden="true">
          👋
        </span>
        <p className="mt-3 text-sm font-bold text-[#1c1917]">{COPY.list.empty}</p>
        <p className="mt-1 text-xs text-[#a8a29e]">{COPY.list.emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {groupByDay(transactions).map((group) => (
        <section key={group.date} aria-label={dayLabel(group.date)}>
          {/* Day header with its own subtotal */}
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h3 className="text-xs font-bold text-[#78716c] capitalize">{dayLabel(group.date)}</h3>
            <span className="text-[11px] font-semibold text-[#a8a29e] tabular-nums">
              {formatCop(group.net)}
            </span>
          </div>

          <ul className="flex flex-col gap-2">
            {group.items.map((tx, idx) => {
              const color = CATEGORY_COLOR[tx.category];
              const esIngreso = tx.kind === 'ingreso';

              return (
                <motion.li
                  key={tx.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.15) }}
                  className="flex items-center gap-3 rounded-2xl border border-[#ede9e3] bg-white px-3 py-3"
                >
                  {/* Category identity: emoji on its own hue. Two channels, not one. */}
                  <span
                    className="fin-emoji flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl"
                    style={{ backgroundColor: tint(color, 0.14) }}
                    aria-hidden="true"
                  >
                    {CATEGORY_EMOJI[tx.category]}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#1c1917]">{tx.description}</p>
                    <p className="text-[11px] font-medium" style={{ color }}>
                      {CATEGORY_LABELS[tx.category]}
                    </p>
                  </div>

                  <span
                    className="shrink-0 text-sm font-extrabold tabular-nums"
                    style={{ color: esIngreso ? '#15803d' : '#be123c' }}
                  >
                    {formatSigned(tx.amountCop, tx.kind)}
                  </span>

                  <button
                    type="button"
                    onClick={() => onDelete(tx.id)}
                    aria-label={`${COPY.list.delete}: ${tx.description}`}
                    className="shrink-0 rounded-xl p-1.5 text-[#d6d3d1] transition-colors hover:bg-[#fff1f2] hover:text-[#e11d48]"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </motion.li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
};
