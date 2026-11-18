package app.lukapp.dominio

import java.text.Normalizer

/** Origen: `lib/contactos.ts` (`normalizarNombre`). Sin tildes, minúsculas, solo [a-z0-9] y espacios simples. */
fun normalizarNombre(nombre: String): String =
    Normalizer.normalize(nombre.lowercase(), Normalizer.Form.NFD)
        .replace(Regex("[\\u0300-\\u036f]"), "")
        .replace(Regex("[^a-z0-9\\s]"), " ")
        .replace(Regex("\\s+"), " ")
        .trim()

/**
 * Origen: `lib/contactos.ts` (`contactoPorApodo`). Quién es "mi pa" en el texto dictado.
 * Compara palabras completas, nunca subcadenas ("pa" no calza en "pagué"), y prueba
 * primero los apodos más largos.
 */
fun contactoPorApodo(texto: String, contactos: List<Contacto>): Contacto? {
    val palabras = normalizarNombre(texto).split(" ").filter { it.isNotEmpty() }
    if (palabras.isEmpty()) return null
    val candidatos = contactos
        .filter { it.archivedAt == null }
        .flatMap { c -> c.apodos.map { apodo -> c to apodo.split(" ").filter { it.isNotEmpty() } } }
        .filter { it.second.isNotEmpty() }
        .sortedByDescending { it.second.size }
    for ((contacto, seq) in candidatos) {
        for (i in 0..(palabras.size - seq.size)) {
            if (seq.indices.all { k -> palabras[i + k] == seq[k] }) return contacto
        }
    }
    return null
}

/** Levenshtein: solo se pregunta si dos palabras cortas casi calzan. */
private fun distancia(a: String, b: String): Int {
    if (a == b) return 0
    val previa = IntArray(b.length + 1) { it }
    for (i in 1..a.length) {
        var esquina = previa[0]
        previa[0] = i
        for (j in 1..b.length) {
            val anterior = previa[j]
            previa[j] = minOf(previa[j] + 1, previa[j - 1] + 1, esquina + if (a[i - 1] == b[j - 1]) 0 else 1)
            esquina = anterior
        }
    }
    return previa[b.length]
}

/** Dos partes de un nombre que probablemente son la misma palabra. */
private fun mismaPalabra(a: String, b: String): Boolean {
    if (a == b) return true
    // Una inicial en lugar del nombre: "Juan P" / "Juan Perez".
    if (a.length == 1 || b.length == 1) return a[0] == b[0]
    // Un error de tecleo tolerado, pero solo en palabras largas ("ana" / "ema" no).
    return a.length >= 5 && b.length >= 5 && distancia(a, b) <= 1
}

/**
 * Origen: `lib/contactos.ts` (`parecido`). De 0 a 1; exactamente 1 solo si los nombres normalizan igual.
 * El apellido decide (va al final) y un nombre de pila que contradice, posición por posición, descarta.
 */
fun parecido(a: String, b: String): Double {
    val na = normalizarNombre(a)
    val nb = normalizarNombre(b)
    if (na.isEmpty() || nb.isEmpty()) return 0.0
    if (na == nb) return 1.0
    val partesA = na.split(" ")
    val partesB = nb.split(" ")
    if (partesA.size > 1 && partesB.size > 1) {
        if (!mismaPalabra(partesA.last(), partesB.last())) return 0.0
        val pilaA = partesA.dropLast(1)
        val pilaB = partesB.dropLast(1)
        for (i in 0 until minOf(pilaA.size, pilaB.size)) if (!mismaPalabra(pilaA[i], pilaB[i])) return 0.0
    }
    val disponibles = partesB.toMutableList()
    var calzadas = 0
    for (parte in partesA) {
        val idx = disponibles.indexOfFirst { mismaPalabra(parte, it) }
        if (idx != -1) { calzadas++; disponibles.removeAt(idx) }
    }
    val proporcion = calzadas.toDouble() / maxOf(partesA.size, partesB.size)
    // `Number(x.toFixed(2))`: dos decimales redondeando medio hacia arriba; un cálculo por palabras nunca es certeza.
    return minOf(0.95, java.math.BigDecimal(proporcion).setScale(2, java.math.RoundingMode.HALF_UP).toDouble())
}

/** Origen: `lib/contactos.ts` (`UMBRAL_PREGUNTA`). Por encima, dos nombres merecen la pregunta. */
const val UMBRAL_PREGUNTA = 0.6

/** Origen: `lib/contactos.ts` (`ParteVista`). Una contraparte tal como aparece en el libro. */
data class ParteVista(val clave: String, val nombre: String, val movimientos: Int, val ultimaFecha: String)

private val colador: java.text.Collator = java.text.Collator.getInstance(java.util.Locale.forLanguageTag("es"))

