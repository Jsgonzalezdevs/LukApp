package app.lukapp.dominio

import app.lukapp.dominio.voz.ParsedTransaction
import app.lukapp.dominio.voz.parseTransaction
import java.text.Normalizer
import java.util.Locale

/**
 * Origen: `lib/filtros.ts`. Lo que se busca: cada campo es «sin opinión» por defecto, así un filtro intacto
 * coincide con todo. Las fechas son 'YYYY-MM-DD' y se comparan como texto, que es orden cronológico.
 */
data class Filtro(
    val texto: String = "",
    val categoria: String? = null,
    val cuentaId: String? = null,
    val kind: String? = null,
    val desde: String? = null,
    val hasta: String? = null,
)

val FILTRO_VACIO = Filtro()

/** Decide que la búsqueda alcance TODO el historial y no solo el mes visible. */
fun filtroActivo(f: Filtro): Boolean =
    f.texto.trim().isNotEmpty() || f.categoria != null || f.cuentaId != null || f.kind != null || f.desde != null || f.hasta != null

/** Con «45000», «45.000» y «$45,000» se busca lo mismo. */
private fun soloDigitos(t: String) = t.filter { it in '0'..'9' }

/**
 * Coincidencia de texto con todo lo que muestra la fila. La contraparte cuenta como campo propio: un banco escribe
 * «Envio con BRE-B a: JUAN PEREZ» y quien busca «juan perez» debe hallarlo. Además entiende frases («ingresos»,
 * «de ayer», una categoría clara) con el intérprete de movimientos.
 */
private fun calzaTexto(tx: Transaccion, consulta: String, catalogo: Catalogo?, intencion: ParsedTransaction?): Boolean {
    val q = normalizarNombre(consulta)
    if (q.isEmpty()) return true
    val campos = listOf(
        normalizarNombre(tx.description),
        normalizarNombre(extraerContraparte(tx.description) ?: ""),
        normalizarNombre(catalogo?.de(tx.category)?.nombre ?: tx.category),
    )
    if (campos.any { it.contains(q) }) return true
    val digitos = soloDigitos(consulta)
    if (digitos.isNotEmpty() && tx.amountCop.toString().contains(digitos)) return true
    if (intencion != null) {
        var magico = false
        if (intencion.signals.categorySource != "default" && intencion.signals.categorySource != "aprendida") {
            if (tx.category == intencion.category) magico = true
        }
        if (intencion.signals.kindSource != "default") {
            if (tx.kind == intencion.kind && consulta.trim().split(" ").size == 1) magico = true
        }
        val fecha = intencion.dateOverride?.takeIf { it.isNotEmpty() }
        if (fecha != null) {
            if (tx.occurredOn == fecha) {
                if (magico && tx.category != intencion.category) return false
                return true
            }
        } else if (magico) return true
    }
    return false
}

fun filtrarMovimientos(transacciones: List<Transaccion>, filtro: Filtro, catalogo: Catalogo? = null): List<Transaccion> {
    // El texto se interpreta UNA sola vez, y solo desde 3 letras.
    val intencion = if (filtro.texto.length >= 3) parseTransaction(filtro.texto) else null
    return transacciones.filter { tx ->
        if (filtro.kind != null && tx.kind != filtro.kind) return@filter false
        if (filtro.categoria != null && tx.category != filtro.categoria) return@filter false
        if (filtro.cuentaId != null && tx.cuentaId != filtro.cuentaId) return@filter false
        if (filtro.desde != null && tx.occurredOn < filtro.desde) return@filter false
        if (filtro.hasta != null && tx.occurredOn > filtro.hasta) return@filter false
        calzaTexto(tx, filtro.texto, catalogo, intencion)
    }
}

data class ResumenFiltro(val cuantos: Int, val gastoCop: Long, val ingresoCop: Long)

/** Lo que suma el resultado, para que una vista filtrada siga respondiendo «cuánto». */
fun resumirFiltrado(txs: List<Transaccion>): ResumenFiltro {
    var gasto = 0L; var ingreso = 0L
    for (t in txs) if (t.kind == TipoTx.INGRESO) ingreso += t.amountCop else gasto += t.amountCop
    return ResumenFiltro(txs.size, gasto, ingreso)
}

// ── lib/navegacionFunciones.ts (`buscarFunciones`) ──

/** Una función de LukApp a la que se puede saltar desde el buscador. Solo van las que ya existen en nativo. */
data class FuncionBuscable(val id: String, val titulo: String, val ayuda: String, val alias: String)

val FUNCIONES_BUSCABLES: List<FuncionBuscable> = listOf(
    FuncionBuscable("topes", "Topes de gasto", "Te avisa antes de que te pases", ""),
    FuncionBuscable("recurrentes", "Pagos fijos", "Lo que te cobran todos los meses", "suscripciones netflix arriendo recibos cobros"),
    FuncionBuscable("calendario", "Calendario financiero", "Pagos e ingresos futuros", "agenda fechas vencimientos"),
    FuncionBuscable("dinero", "Cuentas, tarjetas y ahorros", "Dónde tienes tu dinero y cuánto debes", "bancos efectivo billetera deudas"),
    FuncionBuscable("asesor", "Asesor", "Pregúntale a Luki por tus finanzas", "ia inteligencia artificial luki consejos"),
)

private fun sinTildesBusqueda(t: String) = Normalizer.normalize(t, Normalizer.Form.NFD).replace(Regex("[\\u0300-\\u036f]"), "").lowercase(Locale.forLanguageTag("es")).trim()

fun buscarFunciones(texto: String): List<FuncionBuscable> {
    val palabras = sinTildesBusqueda(texto).split(Regex("\\s+")).filter { it.isNotEmpty() }
    if (palabras.isEmpty()) return emptyList()
    return FUNCIONES_BUSCABLES.filter { f -> palabras.all { p -> sinTildesBusqueda("${f.titulo} ${f.ayuda} ${f.alias}").contains(p) } }
}
