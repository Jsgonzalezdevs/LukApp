package app.lukapp.dominio

/**
 * Origen: `lib/proyeccionFinanciera.ts` (`PuntoProyeccionCompleta`).
 * `riesgo`: saludable, ajustada, deficit-proyectado, incompleto.
 */
data class PuntoProyeccionCompleta(
    val fecha: String,
    val saldoLiquidoCop: Long,
    val entradasCop: Long,
    val salidasCop: Long,
    val obligacionesCop: Long,
    val disponibleDiarioCop: Long,
    val riesgo: String,
    val evidencia: List<String>,
)

/**
 * Origen: `lib/proyeccionFinanciera.ts` (`EscenarioForecast`). `nombre`: base, conservador,
 * favorable. `confianza`: alta, media, baja, desconocida.
 */
data class EscenarioForecast(
    val nombre: String,
    val disponibleDiarioCop: Long?,
    val liquidezCop: Long?,
    val flujoNetoCop: Long?,
    val confianza: String,
    val evidencia: List<String>,
)

/** Origen: `lib/proyeccionFinanciera.ts` (`ForecastFinanciero`). */
data class HorizonteForecast(val dias: Int, val base: EscenarioForecast, val conservador: EscenarioForecast, val favorable: EscenarioForecast)

/** Origen: `lib/proyeccionFinanciera.ts` (`ForecastFinanciero`). */
data class ForecastFinanciero(val horizontes: List<HorizonteForecast>)

/**
 * Origen: `lib/proyeccionFinanciera.ts` (`construirForecast`). Resume la proyección; los
 * escenarios sin hipótesis respaldada quedan en null en vez de inventarse.
 */
fun construirForecast(serie: List<PuntoProyeccionCompleta>, confianza: String): ForecastFinanciero {
    fun noDisponible(nombre: String) = EscenarioForecast(nombre, null, null, null, "desconocida", listOf("No hay hipótesis respaldada para construir este escenario."))
    return ForecastFinanciero(listOf(7, 30, 90).map { dias ->
        val punto = serie.getOrNull(minOf(dias, serie.size - 1))
        val base = if (punto != null) {
            EscenarioForecast("base", punto.disponibleDiarioCop, punto.saldoLiquidoCop, punto.entradasCop - punto.salidasCop, confianza, punto.evidencia)
        } else {
            EscenarioForecast("base", null, null, null, "desconocida", listOf("No existe proyección suficiente para este horizonte."))
        }
        HorizonteForecast(dias, base, noDisponible("conservador"), noDisponible("favorable"))
    })
}

/**
 * Origen: `lib/proyeccionFinanciera.ts` (`proyectarFinanzas`). Día a día desde el saldo
 * de las cuentas, sumando entradas y restando obligaciones fechadas; no muta nada.
 */
fun proyectarFinanzas(
    libro: Libro,
    hoy: String,
    obligaciones: List<ObligacionFutura>,
    entradasFuturas: List<EntradaFutura>,
    dias: Int,
): List<PuntoProyeccionCompleta> {
    val saldoInicial = totalPorTipo(libro.cajitas, libro.movimientos, TipoCajita.CUENTA, libro.transacciones)
    val hayDesconocidas = obligaciones.any { it.estado == "desconocida" }
    val puntos = mutableListOf<PuntoProyeccionCompleta>()
    var acumulado = 0L
    for (i in 0..maxOf(0, dias)) {
        val fecha = shiftDays(hoy, i)
        val entradas = entradasFuturas.filter { it.fecha == fecha }.sumOf { it.montoCop }
        val delDia = obligaciones.filter { it.fecha == fecha }
        val salidas = delDia.sumOf { it.montoCop ?: 0L }
        val saldo = saldoInicial + acumulado + entradas - salidas
        val diasRestantes = maxOf(1, dias - i + 1)
        val riesgo = when {
            saldo < 0 -> "deficit-proyectado"
            saldo < salidas * diasRestantes -> "ajustada"
            hayDesconocidas -> "incompleto"
            else -> "saludable"
        }
        puntos.add(
            PuntoProyeccionCompleta(
                fecha, saldo, entradas, salidas, salidas,
                maxOf(0L, Math.round(saldo.toDouble() / diasRestantes)), riesgo, delDia.map { it.concepto },
            ),
        )
        acumulado += entradas - salidas
    }
    return puntos
}
