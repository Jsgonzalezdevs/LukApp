package app.lukapp.dominio

import java.security.MessageDigest
import java.text.Normalizer
import java.util.Locale
import java.util.UUID
import kotlin.math.abs

// ── data/modelos.ts ─────────────────────────────────────────────────────────

private val MARCAS_COMBINADAS = Regex("[̀-ͯ]")

/** Origen: `data/modelos.ts` (`SIN_TILDES`). Solo el rango U+0300–036F, igual que la web. */
internal fun sinTildes(texto: String): String =
    MARCAS_COMBINADAS.replace(Normalizer.normalize(texto, Normalizer.Form.NFD), "").trim().lowercase(Locale.ROOT)

private val BILLETERAS_CONOCIDAS = listOf("nequi", "daviplata", "dale", "movii", "rappi pay", "rappipay")

/**
 * Origen: `data/modelos.ts` (`claseDeCuenta`). Las filas viejas no traen clase y se
 * clasifican por nombre; el dato explícito siempre gana.
 */
fun claseDeCuenta(cajita: Cajita): String? {
    if (cajita.tipo != TipoCajita.CUENTA) return null
    if (!cajita.claseCuenta.isNullOrEmpty()) return cajita.claseCuenta
    val nombre = sinTildes(cajita.nombre)
    if (nombre.startsWith("efectivo")) return ClaseCuenta.EFECTIVO
    if (BILLETERAS_CONOCIDAS.any { nombre.contains(it) }) return ClaseCuenta.BILLETERA
    return ClaseCuenta.BANCO
}

/** Origen: `data/modelos.ts` (`etiquetaTipoCajita`). */
fun etiquetaTipoCajita(cajita: Cajita): String {
    val clase = claseDeCuenta(cajita)
    return if (clase != null) ClaseCuenta.ETIQUETAS[clase] ?: clase else TipoCajita.ETIQUETAS[cajita.tipo] ?: cajita.tipo
}

/** Origen: `data/modelos.ts` (`cuentaEfectivo`). La cuenta de efectivo que siembra la app. */
fun cuentaEfectivo(createdAt: String, id: String = ID_EFECTIVO): Cajita = Cajita(
    id = id,
    nombre = "Efectivo",
    icon = "Wallet",
    tipo = TipoCajita.CUENTA,
    claseCuenta = ClaseCuenta.EFECTIVO,
    createdAt = createdAt,
)

// ── lib/id.ts ──────────────────────────────────────────────────────────────

/** Origen: `lib/id.ts` (`nuevoId`). UUID v4 aleatorio. */
fun nuevoId(): String = UUID.randomUUID().toString()

/**
 * Origen: `lib/id.ts` (`idEfectivoParaUsuario`). Derivado del usuario para que el
 * Efectivo automático tenga el mismo id en todos sus dispositivos (UUID v8).
 */
fun idEfectivoParaUsuario(usuario: String): String {
    val hash = MessageDigest.getInstance("SHA-256").digest("lukapp:efectivo:$usuario".toByteArray(Charsets.UTF_8))
    val bytes = hash.copyOf(16)
    bytes[6] = ((bytes[6].toInt() and 0x0f) or 0x80).toByte()
    bytes[8] = ((bytes[8].toInt() and 0x3f) or 0x80).toByte()
    val t = bytes.joinToString("") { "%02x".format(it.toInt() and 0xff) }
    return "${t.substring(0, 8)}-${t.substring(8, 12)}-${t.substring(12, 16)}-${t.substring(16, 20)}-${t.substring(20)}"
}

// ── lib/cajitas.ts ─────────────────────────────────────────────────────────

/**
 * Origen: `lib/cajitas.ts` (`idsPasivos`). El signo de un movimiento atribuido
 * depende de esto: gastar desde un banco lo baja, gastar con tarjeta sube la deuda.
 */
fun idsPasivos(cajitas: List<Cajita>): Set<String> =
    cajitas.filter { TipoCajita.esPasivo(it.tipo) }.mapTo(LinkedHashSet()) { it.id }

private fun deltaAtribuido(tx: Transaccion, pasivos: Set<String>): Long {
    val haciaArriba = tx.kind == TipoTx.INGRESO
    // En una deuda se invierte: la compra la agranda, el pago la reduce.
    val sube = if (tx.cuentaId != null && tx.cuentaId in pasivos) !haciaArriba else haciaArriba
    return if (sube) tx.amountCop else -tx.amountCop
}

/**
 * Origen: `lib/cajitas.ts` (`emparejarComprasTarjeta`). Compra del libro → movimiento
 * `compra` de la tarjeta. Uno a uno: dos compras iguales consumen dos movimientos.
 */
