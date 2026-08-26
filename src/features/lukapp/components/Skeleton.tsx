import React from 'react';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Un bloque gris con el brillo pasando por encima, del tamaño que le pongas
 * por className/style. No sabe qué está reemplazando -- eso lo arma quien lo
 * usa, apilando varios con el ancho/alto de lo que va a aparecer ahí.
 */
export const Skeleton: React.FC<SkeletonProps> = ({ className = '', style }) => (
  <span
    className={`fin-skeleton block rounded-[var(--fin-r-control)] ${className}`}
    style={style}
    aria-hidden="true"
  />
);

/**
 * La forma de la pantalla principal (saldo grande + fila de cuentas) para
 * mostrar mientras se carga la sesión o los datos guardados. Antes esas dos
 * pantallas eran un "Cargando..." solo, en blanco -- esto se ve, desde el
 * primer instante, como la app de verdad a punto de aparecer.
 */
export const SkeletonInicio: React.FC = () => (
  <div className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col gap-6 px-5 pt-[calc(env(safe-area-inset-top)+2rem)]">
    <div className="flex flex-col items-center gap-3">
      <Skeleton className="h-[15px] w-28" />
      <Skeleton className="h-[44px] w-48" />
    </div>
    <div className="flex flex-col gap-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-[var(--fin-r-card)] bg-[var(--fin-card)] p-4">
          <Skeleton className="h-11 w-11 shrink-0 rounded-[var(--fin-r-pill)]" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-[15px] w-2/5" />
            <Skeleton className="h-[13px] w-1/4" />
          </div>
          <Skeleton className="h-[17px] w-16 shrink-0" />
        </div>
      ))}
    </div>
  </div>
);
