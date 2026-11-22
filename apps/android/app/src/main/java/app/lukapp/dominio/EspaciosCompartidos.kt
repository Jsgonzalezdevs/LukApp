package app.lukapp.dominio

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// Origen: `data/useEspaciosCompartidos.ts` y `EspaciosCompartidosView.tsx`. Las tablas son las de la migración
// 0020_espacios_compartidos_reales.sql: la web y la nativa leen y escriben lo mismo.

@Serializable
data class FilaEspacio(val id: String, val nombre: String, val icono: String = "🏠", val color: String = "#8b5cf6", @SerialName("created_at") val createdAt: String = "")

@Serializable
data class FilaIntegrante(@SerialName("espacio_id") val espacioId: String, @SerialName("user_id") val userId: String, val nombre: String = "", val emoji: String = "🙂")

@Serializable
data class FilaGasto(
    val id: String,
    @SerialName("espacio_id") val espacioId: String,
    val descripcion: String,
    @SerialName("monto_cop") val montoCop: Long,
    val fecha: String,
    @SerialName("pagado_por") val pagadoPor: String,
    val categoria: String = "otros",
)

/** El que soy yo se llama «yo» en todo el código, como en la web; el otro lleva su id de usuario. */
const val YO = "yo"

data class Integrante(val id: String, val nombre: String, val emoji: String)
data class GastoCompartido(val id: String, val descripcion: String, val montoCop: Long, val fecha: String, val pagadoPorId: String, val categoria: String)
data class EspacioCompartido(val id: String, val nombre: String, val icono: String, val integrantes: List<Integrante>, val gastos: List<GastoCompartido>, val createdAt: String)

/** Origen: la carga de `useEspaciosCompartidos`: junta las cuatro lecturas en espacios con sus integrantes y gastos. */
fun armarEspacios(usuario: String, espacios: List<FilaEspacio>, integrantes: List<FilaIntegrante>, gastos: List<FilaGasto>): List<EspacioCompartido> =
    espacios.sortedByDescending { it.createdAt }.map { e ->
        EspacioCompartido(
            e.id, e.nombre, e.icono,
            integrantes.filter { it.espacioId == e.id }.map { m ->
                if (m.userId == usuario) Integrante(YO, "Tú", m.emoji.ifEmpty { "🙂" }) else Integrante(m.userId, m.nombre.ifEmpty { "Pareja" }, m.emoji.ifEmpty { "🙂" })
            },
            gastos.filter { it.espacioId == e.id }.map { g ->
                GastoCompartido(g.id, g.descripcion, g.montoCop, g.fecha, if (g.pagadoPor == usuario) YO else g.pagadoPor, g.categoria)
            },
            e.createdAt,
        )
    }

/** Cuánto va gastado, quién puso qué y quién le debe a quién (a partes iguales entre dos). */
data class BalanceEspacio(val total: Long, val pagadoPorMi: Long, val pagadoPorOtro: Long, val nombreOtro: String, val hayPareja: Boolean, val balanceMio: Long)

/**
 * Origen: el cálculo del encabezado de la vista. `balanceMio` > 0 = te deben; < 0 = debes. Es la mitad de lo que
 * pusiste de más (o de menos); si la mitad cae en medio peso se redondea hacia afuera, como el formato de la web.
 */
fun balanceDe(e: EspacioCompartido): BalanceEspacio {
    val total = e.gastos.sumOf { it.montoCop }
    val mio = e.gastos.filter { it.pagadoPorId == YO }.sumOf { it.montoCop }
    val hayPareja = e.integrantes.size > 1
    val doble = 2 * mio - total
    val balance = if (!hayPareja) 0L else (if (doble < 0) -1 else 1) * ((Math.abs(doble) + 1) / 2)
    return BalanceEspacio(total, mio, total - mio, e.integrantes.firstOrNull { it.id != YO }?.nombre?.ifEmpty { null } ?: "Tu pareja", hayPareja, balance)
}

/** Tú primero, como la web. */
fun integrantesConYoPrimero(e: EspacioCompartido): List<Integrante> = e.integrantes.sortedBy { if (it.id == YO) 0 else 1 }

/**
 * Origen: `compartirWhatsApp`. Lo manda quien lo escribe, así que va en primera persona: la web dice «le debe a Tú»
 * y «Pagó Tú», que leído por la otra persona no tiene sentido.
 */
fun mensajeDeCuentas(nombreEspacio: String, b: BalanceEspacio): String {
    val estado = when {
        b.balanceMio > 0 -> "👉 *${b.nombreOtro} me debe: ${formatCop(b.balanceMio)}*"
        b.balanceMio < 0 -> "👉 *Le debo a ${b.nombreOtro}: ${formatCop(Math.abs(b.balanceMio))}*"
        else -> "🤝 *¡Estamos al día y a mano!*"
    }
    return "🥑 *Cuentas Claras en LukApp — «$nombreEspacio»*\n\n" +
        "• Total acumulado: ${formatCop(b.total)}\n• Pagué yo: ${formatCop(b.pagadoPorMi)}\n• Pagó ${b.nombreOtro}: ${formatCop(b.pagadoPorOtro)}\n\n" +
        "$estado\n\n📲 ¡Gracias por pasarme tu parte por Nequi o Bancolombia!"
}

/** Origen: `handleGuardarGasto`: lo que se anota en tus gastos personales cuando pagaste tú. */
fun miMitad(montoCop: Long): Long = Math.round(montoCop / 2.0)

fun descripcionMiMitad(descripcion: String, espacio: String): String = "Mi mitad: ${descripcion.trim()} ($espacio)"

/** El enlace que se manda: lleva a la web, donde la otra persona entra con su cuenta. El token es lo único que importa. */
fun enlaceDeInvitacion(token: String): String = "https://mi.lukapp.app/?invitacion=$token"

private val UUID = Regex("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")

/** Saca el token de lo que la persona pegó: el enlace entero o el token solo. */
fun tokenDeInvitacion(texto: String): String? = UUID.find(texto)?.value?.lowercase()

val ICONOS_ESPACIO = listOf("🥑", "🏠", "✈️", "🍕", "☕", "🚗", "🎁", "🏖️")

val NOMBRES_ICONO_ESPACIO = mapOf("🥑" to "Mercado", "🏠" to "Hogar", "✈️" to "Viaje", "🍕" to "Comida", "☕" to "Café", "🚗" to "Carro", "🎁" to "Regalo", "🏖️" to "Vacaciones")

/** Los espacios viejos guardaron el nombre de un ícono de la web en vez de un emoji. */
fun emojiDeEspacio(valor: String): String = mapOf(
    "ShoppingCart" to "🥑", "Home" to "🏠", "Plane" to "✈️", "Utensils" to "🍕", "Coffee" to "☕", "Car" to "🚗", "Gift" to "🎁",
    "Target" to "🎯", "UserRound" to "👤", "Smile" to "😊", "Heart" to "❤️", "Cat" to "🐱", "Dog" to "🐶",
)[valor] ?: valor
