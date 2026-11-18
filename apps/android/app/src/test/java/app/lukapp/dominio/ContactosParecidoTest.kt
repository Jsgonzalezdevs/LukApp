package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Casos de `lib/contactos.test.ts` para `parecido`, `partesDelLibro`, `dudasDeUnion` y `balanceConAlias`. */
class ContactosParecidoTest {
    private fun p(a: String, b: String) = parecido(a, b)
    private fun mov(id: String, desc: String, fecha: String = "2026-08-01", monto: Long = 10_000, kind: String = "gasto") =
        tx(id = id, description = desc, occurredOn = fecha, amountCop = monto, kind = kind, cuentaId = null)

    @Test fun unoSoloSiEsElMismoNombre() {
        assertEquals(1.0, p("JUAN PÉREZ", "juan perez"), 0.0)
        assertTrue(p("Juan Perez", "Juan P") < 1)
    }
    @Test fun inicialSegundoNombreYErrata() {
        assertTrue(p("Juan Perez", "Juan P") >= UMBRAL_PREGUNTA)
        assertTrue(p("Juan Perez", "Juan Carlos Perez") >= UMBRAL_PREGUNTA)
        assertTrue(p("Juan P", "Juan Carlos Perez") >= UMBRAL_PREGUNTA)
        assertTrue(p("Alejandra Gomez", "Alejandro Gomez") >= UMBRAL_PREGUNTA)
    }
    @Test fun noTolerasUnaLetraEnNombresCortosNiCoincidesPorApellidoComun() {
        assertTrue(p("Ana", "Ema") < UMBRAL_PREGUNTA)
        assertEquals(0.0, p("Juan Perez", "Maria Gomez"), 0.0)
        assertTrue(p("Juan Gomez", "Maria Gomez") < UMBRAL_PREGUNTA)
    }
    @Test fun mismoNombreDePilaYDistintoApellidoOSegundoNombreContradichoSeparan() {
        assertTrue(p("Ana Maria Castro", "Ana Maria Lopez") < UMBRAL_PREGUNTA)
        assertTrue(p("Maria Fernanda Gomez", "Maria Fernanda Rodriguez") < UMBRAL_PREGUNTA)
        assertTrue(p("Luis Alberto Torres", "Luis Miguel Torres") < UMBRAL_PREGUNTA)
    }
    @Test fun simetricoYVacioNoSeParece() {
        assertEquals(p("Juan Perez", "Juan Carlos Perez"), p("Juan Carlos Perez", "Juan Perez"), 0.0)
        assertEquals(0.0, p("", "Juan"), 0.0); assertEquals(0.0, p("...", "Juan"), 0.0)
    }

    @Test fun partesJuntaGrafiasMuestraLaMasFrecuenteYOrdenaPorFrecuencia() {
        val partes = partesDelLibro(listOf(
            mov("1", "Transferencia a Juan Perez", "2026-08-01"), mov("2", "Transferencia a Juan Perez", "2026-08-09"),
            mov("3", "Transferencia a JUAN PÉREZ", "2026-08-05"), mov("4", "Transferencia a Maria Gomez"),
        ))
        assertEquals(listOf(3, 1), partes.map { it.movimientos })
        assertEquals("Juan Perez", partes[0].nombre)
        assertEquals("2026-08-09", partes[0].ultimaFecha)
        assertEquals(emptyList<ParteVista>(), partesDelLibro(listOf(mov("5", "Almuerzo"))))
    }

    private fun partes(vararg n: String) = n.map { ParteVista(normalizarNombre(it), it, 1, "2026-08-01") }
    private fun contacto(id: String, alias: List<String>, sep: List<String> = emptyList()) = Contacto(id, id, alias, sep, emptyList(), "2026-08-01T00:00:00.000Z")

    @Test fun dudasPreguntaPorParecidosPeroNoPorDistintosNiIdenticos() {
        val d = dudasDeUnion(partes("Juan Perez", "Juan Carlos Perez"), emptyList())
        assertEquals(1, d.size)
        assertEquals(emptyList<Duda>(), dudasDeUnion(partes("Juan Perez", "Maria Gomez"), emptyList()))
        assertEquals(emptyList<Duda>(), dudasDeUnion(partes("Juan Perez", "JUAN PÉREZ"), emptyList()))
        assertEquals(emptyList<Duda>(), dudasDeUnion(partes("Juan Perez"), emptyList()))
    }
    @Test fun noVuelveAPreguntarLoYaUnidoNiLoRechazado() {
        val ps = partes("Juan Perez", "Juan Carlos Perez")
        val a = ps[0].clave; val b = ps[1].clave
        assertEquals(emptyList<Duda>(), dudasDeUnion(ps, listOf(contacto("c", listOf(a, b)))))
        assertEquals(emptyList<Duda>(), dudasDeUnion(ps, listOf(contacto("c", listOf(a), listOf(b)))))
    }
    @Test fun laClaveDeLaDudaNoDependeDelOrden() {
        val x = dudasDeUnion(partes("Juan Perez", "Juan Carlos Perez"), emptyList())[0]
        val y = dudasDeUnion(partes("Juan Carlos Perez", "Juan Perez"), emptyList())[0]
        assertEquals(x.clave, y.clave)
    }

    @Test fun balanceSeparaLoQueMandasDeLoQueTeMandanYSinMovimientosDaCeros() {
        val txs = listOf(
            mov("a", "Transferencia a Juan Perez", monto = 80_000),
            mov("b", "Transferencia de Juan Perez", monto = 200_000, kind = "ingreso"),
        )
        val alias = listOf(normalizarNombre("Juan Perez"))
        assertEquals(BalanceContacto(80_000, 200_000, 120_000), balanceConAlias(txs, alias))
        assertEquals(BalanceContacto(0, 0, 0), balanceConAlias(txs, listOf("nadie")))
    }

    @Test fun filasAgrupanPorContactoYIncluyenALosAgregadosAManoSinMovimientos() {
        val ps = partes("Juan Perez", "Juan Carlos Perez")
        val c = contacto("c1", ps.map { it.clave }).copy(nombre = "Juan P.")
        val manual = contacto("c2", listOf("pa")).copy(nombre = "Papá")
        val filas = armarFilasContactos(ps, listOf(c, manual))
        assertEquals(2, filas.size)
        assertEquals("Juan P.", filas[0].nombre); assertEquals(2, filas[0].alias.size)
        assertEquals(0, filas[1].movimientos)
    }
}
