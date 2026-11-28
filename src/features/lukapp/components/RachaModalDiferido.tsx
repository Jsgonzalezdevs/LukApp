import React, { lazy, Suspense } from 'react';

/* El modal de racha (ranking, bonos, animaciones) solo se abre al tocar la
   llama, así que no tiene por qué viajar en la carga inicial de Inicio. */
const RachaModalPerezoso = lazy(() =>
  import('./RachaModal').then(({ RachaModal }) => ({ default: RachaModal })),
);

export const RachaModalDiferido: React.FC<React.ComponentProps<typeof RachaModalPerezoso>> = (props) => (
  <Suspense fallback={null}>
    <RachaModalPerezoso {...props} />
  </Suspense>
);
