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
