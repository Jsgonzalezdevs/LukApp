package app.lukapp.dominio

/**
 * Origen: `lib/presupuestos.ts` (`EstadoPresupuesto`). `proyectadoCop` es una suposición
 * y se muestra aparte del gasto real; null en «todo el tiempo».
 */
data class EstadoPresupuesto(
    val categoria: String,
    val topeCop: Long,
    val gastadoCop: Long,
    val disponibleCop: Long,
    val pctUsado: Double,
    val proyectadoCop: Long?,
    val vaARebasar: Boolean,
    val excedidoCop: Long,
)

/** Origen: `lib/presupuestos.ts` (`gastadoEnCategoria`). Solo gastos del período. */
fun gastadoEnCategoria(transacciones: List<Transaccion>, clave: String, config: ConfigPeriodo, categoria: String): Long =
    transacciones.filter { it.kind == TipoTx.GASTO && it.category == categoria && enElPeriodo(it.occurredOn, clave, config) }
        .sumOf { it.amountCop }

/**
 * Origen: `lib/presupuestos.ts` (`promedioPorPeriodoCategoria`). Excluye el período en
 * curso: uno a medio transcurrir promedia bajo y sugeriría un tope irreal.
 */
fun promedioPorPeriodoCategoria(transacciones: List<Transaccion>, categoria: String, claveActual: String, config: ConfigPeriodo): Long? {
    if (config.frecuencia == FrecuenciaPeriodo.TODO_EL_TIEMPO) return null
    val porPeriodo = LinkedHashMap<String, Long>()
    for (tx in transacciones) {
        if (tx.kind != TipoTx.GASTO || tx.category != categoria) continue
        val clave = claveDePeriodo(tx.occurredOn, config)
        if (clave == claveActual) continue
        porPeriodo[clave] = (porPeriodo[clave] ?: 0L) + tx.amountCop
    }
    if (porPeriodo.isEmpty()) return null
    return Math.round(porPeriodo.values.sum().toDouble() / porPeriodo.size)
}

/**
 * Origen: `lib/presupuestos.ts` (`estadoDePresupuesto`). Sin días transcurridos no hay
 * ritmo (dividir daría infinito): se proyecta lo gastado.
 */
fun estadoDePresupuesto(presupuesto: Presupuesto, transacciones: List<Transaccion>, clave: String, hoy: String, config: ConfigPeriodo): EstadoPresupuesto {
    val gastado = gastadoEnCategoria(transacciones, clave, config, presupuesto.categoria)
    val tope = presupuesto.montoCop
    val dias = diasDelPeriodo(clave, config)
    val transcurridos = diasTranscurridosEnPeriodo(clave, hoy, config)
    val proyectado = when {
        dias == null || transcurridos == null -> null
        transcurridos == 0 -> gastado
        else -> Math.round(gastado.toDouble() / transcurridos * dias)
    }
    return EstadoPresupuesto(
        categoria = presupuesto.categoria,
        topeCop = tope,
        gastadoCop = gastado,
        disponibleCop = maxOf(0L, tope - gastado),
        pctUsado = if (tope == 0L) 0.0 else minOf(999.0, Math.round(gastado.toDouble() / tope * 1000) / 10.0),
        proyectadoCop = proyectado,
        vaARebasar = proyectado != null && proyectado > tope,
        excedidoCop = maxOf(0L, gastado - tope),
    )
}

/** Origen: `lib/presupuestos.ts` (`estadoDeTodos`). Los más apretados primero. */
fun estadoDeTodos(presupuestos: List<Presupuesto>, transacciones: List<Transaccion>, clave: String, hoy: String, config: ConfigPeriodo): List<EstadoPresupuesto> =
    presupuestos.map { estadoDePresupuesto(it, transacciones, clave, hoy, config) }.sortedByDescending { it.pctUsado }

/** Origen: `lib/presupuestos.ts` (`TonoPresupuesto`). */
object TonoPresupuesto {
    const val BIEN = "bien"
    const val ATENTO = "atento"
    const val EXCEDIDO = "excedido"
}

/**
 * Origen: `lib/presupuestos.ts` (`tonoDe`). `atento` avisa cuando todavía queda
 * período para corregir; el umbral es configurable (80 por defecto).
 */
fun tonoDe(estado: EstadoPresupuesto, umbralAlertaPct: Double = 80.0): String = when {
    estado.excedidoCop > 0 -> TonoPresupuesto.EXCEDIDO
    estado.vaARebasar || estado.pctUsado >= umbralAlertaPct -> TonoPresupuesto.ATENTO
    else -> TonoPresupuesto.BIEN
}