/** Origen: `lib/contactos.ts` (`partesDelLibro`). Cada contraparte nombrada, la más frecuente primero. */
fun partesDelLibro(transacciones: List<Transaccion>): List<ParteVista> {
    class Acum { val grafias = LinkedHashMap<String, Int>(); var n = 0; var ultima = "" }
    val porClave = LinkedHashMap<String, Acum>()
    for (tx in transacciones) {
        val nombre = extraerContraparte(tx.description) ?: continue
        val clave = normalizarNombre(nombre)
        if (clave.isEmpty()) continue
        val a = porClave.getOrPut(clave) { Acum() }
        a.grafias.merge(nombre, 1, Int::plus)
        a.n++
        if (tx.occurredOn > a.ultima) a.ultima = tx.occurredOn
    }
    return porClave.map { (clave, d) ->
        // En empate gana la grafía alfabéticamente primera, para que el nombre mostrado no cambie entre cargas.
        val nombre = d.grafias.entries.sortedWith { x, y -> if (y.value != x.value) y.value - x.value else colador.compare(x.key, y.key) }.first().key
        ParteVista(clave, nombre, d.n, d.ultima)
    }.sortedWith { a, b -> if (b.movimientos != a.movimientos) b.movimientos - a.movimientos else colador.compare(a.nombre, b.nombre) }
}

/** Origen: `lib/contactos.ts` (`Duda`). Un par que la app no puede decidir sola. */
data class Duda(val clave: String, val a: ParteVista, val b: ParteVista, val parecido: Double)

private fun claveDeDuda(a: String, b: String): String = listOf(a, b).sorted().joinToString("|")

/**
 * Origen: `lib/contactos.ts` (`dudasDeUnion`). Los pares que valen la pregunta, el más probable primero. Lo ya
 * unido, rechazado o idéntico se excluye aquí: una pregunta resuelta no puede volver a la pantalla.
 */
fun dudasDeUnion(partes: List<ParteVista>, contactos: List<Contacto>): List<Duda> {
    val contactoDe = HashMap<String, String>()
    for (c in contactos) for (alias in c.alias) contactoDe[alias] = c.id
    val rechazado = HashSet<String>()
    for (c in contactos) for (alias in c.alias) for (otra in c.separadoDe) rechazado.add(claveDeDuda(alias, otra))

    val dudas = mutableListOf<Duda>()
    for (i in partes.indices) for (j in i + 1 until partes.size) {
        val a = partes[i]; val b = partes[j]
        val ca = contactoDe[a.clave]
        if (ca != null && ca == contactoDe[b.clave]) continue
        if (claveDeDuda(a.clave, b.clave) in rechazado) continue
        val puntaje = parecido(a.nombre, b.nombre)
        if (puntaje < UMBRAL_PREGUNTA || puntaje >= 1) continue
        dudas.add(Duda(claveDeDuda(a.clave, b.clave), a, b, puntaje))
    }
    // `localeCompare` sobre claves normalizadas (solo a-z, 0-9, espacio y "|"): el orden ordinal coincide.
    return dudas.sortedWith { x, y -> if (y.parecido != x.parecido) y.parecido.compareTo(x.parecido) else x.clave.compareTo(y.clave) }
}

/** Origen: `lib/contactos.ts` (`movimientosDeAlias`). Los movimientos de un conjunto de grafías, el más nuevo primero. */
fun movimientosDeAlias(transacciones: List<Transaccion>, alias: List<String>): List<Transaccion> {
    val suyos = alias.toSet()
    return transacciones.filter { tx -> extraerContraparte(tx.description)?.let { normalizarNombre(it) in suyos } == true }
        .sortedByDescending { it.occurredOn }
}

/** Origen: `lib/contactos.ts` (`balanceConAlias`). Cuánto ha ido y venido con alguien. */
data class BalanceContacto(val salioCop: Long, val entroCop: Long, val netoCop: Long)

fun balanceConAlias(transacciones: List<Transaccion>, alias: List<String>): BalanceContacto {
    var salio = 0L; var entro = 0L
    for (tx in movimientosDeAlias(transacciones, alias)) if (tx.kind == "ingreso") entro += tx.amountCop else salio += tx.amountCop
    return BalanceContacto(salio, entro, entro - salio)
}

/** Una fila de la lista: un contacto unido, o un nombre que sigue solo. */
data class FilaContacto(val clave: String, val nombre: String, val alias: List<String>, val movimientos: Int, val ultimaFecha: String, val contacto: Contacto?)

/** `armarFilas` de ContactosView.tsx: agrupa por contacto donde existe y deja sueltas las demás. */
fun armarFilasContactos(partes: List<ParteVista>, contactos: List<Contacto>): List<FilaContacto> {
    val porAlias = HashMap<String, Contacto>()
    for (c in contactos) { if (c.archivedAt != null) continue; for (a in c.alias) porAlias[a] = c }
    val filas = LinkedHashMap<String, FilaContacto>()
    for (parte in partes) {
        val contacto = porAlias[parte.clave]
        val clave = contacto?.id ?: parte.clave
        val previa = filas[clave]
        filas[clave] = FilaContacto(
            clave, contacto?.nombre ?: parte.nombre, (previa?.alias ?: emptyList()) + parte.clave,
            (previa?.movimientos ?: 0) + parte.movimientos,
            if (previa != null && previa.ultimaFecha > parte.ultimaFecha) previa.ultimaFecha else parte.ultimaFecha, contacto,
        )
    }
    // Una persona agregada a mano puede no tener movimientos todavía: sin esto parecería que el botón no hizo nada.
    for (c in contactos) {
        if (c.archivedAt != null || c.id in filas) continue
        filas[c.id] = FilaContacto(c.id, c.nombre, c.alias, 0, "", c)
    }
    return filas.values.sortedWith { a, b -> if (b.movimientos != a.movimientos) b.movimientos - a.movimientos else colador.compare(a.nombre, b.nombre) }
}
