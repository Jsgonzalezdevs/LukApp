package app.lukapp.dominio

import app.lukapp.dominio.voz.normalizeWord
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

// Origen: `analista/` de la web (tipos.ts, aMovimientos.ts, totales.ts, revisionesImportacion.ts). El servidor es el
// mismo (`POST /api/analizar-extracto`), así que la forma de la respuesta es la de la web.

object MotivoExclusion {
    const val TRASLADO_PROPIO = "traslado-propio"
    const val PAGO_TARJETA = "pago-tarjeta"
    const val REVERSO = "reverso"
    const val SALDO_INFORMATIVO = "saldo-informativo"
}

/** La respuesta trae los montos como número cualquiera; en el dominio son pesos enteros. */
@Serializable
data class MovimientoExtraidoDto(
    val fecha: String,
    val descripcion: String,
    val montoCop: Double,
    val tipo: String,
    val categoria: String = "otros",
    val detalle: String? = null,
    val contraparte: String? = null,
    val confianza: String = "alta",
    val exclusion: String? = null,
    val afectaSaldo: Boolean? = null,
)

data class MovimientoExtraido(
    val fecha: String,
    val descripcion: String,
    val montoCop: Long,
    val tipo: String,
    val categoria: String,
    val detalle: String?,
    val contraparte: String?,
    val confianza: String,
    val exclusion: String?,
    val afectaSaldo: Boolean?,
)

fun MovimientoExtraidoDto.aDominio() = MovimientoExtraido(fecha, descripcion, Math.round(montoCop), tipo, categoria, detalle, contraparte, confianza, exclusion, afectaSaldo)

@Serializable data class PeriodoExtracto(val desde: String = "", val hasta: String = "", val etiqueta: String = "")
@Serializable data class FilaMetrica(val etiqueta: String, val valorCop: Double = 0.0, val nota: String? = null)
@Serializable data class AlertaExtracto(val severidad: String = "baja", val titulo: String, val detalle: String)
@Serializable data class RecomendacionExtracto(val titulo: String, val detalle: String, val ahorroMensualCop: Double? = null)

@Serializable
data class AnalisisDto(
    val entidad: String? = null,
    val periodo: PeriodoExtracto = PeriodoExtracto(),
    val veredicto: String = "",
    val metricas: List<FilaMetrica> = emptyList(),
    val alertas: List<AlertaExtracto> = emptyList(),
    val recomendaciones: List<RecomendacionExtracto> = emptyList(),
    val movimientos: List<MovimientoExtraidoDto> = emptyList(),
    val advertencias: List<String> = emptyList(),
)

data class AnalisisResultado(
    val entidad: String?,
    val periodo: PeriodoExtracto,
    val veredicto: String,
    val metricas: List<FilaMetrica>,
    val alertas: List<AlertaExtracto>,
    val recomendaciones: List<RecomendacionExtracto>,
    val movimientos: List<MovimientoExtraido>,
    val advertencias: List<String>,
)

fun AnalisisDto.aDominio() = AnalisisResultado(entidad, periodo, veredicto, metricas, alertas, recomendaciones, movimientos.map { it.aDominio() }, advertencias)

@Serializable
data class RespuestaExtractoDto(val ok: Boolean = false, val resultado: AnalisisDto? = null, val codigo: String? = null, val mensaje: String? = null)

/** Lo que el servidor puede contestar; los códigos son los de `CodigoError` de la web. */
sealed interface RespuestaExtracto {
    data class Listo(val resultado: AnalisisResultado) : RespuestaExtracto
    data class Error(val codigo: String, val mensaje: String) : RespuestaExtracto {
        /** La contraseña se pide aquí mismo (nunca se guarda). */
        val pideContrasena get() = codigo == "pdf-contrasena-requerida" || codigo == "pdf-contrasena-invalida"
    }
}

private val json = Json { ignoreUnknownKeys = true }

/** Lee el cuerpo de la respuesta. Algo que no es de este contrato es un fallo, no un extracto vacío. */
fun leerRespuestaExtracto(cuerpo: String): RespuestaExtracto = try {
    val r = json.decodeFromString<RespuestaExtractoDto>(cuerpo)
    if (r.ok && r.resultado != null) RespuestaExtracto.Listo(r.resultado.aDominio())
    else RespuestaExtracto.Error(r.codigo ?: "fallo-interno", r.mensaje ?: "No se pudo analizar el extracto.")
} catch (_: Exception) { RespuestaExtracto.Error("fallo-interno", "El servidor respondió algo que no se pudo leer.") }

/** El tope de la web (`MAX_BYTES` de useAnalista.ts y `MAX_BYTES_PDF` del servidor). */
const val MAX_BYTES_EXTRACTO = 4 * 1024 * 1024

data class PosibleDuplicado(
    /** Estable entre recálculos: lo que la pantalla recuerda de una fila (la casilla marcada) cuelga de esto. */
    val clave: String,
    val movimiento: MovimientoExtraido,
    val yaTengo: Transaccion,
    /** Listo para escribir, por si la persona dice que de verdad son distintos. */
    val transaccion: Transaccion,
)

