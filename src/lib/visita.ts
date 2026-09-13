/**
 * Avisar que alguien está mirando el portafolio.
 *
 * Manda dos cosas y ninguna más: qué página y de qué dominio llegó. El país, el
 * tipo de dispositivo y la huella del día los deduce el borde de Vercel a
 * partir de encabezados que el navegador manda de todos modos — así el
 * navegador nunca tiene que entregar nada que no estuviera ya entregando.
 */

const RUTA = '/api/visita';
const CLAVE_ATRIBUCION = 'lukapp_atribucion_marketing';

type Atribucion = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
};

/** Solo aceptamos etiquetas de campañas propias, no query arbitrario. */
const leerAtribucion = (): Atribucion => {
  const params = new URLSearchParams(window.location.search);
  const limpiar = (clave: string, largo: number): string | undefined => {
    const valor = params.get(clave)?.trim().toLowerCase();
    return valor && /^[a-z0-9._-]+$/.test(valor) ? valor.slice(0, largo) : undefined;
  };
  const actual = {
    utm_source: limpiar('utm_source', 80),
    utm_medium: limpiar('utm_medium', 80),
    utm_campaign: limpiar('utm_campaign', 120),
    utm_content: limpiar('utm_content', 120),
  };
  if (Object.values(actual).some(Boolean)) {
    try { sessionStorage.setItem(CLAVE_ATRIBUCION, JSON.stringify(actual)); } catch { /* opcional */ }
    return actual;
  }
  try {
    const guardada = JSON.parse(sessionStorage.getItem(CLAVE_ATRIBUCION) ?? '{}') as Atribucion;
    return guardada;
  } catch {
    return {};
  }
};

/**
 * Si esta visita se cuenta o no.
 *
 * "No me rastrees" es una respuesta, no una sugerencia: cuando el navegador lo
 * dice, no se cuenta y ya. Cuesta una línea y es exactamente lo que uno
 * esperaría de un sitio que promete no guardar nada personal.
 */
export const debeRegistrar = (
  doNotTrack: string | null | undefined,
  produccion: boolean,
): boolean => {
  if (doNotTrack === '1' || doNotTrack === 'yes') return false;

  // En desarrollo no hay función del borde que responda, y contar las recargas
  // de uno mismo mientras programa ensuciaría los números reales.
  return produccion;
};

export const registrarVisita = (): void => {
  if (!debeRegistrar(navigator.doNotTrack, import.meta.env.PROD)) return;

  const cuerpo = JSON.stringify({
    ruta: window.location.pathname,
    referente: document.referrer,
    ...leerAtribucion(),
  });

  try {
    // `sendBeacon` sobrevive a que cierren la pestaña de inmediato, que es
    // justo cuando más se pierde una visita corta.
    if (typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(RUTA, new Blob([cuerpo], { type: 'application/json' }));
      return;
    }

    void fetch(RUTA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: cuerpo,
      keepalive: true,
    }).catch(() => {
      // Silencio a propósito: ver más abajo.
    });
  } catch {
    // Contar visitas jamás puede romper la página de nadie. Si falla, se
    // pierde el dato y no pasa nada más.
  }
};
