import React from 'react';
import { motion } from 'framer-motion';
import { useMovimientoReducido } from '../lib/useMovimientoReducido';

interface TypingTextProps {
  text: string;
  className?: string;
}

export const TypingText: React.FC<TypingTextProps> = ({ text, className = '' }) => {
  const movimientoReducido = useMovimientoReducido();

  return (
    <motion.span key={text} className={className}
      initial={movimientoReducido ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}>
      {text}
    </motion.span>
  );
};
