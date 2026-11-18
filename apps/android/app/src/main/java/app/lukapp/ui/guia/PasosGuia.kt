package app.lukapp.ui.guia

import app.lukapp.ui.shell.Seccion

/**
 * `guia/pasos.ts`. Cada paso apunta a un elemento real por su ancla (`Modifier.anclaGuia`): la guía no sabe nada de
 * ninguna pantalla, y si el ancla no está el globo sale centrado y sin recorte en vez de romperse.
 */
data class PasoGuia(val ancla: String, val titulo: String, val texto: String, val aire: Int = 8, val radio: Int = 12)

/** El recorrido básico: cuatro y no diez a propósito. Sale una sola vez, al terminar la bienvenida. */
val PASOS_BASICOS = listOf(
    PasoGuia("saldo", "Lo que tienes", "La suma de todas tus cuentas, ahorros y efectivo. Es el único número grande de la app, y por eso es el que importa.", 10, 14),
    PasoGuia("anotar", "Anota hablando", "Toca el micrófono y dilo como se lo dirías a un amigo: «gasté 45 mil en almuerzo». Se entiende el monto, la categoría y qué fue. El teclado es para escribirlo y la lupa de Inicio para buscar.", 10, 999),
    PasoGuia("nav", "Cinco sitios", "Inicio es donde vives. Dinero es dónde está la plata. Mes es lo que se calcula. Asesor responde preguntas sobre tus números. Y Más es todo lo que se configura.", 6, 18),
    PasoGuia("nav-ajustes", "Aquí está lo demás", "Dinero reúne tus cuentas, ahorros, deudas y tarjetas. Mes reúne pagos, calendario y proyección. En Más quedan las preferencias, los datos y la búsqueda de funciones.", 4, 14),
)

/** Los globos de exploración: uno por sitio, anclado a su pestaña (que siempre existe, aunque la pantalla esté vacía). */
val PASOS_POR_SECCION: Map<Seccion, List<PasoGuia>> = mapOf(
    Seccion.DINERO to listOf(PasoGuia("nav-dinero", "Dónde está tu plata", "Cada cuenta, ahorro, deuda y tarjeta con su saldo. Las Cajitas te dejan apartar plata para algo concreto sin sacarla del banco.", 4, 14)),
    Seccion.MES to listOf(PasoGuia("nav-mes", "Lo que se calcula", "En qué se te fue el mes por categoría, cómo va contra los meses anteriores y si te estás pasando de los topes que te pusiste.", 4, 14)),
    Seccion.ASESOR to listOf(PasoGuia("nav-asesor", "Pregúntale a tus números", "Escríbele como a una persona: «¿en qué gasté más este mes?». Responde con tus movimientos, no con consejos genéricos de internet.", 4, 14)),
    Seccion.AJUSTES to listOf(PasoGuia("nav-ajustes", "Configura tu sistema", "En Más encuentras categorías, período, respaldos y preferencias. Los pagos y la proyección están en Mes. También puedes buscar una función por su nombre.", 4, 14)),
)
