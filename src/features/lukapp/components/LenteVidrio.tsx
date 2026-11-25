import React from 'react';

/**
 * El efecto lente del liquid glass: el fondo se dobla en los bordes de la
 * cápsula, como si fuera vidrio grueso, y el centro queda quieto.
 *
 * Solo Chromium (Chrome, Edge, el WebView de Android) aplica un filtro SVG en
 * `backdrop-filter`. Safari y Firefox leen la regla pero no pintan nada, y
 * en algunos casos dejan la barra sin desenfoque; por eso se activa con una
 * marca en el elemento y no con `@supports`, que en Safari dice que sí.
 */
const soportaLente = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const marcas = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }).userAgentData?.brands;
  if (marcas?.some((m) => /Chromium/i.test(m.brand))) return true;
  // Chrome en iPhone se llama CriOS y es WebKit por dentro: no entra aquí.
  return /\bChrome\/\d+/.test(navigator.userAgent) && !/\bCriOS\b/.test(navigator.userAgent);
};

/**
 * El mapa de desplazamiento: rojo mueve en X y azul en Y. El gris medio no
 * mueve nada, así que el centro se pinta gris y desenfocado para que la
 * curva empiece suave cerca del borde, que es donde el vidrio real refracta.
 */
const mapaDesplazamiento = (ancho: number, alto: number): string => {
  const radio = alto / 2;
  const borde = Math.max(6, Math.round(alto * 0.16));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">
<defs>
<linearGradient id="x" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#f00"/></linearGradient>
<linearGradient id="y" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#00f"/></linearGradient>
<filter id="b"><feGaussianBlur stdDeviation="${borde * 0.6}"/></filter>
</defs>
<rect width="${ancho}" height="${alto}" fill="#000"/>
<rect width="${ancho}" height="${alto}" rx="${radio}" fill="url(#x)"/>
<rect width="${ancho}" height="${alto}" rx="${radio}" fill="url(#y)" style="mix-blend-mode:screen"/>
<rect x="${borde}" y="${borde}" width="${ancho - borde * 2}" height="${alto - borde * 2}" rx="${radio - borde}" fill="#808080" filter="url(#b)"/>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

interface LenteVidrioProps {
  /** El elemento que lleva el vidrio. Se mide para que el mapa calce exacto. */
  objetivo: React.RefObject<HTMLElement | null>;
  id: string;
}

export const LenteVidrio: React.FC<LenteVidrioProps> = ({ objetivo, id }) => {
  const [tamano, setTamano] = React.useState<{ ancho: number; alto: number } | null>(null);

  React.useEffect(() => {
    const el = objetivo.current;
    if (!el || !soportaLente() || typeof ResizeObserver === 'undefined') return;
    const medir = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) setTamano({ ancho: Math.round(width), alto: Math.round(height) });
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, [objetivo]);

  React.useEffect(() => {
    const el = objetivo.current;
    if (!el) return;
    // La marca va después de que el filtro existe: si el CSS apuntara a un
    // filtro que aún no está, Chrome deja la barra sin ningún efecto.
    if (tamano) el.dataset.lente = 'si';
    return () => { delete el.dataset.lente; };
  }, [objetivo, tamano]);

  if (!tamano) return null;
  const { ancho, alto } = tamano;

  return (
    <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
      <filter id={id} x="0" y="0" width={ancho} height={alto} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
        <feImage href={mapaDesplazamiento(ancho, alto)} x="0" y="0" width={ancho} height={alto} result="mapa" preserveAspectRatio="none" />
        <feDisplacementMap in="SourceGraphic" in2="mapa" scale={-Math.round(alto * 0.55)} xChannelSelector="R" yChannelSelector="B" />
      </filter>
    </svg>
  );
};
