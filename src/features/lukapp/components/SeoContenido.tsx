import React, { useEffect } from 'react';

interface ArticuloSeo {
  slug: string;
  titulo: string;
  descripcion: string;
  resumen: string;
  secciones: { titulo: string; texto: string }[];
  faq: { pregunta: string; respuesta: string }[];
}

export const ARTICULOS_SEO: readonly ArticuloSeo[] = [
  { slug: 'presupuesto-mensual-colombia', titulo: 'Cómo hacer un presupuesto mensual en Colombia', descripcion: 'Aprende a organizar tus ingresos, gastos fijos, gastos variables y metas de ahorro con un presupuesto mensual práctico.', resumen: 'Un presupuesto mensual te permite saber cuánto dinero entra, cuánto sale y qué puedes reservar para tus metas. No necesitas una hoja de cálculo complicada: necesitas un método que puedas revisar cada semana.', secciones: [
    { titulo: '1. Calcula tus ingresos reales', texto: 'Anota el dinero que recibes después de descuentos: salario, honorarios, ventas y otros ingresos. Si varían, usa un promedio conservador de los últimos tres meses.' },
    { titulo: '2. Separa gastos fijos y variables', texto: 'Arriendo, servicios, deudas y suscripciones son gastos fijos. Mercado, transporte, comidas fuera y entretenimiento suelen variar. Separarlos muestra dónde tienes margen para ajustar.' },
    { titulo: '3. Define límites y revisa el avance', texto: 'Asigna un límite a cada categoría y revisa tus movimientos durante el mes. Registrar cada gasto por voz en LukApp hace que el presupuesto se mantenga actualizado sin esfuerzo.' },
  ], faq: [{ pregunta: '¿Cuánto debería ahorrar al mes?', respuesta: 'Empieza con una cantidad sostenible, aunque sea pequeña, y aumenta el porcentaje cuando conozcas mejor tus gastos.' }, { pregunta: '¿Es necesario registrar todos los gastos?', respuesta: 'Sí, especialmente los pequeños: juntos pueden representar una parte importante del presupuesto.' }] },
  { slug: 'calcular-4x1000', titulo: 'Cómo calcular el 4x1000 en Colombia', descripcion: 'Qué es el 4x1000, cómo se calcula y cómo llevar un registro claro de tus movimientos financieros en Colombia.', resumen: 'El 4x1000 es un gravamen de cuatro pesos por cada mil pesos de una transacción financiera gravada. Entenderlo ayuda a revisar tus extractos y conocer el costo real de mover tu dinero.', secciones: [
    { titulo: 'La fórmula del 4x1000', texto: 'Para estimarlo, multiplica el valor de la operación por 0,004. Por ejemplo, una transacción de $1.000.000 equivale a aproximadamente $4.000 de gravamen, cuando aplica.' },
    { titulo: 'Revisa tus extractos', texto: 'El cobro puede aparecer con nombres como GMF o 4x1000. Llevar tus movimientos organizados por cuenta y fecha facilita comparar el cobro con la transacción.' },
    { titulo: 'Planea tus movimientos', texto: 'LukApp te ayuda a registrar gastos e ingresos y a consultar el total de tus movimientos. Recuerda que las exenciones y condiciones dependen de la normativa y de tu situación bancaria.' },
  ], faq: [{ pregunta: '¿El 4x1000 siempre se cobra?', respuesta: 'No necesariamente. Existen operaciones y condiciones especiales; confirma tu caso con tu entidad financiera o un profesional tributario.' }, { pregunta: '¿LukApp cobra el 4x1000?', respuesta: 'No. LukApp solo ofrece una herramienta informativa para registrar y entender tus movimientos.' }] },
  { slug: 'controlar-gastos-personales', titulo: 'Cómo controlar los gastos personales', descripcion: 'Método sencillo para registrar, categorizar y reducir gastos personales sin dejar de disfrutar tu dinero.', resumen: 'Controlar gastos no significa dejar de gastar: significa decidir con anticipación qué merece tu dinero. El primer paso es convertir cada compra en información útil.', secciones: [
    { titulo: 'Registra en el momento', texto: 'Anotar una compra al final del día suele hacer que se olviden los gastos pequeños. Con el registro por voz puedes decir qué compraste, cuánto costó y cuándo ocurrió.' },
    { titulo: 'Usa categorías consistentes', texto: 'Comida, transporte, vivienda, salud, ocio y deudas son un buen comienzo. Mantener pocas categorías claras hace que los reportes sean más útiles.' },
    { titulo: 'Busca patrones, no culpas', texto: 'Revisa tus gastos al cierre de cada semana. Identifica suscripciones, compras repetidas o categorías que superan tu límite y decide un cambio concreto para el siguiente periodo.' },
  ], faq: [{ pregunta: '¿Cómo empiezo si nunca he llevado mis gastos?', respuesta: 'Registra durante siete días sin intentar cambiar nada. Después tendrás una primera fotografía real de tus hábitos.' }] },
  { slug: 'mejores-apps-finanzas-personales', titulo: 'Mejores apps de finanzas personales en Colombia', descripcion: 'Qué debes buscar en una app de finanzas personales: privacidad, registro rápido, presupuestos, reportes y adaptación a Colombia.', resumen: 'La mejor app de finanzas personales es la que puedes usar de forma constante y te ayuda a tomar decisiones. Antes de elegir, revisa cómo registra tus datos, qué funciones necesitas y si se adapta a pesos colombianos.', secciones: [
    { titulo: 'Funciones que realmente importan', texto: 'Busca registro de ingresos y gastos, categorías, presupuestos, metas de ahorro, reportes y exportación. El registro por voz puede ser decisivo si abandonas otras apps por lo demorado de escribir.' },
    { titulo: 'Privacidad y control de datos', texto: 'Lee si la aplicación se conecta al banco, qué información almacena y cómo puedes eliminarla. LukApp no se conecta directamente a tu banco: tú decides qué registrar o qué extracto importar.' },
    { titulo: 'Una opción hecha para Colombia', texto: 'Una herramienta local debe manejar pesos colombianos, referencias a bancos del país y cálculos como el 4x1000. También debe funcionar bien desde el celular.' },
  ], faq: [{ pregunta: '¿LukApp tiene un plan gratuito?', respuesta: 'Puedes crear una cuenta y comenzar a organizar tus finanzas personales sin tarjeta.' }] },
  { slug: 'organizar-gastos-en-pareja', titulo: 'Cómo organizar los gastos en pareja', descripcion: 'Guía para dividir gastos, conversar sobre dinero y organizar finanzas personales y compartidas en pareja.', resumen: 'Organizar las finanzas en pareja requiere acuerdos claros, no necesariamente una sola cuenta. Definan qué comparten, qué conserva cada persona y cómo revisarán el avance.', secciones: [
    { titulo: 'Acuerden reglas sencillas', texto: 'Decidan cómo dividir vivienda, servicios, mercado y metas. Puede ser 50/50 o proporcional a los ingresos; lo importante es que ambos entiendan el acuerdo.' },
    { titulo: 'Mantengan espacios personales', texto: 'Compartir algunos gastos no obliga a renunciar a la privacidad. Una buena organización permite ver lo común y conservar autonomía sobre los gastos personales.' },
    { titulo: 'Revisen juntos una vez al mes', texto: 'Una conversación breve sobre lo gastado evita que los problemas se acumulen. Usen categorías y metas visibles para hablar de decisiones, no de reproches.' },
  ], faq: [{ pregunta: '¿Hay que mezclar todo el dinero?', respuesta: 'No. Pueden compartir solo los gastos y metas que acuerden, manteniendo cuentas personales separadas.' }] },
  { slug: 'importar-extractos-bancarios', titulo: 'Cómo importar extractos bancarios PDF', descripcion: 'Pasos para organizar tus movimientos a partir de un extracto bancario PDF y revisar tus finanzas con más claridad.', resumen: 'Los extractos bancarios contienen información valiosa sobre tus hábitos. Importarlos evita digitar cada movimiento y te permite analizar un periodo completo.', secciones: [
    { titulo: 'Descarga el extracto oficial', texto: 'Entra al canal digital de tu banco, selecciona la cuenta y el periodo, y descarga el documento PDF original. Evita compartirlo públicamente: contiene información sensible.' },
    { titulo: 'Revisa antes de importar', texto: 'Confirma que el periodo y la cuenta sean correctos. Después de importar, compara algunos movimientos y corrige categorías o descripciones que necesiten contexto.' },
    { titulo: 'Convierte datos en decisiones', texto: 'Con los movimientos organizados puedes ver gastos por categoría, ingresos, pagos repetidos y oportunidades de ahorro. LukApp está diseñada para trabajar con extractos de bancos colombianos.' },
  ], faq: [{ pregunta: '¿LukApp se conecta a mi banco?', respuesta: 'No. La importación parte del PDF que tú eliges cargar y LukApp no accede directamente a tu cuenta bancaria.' }] },
  { slug: 'como-ahorrar-dinero-colombia', titulo: 'Cómo ahorrar dinero en Colombia', descripcion: 'Estrategias realistas para ahorrar dinero en Colombia, reducir fugas y avanzar hacia una meta financiera.', resumen: 'Ahorrar funciona mejor cuando tiene un propósito, una fecha y un monto. Comienza con un diagnóstico de tus gastos y automatiza la decisión de separar dinero.', secciones: [
    { titulo: 'Encuentra tus fugas de dinero', texto: 'Revisa domicilios, suscripciones, compras impulsivas y comisiones. No tienes que eliminar todo: identifica una o dos fugas que puedas reducir sin afectar tus necesidades.' },
    { titulo: 'Crea una meta concreta', texto: '“Ahorrar más” es difícil de medir. Define para qué ahorras, cuánto necesitas y para qué fecha. Divide el total entre los meses disponibles y revisa el progreso.' },
    { titulo: 'Separa el ahorro primero', texto: 'Cuando recibas ingresos, aparta la cantidad definida antes de repartir el resto. Las cajitas y metas de LukApp ayudan a visualizar el avance y mantener la motivación.' },
  ], faq: [{ pregunta: '¿Se puede ahorrar con ingresos variables?', respuesta: 'Sí. Define un mínimo fijo y agrega una proporción de cada ingreso extraordinario.' }] },
];

