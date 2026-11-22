import React, { useEffect, useRef } from 'react';

/** La paleta del manual de marca, con blanco para que respire sobre el morado. */
const COLORES = ['#772AEA', '#735AC2', '#B6F246', '#D4025A', '#FFFFFF', '#B6F246', '#772AEA'];

type Forma = 'cinta' | 'circulo' | 'destello';

interface Particula {
  x: number;
  y: number;
  vx: number;
  vy: number;
  giro: number;
  velocidadGiro: number;
  vaiven: number;
  velocidadVaiven: number;
  tamano: number;
  color: string;
  forma: Forma;
  vida: number;
}

const GRAVEDAD = 0.16;
const ROCE = 0.988;
const DURACION_MS = 5_200;

const azar = (min: number, max: number) => min + Math.random() * (max - min);

/** El destello de cuatro puntas que acompaña al logo en el manual. */
const dibujarDestello = (ctx: CanvasRenderingContext2D, r: number) => {
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const radio = i % 2 === 0 ? r : r * 0.34;
    const angulo = (Math.PI / 4) * i;
    ctx.lineTo(Math.cos(angulo) * radio, Math.sin(angulo) * radio);
  }
  ctx.closePath();
  ctx.fill();
};

const rafaga = (
  origenX: number,
  origenY: number,
  cantidad: number,
  anguloCentral: number,
  apertura: number,
  fuerza: number,
): Particula[] =>
  Array.from({ length: cantidad }, () => {
    const angulo = anguloCentral + azar(-apertura, apertura);
    const velocidad = fuerza * azar(0.55, 1.05);
    const forma: Forma = Math.random() < 0.55 ? 'cinta' : Math.random() < 0.6 ? 'circulo' : 'destello';
    return {
      x: origenX,
      y: origenY,
      vx: Math.cos(angulo) * velocidad,
      vy: Math.sin(angulo) * velocidad,
      giro: azar(0, Math.PI * 2),
      velocidadGiro: azar(-0.2, 0.2),
      vaiven: azar(0, Math.PI * 2),
      velocidadVaiven: azar(0.05, 0.14),
      tamano: forma === 'destello' ? azar(6, 10) : azar(5, 9),
      color: COLORES[Math.floor(Math.random() * COLORES.length)],
      forma,
      vida: 1,
    };
  });

/**
 * Confeti en un canvas propio: sin dependencias nuevas y sin tocar el DOM por
 * cada papelito, para que la celebración no trabe teléfonos modestos.
 * Quien pidió menos movimiento en su sistema no lo ve.
 */
export const ConfetiMarca: React.FC<{ activo: boolean }> = ({ activo }) => {
  const lienzoRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!activo) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const lienzo = lienzoRef.current;
    const ctx = lienzo?.getContext('2d');
    if (!lienzo || !ctx) return undefined;

    const escala = Math.min(window.devicePixelRatio || 1, 2);
    let ancho = 0;
    let alto = 0;
    const ajustar = () => {
      ancho = window.innerWidth;
      alto = window.innerHeight;
      lienzo.width = ancho * escala;
      lienzo.height = alto * escala;
      ctx.setTransform(escala, 0, 0, escala, 0, 0);
    };
    ajustar();
    window.addEventListener('resize', ajustar);

    const fuerza = Math.min(Math.max(alto / 42, 14), 22);
    // Dos cañones desde las esquinas de abajo y una lluvia suave desde arriba:
    // así el confeti rodea la tarjeta en vez de taparla.
    let particulas: Particula[] = [
      ...rafaga(0, alto, 70, -Math.PI / 3, 0.35, fuerza),
      ...rafaga(ancho, alto, 70, (-2 * Math.PI) / 3, 0.35, fuerza),
    ];
    const segundaOla = window.setTimeout(() => {
      particulas = particulas.concat(
        Array.from({ length: 60 }, () => ({
          ...rafaga(azar(0, ancho), -20, 1, Math.PI / 2, 0.3, 3)[0],
        })),
      );
    }, 650);

    const inicio = performance.now();
    let cuadro = 0;
    const animar = (ahora: number) => {
      const transcurrido = ahora - inicio;
      ctx.clearRect(0, 0, ancho, alto);
      const desvanecer = transcurrido > DURACION_MS - 1_200 ? Math.max(0, (DURACION_MS - transcurrido) / 1_200) : 1;

      for (const p of particulas) {
        p.vx *= ROCE;
        p.vy = p.vy * ROCE + GRAVEDAD;
        p.x += p.vx + Math.sin(p.vaiven) * 0.6;
        p.y += p.vy;
        p.giro += p.velocidadGiro;
        p.vaiven += p.velocidadVaiven;
        if (p.y > alto + 30) p.vida = 0;
        if (p.vida <= 0) continue;

        ctx.save();
        ctx.globalAlpha = desvanecer;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.giro);
        ctx.fillStyle = p.color;
        if (p.forma === 'cinta') {
          // El coseno aplasta la cinta como si girara sobre su eje.
          ctx.scale(1, Math.cos(p.vaiven));
          ctx.fillRect(-p.tamano / 2, -p.tamano * 0.9, p.tamano, p.tamano * 1.8);
        } else if (p.forma === 'circulo') {
          ctx.beginPath();
          ctx.arc(0, 0, p.tamano / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          dibujarDestello(ctx, p.tamano);
        }
        ctx.restore();
      }

      particulas = particulas.filter((p) => p.vida > 0);
      if (transcurrido < DURACION_MS) cuadro = requestAnimationFrame(animar);
      else ctx.clearRect(0, 0, ancho, alto);
    };
    cuadro = requestAnimationFrame(animar);

    return () => {
      cancelAnimationFrame(cuadro);
      window.clearTimeout(segundaOla);
      window.removeEventListener('resize', ajustar);
    };
  }, [activo]);

  return <canvas ref={lienzoRef} className="pointer-events-none fixed inset-0 z-[10011] h-full w-full" aria-hidden="true" />;
};
