package app.lukapp.dominio.voz

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Origen: src/features/lukapp/lib/parseComandoVoz.test.ts */
class ParseComandoVozTest {
    private fun entidad(id: String, nombre: String, tipo: String, archivedAt: String? = null) =
        EntidadVoz(id, nombre, tipo, archivedAt)

    private val entidades = listOf(
        entidad("nequi", "Nequi", "cuenta"),
        entidad("banco", "Bancolombia", "cuenta"),
        entidad("viaje", "Viaje", "cajita"),
        entidad("nu", "Tarjeta Nu", "tarjeta"),
        entidad("moto", "Crédito de la moto", "deuda"),
    )

    @Test fun `entiende un abono completo a tarjeta y conserva la cuenta de origen`() {
        val raw = "Abona 200 mil a la tarjeta Nu desde Bancolombia"
        assertEquals(
            ComandoVoz.Abono(deudaId = "nu", cuentaId = "banco", montoCop = 200_000, raw = raw),
            parseComandoVoz(raw, entidades),
        )
    }

    @Test fun `conserva la fecha relativa de abonos y transferencias`() {
        val abono = parseComandoVoz("Ayer aboné 20 mil a la Nu desde Nequi", entidades) as ComandoVoz.Abono
        assertTrue(Regex("""^\d{4}-\d{2}-\d{2}$""").matches(abono.occurredOn!!))
    }

    @Test fun `reconoce el nombre corto de una tarjeta o deuda`() {
        val a = parseComandoVoz("Aboné 100 mil a la Nu desde Nequi", entidades) as ComandoVoz.Abono
        assertEquals(listOf("nu", "nequi", 100_000L), listOf(a.deudaId, a.cuentaId, a.montoCop))
        val b = parseComandoVoz("Paga 50 mil al crédito de la moto desde Bancolombia", entidades) as ComandoVoz.Abono
        assertEquals(listOf("moto", "banco", 50_000L), listOf(b.deudaId, b.cuentaId, b.montoCop))
    }

    @Test fun `deja visibles los campos que no se dijeron en un abono`() {
        val a = parseComandoVoz("Paga 80 mil a la tarjeta", entidades) as ComandoVoz.Abono
        assertEquals(listOf(null, null, 80_000L), listOf(a.deudaId, a.cuentaId, a.montoCop))
    }

    @Test fun `no confunde una compra con tarjeta con un abono`() {
        assertNull(parseComandoVoz("Pagué 80 mil de mercado con la tarjeta Nu", entidades))
    }

    private fun saldo(raw: String, ents: List<EntidadVoz> = entidades) = parseComandoVoz(raw, ents) as ComandoVoz.Saldo

    @Test fun `actualiza el saldo de cuentas, cajitas, tarjetas o deudas`() {
        saldo("Actualiza el saldo de Nequi a 450 mil").let { assertEquals(listOf<Any?>("nequi", 450_000L), listOf(it.cajitaId, it.saldoCop)) }
        saldo("La deuda actual de la tarjeta Nu es cero").let { assertEquals(listOf<Any?>("nu", 0L), listOf(it.cajitaId, it.saldoCop)) }
        saldo("En Nequi tengo cuatrocientos mil").let { assertEquals(listOf<Any?>("nequi", 400_000L), listOf(it.cajitaId, it.saldoCop)) }
        saldo("Modifica lo que tengo en el Neki").let { assertEquals(listOf<Any?>("nequi", null), listOf(it.cajitaId, it.saldoCop)) }
        val cuentaNumerada = entidad("cuenta-2", "Cuenta 2", "cuenta")
        saldo("Actualiza el saldo de Cuenta 2 a 100 mil", entidades + cuentaNumerada).let {
            assertEquals(listOf<Any?>("cuenta-2", 100_000L), listOf(it.cajitaId, it.saldoCop))
        }
    }

    @Test fun `mueve dinero entre una cuenta y una cajita`() {
        val t = parseComandoVoz("Pasa 150 mil de Nequi a Viaje", entidades) as ComandoVoz.Transferencia
        assertEquals(listOf<Any?>("nequi", "viaje", 150_000L), listOf(t.origenId, t.destinoId, t.montoCop))
    }

    @Test fun `conserva una transferencia interna incompleta para preguntarla`() {
        val a = parseComandoVoz("Aparta 50 mil en Viaje", entidades) as ComandoVoz.Transferencia
        assertEquals(listOf<Any?>(null, "viaje", 50_000L), listOf(a.origenId, a.destinoId, a.montoCop))
        val b = parseComandoVoz("Saca 20 mil de Viaje", entidades) as ComandoVoz.Transferencia
        assertEquals(listOf<Any?>("viaje", null, 20_000L), listOf(b.origenId, b.destinoId, b.montoCop))
    }

    @Test fun `no secuestra una transferencia externa ordinaria`() {
        assertNull(parseComandoVoz("Transferí 50 mil de Nequi a Juan", entidades))
    }

    @Test fun `registra rendimientos solo como orden explicita sobre una cajita`() {
        val r = parseComandoVoz("Registra 2 mil de rendimiento en Viaje", entidades) as ComandoVoz.Rendimiento
        assertEquals(listOf<Any?>("viaje", 2_000L), listOf(r.cajitaId, r.montoCop))
    }

    @Test fun `ignora entidades archivadas`() {
        val archivada = entidad("vieja", "Cuenta vieja", "cuenta", "2026-09-10")
        saldo("Actualiza el saldo de Cuenta vieja a 10 mil", entidades + archivada).let {
            assertEquals(listOf<Any?>(null, 10_000L), listOf(it.cajitaId, it.saldoCop))
        }
    }
}
