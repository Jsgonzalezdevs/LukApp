package app.lukapp.dominio

import kotlin.math.abs

// Agrupar a mano y no con NumberFormat: así el texto sale idéntico al de la web
// sin depender del locale ni de la versión de ICU del teléfono.
private fun agruparMiles(digitos: String): String {
    val sb = StringBuilder()
    val n = digitos.length
    for (i in 0 until n) {
        if (i > 0 && (n - i) % 3 == 0) sb.append('.')
        sb.append(digitos[i])
    }
    return sb.toString()
}

/** Origen: `lib/formatCop.ts` (`formatCop`). Pesos sin decimales: 1234567 → "$1.234.567". */
fun formatCop(valor: Double): String {
    val redondeado = Math.round(valor)
    val signo = if (redondeado < 0) "-" else ""
    return signo + "$" + agruparMiles(abs(redondeado).toString())
}

/** Origen: `lib/formatCop.ts` (`formatCop`). */
fun formatCop(valor: Long): String = formatCop(valor.toDouble())

/** Origen: `lib/formatCop.ts` (`formatCopOculto`). Máscara del Modo Privacidad. */
fun formatCopOculto(valor: Long, oculto: Boolean = false): String =
    if (oculto) "$ ••••••" else formatCop(valor)

/** Origen: `lib/formatCop.ts` (`formatSigned`). El signo explícito evita que el color sea la única pista. */
fun formatSigned(valor: Long, kind: String): String {
    val prefijo = when (kind) {
        TipoTx.INGRESO -> "+"
        TipoTx.GASTO -> "−"
        else -> "↔"
    }
    return prefijo + formatCop(abs(valor))
}

/** Origen: `lib/formatCop.ts` (`formatAmountInput`). */
fun formatAmountInput(valor: Long?): String =
    if (valor == null) "" else agruparMiles(abs(valor).toString())

private fun soloDigitos(texto: String): String = texto.filter { it in '0'..'9' }

// JS convierte con Number() y nunca falla; aquí lo que no cabe en Long se trata como inválido.
private fun digitosALong(digitos: String): Long? {
    val sinCeros = digitos.trimStart('0').ifEmpty { "0" }
    return if (sinCeros.length > 18) null else sinCeros.toLong()
}

/** Origen: `lib/formatCop.ts` (`parseAmountInput`). Un movimiento de $0 no significa nada, por eso se rechaza. */
fun parseAmountInput(texto: String): Long? {
    val digitos = soloDigitos(texto)
    if (digitos.isEmpty()) return null
    return digitosALong(digitos)?.takeIf { it > 0 }
}

/** Origen: `lib/formatCop.ts` (`parseSaldoInput`). Un saldo de $0 sí es legítimo (vaciar una cajita). */
fun parseSaldoInput(texto: String): Long? {
    val digitos = soloDigitos(texto)
    if (digitos.isEmpty()) return null
    return digitosALong(digitos)?.takeIf { it >= 0 }
}

/** Origen: `lib/formatCop.ts` (`conPuntos`). Pone los puntos mientras el usuario escribe. */
fun conPuntos(texto: String): String {
    val digitos = soloDigitos(texto)
    return if (digitos.isEmpty()) "" else agruparMiles(digitos.trimStart('0').ifEmpty { "0" })
}
