package app.lukapp.dominio

import java.time.YearMonth
import java.util.Locale

/**
 * Origen: `lib/insights.ts`. «Para ti»: lo que la app nota por su cuenta.
 *
 * Todo se CALCULA, nunca se le pide a un modelo: una cifra inventada sobre la plata de
 * alguien es peor que ninguna. Corre en el aparato y funciona sin conexión. Los umbrales
 * (25 %, 20 mil, 6 compras…) son los de la web, no se retocan aquí.
 */
data class Insight(
    val id: String,
    val titulo: String,
    val detalle: String,
    /** neutral | bien | atento */
    val tono: String,
    /** «mes», «dinero» o null: qué sección abrir. */
    val seccion: String?,
    val origenIa: Boolean = false,
)

/** `Math.round` de JavaScript: los .5 suben, también en negativos. */
private fun redondeoJs(x: Double): Long = Math.floor(x + 0.5).toLong()

/** Un `number` de JS al convertirse en texto: sin «.0» de más. */
private fun numeroJs(x: Double): String = if (x == Math.rint(x)) x.toLong().toString() else x.toString()

private fun redondeoPct(n: Double): Double = redondeoJs(n * 10) / 10.0

private fun agrupar(n: Long): String {
    val s = Math.abs(n).toString()
    val sb = StringBuilder()
    for (i in s.indices) { if (i > 0 && (s.length - i) % 3 == 0) sb.append('.'); sb.append(s[i]) }
    return (if (n < 0) "-" else "") + sb
}

/** `formatCopCorto`: cifras para una frase, no para un libro contable. */
fun formatCopCorto(valor: Long): String {
    val millones = valor / 1_000_000.0
    if (Math.abs(millones) >= 1) {
        val t = String.format(Locale.ROOT, if (millones >= 10) "%.0f" else "%.1f", millones)
        return "$" + t.replaceFirst(".0", "") + "M"
    }
    return "$" + agrupar(redondeoJs(valor / 1000.0)) + " mil"
}

private fun mesesConHistoria(txs: List<Transaccion>, mes: String): Set<String> =
    txs.map { monthKey(it.occurredOn) }.filter { it < mes }.toSet()

private fun gastosDelMes(txs: List<Transaccion>, mes: String) = txs.filter { it.kind == TipoTx.GASTO && monthKey(it.occurredOn) == mes }

/** Con menos de tres días transcurridos el «ritmo» es el azar de qué se compró ese día. */
private fun proyeccionDeCierre(txs: List<Transaccion>, mes: String, hoy: String): Insight? {
    if (monthKey(hoy) != mes) return null
    val diaHoy = hoy.substring(8, 10).toInt()
    if (diaHoy < 3) return null
    val (anio, m) = mes.split("-").map { it.toInt() }
    val diasDelMes = YearMonth.of(anio, m).lengthOfMonth()
    val gastado = gastosDelMes(txs, mes).sumOf { it.amountCop }
    if (gastado == 0L) return null
    val proyectado = redondeoJs(gastado.toDouble() / diaHoy * diasDelMes)
    return Insight(
        "proyeccion-cierre", "Vas camino a cerrar el mes en ${formatCopCorto(proyectado)}",
        "Llevas ${formatCopCorto(gastado)} en $diaHoy de $diasDelMes días. Si sigues a este ritmo, así cierra el mes.", "neutral", "mes",
    )
}

