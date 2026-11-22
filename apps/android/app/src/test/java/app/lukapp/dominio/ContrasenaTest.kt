package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Casos de `src/lib/seguridad.test.ts`; loginValidation no tiene test web y se fija aquí. */
class ContrasenaTest {
    @Test fun aceptaClavesSeguras() {
        assertNull(validarContrasenaSegura("Clave!", listOf("julian", "julian@lukapp.app")))
        assertNull(validarContrasenaSegura("RíoSeguro!2026"))
    }

    @Test fun rechazaCortasOSimples() {
        assertTrue(validarContrasenaSegura("Cl!ve")!!.contains("6 caracteres"))
        assertTrue(validarContrasenaSegura("solominusculas!")!!.contains("mayúscula"))
        assertTrue(validarContrasenaSegura("SOLOMAYUSCULAS!")!!.contains("minúscula"))
        assertTrue(validarContrasenaSegura("SinSimbolo123A")!!.contains("especial"))
    }

    @Test fun noIgualAlUsuario() {
        assertTrue(validarContrasenaSegura("ClaveSegura!", listOf("claveSegura!"))!!.contains("igual"))
    }

    @Test fun checklist() {
        fun cumplidos(c: String) = evaluarRequisitosContrasena(c).filter { it.cumple }.map { it.id }
        assertEquals(emptyList<String>(), cumplidos(""))
        assertEquals(listOf("minuscula"), cumplidos("a"))
        assertEquals(listOf("mayuscula", "minuscula"), cumplidos("aB"))
        assertEquals(listOf("largo", "mayuscula", "minuscula", "especial"), cumplidos("aB!xyz"))
    }

    @Test fun formularios() {
        assertEquals(ResultadoValidacion(false, "Email requerido"), validateEmail("  "))
        assertFalse(validateEmail("sin-arroba").valido)
        assertTrue(validateEmail(" Ana@Lukapp.app ").valido)
        assertEquals("Contraseña requerida", validatePassword(null).error)
        assertEquals("Contraseña muy larga", validatePassword("Aa!" + "x".repeat(130)).error)
        assertEquals("Mínimo 3 caracteres", validateUsername("ab").error)
        assertEquals("Solo letras, números, _ y - permitidos", validateUsername("ana maria").error)
        assertTrue(validateSignupForm("a@b.co", "Clave!", "ana_1").valido)
        assertEquals("Email requerido", validateLoginForm("", "Clave!").error)
    }

    @Test fun bloqueo() {
        val ahora = 10_000_000L
        val recientes = List(5) { ahora - it * 1000L }
        assertTrue(isLockedOut(recientes, ahora))
        assertFalse(isLockedOut(recientes.take(4), ahora))
        assertEquals(15, getLockoutRemainingMinutes(listOf(ahora - 1000), ahora))
        assertEquals(0, getLockoutRemainingMinutes(listOf(ahora - 16 * 60_000L), ahora))
    }
}
