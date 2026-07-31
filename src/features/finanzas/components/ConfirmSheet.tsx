import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { CATEGORIES, CATEGORY_COLOR, CATEGORY_EMOJI, CATEGORY_LABELS, tint } from '../types';
import type { Category, TxKind } from '../types';
import { COPY } from '../copy';
import { formatAmountInput, parseAmountInput } from '../lib/formatCop';
import type { ParsedTransaction } from '../lib/parseTransaction';

export interface ConfirmDraft {
  kind: TxKind;
  amountCop: number;
  category: Category;
  description: string;
  rawTranscript: string;
}

interface ConfirmSheetProps {
  parsed: ParsedTransaction;
  onSave: (draft: ConfirmDraft) => void;
  onCancel: () => void;
}

/**
 * Always shown, even at high confidence. Confidence controls PRESENTATION only —
 * which field is highlighted and focused — never whether the write happens. That
 * removes the entire class of "silently saved the wrong number" bugs for the cost
 * of one tap.
 */
export const ConfirmSheet: React.FC<ConfirmSheetProps> = ({ parsed, onSave, onCancel }) => {
  const [amountText, setAmountText] = useState(() => formatAmountInput(parsed.amount));
  const [kind, setKind] = useState<TxKind>(parsed.kind);
  const [category, setCategory] = useState<Category>(parsed.category);
  const [description, setDescription] = useState(parsed.description);

  const amountRef = useRef<HTMLInputElement>(null);

  const amountWeak = parsed.signals.amountSource === 'none';
  const kindWeak = parsed.signals.kindSource === 'default';
  const amountCop = parseAmountInput(amountText);

  useEffect(() => {
    if (amountWeak) amountRef.current?.focus();
  }, [amountWeak]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amountCop === null) {
      amountRef.current?.focus();
      return;
    }
    onSave({
      kind,
      amountCop,
      category,
      description: description.trim() || CATEGORY_LABELS[category],
      rawTranscript: parsed.raw,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-40 flex items-end justify-center bg-[#1c1917]/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={COPY.confirm.title}
    >
      <motion.form
        onSubmit={handleSubmit}
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[2rem] bg-[#fbf9f6] px-5 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-[#1c1917]">
              <span className="fin-emoji" aria-hidden="true">
                {CATEGORY_EMOJI[category]}
              </span>
              {COPY.confirm.title}
            </h2>
            {parsed.needsReview ? (
              <p className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-[#d97706]">
                <AlertTriangle className="h-3.5 w-3.5" strokeWidth={3} />
                {COPY.confirm.review}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={COPY.confirm.cancel}
            className="rounded-xl p-1.5 text-[#a8a29e] transition-colors hover:bg-white hover:text-[#1c1917]"
          >
            <X className="h-4 w-4" strokeWidth={3} />
          </button>
        </div>

        {/* Amount */}
        <div className="mt-5">
          <label htmlFor="fin-amount" className="block text-xs font-bold text-[#78716c]">
            {COPY.confirm.amount}
          </label>
          <div className="mt-2 flex items-center gap-2 rounded-2xl border-2 bg-white px-4 py-3"
            style={{ borderColor: amountWeak ? '#fbbf24' : '#ede9e3' }}
          >
            <span className="font-display text-2xl font-extrabold text-[#a8a29e]">$</span>
            <input
              id="fin-amount"
              ref={amountRef}
              value={amountText}
              onChange={(e) => setAmountText(formatAmountInput(parseAmountInput(e.target.value)))}
              inputMode="numeric"
              placeholder="0"
              className="w-full bg-transparent font-display text-3xl font-extrabold text-[#1c1917] tabular-nums placeholder:text-[#d6d3d1] focus:outline-none"
            />
          </div>
          {amountWeak ? (
            <p className="mt-1.5 text-[11px] font-semibold text-[#d97706]">
              {COPY.confirm.amountMissing}
            </p>
          ) : null}
        </div>

        {/* Direction */}
        <fieldset className="mt-5">
          <legend className="text-xs font-bold text-[#78716c]">{COPY.confirm.kind}</legend>
          <div
            className="mt-2 grid grid-cols-2 gap-2 rounded-2xl border-2 bg-white p-1.5"
            style={{ borderColor: kindWeak ? '#fbbf24' : '#ede9e3' }}
          >
            {([
              { value: 'gasto', emoji: '💸', label: COPY.confirm.gasto, on: '#fff1f2', ink: '#be123c' },
              { value: 'ingreso', emoji: '💰', label: COPY.confirm.ingreso, on: '#f0fdf4', ink: '#15803d' },
            ] as const).map((option) => {
              const active = kind === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setKind(option.value)}
                  aria-pressed={active}
                  className="flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors"
                  style={{
                    backgroundColor: active ? option.on : 'transparent',
                    color: active ? option.ink : '#a8a29e',
                  }}
                >
                  <span className="fin-emoji" aria-hidden="true">
                    {option.emoji}
                  </span>
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Category — emoji + hue makes 13 options scannable without reading */}
        <fieldset className="mt-5">
          <legend className="text-xs font-bold text-[#78716c]">{COPY.confirm.category}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {CATEGORIES.map((option) => {
              const active = category === option;
              const color = CATEGORY_COLOR[option];
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCategory(option)}
                  aria-pressed={active}
                  className="flex items-center gap-1.5 rounded-full border-2 px-3 py-2 text-xs font-bold transition-colors"
                  style={{
                    backgroundColor: active ? tint(color, 0.16) : '#ffffff',
                    borderColor: active ? color : '#ede9e3',
                    color: active ? '#1c1917' : '#78716c',
                  }}
                >
                  <span className="fin-emoji" aria-hidden="true">
                    {CATEGORY_EMOJI[option]}
                  </span>
                  {CATEGORY_LABELS[option]}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Description */}
        <div className="mt-5">
          <label htmlFor="fin-desc" className="block text-xs font-bold text-[#78716c]">
            {COPY.confirm.description}
          </label>
          <input
            id="fin-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-2 w-full rounded-2xl border-2 border-[#ede9e3] bg-white px-4 py-3 text-base font-medium text-[#1c1917] focus:border-[#a8a29e] focus:outline-none"
          />
        </div>

        {/* What was actually heard, so a mis-parse is always traceable */}
        {parsed.raw.trim() ? (
          <p className="mt-4 rounded-2xl bg-[#f5f3f0] px-4 py-3 text-[11px] leading-relaxed text-[#78716c]">
            <span className="fin-emoji mr-1" aria-hidden="true">
              👂
            </span>
            <span className="font-bold">{COPY.confirm.heard}: </span>
            &ldquo;{parsed.raw.trim()}&rdquo;
          </p>
        ) : null}

        {/* Actions */}
        <motion.button
          type="submit"
          disabled={amountCop === null}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#1c1917] px-6 py-4 text-sm font-bold text-white transition-colors hover:bg-[#292524] disabled:opacity-30"
        >
          <span className="fin-emoji" aria-hidden="true">
            ✅
          </span>
          {COPY.confirm.save}
        </motion.button>
      </motion.form>
    </motion.div>
  );
};