/** Contra el promedio propio de los tres meses previos: el único punto de comparación justo es uno mismo. */
private fun desviacionPorCategoria(txs: List<Transaccion>, mes: String, nombreDe: (String) -> String): Insight? {
    val historial = mesesConHistoria(txs, mes)
    if (historial.size < 2) return null
    val previos = historial.sorted().takeLast(3)
    val esteMesPorCat = LinkedHashMap<String, Long>()
    for (tx in gastosDelMes(txs, mes)) esteMesPorCat[tx.category] = (esteMesPorCat[tx.category] ?: 0L) + tx.amountCop
    var peorCat: String? = null; var peorPct = 0.0; var peorEste = 0L; var peorProm = 0.0
    for ((cat, este) in esteMesPorCat) {
        if (este < 20_000) continue
        val suma = previos.sumOf { m -> gastosDelMes(txs, m).filter { it.category == cat }.sumOf { it.amountCop } }
        val prom = suma.toDouble() / previos.size
        if (prom < 10_000) continue
        val pct = (este - prom) / prom * 100
        if (pct > peorPct) { peorPct = pct; peorCat = cat; peorEste = este; peorProm = prom }
    }
    if (peorCat == null || peorPct < 25) return null
    return Insight(
        "desviacion-$peorCat", "${nombreDe(peorCat)} subió ${numeroJs(redondeoPct(peorPct))}% este mes",
        "Llevas ${formatCopCorto(peorEste)}, contra un promedio de ${formatCopCorto(redondeoJs(peorProm))} en los últimos ${previos.size} meses.", "atento", "mes",
    )
}

/** Muchas compras chiquitas que juntas ya son una cifra seria; hace falta un patrón, no dos datos. */
private fun gastoHormiga(txs: List<Transaccion>, mes: String, nombreDe: (String) -> String): Insight? {
    val chiquitos = gastosDelMes(txs, mes).filter { it.amountCop < 10_000 }
    if (chiquitos.size < 6) return null
    val total = chiquitos.sumOf { it.amountCop }
    if (total < 30_000) return null
    val totalMes = gastosDelMes(txs, mes).sumOf { it.amountCop }
    val pctGasto = if (totalMes > 0) redondeoJs(total.toDouble() / totalMes * 100) else 0L
    val conteo = LinkedHashMap<String, Int>()
    for (t in chiquitos) conteo[t.category] = (conteo[t.category] ?: 0) + 1
    var topCat: String? = null; var topCount = 0
    for ((cat, n) in conteo) if (n > topCount) { topCount = n; topCat = cat }
    var detalle = "Nada de esto se ve grande solo, pero junto sí es plata. Vale la pena mirarlo."
    if (topCat != null && topCount >= 4) {
        detalle = "La mayoría ($topCount) son en ${nombreDe(topCat)}. Proyectado al año sumarían ${formatCopCorto(total * 12)}."
    } else if (pctGasto >= 10) {
        detalle = "Representan el $pctGasto% de tus gastos del mes. Un recorte del 30% liberaría ${formatCopCorto(redondeoJs(total * 0.3))}."
    }
    return Insight("gasto-hormiga", "${chiquitos.size} compras chiquitas suman ${formatCopCorto(total)}", detalle, "neutral", "mes")
}

/** Este SÍ usa el período real configurado, para que la cifra coincida con la pantalla de topes. */
private fun avisoDePresupuesto(
    presupuestos: List<Presupuesto>, txs: List<Transaccion>, clave: String, hoy: String, nombreDe: (String) -> String, config: ConfigPeriodo, umbral: Int,
): Insight? {
    val critico = estadoDeTodos(presupuestos, txs, clave, hoy, config).firstOrNull { tonoDe(it, umbral.toDouble()) != TonoPresupuesto.BIEN } ?: return null
    val excedido = critico.excedidoCop > 0
    val nombre = nombreDe(critico.categoria)
    return Insight(
        "presupuesto-${critico.categoria}",
        if (excedido) "Te pasaste ${formatCopCorto(critico.excedidoCop)} en $nombre" else "$nombre va camino a pasarse del presupuesto",
        when {
            excedido -> "El tope era ${formatCopCorto(critico.topeCop)} y llevas ${formatCopCorto(critico.gastadoCop)}."
            critico.proyectadoCop == null -> "Llevas ${formatCopCorto(critico.gastadoCop)} de un tope de ${formatCopCorto(critico.topeCop)}."
            else -> "Al ritmo actual cierras en ${formatCopCorto(critico.proyectadoCop)}, y el tope es ${formatCopCorto(critico.topeCop)}."
        },
        "atento", "mes",
    )
}

