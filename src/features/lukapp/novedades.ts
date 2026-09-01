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
    version: '2.0.39',
    fecha: '2026-09-01',
    texto: 'El selector de septiembre ya no crece en dos líneas y el PWA renueva correctamente su caché cuando publicamos una versión nueva.',
  },
  {
    version: '2.0.38',
    fecha: '2026-09-01',
    texto: 'Corregimos el aviso de Supabase que podía quedarse pegado después de una lectura temporalmente fallida: cuando la conexión se recupera, la app limpia el mensaje y conserva la persistencia local.',
  },
  {
    version: '2.0.37',
    fecha: '2026-09-01',
    texto: 'Quitamos únicamente el fondo crema del PNG de Luki. La nutria conserva exactamente su dibujo, pero ya se integra con el color de la landing sin verse dentro de un cuadro.',
  },
  {
    version: '2.0.36',
    fecha: '2026-09-01',
    texto: 'Dejamos a Luki tal como fue aprobada: la landing ahora usa únicamente su ilustración PNG original, estática y sin reconstrucciones ni animaciones que cambien su forma.',
  },
  {
    version: '2.0.35',
    fecha: '2026-08-31',
    texto: 'Quitamos del SVG de Luki el fondo blanco que venía de la lámina de Illustrator: ahora la nutria queda transparente e integrada a la landing, sin tarjeta detrás.',
  },
  {
    version: '2.0.34',
    fecha: '2026-08-31',
    texto: 'Luki dejó de verse chato y cuadrado: ahora es la nutria estilizada de la marca, con el torso y el saco más largos, las piernas más abajo y el isotipo bien centrado. Es el mismo dibujo de siempre, solo con las proporciones corregidas.',
  },
  {
    version: '2.0.33',
    fecha: '2026-08-31',
    texto: 'Luki se ve entero y bien encuadrado junto a "Crea tu cuenta": ya no se arma con recortes que le partían el torso. Descansa con una respiración muy leve, te acompaña con la mirada y saluda una sola vez cuando lo tocas.',
  },
  {
    version: '2.0.32',
    fecha: '2026-08-31',
    texto: 'Hicimos natural la animación de Luki: ahora descansa con respiración, parpadeo y cola sutiles; el saludo sucede solo al tocarlo. También respetamos la preferencia de reducir movimiento.',
  },
  {
    version: '2.0.31',
    fecha: '2026-08-31',
    texto: 'Luki dejó de cargarse como un documento incrustado: ahora su SVG vectorial vive directamente en el código de React. También unimos visualmente privacidad y registro para que la mascota no quede flotando aislada.',
  },
  {
    version: '2.0.30',
    fecha: '2026-08-31',
    texto: 'Ajustamos el cierre de la landing: Luki queda más cerca de su mensaje, el título de creación de cuenta siempre se muestra y la sección ya no acumula espacios vacíos entre bloques.',
  },
  {
    version: '2.0.29',
    fecha: '2026-08-31',
    texto: 'Luki ya aparece en la landing como un solo vector transparente e interactivo: conserva su respiración, parpadeo, saludo, cola y caminata, sigue suavemente el cursor y responde al toque sin deformar ni separar la ilustración.',
  },
  {
    version: '2.0.28',
    fecha: '2026-08-31',
    texto: 'Luki ya se anima ensamblado y completo -- respira, parpadea, saluda, mueve la cola y camina sin huecos en ningún cuadro, usando su ilustración real superpuesta sobre sí misma en vez de piezas sueltas.',
  },
  {
    version: '2.0.27',
    fecha: '2026-08-31',
    texto: 'Extrajimos 43 piezas reales de Luki desde el archivo vectorial luki-plantilla3.ai (torso, saco, brazos, manos con dedos, piernas, cola en segmentos, isotipo y cabeza completa) con mapa de capas, pivotes y una demo de animación por pieza.',
  },
  {
    version: '2.0.26',
    fecha: '2026-08-31',
    texto: 'Añadimos una guía de animación de respaldo con variantes faciales, manos, pies, cola y poses para preparar el rig de Luki.',
  },
  {
    version: '2.0.25',
    fecha: '2026-08-31',
    texto: 'Guardamos un respaldo exacto de la guía completa de rigging de Luki para proteger el trabajo antes de continuar editando.',
  },
  {
    version: '2.0.24',
    fecha: '2026-08-31',
    texto: 'Ampliamos la guía de Luki con solapes ocultos, variantes de manos y pies, segmentos de cola y expresiones faciales para un rig más robusto.',
  },
  {
    version: '2.0.23',
    fecha: '2026-08-31',
    texto: 'Creamos una lámina específica con torso, saco, brazos, mangas, piernas y base de cola para vectorizar manualmente a Luki.',
  },
  {
    version: '2.0.22',
    fecha: '2026-08-31',
    texto: 'Rehicimos la guía de piezas de Luki a partir del vector real de la mascota, no de una recreación: cabeza, ojos, manos, pies, isotipo y más, listos para redibujar y animar.',
  },
  {
    version: '2.0.21',
    fecha: '2026-08-31',
    texto: 'Los errores al guardar comprobantes ahora indican exactamente qué migración de Supabase falta cuando la base está atrasada.',
  },
  {
    version: '2.0.20',
    fecha: '2026-08-31',
    texto: 'Limpiamos la guía de rigging de Luki y eliminamos todos los puntos, marcadores y símbolos visuales de las piezas.',
  },
  {
    version: '2.0.19',
    fecha: '2026-08-31',
    texto: 'Generamos una guía de rigging ampliada para Luki con piezas, articulaciones y poses de movimiento listas para vectorización detallada.',
  },
  {
    version: '2.0.18',
    fecha: '2026-08-31',
    texto: 'Añadimos una guía visual de piezas de Luki para facilitar su vectorización modular y posterior animación.',
  },
  {
    version: '2.0.17',
    fecha: '2026-08-31',
    texto: 'Convertimos la ilustración final de Luki saludando en un SVG por piezas —cabeza, orejas, ojos, brazos, cola, saco e isotipo— lista para animarse, extraída del arte aprobado sin redibujar nada.',
  },
  {
    version: '2.0.16',
    fecha: '2026-08-31',
    texto: 'Reconstruimos a Luki con anatomía real de nutria: cabeza compacta, cuello marcado, cuerpo delgado y cola en punta, lista para animarse (respiración, parpadeo, ojos que siguen el cursor, saludo).',
  },
  {
    version: '2.0.15',
    fecha: '2026-08-31',
    texto: 'Redibujamos a Luki de cero para que coincida con el arte de referencia: cara, orejas, brazos, cola y logo del pecho ya no se ven deformes.',
  },
  {
    version: '2.0.14',
    fecha: '2026-08-31',
    texto: 'Ajustamos a Luki a la silueta de nutria solicitada: cabeza compacta, torso vertical estrecho, ojos pequeños y cola larga puntiaguda, conservando el isotipo oficial.',
  },
  {
    version: '2.0.13',
    fecha: '2026-08-31',
    texto: 'Reconstruimos a Luki como un sistema SVG modular y editable, con expresiones, poses, pivotes y ejemplos listos para animación web.',
  },
  {
    version: '2.0.12',
    fecha: '2026-08-31',
    texto: 'Creamos una propuesta simplificada de Luki, pensada para convertirse en SVG por capas y animarse fácilmente en la web.',
  },
  {
    version: '2.0.11',
    fecha: '2026-08-31',
    texto: 'Presentamos el nuevo concepto 2D de Luki: una nutria tierna con saco morado de LukApp, diseñada como referencia para futuras animaciones expresivas.',
  },
  {
    version: '2.0.10',
    fecha: '2026-08-31',
    texto: 'Retiramos por completo la mascota actual de la landing para dejar el espacio limpio antes de construir la nueva versión.',
  },
  {
    version: '2.0.9',
    fecha: '2026-08-31',
    texto: 'Los extractos ahora comparan lo que ya anotaste, completan ese movimiento sin duplicarlo y permiten asociar los movimientos nuevos a una cuenta.',
  },
  {
    version: '2.0.8',
    fecha: '2026-08-31',
    texto: 'Corregimos el aviso de conexión con la base de datos: ahora explica cuando faltan migraciones, sin decir por error que toda la base está vacía.',
  },
  {
    version: '2.0.7',
    fecha: '2026-08-30',
    texto: 'Un movimiento recién guardado ya no puede desaparecer si una sincronización anterior termina unos segundos después.',
  },
  {
    version: '2.0.6',
    fecha: '2026-08-30',
    texto: 'También afinamos los gestos táctiles para que, al cambiar de pantalla, no se queden escuchando una referencia anterior.',
  },
  {
    version: '2.0.5',
    fecha: '2026-08-30',
    texto: 'Cada actualización de LukApp ahora renueva el caché de la app instalada, evitando que una PWA conserve archivos antiguos.',
  },
  {
    version: '2.0.4',
    fecha: '2026-08-30',
    texto: 'Los abonos a tarjeta ahora también se aplican a la cuota pendiente del mes, para que el aviso no te cobre dos veces lo que ya pagaste.',
  },
  {
    version: '2.0.3',
    fecha: '2026-08-30',
    texto: 'Si una pantalla falla inesperadamente, LukApp ya no queda en blanco: explica cómo volver a abrirla sin poner en riesgo tus datos guardados.',
  },
  {
    version: '2.0.2',
    fecha: '2026-08-30',
    texto: 'El dictado ahora se recupera si el micrófono se desconecta de golpe, sin quedarse bloqueado ni intentar guardar una nota incompleta.',
  },
  {
    version: '2.0.1',
    fecha: '2026-08-30',
    texto: 'Las tarjetas ahora unen las compras registradas por voz o comprobante con el saldo y muestran, en un solo lugar, qué cuota debes pagar este mes.',
  },
  {
    version: '2.0.0',
    fecha: '2026-08-30',
    texto: 'LukApp 2.0 renueva las tarjetas: calcula cada cuota por mes, separa la deuda del efectivo disponible y hace más claro qué debes pagar.',
  },
  {
    version: '1.17.0',
    fecha: '2026-08-30',
    texto: 'Las compras a cuotas ahora conservan su pago mensual. Las tarjetas muestran ese aviso y ya no reducen tu dinero disponible hasta que pagues.',
  },
  {
    version: '1.16.3',
    fecha: '2026-08-30',
    texto: 'Los comprobantes a cuotas ahora limpian los símbolos que el lector confunde con texto antes del nombre del comercio.',
  },
  {
    version: '1.16.2',
    fecha: '2026-08-30',
    texto: 'El análisis de imágenes ya no culpa a una foto nítida por fallos técnicos: reintenta con el archivo original y explica el problema real.',
  },
  {
    version: '1.16.1',
    fecha: '2026-08-30',
    texto: 'Cancelar el selector de fotos ya no bloquea la cámara: puedes volver a abrir Archivos y elegir tu comprobante enseguida.',
  },
  {
    version: '1.16.0',
    fecha: '2026-08-30',
    texto: 'Nueva sección de Tarjetas de crédito: consulta cuántas tienes, la deuda total, cada banco y agrega tarjetas para registrar tus compras.',
  },
  {
    version: '1.15.0',
    fecha: '2026-08-30',
    texto: 'Los comprobantes de tarjeta a cuotas ahora detectan el total real de la compra, conservan el comercio limpio y permiten cargarla directamente a tu tarjeta de crédito.',
  },
  {
    version: '1.14.0',
    fecha: '2026-08-30',
    texto: 'Las transferencias entre tus cuentas ahora también aparecen en el historial, claramente marcadas y sin alterar tus gastos ni ingresos.',
  },
  {
    version: '1.13.4',
    fecha: '2026-08-30',
    texto: 'El check del dictado ahora responde al instante: detiene la escucha de forma segura y muestra que está confirmando tu voz.',
  },
  {
    version: '1.13.3',
    fecha: '2026-08-30',
    texto: 'La confirmación de transferencias ahora tiene un fondo sólido y más contraste para leerse con claridad.',
  },
  {
    version: '1.13.2',
    fecha: '2026-08-30',
    texto: 'La voz ahora muestra una lectura previa más rápido y evita reenvíos lentos cuando el servidor rechaza el audio.',
  },
  {
    version: '1.13.1',
    fecha: '2026-08-30',
    texto: 'Afinamos la voz para transferencias: conserva más claridad con buena señal y reconoce variaciones fonéticas de Nequi y Bancolombia sin convertirlas en gasto.',
  },
  {
    version: '1.13.0',
    fecha: '2026-08-30',
    texto: 'Ahora puedes transferir entre tus cuentas por voz: di el monto, la cuenta de origen y la de destino, y confirma para actualizar ambos saldos.',
  },
  {
    version: '1.12.0',
    fecha: '2026-08-30',
    texto: 'Registro por imagen completo: analiza fotos, facturas y comprobantes, identifica el total y te muestra si detectó un ingreso o un gasto antes de guardarlo.',
  },
  {
    version: '1.11.37',
    fecha: '2026-08-30',
    texto: 'Mejoramos el control de versiones: cada entrega queda identificada también en el mensaje de su commit.',
  },
  {
    version: '1.11.36',
    fecha: '2026-08-30',
    texto: 'La app instalada ahora abre directamente tu Dashboard. Las instalaciones anteriores también se corrigen al iniciar.',
  },
  {
    version: '1.11.35',
    fecha: '2026-08-30',
    texto: 'Reforzamos las pruebas del micrófono: ahora cubren señal caída, desconexión abrupta, permisos, audio vacío, reintentos y transcripción parcial.',
  },
  {
    version: '1.11.34',
    fecha: '2026-08-30',
    texto: 'Mejoramos el registro por voz y foto: reconoce frases como “me dio” y “me transfirió” como ingresos, usa menos datos en señal débil y lee comprobantes con más claridad.',
  },
  {
    version: '1.11.33',
    fecha: '2026-08-28',
    texto: 'Pose de fuerza oficial de Luki: clonado milimétrico de la referencia de marca (cabeza espátula inclinada, ojos en coronilla, brazos en flexión y barriga continua).',
  },
  {
    version: '1.11.32',
    fecha: '2026-08-28',
    texto: 'Modelado facial refinado de Luki: sonrisa tallada continua, mandíbula esculpida, ojos expresivos integrados y conexión anatómica natural de hombros.',
  },
  {
    version: '1.11.31',
    fecha: '2026-08-28',
    texto: 'Acabado mate de arcilla y ultra-alta resolución para Luki: texturizado sin reflejos agresivos, mallas densas (128 sectores) y renderizado DPI 3x.',
  },
  {
    version: '1.11.30',
    fecha: '2026-08-28',
    texto: 'Curvas ultra-suaves para Luki: modelado fluido de alta resolución sin aristas duras, torso torneado continuo, ojos y hocico tiernos y acabado de vinilo suave.',
  },
  {
    version: '1.11.29',
    fecha: '2026-08-28',
    texto: 'Suavizado orgánico total de Luki: malla continua de cuerpo y cabeza sin esferas de corte, degradado integrado de barriga lila y extremidades fluidas.',
  },
  {
    version: '1.11.28',
    fecha: '2026-08-28',
    texto: 'Rediseñamos a Luki fiel a su hoja de referencia de marca: hocico alargado de gecko, ojos elevados en cuencas, 4 dedos con almohadillas esféricas, cola curvada y barriga lila continua.',
  },
  {
    version: '1.11.27',
    fecha: '2026-08-28',
    texto: 'Completamos a Luki en 3D: pose en tres cuartos, asimetrías naturales, hocico estilizado, ojos expresivos y animaciones interactivas en código.',
  },
  {
    version: '1.11.26',
    fecha: '2026-08-28',
    texto: 'Pulimos el modelo 3D de Luki con torso proporcional, cuello continuo, reflejos suaves y movimiento natural de la cabeza.',
  },
  {
    version: '1.11.25',
    fecha: '2026-08-28',
    texto: 'Ajustamos la pose 3D de Luki con brazos continuos, ojos más cercanos y una cola de curva suave terminada en punta.',
  },
  {
    version: '1.11.24',
    fecha: '2026-08-28',
    texto: 'Luki ahora es un personaje 3D real: tiene mallas, luces, profundidad, cola puntiaguda y animaciones sin usar imágenes.',
  },
  {
    version: '1.11.23',
    fecha: '2026-08-28',
    texto: 'Reconstruimos la pose base de Luki: hocico bajo, ojos más vivos, brazos en flexión y silueta de lagartija esbelta.',
  },
  {
    version: '1.11.22',
    fecha: '2026-08-28',
    texto: 'Afinamos la cola y las extremidades de Luki para recuperar una silueta delgada, dinámica y más cercana a la referencia.',
  },
  {
    version: '1.11.21',
    fecha: '2026-08-28',
    texto: 'Redibujamos el torso de Luki con hombros y cadera más suaves, manteniendo el cuello estrecho de la referencia.',
  },
  {
    version: '1.11.20',
    fecha: '2026-08-28',
    texto: 'Pulimos el volumen de Luki con luz radial en la cabeza y una sombra suave bajo los pies, sin añadir rasgos nuevos.',
  },
  {
    version: '1.11.19',
    fecha: '2026-08-28',
    texto: 'Reconstruimos la unión de cabeza y cuello de Luki y cambiamos las patas por pies pequeños con dedos definidos.',
  },
  {
    version: '1.11.18',
    fecha: '2026-08-28',
    texto: 'Ajustamos el violeta de Luki con los tonos reales de la referencia para que el personaje se sienta más suave y natural.',
  },
  {
    version: '1.11.17',
    fecha: '2026-08-28',
    texto: 'Afinamos la silueta de Luki para acercarla a la referencia: cabeza baja, proporción horizontal y cola curva.',
  },
  {
    version: '1.11.16',
    fecha: '2026-08-28',
    texto: 'Mejoramos la comprobación de las acciones de Luki para asegurar que sus gestos se activen desde el componente SVG.',
  },
  {
    version: '1.11.15',
    fecha: '2026-08-28',
    texto: 'Retiramos los recursos de imagen de Luki: la mascota de la landing vive íntegramente en código SVG.',
  },
  {
    version: '1.11.14',
    fecha: '2026-08-28',
    texto: 'Luki vuelve a estar hecho completamente en código: respira, parpadea y cambia de acción sin usar imágenes.',
  },
  {
    version: '1.11.13',
    fecha: '2026-08-28',
    texto: 'Luki ahora respira, parpadea, alterna acciones y celebra cuando la tocas en la landing.',
  },
  {
    version: '1.11.12',
    fecha: '2026-08-28',
    texto: 'La pose maestra de Luki se muestra ahora directamente en la landing con su composición original.',
  },
  {
    version: '1.11.11',
    fecha: '2026-08-28',
    texto: 'Luki vuelve a quedar al frente de la sección de registro, sin que los fondos decorativos oculten su pose.',
  },
  {
    version: '1.11.10',
    fecha: '2026-08-28',
    texto: 'Actualizamos la carga de Luki para que la pose aprobada se vea siempre completa, incluso después de cambios de diseño.',
  },
  {
    version: '1.11.9',
    fecha: '2026-08-28',
    texto: 'Corregimos la visualización de la pose maestra de Luki para que se muestre completa en todos los navegadores.',
  },
  {
    version: '1.11.8',
    fecha: '2026-08-28',
    texto: 'Luki usa ahora su pose maestra aprobada en la landing, conservando exactamente su silueta y expresión.',
  },
  {
    version: '1.11.7',
    fecha: '2026-08-28',
    texto: 'Ajustamos la pose de Luki: cabeza y mandíbula más finas, ojos más juntos, cuerpo compacto y cola más alta.',
  },
  {
    version: '1.11.6',
    fecha: '2026-08-28',
    texto: 'Rediseñamos a Luki con una silueta más fiel: cabeza baja, mandíbula fina, cuerpo compacto y brazos flexionados.',
  },
  {
    version: '1.11.5',
    fecha: '2026-08-28',
    texto: 'Luki ahora aparece tanto en el cierre público como en el registro, para acompañarte sin importar cómo llegues a la landing.',
  },
  {
    version: '1.11.4',
    fecha: '2026-08-28',
    texto: 'Luki suma gestos animables: puede saludar, tener una idea, perder el equilibrio o marearse según lo que pase en la web.',
  },
  {
    version: '1.11.3',
    fecha: '2026-08-28',
    texto: 'Luki ya acompaña el cierre de la landing: parpadea, sigue tu cursor y celebra cuando la tocas.',
  },
  {
    version: '1.11.2',
    fecha: '2026-08-28',
    texto: 'Luki ya es interactiva: parpadea, sigue el cursor y cambia de gesto para acompañar la experiencia de la web.',
  },
  {
    version: '1.11.1',
    fecha: '2026-08-28',
    texto: 'Nueva mascota de LukApp: una lagartija violeta expresiva, con una hoja de gestos lista para usarse en la web.',
  },
  {
    version: '1.11.0',
    fecha: '2026-08-28',
    texto: 'Base técnica para espacios compartidos reales: invitaciones seguras por enlace, membresías separadas y permisos para colaborar sin exponer las finanzas personales.',
  },
  {
    version: '1.10.3',
    fecha: '2026-08-28',
    texto: 'Protegemos tus datos: una respuesta vacía o incompleta del servidor ya no reemplaza silenciosamente tus cuentas, saldos ni movimientos guardados en el dispositivo.',
  },
  {
    version: '1.10.2',
    fecha: '2026-08-28',
    texto: 'Corregimos los ingresos dictados como “me pagó” o “me devolvieron” y reforzamos la carga del isotipo y el logotipo en la pantalla de acceso.',
  },
  {
    version: '1.10.1',
    fecha: '2026-08-28',
    texto: 'Navegación más libre: puedes abrir y compartir la landing de LukApp aunque ya tengas una sesión iniciada; “Ir a mi app” te devuelve a tus finanzas sin recargar.',
  },
  {
    version: '1.10.0',
    fecha: '2026-08-28',
    texto: 'Extractos de bancos colombianos con IA: reconoce cada movimiento por separado, con comercio o contraparte, categoría, referencia y explicación para revisarlo antes de importarlo.',
  },
  {
    version: '1.9.6',
    fecha: '2026-08-28',
    texto: 'Inicio limpio y cifras más claras: no se crean datos de ejemplo, las cuentas distinguen efectivo, banco y billetera, y los paneles explican saldo, disponible y balance del período.',
  },
  {
    version: '1.9.5',
    fecha: '2026-08-27',
    texto: 'Deslizamiento horizontal fluido: discriminación inteligente de gestos táctiles para navegar carruseles y categorías sin activar el gesto de recarga accidentalmente.',
  },
  {
    version: '1.9.4',
    fecha: '2026-08-27',
    texto: 'Simplificación de experiencia: eliminación del módulo de Asesor Fiscal/DIAN para mantener la app sencilla, rápida y enfocada en lo cotidiano.',
  },
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
