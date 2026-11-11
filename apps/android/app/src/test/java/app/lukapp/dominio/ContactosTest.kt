package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// Casos de lib/contactos.test.ts (contactoPorApodo).
class ContactosTest {
    private fun contacto(id: String, nombre: String, apodos: List<String>) =
        Contacto(id, nombre, emptyList(), emptyList(), apodos, "2026-01-01T00:00:00.000Z", null)

    private val wilson = contacto("k-pa", "Wilson Gonzalez", listOf("pa", "papa"))
    private val patricia = contacto("k-ma", "Patricia Riaza Cano", listOf("ana riaza"))

    @Test fun reconoceElApodo() = assertEquals("Wilson Gonzalez", contactoPorApodo("le mandé 20 mil a mi pa", listOf(wilson))?.nombre)
    @Test fun apodoDeVariasPalabras() = assertEquals("Patricia Riaza Cano", contactoPorApodo("le pasé plata a ana riaza", listOf(patricia))?.nombre)
    @Test fun noCalzaDentroDeOtraPalabra() {
        assertNull(contactoPorApodo("pagué el arriendo", listOf(wilson)))
        assertNull(contactoPorApodo("compré papas", listOf(wilson)))
    }
    @Test fun prefiereElMasLargo() {
        val abuelo = contacto("k-ab", "Jorge Gonzalez", listOf("papa grande"))
        assertEquals("Jorge Gonzalez", contactoPorApodo("le di 50 mil al papa grande", listOf(wilson, abuelo))?.nombre)
    }
    @Test fun ignoraTildesYMayusculas() = assertEquals("k-pa", contactoPorApodo("MI PAPÁ", listOf(wilson))?.id)
}