const rutaBlog = '/blog';
const urlBase = 'https://lukapp.app';

const MetaSeo: React.FC<{ articulo?: ArticuloSeo }> = ({ articulo }) => {
  useEffect(() => {
    const titulo = articulo ? `${articulo.titulo} | LukApp` : 'Blog de finanzas personales en Colombia | LukApp';
    const descripcion = articulo?.descripcion ?? 'Consejos prácticos para controlar gastos, ahorrar y organizar tus finanzas personales en Colombia.';
    document.title = titulo;
    const meta = document.querySelector('meta[name="description"]');
    meta?.setAttribute('content', descripcion);
    const canonical = document.querySelector('link[rel="canonical"]');
    canonical?.setAttribute('href', `${urlBase}${window.location.pathname}`);
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(articulo ? { '@context': 'https://schema.org', '@type': 'Article', headline: articulo.titulo, description: articulo.descripcion, author: { '@type': 'Organization', name: 'LukApp' }, publisher: { '@type': 'Organization', name: 'LukApp' }, mainEntityOfPage: `${urlBase}${window.location.pathname}`, inLanguage: 'es-CO', dateModified: '2026-09-03', speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '.seo-resumen'] } } : { '@context': 'https://schema.org', '@type': 'CollectionPage', name: titulo, description: descripcion, url: `${urlBase}${rutaBlog}` });
    document.head.appendChild(script);
    return () => script.remove();
  }, [articulo]);
  return null;
};

