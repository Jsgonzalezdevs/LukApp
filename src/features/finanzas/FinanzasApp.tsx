import React, { useMemo, useState } from 'react';
import type { Transaction } from './types';
import { byCategory, forMonth, monthTotals } from './lib/aggregate';
import { bogotaDate, monthKey, shiftMonth } from './lib/localDate';
import { parseTransaction } from './lib/parseTransaction';
import type { ParsedTransaction } from './lib/parseTransaction';
import { AnalistaView } from './components/AnalistaView';
import { CategoryBreakdown } from './components/CategoryBreakdown';
import { ConfirmSheet } from './components/ConfirmSheet';
import type { ConfirmDraft } from './components/ConfirmSheet';
import { DictationInput } from './components/DictationInput';
import { FinanzasShell } from './components/FinanzasShell';
import type { SectionId } from './sections';
import { KpiRow } from './components/KpiRow';
import { MonthNav } from './components/MonthNav';
import { TransactionList } from './components/TransactionList';
import './finanzas.css';

// `crypto.randomUUID` needs a secure context. Falls back so testing over a LAN
// IP degrades instead of throwing.
const newId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tx-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
};

export const FinanzasApp: React.FC = () => {
  // Phase 1 keeps everything in memory on purpose: the goal is to get the parser
  // onto a real phone with a real voice before any backend exists.
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pending, setPending] = useState<ParsedTransaction | null>(null);
  const [section, setSection] = useState<SectionId>('resumen');

  const today = bogotaDate();
  const thisMonth = monthKey(today);
  const [month, setMonth] = useState(thisMonth);

  const { totals, gastos, ingresos, delMes } = useMemo(() => {
    const mes = forMonth(transactions, month);
    return {
      delMes: mes,
      totals: monthTotals(mes),
      gastos: byCategory(mes, 'gasto'),
      ingresos: byCategory(mes, 'ingreso'),
    };
  }, [transactions, month]);

  const handleSubmit = (text: string) => setPending(parseTransaction(text));

  const handleSave = (draft: ConfirmDraft) => {
    setTransactions((prev) => [
      {
        id: newId(),
        kind: draft.kind,
        amountCop: draft.amountCop,
        category: draft.category,
        description: draft.description,
        occurredOn: bogotaDate(),
        rawTranscript: draft.rawTranscript,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    // Jump back to the month the entry landed in, so a save is never invisible
    // because the user was browsing an older month.
    setMonth(thisMonth);
    setPending(null);
  };

  const handleDelete = (id: string) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
  };

  const monthNav = (
    <MonthNav month={month} onChange={setMonth} maxMonth={thisMonth} shift={shiftMonth} />
  );

  const registrar = (
    <section className="rounded-3xl border border-[#ede9e3] bg-white p-5">
      <h2 className="text-xs font-bold text-[#78716c]">✍️ Registrar un movimiento</h2>
      <div className="mt-3">
        <DictationInput onSubmit={handleSubmit} />
      </div>
    </section>
  );

  return (
    <FinanzasShell
      section={section}
      onSectionChange={setSection}
      toolbar={section === 'analista' ? undefined : monthNav}
    >
      {section === 'resumen' ? (
        // Mobile stacks; from `lg` the same blocks become a two-column dashboard
        // with the KPI row spanning the full width above them.
        <div className="mx-auto flex max-w-6xl flex-col gap-5">
          <div className="lg:hidden">{monthNav}</div>

          <KpiRow totals={totals} />

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="flex flex-col gap-5">
              {registrar}
              <CategoryBreakdown slices={gastos} title="🎯 En qué se te va" />
            </div>

            <div className="flex flex-col gap-5">
              <CategoryBreakdown slices={ingresos} title="🌱 De dónde entra" />

              <section className="rounded-3xl border border-[#ede9e3] bg-white p-5">
                <h2 className="text-xs font-bold text-[#78716c]">🕒 Últimos movimientos</h2>
                <div className="mt-3">
                  <TransactionList
                    transactions={delMes.slice(0, 5)}
                    onDelete={handleDelete}
                  />
                </div>
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {section === 'movimientos' ? (
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          <div className="lg:hidden">{monthNav}</div>
          {registrar}
          <TransactionList transactions={delMes} onDelete={handleDelete} />
        </div>
      ) : null}

      {section === 'analista' ? (
        <AnalistaView
          existentes={transactions}
          onImportar={(nuevos) => setTransactions((prev) => [...nuevos, ...prev])}
        />
      ) : null}

      {/* Confirmation always gates the write — see ConfirmSheet for why. */}
      {pending ? (
        <ConfirmSheet parsed={pending} onSave={handleSave} onCancel={() => setPending(null)} />
      ) : null}
    </FinanzasShell>
  );
};
