package app.lukapp.dominio

import java.time.YearMonth

/** Origen: `lib/cuotasTarjeta.ts` (`CuotaProgramada`). */
data class CuotaProgramada(
    val transaccionId: String,
    val numero: Int,
    val total: Int,
    val montoCop: Long,
    val venceEn: String,
)

// Mismo día del mes `meses` después, recortado al último día real del mes destino.
private fun sumarMeses(fecha: String, meses: Int): String {
    val (anio, mes, dia) = partesFecha(fecha)
    val destino = YearMonth.of(anio, 1).plusMonths((mes - 1 + meses).toLong())
    val d = minOf(dia, destino.lengthOfMonth())
    return "${destino.year}-${destino.monthValue.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}"
}

/** Origen: `lib/cuotasTarjeta.ts` (`cuotasDeTarjeta`). Solo compras diferidas de verdad (≥2 cuotas y cuota > 0). */
fun cuotasDeTarjeta(transacciones: List<Transaccion>, tarjetaId: String): List<CuotaProgramada> =
    transacciones
        .filter { it.cuentaId == tarjetaId && (it.cuotasTotal ?: 0) >= 2 && (it.cuotaCop ?: 0L) > 0 }
        .flatMap { tx ->
            val total = tx.cuotasTotal ?: 0
            (0 until total).map { i -> CuotaProgramada(tx.id, i + 1, total, tx.cuotaCop ?: 0L, sumarMeses(tx.occurredOn, i)) }
        }
        .sortedBy { it.venceEn }

/** Origen: `lib/cuotasTarjeta.ts` (`pagoMensualTarjeta`). Lo que se debería apartar en el mes. */
fun pagoMensualTarjeta(transacciones: List<Transaccion>, tarjetaId: String, mes: String): Long =
    cuotasDeTarjeta(transacciones, tarjetaId).filter { it.venceEn.take(7) == mes }.sumOf { it.montoCop }

private fun finDeMes(mes: String): String {
    val (anio, m, _) = partesFecha(mes)
    return "$mes-${YearMonth.of(anio, m).lengthOfMonth().toString().padStart(2, '0')}"
}

/**
 * Origen: `lib/cuotasTarjeta.ts` (`pagoPendienteTarjeta`). Los abonos se aplican a la
 * cuota vencida más antigua (FIFO), sin consumir cuotas futuras por accidente.
 */
fun pagoPendienteTarjeta(
    transacciones: List<Transaccion>,
    movimientos: List<CajitaMovimiento>,
    tarjetaId: String,
    mes: String,
    hasta: String = finDeMes(mes),
): Long {
    val cuotas = cuotasDeTarjeta(transacciones, tarjetaId).filter { it.venceEn <= hasta }
    val pendiente = LongArray(cuotas.size) { cuotas[it].montoCop }
    val abonos = movimientos
        .filter { it.cajitaId == tarjetaId && it.kind == TipoMovimiento.ABONO && it.deltaCop < 0 && it.occurredOn <= hasta }
        .sortedWith(compareBy<CajitaMovimiento> { it.occurredOn }.thenBy { it.createdAt })
    for (abono in abonos) {
        var porAplicar = Math.abs(abono.deltaCop)
        for (i in cuotas.indices) {
            if (porAplicar == 0L || cuotas[i].venceEn > abono.occurredOn) break
            val cubierto = minOf(pendiente[i], porAplicar)
            pendiente[i] -= cubierto
            porAplicar -= cubierto
        }
    }
    return cuotas.indices.filter { cuotas[it].venceEn.take(7) == mes }.sumOf { pendiente[it] }
}