export const SeoContenido: React.FC<{ articulo?: ArticuloSeo }> = ({ articulo }) => (
  <><MetaSeo articulo={articulo} /><main className="seo-pagina"><nav aria-label="Migas de pan"><a href="/">LukApp</a> / <a href="/blog">Blog</a>{articulo ? ` / ${articulo.titulo}` : ''}</nav>{articulo ? <article><p className="seo-etiqueta">Finanzas personales · Colombia</p><h1>{articulo.titulo}</h1><p className="seo-resumen">{articulo.resumen}</p>{articulo.secciones.map((s) => <section key={s.titulo}><h2>{s.titulo}</h2><p>{s.texto}</p></section>)}<section><h2>Preguntas frecuentes</h2>{articulo.faq.map((f) => <div key={f.pregunta}><h3>{f.pregunta}</h3><p>{f.respuesta}</p></div>)}</section><a className="seo-cta" href="/entrar">Crear cuenta gratis en LukApp</a></article> : <><h1>Blog de finanzas personales en Colombia</h1><p className="seo-resumen">Guías claras para controlar gastos, crear presupuestos, ahorrar y entender tus movimientos financieros.</p><section className="seo-lista">{ARTICULOS_SEO.map((a) => <article key={a.slug}><p className="seo-etiqueta">Guía práctica</p><h2><a href={`/blog/${a.slug}`}>{a.titulo}</a></h2><p>{a.descripcion}</p><a href={`/blog/${a.slug}`}>Leer la guía</a></article>)}</section></>}</main></>
);
