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
    version: '1.9.3',
    fecha: '2026-08-27',
    texto: 'Integración limpia y bajo demanda: Asesor Fiscal DIAN y Vaquitas accesibles desde Más > Herramientas y el Asesor IA, manteniendo la cabecera limpia y explicados en la guía interactiva.',
  },
  {
    version: '1.9.2',
    fecha: '2026-08-27',
    texto: 'Vaquitas reales sin datos ficticios: almacenamiento local en tu dispositivo, estado vacío limpio para crear tu primera vaca y botón para eliminar vaquitas completadas.',
  },
  {
    version: '1.9.1',
    fecha: '2026-08-27',
    texto: 'Categorización precisa de Mascotas: reconocimiento de comida de perro/gato y veterinaria con emoji 🐶 en el demo y la app, y actualización de las 7 maneras de registrar con Apple Pay.',
  },
  {
    version: '1.9.0',
    fecha: '2026-08-27',
    texto: 'Inteligencia Financiera Colombiana: Semáforo de topes de Renta DIAN, Simulador de Retefuente para independientes, Calendario de Nómina y festivos de Colombia, Vaquitas y gastos compartidos, y Traductor de hábitos cotidianos.',
  },
  {
    version: '1.8.1',
    fecha: '2026-08-27',
    texto: 'Transcripción por voz robusta: conexión con fallback automático a la API de backend (apiUrl) y diagnóstico claro para dictado por voz.',
  },
  {
    version: '1.8.0',
    fecha: '2026-08-27',
    texto: 'Apple Pay y Automatizaciones: soporte robusto universal para pagos automáticos con iPhone, compatibilidad de payloads en inglés/español y nueva guía interactiva paso a paso en la landing.',
  },
  {
    version: '1.7.8',
    fecha: '2026-08-27',
    texto: 'Emojis en el demostrador interactivo de la landing: el resultado del parser en vivo y el teléfono interactivo ahora reflejan los emojis y colores de cada categoría.',
  },
  {
    version: '1.7.7',
    fecha: '2026-08-27',
    texto: 'Ritmo calibrado en animaciones de landing: la secuencia de 21 días ahora corre a un tempo equilibrado y natural (420ms) para una apreciación visual óptima.',
  },
  {
    version: '1.7.6',
    fecha: '2026-08-27',
    texto: 'Animación en la Landing: la matriz de consistencia "Crea el hábito" ahora se llena de forma secuencial cuadrito por cuadrito con animación y check dinámico.',
  },
  {
    version: '1.7.5',
    fecha: '2026-08-27',
    texto: 'Contraste visual en categorías: escala directa y marcada en el gráfico de tarjetas del Dashboard para ver con total claridad la diferencia real entre categorías de alto y bajo gasto.',
  },
  {
    version: '1.7.4',
    fecha: '2026-08-27',
    texto: 'Optimización visual del Dashboard: alturas y anchos de tarjetas de categorías ajustados a proporciones compactas y equilibradas para una lectura inmediata a simple vista.',
  },
  {
    version: '1.7.3',
    fecha: '2026-08-27',
    texto: 'Gráfico visual de categorías en el Dashboard: las tarjetas ahora tienen alturas proporcionales a su volumen de gasto alineadas al fondo, creando un gráfico de barras vivo y dinámico.',
  },
  {
    version: '1.7.2',
    fecha: '2026-08-27',
    texto: 'Animación fluida en la landing: cápsula de gastos deslizante con entrada suave, matriz de consistencia con efecto ola y carrusel continuo deslizante para el panorama completo de categorías.',
  },
  {
    version: '1.7.1',
    fecha: '2026-08-27',
    texto: 'Claridad financiera: el Dashboard ahora destaca como cifra principal el dinero disponible real de la persona (patrimonio total en bancos y efectivo).',
  },
  {
    version: '1.7.0',
    fecha: '2026-08-27',
    texto: 'Emojis en categorías y movimientos: personaliza tus categorías con cualquier emoji, disfruta de tarjetas de categorías con colores vivos y un carrusel deslizable con scrollbar discreto y elegante.',
  },
  {
    version: '1.6.1',
    fecha: '2026-08-27',
    texto: 'Optimización de rendimiento del empaquetado Vite, corrección de dependencias en hooks de audio y sincronización más rápida de preferencias en la nube.',
  },
  {
    version: '1.6.0',
    fecha: '2026-08-27',
    texto: 'Finanzas en Pareja y Espacios Compartidos: lleva las cuentas claras y saldos 50/50 con tu pareja o roommates en mercados, viajes y hogar. Además, carrusel deslizable con todas las categorías en el Dashboard y pastilla de balances centrada.',
  },
  {
    version: '1.5.0',
    fecha: '2026-08-27',
    texto: 'Rediseño completo del Dashboard: nueva vista minimalista inspirada en las mejores apps fintech, con barras visuales de tus categorías principales, botón para alternar entre gráfica y lista, y botón rápido para registrar gastos.',
  },
  {
    version: '1.4.0',
    fecha: '2026-08-27',
    texto: 'Nueva experiencia animada en la landing: sección interactiva y visual que ilustra en bucle continuo el registro sin esfuerzo, la creación del hábito y la analítica del panorama completo.',
  },
  {
    version: '1.3.0',
    fecha: '2026-08-27',
    texto: 'Ahora puedes marcar tu "Cuenta Principal" favorita en Dinero: se preseleccionará automáticamente al registrar movimientos y mostrará una estrella dorada en tus listas.',
  },
  {
    version: '1.2.0',
    fecha: '2026-08-27',
    texto: 'Captura más inteligente: el sistema ahora infiere la categoría automáticamente mientras escribes la descripción, las categorías se ordenan por las que más usas en una cuadrícula más visual, y si no especificas cuenta te pide confirmar de cuál salió antes de guardar.',
  },
  {
    version: '1.1.5',
    fecha: '2026-08-27',
    texto: 'La importación de extractos bancarios en PDF ahora es directa e inmediata: ya no te pide ingresar una clave ni token de acceso para entrar a la pantalla.',
  },
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