fun emparejarComprasTarjeta(
    movimientos: List<CajitaMovimiento>,
    transacciones: List<Transaccion>,
    pasivos: Set<String>,
): Map<String, String> {
    val pares = LinkedHashMap<String, String>()
    val usados = HashSet<String>()
    val compras = transacciones.filter {
        it.afectaSaldo && it.kind == TipoTx.GASTO && it.cuentaId != null && it.cuentaId in pasivos
    }
    // El id compartido es el contrato actual y aguanta ediciones de monto o fecha.
    for (tx in compras) {
        val exacto = movimientos.firstOrNull {
            it.id == tx.id && it.kind == TipoMovimiento.COMPRA && it.cajitaId == tx.cuentaId
        } ?: continue
        pares[tx.id] = exacto.id
        usados.add(exacto.id)
    }
    // Compras anteriores a compartir id: misma tarjeta, fecha y monto.
    for (tx in compras) {
        if (tx.id in pares) continue
        val legado = movimientos.firstOrNull {
            it.id !in usados && it.kind == TipoMovimiento.COMPRA && it.cajitaId == tx.cuentaId &&
                it.occurredOn == tx.occurredOn && it.deltaCop == tx.amountCop
        } ?: continue
        pares[tx.id] = legado.id
        usados.add(legado.id)
    }
    return pares
}

/**
 * Origen: `lib/cajitas.ts` (`saldosPorCajita`). El saldo siempre es la suma de sus
 * movimientos más lo atribuido; nunca un número guardado.
 */
fun saldosPorCajita(
    movimientos: List<CajitaMovimiento>,
    transacciones: List<Transaccion> = emptyList(),
    pasivos: Set<String> = emptySet(),
): Map<String, Long> {
    val saldos = LinkedHashMap<String, Long>()
    val emparejadas = emparejarComprasTarjeta(movimientos, transacciones, pasivos)
    for (mov in movimientos) saldos[mov.cajitaId] = (saldos[mov.cajitaId] ?: 0L) + mov.deltaCop
    for (tx in transacciones) {
        val cuenta = tx.cuentaId
        if (cuenta.isNullOrEmpty()) continue
        if (!tx.afectaSaldo) continue
        if (tx.id in emparejadas) continue
        saldos[cuenta] = (saldos[cuenta] ?: 0L) + deltaAtribuido(tx, pasivos)
    }
    return saldos
}

/** Origen: `lib/cajitas.ts` (`saldoDeCajita`). Sin movimientos = 0 (regla v10.11.8: la UI muestra $0). */
fun saldoDeCajita(
    movimientos: List<CajitaMovimiento>,
    cajitaId: String,
    transacciones: List<Transaccion> = emptyList(),
    pasivos: Set<String> = emptySet(),
): Long = saldosPorCajita(movimientos, transacciones, pasivos)[cajitaId] ?: 0L

/** Origen: `lib/cajitas.ts` (`ajusteHacia`). Delta del movimiento `ajuste` que lleva al saldo dicho. */
fun ajusteHacia(saldoActual: Long, saldoObjetivo: Long): Long = saldoObjetivo - saldoActual

/** Origen: `lib/cajitas.ts` (`FilaHistorial`). */
data class FilaHistorial(val movimiento: CajitaMovimiento, val saldoDespues: Long)

/**
 * Origen: `lib/cajitas.ts` (`historialDeCajita`). Se acumula del más viejo al más
 * nuevo y luego se invierte, para que cada fila muestre el saldo después de sí misma.
 */
fun historialDeCajita(movimientos: List<CajitaMovimiento>, cajitaId: String): List<FilaHistorial> {
    val propios = movimientos.filter { it.cajitaId == cajitaId }
        .sortedWith(compareBy<CajitaMovimiento> { it.occurredOn }.thenBy { it.createdAt })
    var corriendo = 0L
    return propios.map { corriendo += it.deltaCop; FilaHistorial(it, corriendo) }.reversed()
}

/** Origen: `lib/cajitas.ts` (`totalEnCajitas`). Las archivadas conservan historia pero salen del total. */
fun totalEnCajitas(
    cajitas: List<Cajita>,
    movimientos: List<CajitaMovimiento>,
    transacciones: List<Transaccion> = emptyList(),
): Long {
    val saldos = saldosPorCajita(movimientos, transacciones, idsPasivos(cajitas))
    return cajitas.filter { it.archivedAt == null }.sumOf { saldos[it.id] ?: 0L }
}

/** Origen: `lib/cajitas.ts` (`ResumenCajita`). `pct` 0..100 con un decimal, o null sin meta. */
data class ResumenCajita(val cajita: Cajita, val saldoCop: Long, val pct: Double?)

/** Origen: `lib/cajitas.ts` (`resumenDeCajitas`). Orden descendente por saldo. */
fun resumenDeCajitas(
    cajitas: List<Cajita>,
    movimientos: List<CajitaMovimiento>,
    transacciones: List<Transaccion> = emptyList(),
): List<ResumenCajita> {
    val saldos = saldosPorCajita(movimientos, transacciones, idsPasivos(cajitas))
    return cajitas.filter { it.archivedAt == null }.map { c ->
        val saldo = saldos[c.id] ?: 0L
        val meta = c.metaCop
        val pct = if (meta != null && meta > 0) minOf(100.0, Math.round(saldo.toDouble() / meta * 1000) / 10.0) else null
        ResumenCajita(c, saldo, pct)
    }.sortedByDescending { it.saldoCop }
}

