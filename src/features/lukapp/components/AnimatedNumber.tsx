import React from 'react';
import { motion } from 'framer-motion';
import { useMovimientoReducido } from '../lib/useMovimientoReducido';

interface AnimatedNumberProps {
  value: number | null;
  className?: string;
  format?: (n: number) => string;
}

/**
 * Muestra el valor financiero confirmado de inmediato y marca el cambio con
 * una entrada breve, sin interpolar cifras que nunca existieron en la cuenta.
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  className = '',
  format = (n) => n.toString(),
}) => {
  const movimientoReducido = useMovimientoReducido();

  return (
    <motion.span key={value} className={className}
      initial={movimientoReducido ? false : { opacity: 1, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: 'easeOut' }}>
      {value === null ? '0' : format(value)}
    </motion.span>
  );
};
