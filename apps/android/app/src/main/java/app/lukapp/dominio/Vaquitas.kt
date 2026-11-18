package app.lukapp.dominio

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

// Origen: `lib/vaquitasColombia.ts`. Los campos se llaman igual que en la web: el JSON es el mismo.

@Serializable
data class ParticipanteVaquita(val nombre: String, val cuotaComprometida: Long, val aportadoCop: Long)

@Serializable
data class GastoVaquita(val id: String, val descripcion: String, val montoCop: Long, val pagadoPor: String, val fecha: String)

@Serializable
data class Vaquita(
    val id: String,
    val nombre: String,
    val emoji: String,
    val metaCop: Long,
    val participantes: List<ParticipanteVaquita>,
    val gastos: List<GastoVaquita>,
    val creadaEn: String,
)

data class DeudaLiquidacion(val deudor: String, val acreedor: String, val montoCop: Long)
data class PendienteVaquita(val nombre: String, val faltante: Long)

data class ResumenVaquita(
    val totalRecolectado: Long,
    val totalGastado: Long,
    val saldoDisponible: Long,
    val porcentajeRecoleccion: Int,
    val estaCompleta: Boolean,
    val pendientesPorPagar: List<PendienteVaquita>,
    val liquidacionesSugeridas: List<DeudaLiquidacion>,
)

/** Origen: `repartirCuota`. Reparte pesos enteros sin crear ni perder saldo por redondeo: los primeros se llevan el sobrante. */
fun repartirCuota(totalCop: Long, cantidad: Int): List<Long> {
    if (totalCop < 0 || cantidad <= 0) return emptyList()
    val base = totalCop / cantidad
    val sobrante = (totalCop % cantidad).toInt()
    return List(cantidad) { base + if (it < sobrante) 1 else 0 }
}

/** Origen: `calcularResumenVaquita`. Cuánto hay, cuánto se gastó y quién le paga a quién para quedar a mano. */
fun calcularResumenVaquita(v: Vaquita): ResumenVaquita {
    val recolectado = v.participantes.sumOf { maxOf(0L, it.aportadoCop) }
    val gastado = v.gastos.sumOf { maxOf(0L, it.montoCop) }
    val meta = if (v.metaCop > 0) v.metaCop else v.participantes.sumOf { it.cuotaComprometida }
    val porcentaje = if (meta > 0) minOf(100, Math.round(recolectado.toDouble() / meta * 100).toInt()) else 100
    val pendientes = v.participantes.filter { it.aportadoCop < it.cuotaComprometida }.map { PendienteVaquita(it.nombre, it.cuotaComprometida - it.aportadoCop) }

    // Balance individual: lo que aportó más lo que pagó de su bolsillo, menos la cuota que le tocaba.
    // Un mapa por nombre, como el Record de la web: dos personas con el mismo nombre se funden en una.
    val balances = LinkedHashMap<String, Long>()
    v.participantes.forEach { balances[it.nombre] = it.aportadoCop - it.cuotaComprometida }
    v.gastos.forEach { g -> if (g.pagadoPor.isNotEmpty() && balances.containsKey(g.pagadoPor)) balances[g.pagadoPor] = balances.getValue(g.pagadoPor) + g.montoCop }

    val deudores = balances.filter { it.value < 0 }.map { it.key to -it.value }.toMutableList()
    val acreedores = balances.filter { it.value > 0 }.map { it.key to it.value }.toMutableList()
    val liquidaciones = mutableListOf<DeudaLiquidacion>()
    var i = 0
    var j = 0
    while (i < deudores.size && j < acreedores.size) {
        val pago = minOf(deudores[i].second, acreedores[j].second)
        if (pago > 0) {
            liquidaciones.add(DeudaLiquidacion(deudores[i].first, acreedores[j].first, pago))
            deudores[i] = deudores[i].first to deudores[i].second - pago
            acreedores[j] = acreedores[j].first to acreedores[j].second - pago
        }
        if (deudores[i].second == 0L) i++
        if (acreedores[j].second == 0L) j++
    }
    return ResumenVaquita(recolectado, gastado, recolectado - gastado, porcentaje, porcentaje >= 100, pendientes, liquidaciones)
}

private val json = Json { ignoreUnknownKeys = true }

/** Lee lo guardado; algo ilegible vuelve a la lista vacía, como el `catch` de la web. */
fun vaquitasDeTexto(texto: String?): List<Vaquita> =
    if (texto.isNullOrEmpty()) emptyList() else runCatching { json.decodeFromString<List<Vaquita>>(texto) }.getOrDefault(emptyList())

fun vaquitasATexto(l: List<Vaquita>): String = json.encodeToString(kotlinx.serialization.builtins.ListSerializer(Vaquita.serializer()), l)

/** Origen: `handleCrearVaquita`. «Yo» siempre va primero; las cuotas salen de `repartirCuota`. Sin nombre o sin meta no hay vaca. */
fun nuevaVaquita(nombre: String, metaCop: Long, amigosTexto: String, id: String, hoy: String): Vaquita? {
    if (nombre.isBlank() || metaCop <= 0) return null
    val todos = listOf("Yo") + amigosTexto.split(',').map { it.trim() }.filter { it.isNotEmpty() }
    val cuotas = repartirCuota(metaCop, todos.size)
    return Vaquita(id, nombre, "🐮", metaCop, todos.mapIndexed { i, n -> ParticipanteVaquita(n, cuotas[i], 0) }, emptyList(), hoy)
}
