package app.lukapp.dominio

import app.lukapp.dominio.voz.js

/** Origen: `simulacionConversacional.ts` (`SolicitudSimulacion`). */
data class SolicitudSimulacion(
    val preguntaOriginal: String,
    val escenario: ModificadorSimulacion,
    val resultado: ResultadoSimulacion,
    val respuesta: String,
) {
    /** La web lo guarda como la cadena fija `'simulacion'`. */
    val tipo: String get() = "simulacion"
}

private val RE_MONTO_EN_TEXTO = js("""\$?\s*\d+(?:[.,]\d+)*\s*(?:millones|millón|millon|mil)?""", "i")
private val RE_INTENCION_SIMULAR = js("""(qué pasa|que pasa|si gasto|si ahorro|si pago|afecta mi disponible|representa)""")
private val RE_ES_RECOMENDACION = js("""(recomiend|conviene|o si|mejor|contrato)""")
private val RE_ES_AHORRO = js("""(ahorro|ahorre|guardar)""")
private val RE_ES_ABONO = js("""(pago|abono|deuda)""")

// Un solo monto en toda la frase: con dos o más (alternativas) la decisión es del asesor.
private fun montoDe(texto: String): Long? {
    val coincidencias = RE_MONTO_EN_TEXTO.findAll(texto).map { it.value }.toList()
    if (coincidencias.size != 1) return null
    val monto = leerMontoConversacion(coincidencias[0])
    return if (monto != null && monto > 0) monto else null
}

/**
 * Origen: `simulacionConversacional.ts` (`simularPregunta`). Detecta intención y delega
 * toda la matemática al simulador determinista.
 */
fun simularPregunta(pregunta: String, entrada: EntradaMotorFinanciero): SolicitudSimulacion? {
    val texto = pregunta.lowercase()
    if (!RE_INTENCION_SIMULAR.containsMatchIn(texto)) return null
    if (RE_ES_RECOMENDACION.containsMatchIn(texto)) return null
    val monto = montoDe(pregunta) ?: return null
    val escenario: ModificadorSimulacion = when {
        RE_ES_AHORRO.containsMatchIn(texto) -> ModificadorSimulacion.AhorroAdicional(monto)
        RE_ES_ABONO.containsMatchIn(texto) -> ModificadorSimulacion.AbonoExtraordinario(monto)
        else -> ModificadorSimulacion.GastoExtraordinario(monto)
    }
    val resultado = simularDecisiones(entrada, listOf(escenario))
    val d = resultado.diferencia.disponibleDiario
    val aviso = if (resultado.avisos.isNotEmpty()) "\n\nAviso: ${resultado.avisos.joinToString(" ")}" else ""
    val equivale = resultado.recuperacionDias?.let { " Equivale aproximadamente a $it días de tu disponible actual." } ?: ""
    return SolicitudSimulacion(
        preguntaOriginal = pregunta,
        escenario = escenario,
        resultado = resultado,
        respuesta = "Es una simulación temporal. Tu disponible diario pasaría de ${milesEsCo(d.base)} COP a ${milesEsCo(d.simulado)} COP. El cambio sería de ${milesEsCo(Math.abs(d.cambioCop))} COP.$equivale$aviso\n\nNo se modificaron tus finanzas reales.",
    )
}
