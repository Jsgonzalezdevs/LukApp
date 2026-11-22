package app.lukapp.dominio

/** Origen: `lib/resumenMes.ts` (`Tono`). */
enum class Tono { NEUTRAL, BIEN, ATENTO }

/**
 * Origen: `lib/resumenMes.ts` (`TarjetaResumen`). El mes contado como historia: cada tarjeta
 * reusa una cuenta que la app ya hace y las condicionales se omiten en vez de mostrarse en cero.
 */
sealed interface TarjetaResumen {
    data class Portada(val mes: String) : TarjetaResumen
    data class Balance(val totals: MonthTotals) : TarjetaResumen
    data class CategoriaEstrella(val slice: CategorySlice) : TarjetaResumen
    data class CambioCategoriaTarjeta(val subida: CambioCategoria?, val bajada: CambioCategoria?) : TarjetaResumen
    data class GastoMasCaro(val tx: Transaccion) : TarjetaResumen
    data class DiasActivos(val activos: Int, val totalDias: Int) : TarjetaResumen
    data class Racha(val dias: Int) : TarjetaResumen
    data class ComparadoConPromedio(val gastosMesCop: Long, val promedioCop: Long, val deltaPct: Double, val meses: Int) : TarjetaResumen
    data class Cierre(val totals: MonthTotals, val tono: Tono, val frase: String) : TarjetaResumen
}

/** Días del mes que ya pasaron: no se cuentan como racha o actividad días que todavía no llegan. */
private fun diasTranscurridos(mes: String, hoy: String): Int {
    val total = diasEnMes(mes)
    if (mes > hoy.take(7)) return 0
    if (mes < hoy.take(7)) return total
    return minOf(total, hoy.substring(8, 10).toInt())
}

private fun diaDe(fecha: String): Int = fecha.substring(8, 10).toInt()

private fun fraseDeCierre(t: MonthTotals): Pair<Tono, String> = when {
    t.ingresos == 0L && t.gastos == 0L -> Tono.NEUTRAL to "Un mes sin movimientos registrados todavía."
    t.tasaAhorro != null && t.tasaAhorro >= 20 -> Tono.BIEN to "Guardaste una buena tajada este mes."
    t.balance < 0 -> Tono.ATENTO to "Este mes gastaste más de lo que entró."
    else -> Tono.NEUTRAL to "Otro mes más en el libro."
}

/** Cuántos meses de historia mirar hacia atrás para el promedio de comparación. */
private const val MESES_PROMEDIO = 6

/** Origen: `lib/resumenMes.ts` (`resumenDelMes`). */
fun resumenDelMes(transacciones: List<Transaccion>, mes: String, hoy: String): List<TarjetaResumen> {
    val delMes = forMonth(transacciones, mes)
    val totals = monthTotals(delMes)
    val tarjetas = mutableListOf<TarjetaResumen>(TarjetaResumen.Portada(mes), TarjetaResumen.Balance(totals))

    val gastosPorCategoria = byCategory(delMes, "gasto")
    if (gastosPorCategoria.isNotEmpty()) tarjetas.add(TarjetaResumen.CategoriaEstrella(gastosPorCategoria[0]))

    val mesAnterior = shiftMonth(mes, -1)
    if (forMonth(transacciones, mesAnterior).isNotEmpty()) {
        val cambios = compararCategorias(transacciones, mes, mesAnterior, "gasto")
        val subida = cambios.firstOrNull { it.deltaCop > 0 }
        val candidata = cambios.lastOrNull()
        val bajada = if (candidata != null && candidata.deltaCop < 0) candidata else null
        if (subida != null || bajada != null) tarjetas.add(TarjetaResumen.CambioCategoriaTarjeta(subida, bajada))
    }

    val gastos = delMes.filter { it.kind == "gasto" }
    if (gastos.isNotEmpty()) {
        // ">" estricto: en empate gana el primero, igual que el reduce de la web.
        tarjetas.add(TarjetaResumen.GastoMasCaro(gastos.reduce { max, tx -> if (tx.amountCop > max.amountCop) tx else max }))
    }

    val transcurridos = diasTranscurridos(mes, hoy)
    if (transcurridos > 0) {
        tarjetas.add(TarjetaResumen.DiasActivos(delMes.map { diaDe(it.occurredOn) }.toSet().size, transcurridos))
        val diasConGasto = gastos.map { diaDe(it.occurredOn) }.toSet()
        var racha = 0
        var mejor = 0
        for (dia in 1..transcurridos) {
            racha = if (dia in diasConGasto) 0 else racha + 1
            mejor = maxOf(mejor, racha)
        }
        tarjetas.add(TarjetaResumen.Racha(mejor))
    }

    val promedio = promedioMensual(serieMensual(transacciones, ultimosMeses(mesAnterior, MESES_PROMEDIO)))
    if (promedio.meses > 0 && promedio.gastos > 0) {
        tarjetas.add(
            TarjetaResumen.ComparadoConPromedio(
                totals.gastos, promedio.gastos,
                Math.round((totals.gastos - promedio.gastos).toDouble() / promedio.gastos * 1000) / 10.0,
                promedio.meses,
            ),
        )
    }

    val (tono, frase) = fraseDeCierre(totals)
    tarjetas.add(TarjetaResumen.Cierre(totals, tono, frase))
    return tarjetas
}

/** Origen: `lib/resumenMes.ts` (`textoParaCompartir`). El resumen en pocas líneas de texto plano. */
fun textoParaCompartir(tarjetas: List<TarjetaResumen>, nombreDe: (String) -> String): String {
    val portada = tarjetas.filterIsInstance<TarjetaResumen.Portada>().firstOrNull()
    val balance = tarjetas.filterIsInstance<TarjetaResumen.Balance>().firstOrNull()
    val estrella = tarjetas.filterIsInstance<TarjetaResumen.CategoriaEstrella>().firstOrNull()
    val racha = tarjetas.filterIsInstance<TarjetaResumen.Racha>().firstOrNull()

    val lineas = mutableListOf("Mi resumen de ${if (portada != null) monthKeyLabel(portada.mes) else "el mes"} en LukApp:")
    if (balance != null) lineas.add("Balance: ${formatCop(balance.totals.balance)}")
    if (estrella != null) lineas.add("Categoría estrella: ${nombreDe(estrella.slice.category)} (${formatCop(estrella.slice.total)})")
    if (racha != null && racha.dias > 0) lineas.add("${racha.dias} ${if (racha.dias == 1) "día seguido" else "días seguidos"} sin gastar")
    return lineas.joinToString("\n")
}
