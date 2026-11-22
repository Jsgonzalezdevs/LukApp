package app.lukapp.dominio

import app.lukapp.dominio.voz.LEXICO_VACIO
import app.lukapp.dominio.voz.capitalizarJs
import app.lukapp.dominio.voz.js
import app.lukapp.dominio.voz.parseTransaction
import app.lukapp.dominio.voz.reemplazarTodos

/** Origen: `lib/propuestasAsesor.ts` (`PropuestaAsesor`). */
sealed interface PropuestaAsesor {
    data class Presupuesto(val categoria: String, val montoCop: Long) : PropuestaAsesor
    data class Meta(val nombre: String, val objetivoCop: Long, val fechaObjetivo: String?) : PropuestaAsesor
}

private val REGEX_PARA = js("""\bpara\s+(.+?)(?:[.!?,]|$)""", "i")
private val REGEX_PALABRAS = js("""\b(?:ahorrar|guardar|crear|una|un|mi|meta|objetivo|de|por|pesos?|cop|en|este|esta|durante|meses?|mes)\b""", "gi")
private val REGEX_MONTO = js("""\$?\s*\d[\d.,]*(?:\s*(?:mil|millones?|lucas))?""", "gi")
private val REGEX_ESPACIOS = js("""\s+""", "g")
private val REGEX_ACCION = js("""\b(?:quiero|crea(?:r|me)?|pon(?:er)?|arma(?:r|me)?|establece(?:r)?|ajusta(?:r|me)?|define(?:r)?|ay[uú]dame\s+a)\b""", "i")
private val REGEX_PRESUPUESTO = js("""\bpresupuesto\b""", "i")
private val REGEX_META = js("""\b(?:meta|objetivo)\b""", "i")

private fun nombreMeta(texto: String): String {
    val para = REGEX_PARA.find(texto)?.groupValues?.get(1)
    val nombre = (para ?: "")
        .reemplazarTodos(REGEX_PALABRAS, " ")
        .reemplazarTodos(REGEX_MONTO, " ")
        .reemplazarTodos(REGEX_ESPACIOS, " ")
        .trim()
    return if (nombre.isNotEmpty()) capitalizarJs(nombre) else "Mi nueva meta"
}

/** Origen: `detectarPropuestaAsesor`. Solo propone cuando la persona dice la acción y el monto con claridad. */
fun detectarPropuestaAsesor(texto: String, categorias: List<CategoriaPersonal> = emptyList(), lexico: app.lukapp.dominio.voz.LexicoAprendido = LEXICO_VACIO): PropuestaAsesor? {
    val parseado = parseTransaction(texto, emptyList(), categorias, lexico)
    val monto = parseado.amount
    if (REGEX_ACCION.find(texto) == null) return null
    if (monto == null || monto <= 0) return null
    if (REGEX_PRESUPUESTO.find(texto) != null && parseado.signals.categorySource != "default") return PropuestaAsesor.Presupuesto(parseado.category, monto)
    if (REGEX_META.find(texto) != null) return PropuestaAsesor.Meta(nombreMeta(texto), monto, null)
    return null
}
