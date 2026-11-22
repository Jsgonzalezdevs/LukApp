package app.lukapp.dominio

/**
 * Origen: `lib/senales.ts` + `lib/bandejaRevision.ts`. De las seis señales de la web solo se portan
 * las dos que la bandeja toma («duplicado» e «inusual»): son las únicas que pueden pedir una
 * decisión; las demás (recurrente, hormiga, creciendo, nuevo) solo se leen en el detalle de un
 * movimiento, que aún no las muestra.
 */
private const val MUESTRAS_MINIMAS = 5
private const val VECES_INUSUAL = 3

private data class Senal(val tipo: String, val titulo: String, val detalle: String, val peso: Int)

/** Lo que las dos señales necesitan saber del historial, reunido en una sola pasada. */
private class IndiceSenales(historial: List<Transaccion>, val nombreCategoria: (String) -> String) {
    val medianaPorCategoria = HashMap<String, Double>()
    val cuantosPorCategoria = HashMap<String, Int>()
    val porDiaMontoParte = HashMap<String, Int>()

    init {
        val montos = HashMap<String, MutableList<Long>>()
        for (tx in historial) {
            montos.getOrPut("${tx.kind}|${tx.category}") { mutableListOf() }.add(tx.amountCop)
            val parte = claveDeParte(tx)
            if (parte.isNotEmpty()) porDiaMontoParte.merge("${tx.occurredOn}|${tx.amountCop}|${tx.kind}|$parte", 1, Int::plus)
        }
        for ((cat, lista) in montos) { medianaPorCategoria[cat] = mediana(lista); cuantosPorCategoria[cat] = lista.size }
    }
}

/** Mediana: el valor del medio, o el promedio de los dos del medio. */
private fun mediana(valores: List<Long>): Double {
    if (valores.isEmpty()) return 0.0
    val orden = valores.sorted()
    val medio = orden.size / 2
    return if (orden.size % 2 == 0) (orden[medio - 1] + orden[medio]) / 2.0 else orden[medio].toDouble()
}

/** Cómo se identifica un movimiento entre meses: con quién fue, o si no su texto. */
private fun claveDeParte(tx: Transaccion): String = (extraerContraparte(tx.description) ?: tx.description).trim().lowercase()

private fun senalInusual(tx: Transaccion, i: IndiceSenales): Senal? {
    val cat = "${tx.kind}|${tx.category}"
    if ((i.cuantosPorCategoria[cat] ?: 0) < MUESTRAS_MINIMAS) return null
    val base = i.medianaPorCategoria[cat] ?: 0.0
    if (base <= 0) return null
    val veces = tx.amountCop / base
    if (veces < VECES_INUSUAL) return null
    return Senal(
        "inusual", "El monto fue mayor de lo normal",
        "En ${i.nombreCategoria(tx.category)}, suele rondar ${formatCop(Math.round(base))}. Este movimiento fue de ${formatCop(tx.amountCop)}.",
        if (veces >= 5) 0 else 1,
    )
}

private fun senalDuplicado(tx: Transaccion, i: IndiceSenales): Senal? {
    val parte = claveDeParte(tx)
    if (parte.isEmpty()) return null
    val cuantos = i.porDiaMontoParte["${tx.occurredOn}|${tx.amountCop}|${tx.kind}|$parte"] ?: 0
    if (cuantos < 2) return null
    return Senal("duplicado", "Hay otro idéntico ese día", "$cuantos cobros iguales de ${formatCop(tx.amountCop)} el mismo día. Puede ser real, o un cobro doble.", 1)
}

/** Origen: `lib/bandejaRevision.ts`. Une lo detectado en el historial con las decisiones ya guardadas. */
fun construirBandejaRevision(transacciones: List<Transaccion>, guardadas: List<RevisionDudosa>, catalogo: Catalogo): List<RevisionDudosa> {
    val indice = IndiceSenales(transacciones) { catalogo.de(it).nombre }
    val porId = LinkedHashMap<String, RevisionDudosa>()
    guardadas.forEach { porId[it.id] = it }

    for (tx in transacciones) {
        // Mismo orden que `senalesConIndice`: de la más urgente a la menos, y a igual urgencia duplicado antes que inusual.
        val senales = listOfNotNull(senalDuplicado(tx, indice), senalInusual(tx, indice)).sortedBy { it.peso }
        for (s in senales) {
            val id = "senal:${tx.id}:${s.tipo}"
            if (id in porId) continue
            porId[id] = RevisionDudosa(id, "movimiento", "pendiente", tx.id, s.titulo, s.detalle, null, null, tx.createdAt, tx.createdAt)
        }
    }
    // Pendientes primero; dentro de cada grupo, lo más reciente arriba.
    return porId.values.sortedWith { a, b ->
        if (a.estado == b.estado) b.updatedAt.compareTo(a.updatedAt) else if (a.estado == "pendiente") -1 else 1
    }
}
