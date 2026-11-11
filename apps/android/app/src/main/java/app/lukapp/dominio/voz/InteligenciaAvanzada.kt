package app.lukapp.dominio.voz

/*
 * Solo las piezas que usa el intérprete de voz.
 * Origen: src/features/lukapp/lib/inteligenciaAvanzada.ts
 */

data class ConfianzaGranular(
    val monto: Double,
    val tipo: Double,
    val categoria: Double,
    val cuenta: Double,
    val metodo: Double,
)

/** Distancia de Levenshtein por unidad UTF-16, igual que indexar un string en JS. */
fun distanciaLevenshtein(a: String, b: String): Int {
    val m = a.length
    val n = b.length
    val dp = Array(m + 1) { IntArray(n + 1) }
    for (i in 0..m) dp[i][0] = i
    for (j in 0..n) dp[0][j] = j
    for (i in 1..m) {
        for (j in 1..n) {
            dp[i][j] = if (a[i - 1] == b[j - 1]) {
                dp[i - 1][j - 1]
            } else {
                1 + minOf(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
            }
        }
    }
    return dp[m][n]
}

/** La palabra más parecida del diccionario; con empate gana la primera en orden. */
fun buscarSimilar(palabra: String, diccionario: Collection<String>, umbral: Int = 2): String? {
    val norm = normalizeWord(palabra)
    var mejor: String? = null
    var distanciaMinima = umbral
    for (opcion in diccionario) {
        val dist = distanciaLevenshtein(norm, normalizeWord(opcion))
        if (dist < distanciaMinima) {
            distanciaMinima = dist
            mejor = opcion
        }
    }
    return mejor
}

fun calcularConfianzaGranular(
    monto: Long?,
    tipoSeguro: Boolean,
    categoriaFuente: String,
    cuentaEncontrada: Boolean,
    metodoDetectado: Boolean,
): ConfianzaGranular = ConfianzaGranular(
    monto = if (monto != null) 0.95 else 0.0,
    tipo = if (tipoSeguro) 0.9 else 0.5,
    categoria = when (categoriaFuente) {
        "usuario" -> 0.95
        "merchant" -> 0.85
        "aprendida" -> 0.7
        else -> 0.4
    },
    cuenta = if (cuentaEncontrada) 0.9 else 0.0,
    metodo = if (metodoDetectado) 0.8 else 0.0,
)
