package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** Casos de `categorias.test.ts`. */
class CatalogoTest {
    private fun propia(id: String = "p-abc", nombre: String = "Suscripciones", archivedAt: String? = null, emoji: String? = null) =
        CategoriaPersonal(id = id, nombre = nombre, icon = "Smartphone", emoji = emoji, color = "#6366F1", archivedAt = archivedAt, createdAt = "2026-08-01T00:00:00.000Z")

    @Test fun basicasSiempre() {
        assertEquals(CATEGORIES, CATALOGO_BASE.lista.map { it.clave })
    }

    @Test fun sumaPropias() {
        val cat = hacerCatalogo(listOf(propia()))
        assertEquals(CATEGORIES.size + 1, cat.lista.size)
        assertEquals("Suscripciones", cat.de("p-abc").nombre)
        assertEquals("Comida", cat.de("comida").nombre)
        assertTrue(cat.de("p-abc").propia)
        assertFalse(cat.de("comida").propia)
    }

    @Test fun archivadaSaleDeSelectores() {
        val cat = hacerCatalogo(listOf(propia(archivedAt = "2026-08-05T00:00:00.000Z")))
        assertFalse("p-abc" in cat.lista.map { it.clave })
        assertEquals("Suscripciones", cat.de("p-abc").nombre)
        assertTrue(cat.de("p-abc").archivada)
    }

    @Test fun claveDesconocida() {
        val e = hacerCatalogo().de("p-borrada-hace-meses")
        assertEquals("p-borrada-hace-meses", e.clave)
        assertEquals("Otros", e.nombre)
        assertEquals("Package", e.icono)
        assertEquals("🏷️", e.emoji)
        assertTrue(Regex("^#[0-9A-F]{6}$", RegexOption.IGNORE_CASE).matches(e.color))
    }

    @Test fun ordenEspanol() {
        val cat = hacerCatalogo(listOf(propia("p-1", "Zapatos"), propia("p-2", "Árbol"), propia("p-3", "mascotas")))
        assertEquals(listOf("Árbol", "mascotas", "Zapatos"), cat.lista.filter { it.propia }.map { it.nombre })
        assertTrue(hacerCatalogo(listOf(propia(nombre = "Aaa"))).lista.take(CATEGORIES.size).none { it.propia })
    }

    @Test fun clavesNuevas() {
        repeat(200) { assertFalse(nuevaClaveCategoria() in CATEGORIES) }
        assertEquals(500, List(500) { nuevaClaveCategoria() }.toSet().size)
        assertTrue(esClavePropia(nuevaClaveCategoria()))
        assertFalse(CATEGORIES.any(::esClavePropia))
    }

    @Test fun selector() {
        for (n in ICONOS_CATEGORIA) assertEquals(n, iconoDeCategoria(n))
        assertTrue(ICONOS_CATEGORIA.size > 15)
        assertEquals("Package", iconoDeCategoria("UnIconoQueBorramos"))
        assertEquals("Package", iconoDeCategoria(null))
        for (c in COLORES_CATEGORIA) assertTrue(Regex("^#[0-9A-F]{6}$").matches(c))
        assertEquals(COLORES_CATEGORIA.size, COLORES_CATEGORIA.toSet().size)
        val cat = hacerCatalogo(listOf(propia(emoji = "🍿")))
        assertEquals("🍔", cat.de("comida").emoji)
        assertEquals("🍿", cat.de("p-abc").emoji)
    }

    @Test fun sugerencias() {
        assertEquals("🐶", sugerirEmojiCategoria("Comida para el perro"))
        assertEquals("☕", sugerirEmojiCategoria("Café"))
        assertEquals("🏷️", sugerirEmojiCategoria("  "))
        assertEquals("Smartphone", sugerirIconoCategoria("Suscripción"))
        assertEquals("Package", sugerirIconoCategoria("xyz"))
        assertEquals("📱", hacerCatalogo(listOf(propia())).de("p-abc").emoji)
        assertEquals("rgb(245 158 11 / 0.2)", tint("#F59E0B", 0.2))
    }
}