/** Origen: `lib/cajitas.ts` (`totalPorTipo`). */
fun totalPorTipo(
    cajitas: List<Cajita>,
    movimientos: List<CajitaMovimiento>,
    tipo: String,
    transacciones: List<Transaccion> = emptyList(),
): Long = totalEnCajitas(cajitas.filter { it.tipo == tipo }, movimientos, transacciones)

/** Origen: `lib/cajitas.ts` (`Patrimonio`). `deudasCop` siempre positivo; `netoCop` puede ser negativo. */
data class Patrimonio(
    val cuentasCop: Long,
    val cajitasCop: Long,
    val deudasCop: Long,
    val totalCop: Long,
    val netoCop: Long,
)

/**
 * Origen: `lib/cajitas.ts` (`patrimonio`). El abs va por tipo y no sobre el total
 * para que una tarjeta y una deuda con signos opuestos no se cancelen.
 */
fun patrimonio(
    cajitas: List<Cajita>,
    movimientos: List<CajitaMovimiento>,
    transacciones: List<Transaccion> = emptyList(),
): Patrimonio {
    val cuentas = totalPorTipo(cajitas, movimientos, TipoCajita.CUENTA, transacciones)
    val ahorros = totalPorTipo(cajitas, movimientos, TipoCajita.CAJITA, transacciones)
    val deudas = abs(totalPorTipo(cajitas, movimientos, TipoCajita.DEUDA, transacciones)) +
        abs(totalPorTipo(cajitas, movimientos, TipoCajita.TARJETA, transacciones))
    val total = cuentas + ahorros
    return Patrimonio(cuentas, ahorros, deudas, total, total - deudas)
}

/** Origen: `lib/cajitas.ts` (`resumenDePasivos`). */
fun resumenDePasivos(
    cajitas: List<Cajita>,
    movimientos: List<CajitaMovimiento>,
    transacciones: List<Transaccion> = emptyList(),
): List<ResumenCajita> = resumenDeCajitas(cajitas.filter { TipoCajita.esPasivo(it.tipo) }, movimientos, transacciones)

/** Origen: `lib/cajitas.ts` (`resumenDeActivos`). Igual que la web, no recibe transacciones. */
fun resumenDeActivos(cajitas: List<Cajita>, movimientos: List<CajitaMovimiento>): List<ResumenCajita> =
    resumenDeCajitas(cajitas.filter { !TipoCajita.esPasivo(it.tipo) }, movimientos)

/**
 * Origen: `lib/cajitas.ts` (`totalVisible`). La tarjeta no se descuenta (es una
 * obligación futura del ciclo de facturación); las deudas directas sí.
 */
fun totalVisible(
    cajitas: List<Cajita>,
    movimientos: List<CajitaMovimiento>,
    transacciones: List<Transaccion>,
    contarAhorros: Boolean,
): Long {
    val p = patrimonio(cajitas, movimientos, transacciones)
    val deudasDirectas = abs(totalPorTipo(cajitas, movimientos, TipoCajita.DEUDA, transacciones))
    return if (contarAhorros) p.totalCop - deudasDirectas else p.cuentasCop - deudasDirectas
}

/**
 * Origen: `lib/cajitas.ts` (`esCuentaEfectivo`). Por id cuando la sembró la app y
 * por nombre/clase cuando la creó la persona a mano.
 */
fun esCuentaEfectivo(cajita: Cajita): Boolean {
    if (cajita.tipo != TipoCajita.CUENTA) return false
    if (cajita.id == ID_EFECTIVO || cajita.id == ID_EFECTIVO_VIEJO) return true
    return claseDeCuenta(cajita) == ClaseCuenta.EFECTIVO
}

/** Origen: `lib/cajitas.ts` (`saldoEfectivo`). Suma todas las cuentas de efectivo vivas, no solo la primera. */
fun saldoEfectivo(
    cajitas: List<Cajita>,
    movimientos: List<CajitaMovimiento>,
    transacciones: List<Transaccion> = emptyList(),
): Long {
    val pasivos = idsPasivos(cajitas)
    val saldos = saldosPorCajita(movimientos, transacciones, pasivos)
    return cajitas.filter { it.archivedAt == null && esCuentaEfectivo(it) }.sumOf { saldos[it.id] ?: 0L }
}

/** Origen: `lib/cajitas.ts` (`saldoCuentasSinEfectivo`). */
fun saldoCuentasSinEfectivo(
    cajitas: List<Cajita>,
    movimientos: List<CajitaMovimiento>,
    transacciones: List<Transaccion> = emptyList(),
): Long = totalPorTipo(cajitas, movimientos, TipoCajita.CUENTA, transacciones) - saldoEfectivo(cajitas, movimientos, transacciones)