private fun tasaDeAhorroInsight(txs: List<Transaccion>, mes: String): Insight? {
    val ingresos = txs.filter { it.kind == TipoTx.INGRESO && monthKey(it.occurredOn) == mes }.sumOf { it.amountCop }
    val gastos = gastosDelMes(txs, mes).sumOf { it.amountCop }
    if (ingresos < 150_000) return null
    val tasa = redondeoJs((ingresos - gastos).toDouble() / ingresos * 100)
    if (tasa >= 40) return Insight(
        "tasa-ahorro-alta", "Tasa de ahorro del $tasa% este mes",
        "Has retenido ${formatCopCorto(ingresos - gastos)} de tus ingresos. Excelente margen para tus metas.", "bien", "mes",
    )
    if (tasa < 0 && gastos > 100_000) return Insight(
        "balance-negativo-mes", "Gastos superan ingresos por ${formatCopCorto(gastos - ingresos)}",
        "Llevas ${formatCopCorto(gastos)} en salidas frente a ${formatCopCorto(ingresos)} de entradas este mes.", "atento", "mes",
    )
    return null
}

/** Una sola transacción muy grande que sesga el mes. */
private fun mayorGastoMes(txs: List<Transaccion>, mes: String, nombreDe: (String) -> String): Insight? {
    val gastos = gastosDelMes(txs, mes)
    if (gastos.size < 4) return null
    val total = gastos.sumOf { it.amountCop }
    if (total < 100_000) return null
    val max = gastos.fold(gastos[0]) { prev, cur -> if (cur.amountCop > prev.amountCop) cur else prev }
    val pct = redondeoJs(max.amountCop.toDouble() / total * 100)
    if (pct >= 35 && max.amountCop >= 50_000) {
        val desc = max.description.trim().ifEmpty { nombreDe(max.category) }
        return Insight(
            "gran-gasto-${max.id}", "${desc.take(22)} concentró $pct% del mes",
            "Un solo movimiento de ${formatCopCorto(max.amountCop)} representó más de un tercio de todas tus salidas.", "neutral", "mes",
        )
    }
    return null
}

/** Los insights del mes, lo «atento» primero, máximo tres: una lista larga se vuelve papel tapiz. */
fun insightsDelMes(
    txs: List<Transaccion>, presupuestos: List<Presupuesto>, mes: String, hoy: String, nombreDe: (String) -> String,
    config: ConfigPeriodo = PERIODO_POR_DEFECTO, umbralAlertaPct: Int = 80,
): List<Insight> {
    val clave = claveDePeriodo(hoy, config)
    val orden = mapOf("atento" to 0, "bien" to 1, "neutral" to 2)
    return listOfNotNull(
        avisoDePresupuesto(presupuestos, txs, clave, hoy, nombreDe, config, umbralAlertaPct),
        desviacionPorCategoria(txs, mes, nombreDe),
        gastoHormiga(txs, mes, nombreDe),
        proyeccionDeCierre(txs, mes, hoy),
        tasaDeAhorroInsight(txs, mes),
        mayorGastoMes(txs, mes, nombreDe),
    ).sortedBy { orden.getValue(it.tono) }.take(3)
}

/** `handleConsultarTipEnAsesor`: la pregunta que se le manda al Asesor al tocar un insight. */
fun promptDeInsight(i: Insight): String =
    "Hola asesor, sobre este dato de mis finanzas: \"${i.titulo} - ${i.detalle}\", ¿qué análisis detallado y recomendaciones prácticas me das al respecto?"

/** `abrirResumenPremium`: el insight del Pulso Premium convertido en pregunta. */
fun promptPulsoPremium(disponibleDiarioCop: Long, diasRestantes: Int, insight: Insight?): String {
    val senal = if (insight != null) "Además, LukApp detectó: “${insight.titulo}: ${insight.detalle}”." else "No hay una alerta adicional prioritaria hoy."
    return promptDeInsight(Insight(
        "pulso-premium", "Mi Pulso Premium",
        "Tengo ${formatCop(disponibleDiarioCop)} para usar hoy durante los $diasRestantes días restantes del período. $senal Quiero entender qué podría cambiar ese margen y cuál sería la mejor decisión ahora.",
        "neutral", null, true,
    ))
}
