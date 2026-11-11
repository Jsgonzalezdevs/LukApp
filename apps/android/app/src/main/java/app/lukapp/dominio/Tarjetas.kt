package app.lukapp.dominio

import java.time.DateTimeException
import java.time.LocalDate
import java.time.YearMonth

/** Origen: `lib/tarjetas.ts` (`ResumenTarjeta`). `certezaPago`: "real" o "estimada". */
data class ResumenTarjeta(
    val tarjetaId: String,
    val saldoUtilizadoCop: Long,
    val limiteCreditoCop: Long?,
    val cupoDisponibleCop: Long?,
    val pagoSiguienteCop: Long,
    val pagoMinimoCop: Long?,
    val fechaCorteSiguiente: String?,
    val fechaPagoSiguiente: String?,
    val certezaPago: String,
)

/**
 * Origen: `lib/tarjetas.ts` (`ClasificacionCompraTarjeta`). `posicion`: antes-del-corte,
 * en-el-corte, despues-del-corte, desconocida. `posicionExtracto`: actual, siguiente,
 * anterior, desconocido.
 */
data class ClasificacionCompraTarjeta(val posicion: String, val extracto: String?, val posicionExtracto: String)

/** Origen: `lib/tarjetas.ts` (`fechasTarjeta`). */
data class FechasTarjeta(val corte: String?, val pago: String?)

private fun fechaConDia(mes: String, dia: Int): String {
    val (anio, m, _) = partesFecha(mes)
    val ultimo = YearMonth.of(anio, m).lengthOfMonth()
    return "$mes-${minOf(maxOf(1, dia), ultimo).toString().padStart(2, '0')}"
}

private fun siguienteMes(mes: String): String = shiftMonth(mes, 1)

private val FORMATO_FECHA = Regex("^\\d{4}-\\d{2}-\\d{2}$")

// Rechaza fechas que JS normalizaría (2026-02-31): aquí nunca se fabrica una fecha.
private fun fechaValida(fecha: String): Boolean {
    if (!FORMATO_FECHA.matches(fecha)) return false
    val (a, m, d) = partesFecha(fecha)
    return try {
        LocalDate.of(a, m, d); true
    } catch (_: DateTimeException) {
        false
    }
}

/**
 * Origen: `lib/tarjetas.ts` (`clasificarCompraTarjeta`). El día de corte pertenece al
 * extracto de ese mes; lo posterior, al siguiente. Sin datos → desconocido.
 */
fun clasificarCompraTarjeta(tarjeta: Cajita, fechaCompra: String, fechaReferencia: String): ClasificacionCompraTarjeta {
    val dia = if (tarjeta.tipo == TipoCajita.TARJETA) tarjeta.diaCorte else null
    if (dia == null || dia < 1 || dia > 31 || !fechaValida(fechaCompra) || !fechaValida(fechaReferencia)) {
        return ClasificacionCompraTarjeta("desconocida", null, "desconocido")
    }
    val mesCompra = fechaCompra.take(7)
    val corteCompra = fechaConDia(mesCompra, dia)
    val posicion = when {
        fechaCompra < corteCompra -> "antes-del-corte"
        fechaCompra == corteCompra -> "en-el-corte"
        else -> "despues-del-corte"
    }
    val extracto = if (posicion == "despues-del-corte") siguienteMes(mesCompra) else mesCompra
    val mesReferencia = fechaReferencia.take(7)
    val extractoActual = if (fechaReferencia <= fechaConDia(mesReferencia, dia)) mesReferencia else siguienteMes(mesReferencia)
    fun orden(mes: String): Int {
        val (a, n, _) = partesFecha(mes)
        return a * 12 + n
    }
    val diferencia = orden(extracto) - orden(extractoActual)
    val posicionExtracto = when {
        diferencia == 0 -> "actual"
        diferencia == 1 -> "siguiente"
        diferencia < 0 -> "anterior"
        else -> "desconocido"
    }
    return ClasificacionCompraTarjeta(posicion, extracto, posicionExtracto)
}

/** Origen: `lib/tarjetas.ts` (`fechasTarjeta`). Próximo corte y pago, sin inventar los que no se configuraron. */
fun fechasTarjeta(tarjeta: Cajita, hoy: String): FechasTarjeta {
    if (tarjeta.tipo != TipoCajita.TARJETA) return FechasTarjeta(null, null)
    val mes = hoy.take(7)
    val diaCorte = tarjeta.diaCorte?.takeIf { it != 0 }
    val corte = diaCorte?.let { if (fechaConDia(mes, it) >= hoy) fechaConDia(mes, it) else fechaConDia(siguienteMes(mes), it) }
    val diaPago = tarjeta.diaPago?.takeIf { it != 0 } ?: return FechasTarjeta(corte, null)
    val pagoMes = corte?.take(7) ?: mes
    var pago = fechaConDia(pagoMes, diaPago)
    if (corte != null && pago <= corte) pago = fechaConDia(siguienteMes(pagoMes), diaPago)
    return FechasTarjeta(corte, pago)
}

/** Origen: `lib/tarjetas.ts` (`fechaPagoDePeriodo`). Pago del extracto de un mes; null si no se configuró. */
fun fechaPagoDePeriodo(tarjeta: Cajita, periodo: String): String? {
    val diaPago = tarjeta.diaPago?.takeIf { it != 0 }
    if (tarjeta.tipo != TipoCajita.TARJETA || diaPago == null) return null
    val (anio, mes, _) = partesFecha(periodo)
    val corte = tarjeta.diaCorte?.takeIf { it != 0 }?.let { minOf(it, YearMonth.of(anio, mes).lengthOfMonth()) }
    val pago = fechaConDia(periodo, diaPago)
    return if (corte != null && pago <= fechaConDia(periodo, corte)) fechaConDia(siguienteMes(periodo), diaPago) else pago
}

/**
 * Origen: `lib/tarjetas.ts` (`resumenTarjeta`). Presentacional: no reemplaza el saldo
 * contable. Cupo disponible = max(0, límite − max(0, usado)).
 */
fun resumenTarjeta(
    tarjeta: Cajita,
    saldoUtilizadoCop: Long,
    transacciones: List<Transaccion>,
    movimientos: List<CajitaMovimiento>,
    mes: String,
    hoy: String,
): ResumenTarjeta {
    val fechas = fechasTarjeta(tarjeta, hoy)
    // Sin fecha de pago la web usa '<mes>-31' como tope: comparación de texto, no una fecha real.
    val pagoSiguiente = pagoPendienteTarjeta(transacciones, movimientos, tarjeta.id, mes, fechas.pago ?: "$mes-31")
    val limite = tarjeta.limiteCreditoCop
    return ResumenTarjeta(
        tarjetaId = tarjeta.id,
        saldoUtilizadoCop = saldoUtilizadoCop,
        limiteCreditoCop = limite,
        cupoDisponibleCop = limite?.let { maxOf(0L, it - maxOf(0L, saldoUtilizadoCop)) },
        pagoSiguienteCop = pagoSiguiente,
        pagoMinimoCop = tarjeta.pagoMinimoCop,
        fechaCorteSiguiente = fechas.corte,
        fechaPagoSiguiente = fechas.pago,
        certezaPago = if (pagoSiguiente > 0) "real" else "estimada",
    )
}
