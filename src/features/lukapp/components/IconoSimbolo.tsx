import type { HTMLAttributes } from 'react';

const EMOJIS_IDENTIDAD: Record<string, string> = {"Bell": "🔔", "CalendarDays": "🗓️", "Flame": "🔥", "PiggyBank": "🐷", "TrendingUp": "📊", "Wallet": "💸", "Plane": "🚀", "Shield": "🛡️", "Moon": "🌗", "Cloud": "☁️", "Heart": "❤️", "Lightbulb": "💡", "UserRound": "👤", "Users": "🐮"};

/** Conserva los emojis elegidos; los nombres internos tienen su equivalente visual. */
export const IconoSimbolo = ({ valor, className = '', ...propiedades }: HTMLAttributes<HTMLSpanElement> & { valor?: string | null }) => (
  <span className={`inline-flex shrink-0 items-center justify-center leading-none ${className}`} aria-hidden="true" {...propiedades}>
    {valor ? (EMOJIS_IDENTIDAD[valor] ?? valor) : '👤'}
  </span>
);
