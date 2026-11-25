/**
 * Manual de uso de LukApp para el Asesor, partido por temas.
 *
 * El mapa general viaja en cada consulta, pero el manual completo no cabe en la
 * cuota de tokens del proveedor (ver `compactar` en server.ts): por eso cada
 * tema lleva sus palabras clave y solo se adjuntan los que la pregunta toca.
 *
 * Los nombres de botones son los que se ven en pantalla. Si cambias un texto de
 * la interfaz, cámbialo también aquí o Luki mandará a la persona a un botón que
 * ya no existe.
 */

export interface TemaGuia {
  id: string;
  /** Raíces normalizadas (sin tildes, minúsculas); basta con que una aparezca. */
  claves: readonly string[];
  texto: string;
}

export const normalizarGuia = (texto: string): string => texto
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLocaleLowerCase('es-CO');

export const TEMAS_GUIA_LUKAPP: readonly TemaGuia[] = [
  {
    id: 'saldo',
    claves: ['saldo', 'cuadrar', 'ajustar', 'no coincide', 'no cuadra', 'cuanto tengo en', 'corregir lo que tengo'],
    texto: `ACTUALIZAR EL SALDO DE UNA CUENTA (cuando LukApp no coincide con el banco):
1. Abre Dinero y toca la cuenta.
2. En «Saldo actual» toca la cifra grande (tiene la etiqueta Editar).
3. Escribe lo que de verdad tienes (0 si está vacía) y toca Guardar.
LukApp anota la diferencia como un ajuste: no cuenta como gasto ni como ingreso. Se repite por cada cuenta.
Atajo por voz: con el micrófono rojo di «actualiza el saldo de Nequi a 500 mil» y confirma con Actualizar saldo.
Tarjetas de crédito y deudas: ábrelas en Dinero y usa el botón Actualizar saldo. Ahorros: en Dinero > 🐷 Crear ahorro, cada ahorro tiene Actualizar saldo.
Importar extractos sirve para traer movimientos que faltan, no para corregir un saldo.`,
  },
  {
    id: 'anotar',
    claves: ['anotar', 'registrar', 'agregar gasto', 'agregar ingreso', 'nuevo gasto', 'nuevo ingreso', 'dictar', 'voz', 'microfono', 'hablando', 'foto', 'factura', 'comprobante', 'recibo', 'escanear', 'deshacer', 'fecha'],
    texto: `ANOTAR UN GASTO O INGRESO (en Inicio, Dinero o Mes; abajo está la barra flotante):
- A mano: icono de teclado o el botón «Anotar nuevo gasto» en Inicio. Elige Gasto o Ingreso, la cuenta o tarjeta, el monto, «¿En qué fue?» y la categoría; toca Guardar.
- Hablando: micrófono rojo, di el movimiento («gasté 20 mil en almuerzo con Nequi»), toca Terminé y luego Revisar movimiento. Si dices varios en una frase, salen juntos para guardarlos de una vez.
- Con foto: icono de cámara; LukApp lee el comprobante y te deja revisarlo antes de guardar.
- Justo después de guardar aparece Deshacer por unos segundos.
- La captura queda con fecha de hoy. Para otra fecha dilo al dictar («ayer») o guarda y luego cambia la Fecha con Editar.
- Desde el Asesor también: escribe «pagué 70 mil en comida» y toca Revisar y editar movimiento; se guarda solo cuando tú tocas Guardar.`,
  },
  {
    id: 'editar-movimiento',
    claves: ['editar movimiento', 'borrar movimiento', 'eliminar movimiento', 'cambiar movimiento', 'corregir movimiento', 'me equivoque', 'movimiento mal', 'cambiar la categoria de', 'repetir', 'buscar', 'encontrar un movimiento'],
    texto: `EDITAR, BORRAR O BUSCAR MOVIMIENTOS:
- Toca el movimiento en la lista de Inicio. Verás Analizar, Editar y Borrar.
- Editar permite cambiar Monto, Gasto/Ingreso, Categoría, cuenta, Descripción y Fecha; termina con Guardar cambios.
- Borrar lo elimina de inmediato, sin pedir confirmación.
- En la lista: desliza a la derecha para Repetir (lo copia con fecha de hoy) y a la izquierda para Editar.
- Buscar: la lupa en Inicio o en la barra flotante. Busca en todo el historial y filtra por Todo / Solo gastos / Solo ingresos, categoría y cuenta.
- Los traslados entre tus cuentas no se pueden editar desde el detalle.`,
  },
  {
    id: 'cuentas',
    claves: ['cuenta', 'banco', 'billetera', 'nequi', 'daviplata', 'bancolombia', 'efectivo', 'principal', 'eliminar cuenta', 'borrar cuenta'],
    texto: `CUENTAS (en Dinero):
- Crear: Dinero > Agregar cuenta > Agregar cuenta. Pon Nombre, Tipo de cuenta (Cuenta bancaria, Billetera digital o Efectivo) y cuánto tienes; toca Crear cuenta.
- Ya existe una cuenta «Efectivo» para la plata en la mano.
- Editar nombre, ícono o marcarla como depósito de bajo monto (4x1000): abre la cuenta y toca el lápiz.
- Cuenta principal: dentro de la cuenta, Activar cuenta principal ⭐. Sale preseleccionada al anotar.
- Eliminar: dentro de la cuenta, Eliminar cuenta. Los movimientos se conservan, pero quedan sin cuenta. No hay opción de archivar.
- Pasar plata entre cuentas: abre la cuenta de origen > Enviar dinero a otra cuenta > elige destino y monto > Enviar. Necesitas al menos 2 cuentas. También por voz: «pasa 100 mil de Nequi a Bancolombia».`,
  },
  {
    id: 'tarjetas',
    claves: ['tarjeta', 'credito', 'cupo', 'corte', 'cuota', 'visa', 'mastercard', 'pagar la tarjeta', 'abonar', 'deuda', 'prestamo', 'debo'],
    texto: `TARJETAS DE CRÉDITO Y DEUDAS (en Dinero):
- Abre Dinero > Tarjetas de crédito. Crear: Agregar tarjeta de crédito, con Nombre y cuánto debes ahora; toca Crear.
- Cupo, Pago mínimo, Día de corte y Día de pago se ponen después con el lápiz de la tarjeta > Guardar cambios.
- Cada tarjeta tiene Registrar compra (con cuotas e interés), Abonar (elige de qué cuenta sale el pago) y Actualizar saldo.
- También puedes anotar una compra eligiendo la tarjeta como cuenta al anotar, o pagar por voz: «abona 200 mil a la Visa desde Nequi».
- Las deudas que ya aparecen en Dinero se abren tocándolas y tienen Abonar y Actualizar saldo.`,
  },
  {
    id: 'ahorros',
    claves: ['ahorro', 'cajita', 'bolsillo', 'inversion', 'invertir', 'cdt', 'rendimiento', 'depositar', 'retirar', 'meta'],
    texto: `AHORROS, INVERSIONES Y METAS (en Dinero):
- Crear un ahorro: Dinero > 🐷 Crear ahorro > 🐷 Crear ahorro. Elige Ahorro o Inversión, nombre, con cuánto empiezas y una meta opcional. En «Avanzado» puedes poner la tasa E.A. si genera rendimientos.
- En esa misma pantalla, cada ahorro tiene Actualizar saldo, Depositar, Retirar, Rendimiento, Valorar 📊 y Transferir; elige uno y toca Guardar.
- Para mover plata desde el banco al ahorro: abre la cuenta del banco > Enviar dinero a otra cuenta > elige el ahorro.
- Metas: Dinero > Metas de ahorro > Nueva meta (nombre, objetivo, fecha opcional). Puede seguir el saldo de un ahorro o llevarse a mano tocando «Ahorrado». Se borra con la caneca.
- Luki puede dejarte una meta lista para confirmar en el chat.`,
  },
  {
    id: 'mes',
    claves: ['balance', 'tope', 'presupuesto', 'limite', 'alerta', 'pago fijo', 'pagos fijos', 'recurrente', 'suscripcion', 'calendario', 'proximos pagos', 'proyeccion', 'tendencia', 'resumen', 'wrapped', 'excel'],
    texto: `MES (balance, topes y pagos fijos):
- Arriba cambias de período con las flechas; el icono de calendario abre el Calendario financiero (vista Día, Semana o Mes).
- Balance del período: Entró y Salió. Debajo, en qué se te va y de dónde entra, los días con gasto y las tendencias de 3, 6 o 12 meses.
- Topes de gasto: toca una categoría en «Sin presupuesto establecido», escribe el máximo por período y Guardar. Tocar un tope existente da Editar presupuesto o Quitar presupuesto. Ahí mismo están las Alertas de presupuesto y el Umbral de alerta. Luki puede dejarte un tope listo para confirmar.
- Pagos fijos: Mes > Pagos fijos > Nuevo recurrente (qué es, cuánto, qué día, si sale o entra, categoría y cuenta) > Guardar. Cuando pasa la fecha, toca Sí pasó para registrarlo. No se editan: se borran y se crean de nuevo.
- Proyección financiera: cómo podría verse tu liquidez.
- «Tu resumen de {mes}» se abre en los últimos días del mes.
- Exportar el período a Excel con el botón del final.`,
  },
  {
    id: 'extractos',
    claves: ['extracto', 'importar', 'pdf', 'csv', 'xlsx', 'excel', 'archivo', 'correo', 'historial antiguo'],
    texto: `IMPORTAR EXTRACTOS (Dinero > Importar extractos, o dentro de una cuenta: Importar extracto de esta cuenta):
- Elegir archivos: PDF, fotos, Excel .xlsx o CSV, varios a la vez.
- Elige a qué cuenta pertenece. «Importar como historial antiguo» trae los movimientos sin cambiar el saldo.
- Si el PDF tiene clave, escríbela y toca Desbloquear PDF.
- Revisa los posibles repetidos y termina con Importar N movimientos.
- No crea cuentas nuevas: crea la cuenta antes en Dinero.`,
  },
  {
    id: 'compartir',
    claves: ['pareja', 'compartid', 'espacio', 'vaca', 'vaquita', 'dividir', 'propina', 'amigos', 'paseo', 'asado', 'saldar'],
    texto: `GASTOS COMPARTIDOS (Dinero > Compartir gastos e impuestos):
- Finanzas en Pareja / Compartidas: Nuevo espacio > nombre > Crear espacio. Invita con Vincular pareja o WhatsApp. Anotar gasto compartido: monto, quién pagó y, si quieres, anotar tu mitad en tus gastos. Saldar a $0 deja las cuentas en cero.
- Vaquitas y Gastos Compartidos: Armar una Vaquita nueva con la meta y los amigos; marca quién pagó y anota gastos. Se guardan en este celular.
- Dividir cuenta y propina: monto de la cuenta, propina, cuántas personas; Enviar cobro y Anotar mi parte.`,
  },
  {
    id: 'gmf',
    claves: ['4x1000', '4 x 1000', 'cuatro por mil', 'gmf', 'exenta', 'exento', 'uvt'],
    texto: `IMPUESTO 4x1000 (Dinero > Compartir gastos e impuestos > Impuesto 4x1000):
- Indica cómo te lo aplica tu banco: repartido entre tus cuentas o solo en una cuenta marcada como exenta.
- Ves tu cupo exento del mes y cuánto te está costando.
- Marca qué cuentas están en una entidad financiera. Las de bajo monto (como Nequi) se marcan con el lápiz de la cuenta.`,
  },
  {
    id: 'ajustes',
    claves: ['categoria', 'periodo', 'quincena', 'semanal', 'dia de inicio', 'tema', 'oscuro', 'claro', 'modo', 'ocultar', 'privacidad', 'guia', 'tutorial', 'respaldo', 'copia', 'backup', 'restaurar', 'informe', 'reporte', 'nombres repetidos', 'persona', 'contacto', 'revisar movimientos', 'atajo', 'automatico', 'apple', 'iphone'],
    texto: `MÁS (ajustes y herramientas):
- Categorías: Nueva > nombre, emoji y color > Crear categoría. El lápiz edita; la caneca borra si no tiene movimientos o la archiva si sí.
- Período: Semanal, Cada 2 semanas, Dos veces al mes, Mensual (con Ajustar día de inicio), Personalizado o Sin reinicio.
- Registro automático: conecta los Atajos del iPhone (Crear mi llave y Añadir atajo de Nequi o manual) para anotar solo.
- Revisar movimientos: avisos pendientes con Ver movimiento, Marcar revisado o Descartar aviso.
- Nombres repetidos: une a la misma persona escrita de dos formas (Sí, únelos).
- Copia de seguridad: Generar informe / PDF, Descargar respaldo completo, Exportar a Excel, Movimientos en CSV o Restaurar desde un respaldo (reemplaza todo y no se deshace).
- Interruptores de la app: Próximos pagos en Inicio, Contar los ahorros, Mostrar decisiones financieras, Mostrar efectivo por separado y Recordatorio diario de racha.
- Apariencia: Claro, Oscuro o Sistema. Volver a ver la guía repite el recorrido.
- El ojo de Inicio oculta o muestra los saldos.
- La lupa de Más busca cualquier función por su nombre.`,
  },
  {
    id: 'cuenta-premium',
    claves: ['premium', 'plan', 'suscribir', 'pagar premium', 'precio', 'cuesta', 'beneficio', 'contrasena', 'clave', 'cerrar sesion', 'sincronizar', 'eliminar mi cuenta', 'borrar mi cuenta', 'nombre de usuario', 'apodo', 'id de cuenta'],
    texto: `CUENTA Y PREMIUM (Más > Cuenta y Premium):
- Cambiar nombre: el nombre con el que te ven en el ranking (de 3 a 24 caracteres, único).
- ID de cuenta con Copiar, Sincronizar y Cerrar sesión.
- Restablecer contraseña: nueva contraseña (mínimo 6) y Guardar. Si la olvidaste, en la pantalla de entrada usa Recuperar contraseña.
- Premium: Ver beneficios de Premium y luego Premium mensual o Premium anual. Incluye dictado por voz, respuestas con IA del Asesor, importar extractos, espacios compartidos, consejos con IA en Inicio y el Pulso Premium. Los cupos del plan se renuevan el día 1 de cada mes.
- Zona de riesgo: Eliminar cuenta > Sí, eliminar mi cuenta. No se puede deshacer.`,
  },
  {
    id: 'racha',
    claves: ['racha', 'ranking', 'protector', 'premio', 'reclamar', 'recordatorio'],
    texto: `RACHA Y RANKING (la pastilla de llama 🔥 en Inicio o Dinero):
- La racha sube cada día que anotas algo.
- Cada 7 días ganas un 🛡️ protector, hasta 2; salva un día que se te pase.
- Premios: 30 días dan 7 días de Premium, 100 dan 30 y 365 dan 90; se cobran con Reclamar.
- En 🏆 Ranking ves Racha, Semana y Amigos, y puedes Ocultarme del ranking.
- El Recordatorio diario se activa ahí o en Más.`,
  },
  {
    id: 'asesor',
    claves: ['asesor', 'luki', 'que puedes hacer', 'que sabes hacer', 'conversacion', 'historial de chat'],
    texto: `QUÉ PUEDE HACER LUKI EN EL ASESOR:
- Responder sobre tus finanzas con tus cifras y gráficas: resumen, cuánto puedes gastar, en qué se te va.
- Dejar listos para confirmar un movimiento («pagué 70 mil en comida»), un tope («tope de 300 mil para comida») o una meta («meta de 2 millones para viajar»). Nada se guarda sin que confirmes.
- Simular compras («qué pasa si gasto 100 mil») y explicar renta, 4x1000 y otros temas de Colombia.
- Explicar paso a paso cómo usar cualquier función de LukApp.
- No puede mover plata, cambiar saldos, crear cuentas ni pagos fijos por ti: te dice dónde hacerlo.
- El reloj de arriba guarda las conversaciones anteriores y el + abre una nueva.`,
  },
];

/** Los temas cuya clave aparece en la pregunta, en el orden del manual. */
export const temasGuiaPara = (pregunta: string, maximo = 3): TemaGuia[] => {
  const texto = normalizarGuia(pregunta);
  // Solo al inicio de palabra: «visa» no debe saltar con «revisar».
  const aparece = (clave: string) => new RegExp(`(^|[^a-z0-9])${clave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(texto);
  return TEMAS_GUIA_LUKAPP.filter((tema) => tema.claves.some(aparece)).slice(0, maximo);
};

/** Bloque de manual para adjuntar al Asesor; vacío si la pregunta no toca la app. */
export const guiaLukAppPara = (pregunta: string): string => {
  const temas = temasGuiaPara(pregunta);
  return temas.length ? `\nManual detallado de lo que se preguntó:\n${temas.map((t) => t.texto).join('\n\n')}` : '';
};