data class PlanDeImportacion(
    val nuevos: List<Transaccion>,
    val duplicados: List<MovimientoExtraido>,
    val posibles: List<PosibleDuplicado>,
    val excluidos: List<MovimientoExtraido>,
)

private fun claveAproximada(fecha: String, tipo: String, monto: Long) = "$fecha|$tipo|$monto"

/** Identidad de un movimiento: día, sentido, monto exacto y descripción normalizada («MERCADO EXITO» = «Mercado Éxito»). */
fun claveDeMovimiento(fecha: String, tipo: String, monto: Long, descripcion: String): String =
    "$fecha|$tipo|$monto|${normalizeWord(descripcion).replace(Regex("\\s+"), " ").trim()}"

private fun claveDeTransaccion(t: Transaccion) = claveDeMovimiento(t.occurredOn, t.kind, t.amountCop, t.description)

/**
 * Origen: `planearImportacion`. Lo que se importa es lo que el extracto trae DE MÁS sobre lo que el libro ya tiene
 * por cada clave: subir el mismo extracto dos veces no hace nada, uno que se solapa trae solo las líneas nuevas, y dos
 * cafés iguales el mismo día siguen siendo dos. Lo que cae el mismo día, sentido y monto pero con otro texto (lo normal
 * en lo anotado a mano) no se importa ni se descarta solo: queda como «posible» para que la persona decida.
 */
fun planearImportacion(
    movimientos: List<MovimientoExtraido>,
    existentes: List<Transaccion>,
    hacerId: () -> String,
    ahora: () -> String = { java.time.Instant.now().toString() },
    cuentaId: String? = null,
): PlanDeImportacion {
    val yaTengo = HashMap<String, Int>()
    val porAproximada = HashMap<String, MutableList<Transaccion>>()
    for (t in existentes) {
        val c = claveDeTransaccion(t)
        yaTengo[c] = (yaTengo[c] ?: 0) + 1
        porAproximada.getOrPut(claveAproximada(t.occurredOn, t.kind, t.amountCop)) { mutableListOf() }.add(t)
    }
    // Una entrada solo se puede emparejar una vez, por cualquiera de las dos vías.
    val reclamados = HashSet<String>()
    fun reclamarExacto(clave: String) {
        val (fecha, tipo, monto) = clave.split('|')
        porAproximada["$fecha|$tipo|$monto"]?.firstOrNull { it.id !in reclamados && claveDeTransaccion(it) == clave }?.let { reclamados.add(it.id) }
    }

    val nuevos = mutableListOf<Transaccion>()
    val duplicados = mutableListOf<MovimientoExtraido>()
    val posibles = mutableListOf<PosibleDuplicado>()
    val excluidos = mutableListOf<MovimientoExtraido>()

    for (mov in movimientos) {
        if (mov.exclusion != null) { excluidos.add(mov); continue }
        // Un movimiento de cero no es un movimiento: el esquema lo rechaza y tumbaría toda la importación.
        if (mov.montoCop <= 0) continue
        val clave = claveDeMovimiento(mov.fecha, mov.tipo, mov.montoCop, mov.descripcion)
        val restantes = yaTengo[clave] ?: 0
        if (restantes > 0) { yaTengo[clave] = restantes - 1; reclamarExacto(clave); duplicados.add(mov); continue }

        fun construir() = Transaccion(
            id = hacerId(), kind = mov.tipo, amountCop = mov.montoCop, category = mov.categoria, description = mov.descripcion,
            occurredOn = mov.fecha, cuentaId = cuentaId, afectaSaldo = mov.afectaSaldo ?: true, rawTranscript = "extracto: ${mov.descripcion}", createdAt = ahora(),
        )
        val yaTeniaUno = porAproximada[claveAproximada(mov.fecha, mov.tipo, mov.montoCop)]?.firstOrNull { it.id !in reclamados }
        if (yaTeniaUno != null) { reclamados.add(yaTeniaUno.id); posibles.add(PosibleDuplicado(clave, mov, yaTeniaUno, construir())); continue }
        // El origen queda en rawTranscript: una fila de extracto siempre se distingue de una dictada.
        nuevos.add(construir())
    }
    return PlanDeImportacion(nuevos, duplicados, posibles, excluidos)
}

data class ExclusionTotal(val motivo: String, val cuantos: Int, val montoCop: Long)
data class TotalesAnalisis(val ingresos: Long, val gastos: Long, val balance: Long, val contados: Int, val excluidos: List<ExclusionTotal>)

private val ETIQUETA_EXCLUSION = mapOf(
    MotivoExclusion.TRASLADO_PROPIO to "Traslados entre tus cuentas",
    MotivoExclusion.PAGO_TARJETA to "Pagos a tarjeta de crédito",
    MotivoExclusion.REVERSO to "Reversos y devoluciones",
    MotivoExclusion.SALDO_INFORMATIVO to "Filas informativas de saldo",
)

/**
 * Origen: `totalesDelAnalisis`. Un extracto no es un libro de actividad neta: lista traslados entre cuentas propias, pagos de
 * tarjeta cuyas compras salen aparte y reversos. Sumarlo todo infla los dos lados; por eso solo cuentan las filas sin
 * exclusión, y las excluidas se devuelven para que se vean.
 */
