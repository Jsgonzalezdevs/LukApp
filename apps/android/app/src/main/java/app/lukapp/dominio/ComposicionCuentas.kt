package app.lukapp.dominio

private val FRIAS = listOf("morado", "azul", "verde", "gris")

// Castiga sobre todo rojos repetidos; amarillo y naranja juntos se toleran como pareja cálida.
private fun cercaniaCromatica(a: Cajita, b: Cajita): Int {
    val colorA = entidadDeCuenta(a)?.familiaColor
    val colorB = entidadDeCuenta(b)?.familiaColor
    if (colorA.isNullOrEmpty() || colorB.isNullOrEmpty()) return 0
    if (colorA == colorB) return if (colorA == "morado") 2 else 12
    if (colorA in FRIAS || colorB in FRIAS) return 0
    if (colorA == "rojo" || colorB == "rojo") return if (colorA == "naranja" || colorB == "naranja") 8 else 6
    return 3
}

/**
 * Origen: `lib/composicionCuentas.ts` (`componerCuentas`). Deja primero la favorita
 * y reparte los colores de marca. Solo acepta intercambios que mejoran el conjunto:
 * uno voraz solo movería la acumulación de cálidos al final.
 */
fun componerCuentas(cuentas: List<Cajita>, favoritaId: String?): List<Cajita> {
    val orden = cuentas.toMutableList()
    val favorita = orden.indexOfFirst { it.id == favoritaId }
    if (favorita > 0) orden.add(0, orden.removeAt(favorita))

    fun intercambiar(i: Int, j: Int) {
        val t = orden[i]; orden[i] = orden[j]; orden[j] = t
    }

    for (pasada in orden.indices) {
        var mejorCambio: Pair<Int, Int>? = null
        var mejorDiferencia = 0
        for (i in 1 until orden.size - 1) {
            for (j in i + 1 until orden.size) {
                val vecinos = linkedSetOf(i - 1, i, j - 1, j).filter { it < orden.size - 1 }
                fun coste() = vecinos.sumOf { cercaniaCromatica(orden[it], orden[it + 1]) }
                val antes = coste()
                intercambiar(i, j)
                val diferencia = coste() - antes
                intercambiar(i, j)
                if (diferencia < mejorDiferencia) {
                    mejorDiferencia = diferencia
                    mejorCambio = i to j
                }
            }
        }
        val cambio = mejorCambio ?: break
        intercambiar(cambio.first, cambio.second)
    }
    return orden
}
