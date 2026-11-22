package app.lukapp.dominio.voz

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate
import java.util.Locale

/**
 * Compara el intérprete Kotlin contra la salida REAL del intérprete web sobre
 * un corpus amplio (CorpusWeb.kt, generado ejecutando el TS con hoy fijo).
 * Es la red que confirma «resultados idénticos» más allá de los casos sueltos
 * de los tests portados.
 */
class ParidadWebTest {
    private val hoy = LocalDate.of(2026, 11, 11)

    private val cuentas = listOf(
        CuentaConocida("nequi", "Nequi"), CuentaConocida("banco", "Bancolombia"),
        CuentaConocida("davi", "Davivienda"), CuentaConocida("efec", "Efectivo"),
        CuentaConocida("bogota", "Banco de Bogotá"), CuentaConocida("nu", "Tarjeta Nu"),
    )

    private val entidades = listOf(
        EntidadVoz("nequi", "Nequi", "cuenta"), EntidadVoz("banco", "Bancolombia", "cuenta"),
        EntidadVoz("viaje", "Viaje", "cajita"), EntidadVoz("nu", "Tarjeta Nu", "tarjeta"),
        EntidadVoz("moto", "Crédito de la moto", "deuda"),
    )

    private fun n(v: Any?) = v?.toString() ?: "∅"
    private fun f2(x: Double) = String.format(Locale.ROOT, "%.2f", x)

    private fun ser(r: ParsedTransaction): String = listOf(
        r.kind, n(r.amount), r.category, n(r.cuentaId), r.description, n(r.dateOverride), n(r.cuotasTotal),
        n(r.cuotaCop), f2(r.confidence), r.needsReview.toString(), r.signals.amountSource, r.signals.kindSource,
        r.signals.categorySource, r.signals.cuentaSource, r.signals.paymentMethod, r.signals.recurringPattern,
        r.signals.ambiguousAmount.toString(), n(r.signals.destinatario), n(r.signals.ubicacion),
        r.signals.tags.joinToString(","), r.suggestedCategories.joinToString(","),
        with(r.confianzaGranular) { listOf(monto, tipo, categoria, cuenta, metodo).joinToString(",") { f2(it) } },
    ).joinToString("|")

    private fun serCmd(c: ComandoVoz?): String = when (c) {
        null -> "∅"
        is ComandoVoz.Transferencia -> listOf("transferencia", n(c.origenId), n(c.destinoId), "∅", "∅", "∅", n(c.montoCop), n(c.occurredOn))
        is ComandoVoz.Abono -> listOf("abono", "∅", "∅", n(c.deudaId), n(c.cuentaId), "∅", n(c.montoCop), n(c.occurredOn))
        is ComandoVoz.Saldo -> listOf("saldo", "∅", "∅", "∅", "∅", n(c.cajitaId), n(c.saldoCop), "∅")
        is ComandoVoz.Rendimiento -> listOf("rendimiento", "∅", "∅", "∅", "∅", n(c.cajitaId), n(c.montoCop), n(c.occurredOn))
    }.let { if (it is List<*>) it.joinToString("|") else it.toString() }

    private fun <T> comparar(casos: List<Pair<String, T>>, real: (String) -> T) {
        val fallos = casos.mapNotNull { (entrada, esperado) ->
            val obtenido = real(entrada)
            if (obtenido == esperado) null else "«$entrada»\n  web:    $esperado\n  kotlin: $obtenido"
        }
        assertEquals("${fallos.size} de ${casos.size} difieren:\n" + fallos.joinToString("\n"), 0, fallos.size)
    }

    @Test fun `parseTransaction sin cuentas`() =
        comparar(CorpusWeb.transaccionesSinCuentas) { ser(parseTransaction(it, hoy = hoy)) }

    @Test fun `parseTransaction con cuentas`() =
        comparar(CorpusWeb.transaccionesConCuentas) { ser(parseTransaction(it, cuentas, hoy = hoy)) }

    @Test fun `parseMultipleTransactions`() =
        comparar(CorpusWeb.multiples) { t -> parseMultipleTransactions(t, hoy = hoy).map { ser(it) + "|" + it.raw } }

    @Test fun `limpiarDescripcionFinanciera`() =
        comparar(CorpusWeb.limpiezas) { limpiarDescripcionFinanciera(it) }

    @Test fun `parseComandoVoz`() =
        comparar(CorpusWeb.comandos) { serCmd(parseComandoVoz(it, entidades, hoy)) }

    @Test fun `parseAmount`() =
        comparar(CorpusWeb.montos) { n(parseAmount(it)) }

    @Test fun `extraerContraparte`() =
        comparar(CorpusWeb.contrapartes) { n(extraerContraparte(it)) }
}
