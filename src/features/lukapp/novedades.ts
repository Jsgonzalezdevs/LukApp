/**
 * El historial de "qué cambió", más reciente primero.
 *
 * La entrada de más arriba TIENE que ser la versión actual: `VERSION` en
 * src/version.ts, que es donde está explicado cómo se versiona esto. Si no
 * coinciden, version.test.ts falla.
 *
 * Es un archivo que se edita a mano con cada lanzamiento que valga la pena
 * contar -- no todo commit, solo lo que un usuario notaría o le sirve saber.
 * `VERSION_ACTUAL` sale sola de la primera entrada: agregar una entrada nueva
 * arriba de la lista es lo único que hace falta para que la tarjeta de
 * novedades vuelva a aparecer.
 */
import { VERSION } from '../../version';

export interface Novedad {
  /** La versión, en formato V0.0.0. Ver src/version.ts. */
  version: string;
  /** Solo de referencia interna -- no se le enseña al usuario. */
  fecha: string;
  texto: string;
}

export const NOVEDADES: readonly Novedad[] = [
  {
    version: '1.1.4',
    fecha: '2026-08-26',
    texto: 'El gesto de jalar para refrescar ahora es exclusivo de la pantalla principal (Dashboard / Inicio) y se deshabilita automáticamente al abrir modales o navegar por otras pestañas.',
  },
  {
    version: '1.1.3',
    fecha: '2026-08-26',
    texto: 'Mejoramos el escaneo de comprobantes OCR: ahora limpian automáticamente el texto de plantilla de Nequi y Bancolombia, evitando que se guarden frases o caracteres extraños de la imagen en la descripción.',
  },
  {
    version: '1.1.2',
    fecha: '2026-08-26',
    texto: 'Ahora sí: las manos de la Estrella se ocultan de verdad tras el cuerpo (nada de "bolas" asomando) y la sonrisa grande de las emociones más efusivas quedó redonda, no puntiaguda.',
  },
  {
    version: '1.1.1',
    fecha: '2026-08-26',
    texto: 'Corregimos el arreglo anterior de los brazos: la "bola" que se veía pegada al cuerpo ya no está, y las expresiones de "escéptica" y "somnolienta" se veían raras -- ahora son más simples y amigables.',
  },
  {
    version: '1.1.0',
    fecha: '2026-08-26',
    texto: 'La Estrella ya no se rompe ni en el saludo más exagerado, mira de frente en vez de sesgada, y estrena un montón de gestos nuevos: asiente, niega, se encoge de hombros, se estira, hace reverencia, gira mareada, flota, mira alrededor, baila, apunta hacia arriba, se emociona y bosteza.',
  },
  {
    version: '1.0.7',
    fecha: '2026-08-26',
    texto: 'Arreglamos que los brazos de la Estrella se vieran rotos al moverse, y el saludo ahora sí levanta el brazo en vez de solo agitarlo abajo.',
  },
  {
    version: '1.0.6',
    fecha: '2026-08-26',
    texto: 'La Estrella quedó calcada del dibujo original: trazamos su silueta píxel a píxel (puntas, brazos y pies incluidos) en vez de aproximarla a mano.',
  },
  {
    version: '1.0.5',
    fecha: '2026-08-26',
    texto: 'Corregimos la forma de la Estrella: ahora el vector es fiel al personaje original, con sus 7 puntas redondeadas y su carita amigable de siempre.',
  },
  {
    version: '1.0.4',
    fecha: '2026-08-26',
    texto: 'La Estrella en el asesor ahora tiene vida propia: saluda, piensa, salta, celebra y respira continuamente mientras esperas respuestas. Nunca se queda quieta.',
  },
  {
    version: '1.0.3',
    fecha: '2026-08-26',
    texto: 'La Estrella ahora es un vector animable: sus brazos, piernas y cabeza se mueven con código. Listos para nuevos gestos y expresiones que vienen pronto.',
  },
  {
    version: '1.0.2',
    fecha: '2026-08-26',
    texto: 'Efecto de escritura en los tutoriales: los títulos del onboarding ahora se escriben como si los escribiera la Estrella en tiempo real.',
  },
  {
    version: '1.0.1',
    fecha: '2026-08-26',
    texto: 'Favicon mejorado: el isotipo sin fondo en vez del icono con fondo, se lee mejor a 32px.',
  },
  {
    version: '1.0.0',
    fecha: '2026-08-26',
    texto:
      'La primera versión con número propio. LukApp ya lleva su logo e identidad oficial en todas partes, y te presentamos a la Estrella: el personaje que le pone cara al asesor con inteligencia artificial. Presupuestos muestra todas tus categorías y te sugiere un monto según lo que sueles gastar. Elige cada cuánto se reinicia todo — semanal, cada dos semanas, varias veces al mes, mensual o sin reinicio — desde Ajustes → Período. Además: la pantalla de Cuenta con tu ID y estado de sincronización, funciones solicitadas por votación, y un menú de Ajustes más fácil de reconocer de un vistazo.',
  },
];

export const VERSION_ACTUAL: string = NOVEDADES[0]?.version ?? VERSION;
