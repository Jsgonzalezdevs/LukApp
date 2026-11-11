package app.lukapp.dominio.voz

import app.lukapp.dominio.CategoriaPersonal
import org.junit.Assert.assertEquals
import org.junit.Test

/** Origen: src/features/lukapp/lib/vocabularioUsuario.test.ts */
class VocabularioUsuarioTest {
    private fun cat(id: String = "c-1", nombre: String = "Mascotas", archivedAt: String? = null) =
        CategoriaPersonal(id = id, nombre = nombre, icon = "Package", color = "#A8A29E",
            createdAt = "2026-08-01T00:00:00.000Z", archivedAt = archivedAt)

    @Test fun `normaliza el nombre a palabras`() {
        assertEquals(listOf(FraseCategoria(listOf("mascotas"), "c-m")), frasesDeCategorias(listOf(cat("c-m", "Mascotás"))))
    }

    @Test fun `conserva las palabras del nombre compuesto en orden`() {
        assertEquals(
            listOf(FraseCategoria(listOf("cosas", "de", "la", "casa"), "c-casa")),
            frasesDeCategorias(listOf(cat("c-casa", "Cosas de la casa"))),
        )
    }

    @Test fun `ordena de la frase mas larga a la mas corta`() {
        val frases = frasesDeCategorias(listOf(cat("c-casa", "Casa"), cat("c-cosas", "Cosas de la casa")))
        assertEquals(listOf("c-cosas", "c-casa"), frases.map { it.id })
    }

    @Test fun `ignora las categorias archivadas`() {
        val frases = frasesDeCategorias(listOf(cat("viva", "Novia"), cat("vieja", "Ex", "2026-01-01T00:00:00.000Z")))
        assertEquals(listOf("viva"), frases.map { it.id })
    }

    @Test fun `descarta un nombre que queda vacio al normalizar`() {
        assertEquals(emptyList<FraseCategoria>(), frasesDeCategorias(listOf(cat(nombre = "   "))))
    }
}
