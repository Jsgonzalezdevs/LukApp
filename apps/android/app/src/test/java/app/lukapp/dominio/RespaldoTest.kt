package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Casos de `lib/respaldo.test.ts` y de la compatibilidad de formato con la web. */
class RespaldoTest {
    private val libro = Libro(
        transacciones = listOf(tx(id = "t1", description = "Almuerzo; con \"amigos\", hoy", cuentaId = "c1"), tx(id = "t2", kind = "ingreso", amountCop = 2_000_000, occurredOn = "2026-08-01", afectaSaldo = false)),
        cajitas = listOf(caj(id = "c1", nombre = "Nequi", tipo = "cuenta")),
        movimientos = listOf(mov(id = "m1", cajitaId = "c1")),
        contactos = listOf(Contacto("k1", "Juan", listOf("juan"), emptyList(), listOf("pa"), "2026-08-01T00:00:00.000Z")),
    )

    @Test fun idaYVueltaConservaTodo() {
        val json = armarRespaldoJson(libro, "2026-11-17T10:00:00.000Z")
        val r = leerRespaldo(json)
        assertTrue(r.ok); assertEquals(libro, r.libro)
        assertEquals("2 movimientos · 1 cuenta o cajita · 1 ajuste · 1 contacto", r.resumen)
    }

    @Test fun escribeConLosNombresYLosNulosDeLaWeb() {
        val json = armarRespaldoJson(libro, "2026-11-17T10:00:00.000Z")
        assertTrue(json.contains("\"version\": 1")); assertTrue(json.contains("\"cajitaMovimientos\""))
        // La web distingue null de ausente: `archivedAt` tiene que ir escrito.
        assertTrue(json.contains("\"archivedAt\": null"))
        assertTrue(json.contains("\"revisiones\": []"))
    }

    @Test fun leeUnRespaldoDeLaWebConOpcionalesAusentesYListasFaltantes() {
        val web = """{"version":1,"generado":"2026-10-01T00:00:00.000Z","datos":{"transacciones":[
            {"id":"a","kind":"gasto","amountCop":12000,"category":"comida","description":"Café","occurredOn":"2026-09-30","cuentaId":null,"rawTranscript":"","createdAt":"2026-09-30T10:00:00.000Z","campoNuevo":1}],
            "cajitas":[{"id":"c","nombre":"Caja","icon":"Wallet","tipo":"cuenta","createdAt":"2026-01-01T00:00:00.000Z"}]}}"""
        val r = leerRespaldo(web)
        assertTrue(r.error, r.ok)
        val t = r.libro!!.transacciones.single()
        assertTrue(t.afectaSaldo); assertNull(t.cuotasTotal); assertEquals(12_000L, t.amountCop)
        assertEquals("COP", r.libro!!.cajitas.single().moneda); assertNull(r.libro!!.cajitas.single().archivedAt)
        assertEquals(emptyList<Contacto>(), r.libro!!.contactos)
    }

    @Test fun rechazaLoQueNoEsUnRespaldo() {
        assertEquals("Ese archivo no es un respaldo de la app: no se pudo leer como JSON.", leerRespaldo("esto no es json").error)
        assertEquals("El archivo está vacío o no tiene datos.", leerRespaldo("[1,2]").error)
        assertEquals("Falta la información que identifica al archivo como un respaldo de esta app.", leerRespaldo("""{"datos":{}}""").error)
        assertEquals("Falta la información que identifica al archivo como un respaldo de esta app.", leerRespaldo("""{"version":1,"datos":null}""").error)
        assertEquals("Ese respaldo es de una versión más nueva (2) que esta app. Actualiza la app antes de restaurarlo.", leerRespaldo("""{"version":2,"datos":{}}""").error)
        assertFalse(leerRespaldo("""{"version":1,"datos":{"transacciones":[{"id":5}]}}""").ok)
    }

    @Test fun unaListaQueNoEsListaSeIgnoraYVacioSeDiceAsi() {
        val r = leerRespaldo("""{"version":1,"datos":{"transacciones":"nada"}}""")
        assertTrue(r.ok); assertEquals("Está vacío", r.resumen); assertNotNull(r.libro)
    }

    @Test fun csvSeparaConPuntoYComaOrdenaPorFechaYEscapa() {
        val csv = aCsv(libro) { id -> if (id == "c1") "Nequi" else "" }.lines()
        assertEquals("Fecha;Tipo;Monto;Categoría;Descripción;Cuenta;Afecta saldo", csv[0])
        assertTrue(csv[1].startsWith("2026-08-01;ingreso;2000000;")); assertTrue(csv[1].endsWith(";No"))
        assertTrue(csv[2].contains("\"Almuerzo; con \"\"amigos\"\", hoy\"")); assertTrue(csv[2].endsWith(";Nequi;Sí"))
    }

    @Test fun nombrePesoYResumenVacio() {
        assertEquals("finanzas-2026-11-17.json", nombreDeArchivoRespaldo("2026-11-17"))
        assertEquals("1 KB", pesoAproximado("x".repeat(1024))); assertEquals("1.5 MB", pesoAproximado("x".repeat(1024 * 1536)))
        assertEquals("Está vacío", resumirRespaldo(Libro()))
    }
}
