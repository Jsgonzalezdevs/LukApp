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
const CLAVE_CONSENTIMIENTO = 'lukapp_analitica_detallada';

export const puedeMedirDetalle = (): boolean => {
  try { return localStorage.getItem(CLAVE_CONSENTIMIENTO) === 'aceptada'; } catch { return false; }
};

export const guardarConsentimientoAnalitica = (acepta: boolean): void => {
  try { localStorage.setItem(CLAVE_CONSENTIMIENTO, acepta ? 'aceptada' : 'esencial'); } catch { /* opcional */ }
};

export const pideConsentimientoAnalitica = (): boolean => {
  try { return localStorage.getItem(CLAVE_CONSENTIMIENTO) === null; } catch { return false; }
};

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

  const detalles = puedeMedirDetalle() ? contextoTecnico() : {};
  const cuerpo = JSON.stringify({
    ruta: window.location.pathname,
    referente: document.referrer,
    ...leerAtribucion(),
    ...detalles,
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

/** Categorías amplias: el UA completo sería una huella y no se conserva. */
const contextoTecnico = (): Record<string, string> => {
  const ua = navigator.userAgent;
  const navegador = /edg\//i.test(ua) ? 'Edge' : /firefox/i.test(ua) ? 'Firefox' : /safari/i.test(ua) && !/chrome|crios/i.test(ua) ? 'Safari' : /chrome|crios/i.test(ua) ? 'Chrome' : 'Otro';
  const sistema = /windows/i.test(ua) ? 'Windows' : /android/i.test(ua) ? 'Android' : /iphone|ipad|mac os/i.test(ua) ? 'Apple' : /linux/i.test(ua) ? 'Linux' : 'Otro';
  const ancho = window.innerWidth;
  const pantalla = ancho < 640 ? 'compacta' : ancho < 1024 ? 'mediana' : 'amplia';
  return {
    idioma: (navigator.language || 'sin-dato').slice(0, 16),
    navegador,
    sistema,
    pantalla,
    zona_horaria: Intl.DateTimeFormat().resolvedOptions().timeZone.replace('/', '-').slice(0, 48),
  };
};
