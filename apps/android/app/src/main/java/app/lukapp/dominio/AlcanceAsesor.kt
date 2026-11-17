package app.lukapp.dominio

import app.lukapp.dominio.voz.js
import java.text.Normalizer

/** Origen: `lib/alcanceAsesor.ts` (`AlcanceAsesor`). Clasifica una pregunta antes de entregarla al asesor financiero. */
enum class AlcanceAsesor(val clave: String) {
    FINANCIERA("financiera"),
    TECNICA_SIN_FINANZAS("tecnica-sin-finanzas"),
    GENERAL("general"),
}

// Se normaliza aquí y no con `normalizarNombre`: la web conserva la puntuación en este paso.
private fun normalizarAlcance(texto: String): String =
    Normalizer.normalize(texto, Normalizer.Form.NFD)
        .replace(Regex("[\\u0300-\\u036f]"), "")
        .lowercase()

private val PATRON_TECNICO = js("""\b(sql|sqlite|mysql|postgres(?:ql)?|base de datos|database|codigo|programar|programacion|javascript|typescript|react|html|css|api|servidor)\b""")
private val PATRON_FINANCIERO = js("""\b(finanzas?|financier[oa]s?|gastos?|ingresos?|saldos?|balances?|presupuestos?|ahorros?|cajitas?|cuentas?|deudas?|tarjetas?|creditos?|pagos?|dinero|plata|movimientos?|renta|4x1000|gmf|mes|quincena|como voy)\b""")

/**
 * Origen: `lib/alcanceAsesor.ts` (`clasificarAlcanceAsesor`). El asesor no es un chat
 * técnico genérico. Distinguir el tema antes de llamar al proveedor evita respuestas
 * contradictorias: en una pregunta mixta se conserva la parte financiera y se deja que
 * el modelo la responda.
 */
fun clasificarAlcanceAsesor(texto: String): AlcanceAsesor {
    val consulta = normalizarAlcance(texto)
    if (PATRON_FINANCIERO.containsMatchIn(consulta)) return AlcanceAsesor.FINANCIERA
    if (PATRON_TECNICO.containsMatchIn(consulta)) return AlcanceAsesor.TECNICA_SIN_FINANZAS
    return AlcanceAsesor.GENERAL
}

/** Origen: `lib/alcanceAsesor.ts` (`RESPUESTA_TEMA_TECNICO`). */
const val RESPUESTA_TEMA_TECNICO =
    "Este Asesor te guía por las finanzas y funciones de LukApp, pero no configura bases de datos. Escribe “dime mi resumen del mes” para revisar ingresos, gastos y saldo."
