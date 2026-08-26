import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * La Estrella IA, el personaje de marca.
 *
 * El manual es explícito sobre qué representa: "personaje que representa la
 * inteligencia artificial de la app". Por eso vive donde vive la IA —el
 * asesor— y no repartida de adorno por toda la interfaz. Es el mismo criterio
 * que sections.ts aplica al color: si aparece en todas partes deja de
 * significar algo.
 *
 * El dibujo es el PNG oficial, no un redibujo: sobre él van dos párpados del
 * lila del cuerpo que bajan para el parpadeo. Así se anima sin arriesgar la
 * fidelidad del arte, y si mañana cambia el personaje solo hay que volver a
 * correr scripts/generar-iconos-marca.py y copiar las cajas de los ojos.
 */

/** El lila del cuerpo (#735AC2 en el manual). Los párpados van de ese color. */
const LILA_CUERPO = '#735AC2';

interface CajaOjo {
  left: string;
  top: string;
  width: string;
  height: string;
}

/* Dónde caen los ojos dentro de cada recorte, en fracciones. Los imprime
   scripts/generar-iconos-marca.py midiendo el PNG; no están puestos a ojo.
   Se ensanchan un pelo al pintarlos para tapar el borde suavizado. */
const OJOS: Record<'cara' | 'cuerpo', readonly [CajaOjo, CajaOjo]> = {
  cara: [
    { left: '25.49%', top: '44.25%', width: '15.86%', height: '17.15%' },
    { left: '54.37%', top: '44.83%', width: '15.69%', height: '17.35%' },
  ],
  cuerpo: [
    { left: '32.96%', top: '30.77%', width: '12.43%', height: '11.88%' },
    { left: '55.59%', top: '31.17%', width: '12.29%', height: '12.01%' },
  ],
};

const HOLGURA = '1.6%';

export type EstadoEstrella =
  /** Respirando, sin nada que hacer. */
  | 'quieta'
  /** El asesor está calculando: se balancea más rápido. */
  | 'pensando'
  /** Acaba de llegar una respuesta: un rebote y vuelve a lo suyo. */
  | 'contenta';

interface EstrellaProps {
  className?: string;
  estado?: EstadoEstrella;
  /** `cuerpo` trae brazos y piernas; `cara` es solo la estrella. */
  variante?: 'cara' | 'cuerpo';
  /**
   * Texto alternativo. Vacío (lo normal cuando acompaña a un texto que ya dice
   * lo mismo) la deja como decoración para el lector de pantalla.
   */
  alt?: string;
}

/* El cuerpo entero pierde casi la mitad del alto en brazos y piernas, así que a
   32px la carita queda en nada: para avatares va la variante `cara`.

   La proporción de cada recorte importa de verdad y no es decorativa: los
   párpados se posicionan en porcentajes de su caja, así que esa caja tiene que
   medir exactamente lo que mide el dibujo. Si se dejara que el `object-fit`
   centrara la imagen dentro de una caja cuadrada, las barras del letterbox
   correrían los ojos y el parpadeo saldría desalineado. */
const ARTE: Record<'cara' | 'cuerpo', { src: string; proporcion: number }> = {
  cara: { src: '/lukapp-estrella-cara.png', proporcion: 561 / 513 },
  cuerpo: { src: '/lukapp-estrella.png', proporcion: 716 / 741 },
};

const MOVIMIENTO = {
  quieta: {
    animate: { y: ['0%', '-3.5%', '0%'], rotate: [-1.5, 1.5, -1.5] },
    transition: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' as const },
  },
  pensando: {
    animate: { y: ['0%', '-7%', '0%'], rotate: [-5, 5, -5] },
    transition: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' as const },
  },
  contenta: {
    animate: { y: ['0%', '-14%', '0%'], scale: [1, 1.12, 0.96, 1], rotate: [0, -8, 6, 0] },
    transition: { duration: 0.7, ease: 'easeOut' as const },
  },
};

/** Cuánto se tarda en volver a parpadear. Irregular a propósito: un parpadeo
    cada exactamente 4s se nota mecánico. */
const proximoParpadeo = (): number => 2400 + Math.random() * 3600;

export const Estrella: React.FC<EstrellaProps> = ({
  className,
  estado = 'quieta',
  variante = 'cara',
  alt = '',
}) => {
  const quieto = useReducedMotion();
  const [parpadea, setParpadea] = useState(false);

  useEffect(() => {
    if (quieto) return;
    let abrir: ReturnType<typeof setTimeout>;
    const cerrar = () => {
      setParpadea(true);
      abrir = setTimeout(() => setParpadea(false), 120);
    };
    let siguiente = setTimeout(function ciclo() {
      cerrar();
      siguiente = setTimeout(ciclo, proximoParpadeo());
    }, proximoParpadeo());
    return () => {
      clearTimeout(siguiente);
      clearTimeout(abrir);
    };
  }, [quieto]);

  const movimiento = MOVIMIENTO[estado];
  const arte = ARTE[variante];

  return (
    <motion.span
      /* La caja de fuera es la que le da tamaño quien la usa. La de dentro se
         encoge hasta caber conservando la proporción del dibujo, que es lo
         mismo que haría `object-fit: contain` pero dejando los párpados
         pegados a la imagen y no a las barras vacías de los lados. */
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 0,
      }}
      animate={quieto ? undefined : movimiento.animate}
      transition={quieto ? undefined : movimiento.transition}
    >
      <span
        style={{
          position: 'relative',
          display: 'block',
          width: '100%',
          maxWidth: '100%',
          maxHeight: '100%',
          aspectRatio: String(arte.proporcion),
        }}
      >
        <img
          src={arte.src}
          alt={alt}
          aria-hidden={alt === '' ? true : undefined}
          draggable={false}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
        {OJOS[variante].map((ojo, i) => (
          <motion.span
            key={i}
            aria-hidden
            style={{
              position: 'absolute',
              left: `calc(${ojo.left} - ${HOLGURA})`,
              top: `calc(${ojo.top} - ${HOLGURA})`,
              width: `calc(${ojo.width} + ${HOLGURA} * 2)`,
              height: `calc(${ojo.height} + ${HOLGURA} * 2)`,
              background: LILA_CUERPO,
              transformOrigin: 'top',
              pointerEvents: 'none',
            }}
            initial={false}
            animate={{ scaleY: parpadea ? 1 : 0 }}
            transition={{ duration: 0.08, ease: 'linear' }}
          />
        ))}
      </span>
    </motion.span>
  );
};
