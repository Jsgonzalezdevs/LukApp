package app.lukapp.dominio.voz

import app.lukapp.dominio.CategoriaPersonal

/*
 * Origen: src/features/lukapp/lib/vocabularioUsuario.ts
 *
 * El intérprete de fábrica solo conoce sus trece categorías y un puñado de
 * palabras por cada una. Si el usuario creó «Mascotas» o «Cosas de la casa»,
 * nada de eso le suena. Esto cierra el hueco sin listas a mano: el nombre que
 * le puso ES el vocabulario.
 */

data class FraseCategoria(
    /** El nombre normalizado, palabra por palabra. */
    val seq: List<String>,
    /** La clave de la categoría: su id, que es lo que queda en el movimiento. */
    val id: String,
)

private val RE_ESPACIOS_CAT = js("""\s+""")

/**
 * Las categorías activas como frases, de la más larga a la más corta.
 *
 * Más larga primero por la misma razón que las cuentas: «Cosas de la casa» no
 * puede resolverse por un «casa» suelto si ambas existen. Se exige que el
 * nombre completo aparezca consecutivo en lo dictado: es preciso y casi nunca
 * se equivoca.
 */
fun frasesDeCategorias(categorias: List<CategoriaPersonal>): List<FraseCategoria> =
    categorias
        .filter { it.archivedAt == null }
        .map { c -> FraseCategoria(seq = c.nombre.split(RE_ESPACIOS_CAT).map(::normalizeWord).filter { it.isNotEmpty() }, id = c.id) }
        .filter { it.seq.isNotEmpty() }
        .sortedByDescending { it.seq.size }
