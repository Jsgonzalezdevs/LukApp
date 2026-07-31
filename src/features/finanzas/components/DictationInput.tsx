import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Info, Mic, Square } from 'lucide-react';
import { COPY } from '../copy';
import { useDictation } from '../hooks/useDictation';

interface DictationInputProps {
  onSubmit: (text: string) => void;
}

export const DictationInput: React.FC<DictationInputProps> = ({ onSubmit }) => {
  const [text, setText] = useState('');

  const dictation = useDictation((finalText) => {
    setText(finalText);
    onSubmit(finalText);
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setText('');
  };

  const listening = dictation.status === 'listening';

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {/* The textarea is the PRIMARY voice path: tapping it brings up the iOS
          keyboard, whose microphone key is on-device dictation. That works in the
          installed app and offline, which the Web Speech API does not. */}
      <textarea
        value={listening && dictation.interim ? dictation.interim : text}
        onChange={(e) => setText(e.target.value)}
        placeholder={COPY.input.placeholder}
        rows={2}
        // 16px minimum: anything smaller makes iOS auto-zoom on focus and never
        // zoom back out.
        className="w-full resize-none rounded-2xl border border-[#ede9e3] bg-white px-4 py-3 text-base text-[#1c1917] placeholder:text-[#a8a29e] focus:border-[#a8a29e] focus:outline-none"
        aria-label={COPY.input.placeholder}
      />

      <div className="flex items-center gap-3">
        <motion.button
          type="submit"
          disabled={!text.trim()}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-[#1c1917] px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#292524] disabled:opacity-30"
        >
          <span className="fin-emoji" aria-hidden="true">
            ✨
          </span>
          {COPY.input.submit}
        </motion.button>

        {/* One-tap dictation, shown only where it genuinely works. */}
        {dictation.supported ? (
          <motion.button
            type="button"
            onClick={listening ? dictation.stop : dictation.start}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-pressed={listening}
            aria-label={listening ? COPY.input.stop : COPY.input.speak}
            className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-colors ${
              listening
                ? 'bg-[#fff1f2] text-[#e11d48]'
                : 'bg-[#1c1917] text-white hover:bg-[#292524]'
            }`}
          >
            {listening ? <Square className="h-5 w-5" strokeWidth={3} /> : <Mic className="h-6 w-6" strokeWidth={2.5} />}
          </motion.button>
        ) : null}
      </div>

      {/* Status line. aria-live so the parse outcome is announced, not just shown. */}
      <p className="flex items-start gap-2 text-[11px] leading-relaxed text-[#a8a29e]" aria-live="polite">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
        <span>
          {listening
            ? COPY.input.listening
            : dictation.status === 'blocked'
              ? COPY.input.blocked
              : dictation.standalone
                ? COPY.input.keyboardHint
                : dictation.supported
                  ? COPY.input.keyboardHint
                  : COPY.input.offline}
        </span>
      </p>
    </form>
  );
};
