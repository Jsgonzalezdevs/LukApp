import { Award, Bell, BookOpen, CalendarDays, Car, Cat, Cloud, Coffee, CreditCard, Dog, Download, Flag, Flame, Gift, Heart, Home, KeyRound, Landmark, Lightbulb, Moon, Package, PiggyBank, Plane, Repeat2, Shield, ShoppingCart, Smile, Target, TrendingUp, UserRound, Users, Utensils, Wallet, Wrench } from 'lucide-react';
import type { LucideIcon, LucideProps } from 'lucide-react';

/** Compatibilidad visual con valores antiguos, sin modificar lo que está guardado. */
const SIMBOLOS: Record<string, LucideIcon> = {
  Bell, BookOpen, CalendarDays, Car, Cat, Cloud, Coffee, CreditCard, Dog, Download, Flag, Flame, Gift, Heart, Home, KeyRound, Landmark, Lightbulb, Moon, Package, PiggyBank, Plane, Repeat2, Shield, ShoppingCart, Smile, Target, TrendingUp, UserRound, Users, Utensils, Wallet, Wrench,
  '👤': UserRound, '😊': Smile,
  '🌱': TrendingUp, '⚡': Flame, '💎': Target, '🏆': Award, '👑': Award, '🌟': Award,
  '📈': TrendingUp, '🏷️': Package, '🎯': Target, '🗓️': CalendarDays, '🚩': Flag, '🔁': Repeat2, '👫': Users, '🍽️': Utensils, '🐮': Users, '📥': Download, '💳': CreditCard, '🏛️': Landmark, '👥': Users, '🔑': KeyRound, '💾': Download, '🔧': Wrench, '☁️': Cloud, '🐷': PiggyBank, '📊': TrendingUp, '💵': Wallet, '🔔': Bell, '🚀': Plane, '🛡️': Shield, '🌗': Moon, '🔥': Flame, '💸': Wallet, '💰': Wallet, '💡': Lightbulb, '🥑': ShoppingCart, '🏠': Home, '✈️': Plane, '🍷': Utensils, '🍕': Utensils, '🏖️': Plane, '🛒': ShoppingCart, '🚗': Car, '☕': Coffee, '🎁': Gift, '❤️': Heart, '✨': Lightbulb, '🤝': Users, '🐶': Dog, '🐱': Cat,
};

export const IconoSimbolo = ({ valor, className = 'h-5 w-5', ...propiedades }: LucideProps & { valor?: string | null }) => {
  const Icono = valor && SIMBOLOS[valor] ? SIMBOLOS[valor] : UserRound;
  return <Icono className={className} strokeWidth={1.8} aria-hidden="true" {...propiedades} />;
};