fun totalesDelAnalisis(movimientos: List<MovimientoExtraido>): TotalesAnalisis {
    var ingresos = 0L; var gastos = 0L; var contados = 0
    val porMotivo = LinkedHashMap<String, Pair<Int, Long>>()
    for (m in movimientos) {
        if (m.exclusion != null) { val a = porMotivo[m.exclusion] ?: (0 to 0L); porMotivo[m.exclusion] = (a.first + 1) to (a.second + m.montoCop); continue }
        contados++
        if (m.tipo == "ingreso") ingresos += m.montoCop else gastos += m.montoCop
    }
    return TotalesAnalisis(
        ingresos, gastos, ingresos - gastos, contados,
        porMotivo.map { (k, v) -> ExclusionTotal(ETIQUETA_EXCLUSION[k] ?: k, v.first, v.second) }.sortedByDescending { it.montoCop },
    )
}

data class RebanadaAnalisis(val categoria: String, val total: Long, val pct: Double)

/** Origen: `rebanadasDelAnalisis`. Total por categoría de un sentido, solo filas contadas, de mayor a menor. */
fun rebanadasDelAnalisis(movimientos: List<MovimientoExtraido>, tipo: String): List<RebanadaAnalisis> {
    val t = LinkedHashMap<String, Long>()
    for (m in movimientos) if (m.exclusion == null && m.tipo == tipo) t[m.categoria] = (t[m.categoria] ?: 0L) + m.montoCop
    val gran = t.values.sum()
    if (gran == 0L) return emptyList()
    return t.map { (c, v) -> RebanadaAnalisis(c, v, Math.round(v.toDouble() / gran * 1000) / 10.0) }
        .sortedWith(compareByDescending<RebanadaAnalisis> { it.total }.thenBy { it.categoria })
}

/** Origen: `metricasCoherentes`. Si la tabla de métricas del modelo no cuadra con los movimientos, se confía en los movimientos. */
fun metricasCoherentes(r: AnalisisResultado, tolerancia: Double = 0.02): Boolean {
    val propios = totalesDelAnalisis(r.movimientos)
    val declarado = r.metricas.firstOrNull { Regex("gasto total|total de gastos", RegexOption.IGNORE_CASE).containsMatchIn(it.etiqueta) }
    if (declarado == null || propios.gastos == 0L) return true
    return Math.abs(declarado.valorCop - propios.gastos) / propios.gastos <= tolerancia
}

/** Origen: `crearRevisionesImportacion`. Deja en «Revisar movimientos» lo que la persona aún quiere mirar y sus decisiones sobre duplicados. */
fun crearRevisionesImportacion(
    trabajoId: String,
    documento: String,
    transacciones: List<Transaccion>,
    movimientosDudosos: List<MovimientoExtraido>,
    posiblesConfirmados: List<PosibleDuplicado>,
    transferenciasExcluidas: List<MovimientoExtraido>,
    ahora: String,
): List<RevisionDudosa> {
    val r = mutableListOf<RevisionDudosa>()
    for (tx in transacciones) {
        val dudosa = movimientosDudosos.firstOrNull { it.fecha == tx.occurredOn && it.montoCop == tx.amountCop && it.descripcion == tx.description }
        if (dudosa != null) r.add(RevisionDudosa(
            "documento:${tx.id}", "documento", "pendiente", tx.id, "Confirma la lectura de esta fila",
            "El lector marcó esta fila con confianza ${dudosa.confianza}. Revisa fecha, descripción y monto para asegurar que quedó bien transcrita.", documento, null, tx.createdAt, tx.createdAt,
        ))
        if (tx.kind == "transferencia" || tx.category == "transferencia") r.add(RevisionDudosa(
            "transferencia:${tx.id}", "transferencia", "pendiente", tx.id, "Confirma esta transferencia",
            "Revisa si fue un movimiento entre cuentas tuyas y comprueba los saldos de origen y destino.", documento, null, tx.createdAt, tx.createdAt,
        ))
    }
    for (p in posiblesConfirmados) r.add(RevisionDudosa(
        "posible:${p.transaccion.id}", "movimiento", "resuelta", p.transaccion.id, "Posible duplicado confirmado como distinto",
        "En el extracto: ${p.movimiento.descripcion}. Ya estaba anotado: ${p.yaTengo.description}.", documento,
        "Confirmaste que son dos movimientos diferentes y elegiste importar ambos.", p.transaccion.createdAt, p.transaccion.createdAt,
    ))
    for (e in transferenciasExcluidas) r.add(RevisionDudosa(
        "transferencia-excluida:$trabajoId:${e.fecha}:${e.montoCop}:${e.descripcion}", "transferencia", "pendiente", null, "Verifica una transferencia del extracto",
        "${e.fecha} · ${e.descripcion} · ${formatCop(e.montoCop)}. Se excluyó del total como traslado entre cuentas propias; confirma que no debía registrarse de otra forma.", documento, null, ahora, ahora,
    ))
    return r
}
