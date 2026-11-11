package app.lukapp.dominio

import java.text.Collator
import java.util.Locale

/**
 * Origen: `lib/metas.ts` (`ProgresoMeta`). Los ritmos son null sin fecha, con la meta
 * cumplida o con la fecha vencida: un «ritmo necesario» hacia el pasado no es un número.
 */
data class ProgresoMeta(
    val ahorradoCop: Long,
    val objetivoCop: Long,
    val pct: Double,
    val faltaCop: Long,
    val completada: Boolean,
    val diasRestantes: Int?,
    val ritmoMensualCop: Long?,
    val ritmoQuincenalCop: Long?,
    val ritmoDiarioCop: Long?,
)

private const val DIAS_POR_MES = 30.44
private const val DIAS_POR_QUINCENA = 15.22

/**
 * Origen: `lib/metas.ts` (`progresoDeMeta`). Con cajita vinculada el avance sale de su
 * saldo, para que nunca se desvíe de la cajita que dice describir.
 */
fun progresoDeMeta(meta: Meta, saldosPorCajita: Map<String, Long>, hoy: String): ProgresoMeta {
    val ahorrado = if (meta.cajitaId != null) saldosPorCajita[meta.cajitaId] ?: 0L else meta.ahorradoCop
    val objetivo = meta.objetivoCop
    val falta = maxOf(0L, objetivo - ahorrado)
    val completada = objetivo > 0 && ahorrado >= objetivo
    val diasRestantes = meta.fechaObjetivo?.takeIf { it.isNotEmpty() }?.let { daysBetween(hoy, it) }
    var mensual: Long? = null
    var quincenal: Long? = null
    var diario: Long? = null
    if (!completada && diasRestantes != null && diasRestantes > 0) {
        mensual = Math.ceil(falta / (diasRestantes / DIAS_POR_MES)).toLong()
        quincenal = Math.ceil(falta / maxOf(1.0, diasRestantes / DIAS_POR_QUINCENA)).toLong()
        diario = Math.ceil(falta / maxOf(1.0, diasRestantes.toDouble())).toLong()
    }
    return ProgresoMeta(
        ahorradoCop = ahorrado,
        objetivoCop = objetivo,
        pct = if (objetivo > 0) minOf(100.0, Math.round(ahorrado.toDouble() / objetivo * 1000) / 10.0) else 0.0,
        faltaCop = falta,
        completada = completada,
        diasRestantes = diasRestantes,
        ritmoMensualCop = mensual,
        ritmoQuincenalCop = quincenal,
        ritmoDiarioCop = diario,
    )
}

/** Origen: `lib/metas.ts` (`MetaConProgreso`). */
data class MetaConProgreso(val meta: Meta, val progreso: ProgresoMeta)

/**
 * Origen: `lib/metas.ts` (`metasConProgreso`). Vivas y con fecha más cercana primero;
 * las abiertas después; las cumplidas al fondo.
 */
fun metasConProgreso(metas: List<Meta>, saldosPorCajita: Map<String, Long>, hoy: String): List<MetaConProgreso> {
    val colador = Collator.getInstance(Locale.forLanguageTag("es"))
    return metas.map { MetaConProgreso(it, progresoDeMeta(it, saldosPorCajita, hoy)) }.sortedWith { a, b ->
        if (a.progreso.completada != b.progreso.completada) return@sortedWith if (a.progreso.completada) 1 else -1
        val da = a.progreso.diasRestantes
        val db = b.progreso.diasRestantes
        when {
            da == null && db == null -> colador.compare(a.meta.nombre, b.meta.nombre)
            da == null -> 1
            db == null -> -1
            else -> da.compareTo(db)
        }
    }
}
