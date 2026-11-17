package app.lukapp.dominio

import app.lukapp.dominio.voz.LEXICO_VACIO
import java.time.Instant
import kotlin.random.Random
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Casos de `lib/asesorBot.test.ts`, uno a uno. La web fija el reloj con `vi.setSystemTime`;
 * aquí es el parámetro `ahora` (el mismo instante: 2026-08-20 15:00 UTC = 10:00 en Bogotá).
 */
class AsesorBotTest {
    private val AHORA = Instant.parse("2026-08-20T15:00:00Z")
    private val CTX_VACIO = AsesorContext(ultimoAsunto = null, ultimaFecha = null)

    private fun txa(
        kind: String = "gasto",
        amountCop: Long = 10_000,
        category: String = "comida",
        description: String = "x",
        occurredOn: String = "2026-08-15",
    ) = Transaccion(
        id = "t-${Math.random()}", kind = kind, amountCop = amountCop, category = category,
        description = description, occurredOn = occurredOn, cuentaId = null, rawTranscript = "",
        createdAt = "2026-08-15T00:00:00.000Z",
    )

    private fun cajita(
        id: String = "c-${Math.random()}",
        nombre: String = "Nequi",
        tipo: String = "cuenta",
        esBajoMonto: Boolean = false,
    ) = Cajita(id = id, nombre = nombre, icon = "Wallet", tipo = tipo, createdAt = "2026-01-01T00:00:00.000Z", esBajoMonto = esBajoMonto)

    private fun preguntar(
        texto: String,
        transacciones: List<Transaccion> = emptyList(),
        cajitas: List<Cajita> = emptyList(),
        balances: Map<String, Long> = emptyMap(),
        categorias: List<CategoriaPersonal> = emptyList(),
        context: AsesorContext = CTX_VACIO,
        azar: Random = Random(1),
    ) = responderAsesor(texto, transacciones, cajitas, balances, categorias, LEXICO_VACIO, context, ahora = AHORA, azar = azar)

    private fun assertMatch(patron: String, texto: String) =
        assertTrue("«$texto» no calza con /$patron/i", Regex(patron, RegexOption.IGNORE_CASE).containsMatchIn(texto))

    // ── consultas con montos no son movimientos ─────────────────────────────

    private val consultaLarga = "Mira que tengo una Deuda de mi tarjeta de credito, actualmente trabajo, gano un minimo, quiero saber si me recomiendas pagar la tarjeta con lo que tengo de ahorros para una macbook o si mejor pago como 70000 que es mensualmente (Pero mi contrato termina en enero)"

    private fun sinBotones(texto: String) {
        assertNull(detectarMovimiento(texto, emptyList(), emptyList(), emptyList(), LEXICO_VACIO, CTX_VACIO, AHORA).propuesta)
        val respuesta = preguntar(texto)
        assertNull(respuesta.action)
        assertNull(respuesta.actions)
    }

    @Test fun consultaConMontosNoOfreceBotonesLarga() = sinBotones(consultaLarga)
    @Test fun consultaConMontosNoOfreceBotonesConviene() = sinBotones("Me conviene pagar 70000 de tarjeta y ahorrar 200000")
    @Test fun consultaConMontosNoOfreceBotonesCompro() = sinBotones("Si compro un computador de 3000000 me quedo sin ahorros")
    @Test fun consultaConMontosNoOfreceBotonesVoyAPagar() = sinBotones("Voy a pagar 70000 en comida y 20000 en transporte")

    @Test fun pideLosDatosDeLaDeudaYConsideraElFinDelContrato() {
        val respuesta = preguntar(consultaLarga)
        assertTrue(respuesta.text.contains("saldo total"))
        assertTrue(respuesta.text.contains("contrato"))
        assertEquals(CampoDeuda.DEUDA, respuesta.newContext.conversacionDeuda?.pendiente)
    }

    @Test fun sigueProponiendoGastosRealizados() {
        assertEquals(70000L, preguntar("Pagué 70000 en comida").action?.amount)
    }

    // ── resumen del mes ─────────────────────────────────────────────────────

    @Test fun mantieneElAlcanceFinancieroTambienCuandoRespondeSinIA() {
        val r = preguntar("¿Cómo hago una base de datos en SQL?")
        assertMatch("te guía por las finanzas", r.text)
        assertMatch("resumen del mes", r.text)
    }

    @Test fun sumaIngresosYGastosSoloDelMesActual() {
        val transacciones = listOf(
            txa(kind = "ingreso", amountCop = 1_000_000, occurredOn = "2026-08-05"),
            txa(kind = "gasto", amountCop = 200_000, occurredOn = "2026-08-10", category = "comida"),
            // Julio: no debe contar.
            txa(kind = "gasto", amountCop = 999_999, occurredOn = "2026-07-15"),
        )
        val r = preguntar("resumen del mes", transacciones = transacciones)
        assertTrue(r.text.contains("1.000.000"))
        assertTrue(r.text.contains("200.000"))
        assertFalse(r.text.contains("999.999"))
    }

    @Test fun senalaLaCategoriaConMasGastoComoAgujeroNegro() {
        val transacciones = listOf(
            txa(amountCop = 300_000, category = "comida", occurredOn = "2026-08-05"),
            txa(amountCop = 50_000, category = "transporte", occurredOn = "2026-08-06"),
        )
        val r = preguntar("como voy este mes", transacciones = transacciones)
        assertTrue(r.text.contains("comida"))
    }

    @Test fun sinMovimientosEsteMesNoDiceQueHayDeficit() {
        val r = preguntar("dame mi resumen")
        assertMatch("no has registrado movimientos", r.text)
    }

    @Test fun alertaCuandoLosGastosSuperanLosIngresos() {
        val transacciones = listOf(
            txa(kind = "ingreso", amountCop = 100_000, occurredOn = "2026-08-05"),
            txa(kind = "gasto", amountCop = 500_000, occurredOn = "2026-08-10"),
        )
        val r = preguntar("resumen", transacciones = transacciones)
        assertMatch("alerta roja|gastando más", r.text)
    }

    // ── saldos ──────────────────────────────────────────────────────────────

    @Test fun sumaCuentasYCajitasPorSeparado() {
        val cajitas = listOf(cajita(id = "cta-1", tipo = "cuenta"), cajita(id = "caj-1", tipo = "cajita", nombre = "Vacaciones"))
        val r = preguntar("cuanto tengo", cajitas = cajitas, balances = mapOf("cta-1" to 500_000L, "caj-1" to 300_000L))
        assertTrue(r.text.contains("500.000"))
        assertTrue(r.text.contains("300.000"))
    }

    @Test fun respondeElSaldoDeUnaCuentaEspecificaCuandoLaNombra() {
        val cajitas = listOf(cajita(id = "cta-1", nombre = "Bancolombia"))
        val r = preguntar("cuanto tengo en bancolombia", cajitas = cajitas, balances = mapOf("cta-1" to 250_000L))
        assertTrue(r.text.contains("250.000"))
        assertTrue(r.text.contains("Bancolombia"))
    }

    @Test fun noConfundeCuantoGasteConUnaPreguntaDeSaldo() {
        val r = preguntar("cuanto he gastado", cajitas = listOf(cajita(id = "cta-1")), balances = mapOf("cta-1" to 999_999L))
        assertFalse(r.text.contains("999.999"))
    }

    // ── 4x1000 ──────────────────────────────────────────────────────────────

    @Test fun avisaDelCupoExentoCuandoHayUnaCuentaDeBajoMonto() {
        val r = preguntar("cuanto es el 4x1000", cajitas = listOf(cajita(nombre = "Nequi", esBajoMonto = true)))
        assertTrue(r.text.contains("Nequi"))
        assertMatch("exen", r.text)
    }

    @Test fun sugiereMarcarUnaCuentaDeBajoMontoSiNingunaLoEsta() {
        val r = preguntar("que es el gmf", cajitas = listOf(cajita(esBajoMonto = false)))
        assertMatch("bajo monto", r.text)
    }

    // ── presupuesto diario sugerido ─────────────────────────────────────────

    @Test fun repartaElSaldoEntreLosDiasQueQuedanDelMes() {
        // Reloj fijo en 2026-08-20: agosto tiene 31 días, quedan 12 (20..31).
        val r = preguntar("cuanto puedo gastar", cajitas = listOf(cajita(id = "cta-1")), balances = mapOf("cta-1" to 1_200_000L))
        assertTrue(r.text.contains("12 días"))
        assertTrue(r.text.contains("100.000")) // 1.200.000 / 12
    }

    @Test fun sinSaldoEnCuentasLoDiceEnVezDeCalcularUnPresupuestoDeCero() {
        val r = preguntar("cual es mi presupuesto", cajitas = listOf(cajita(id = "cta-1")))
        assertMatch("no tienes saldo", r.text)
    }

    // ── gastos recurrentes ──────────────────────────────────────────────────

    @Test fun detectaUnaDescripcionQueSeRepiteAlMenosDosVeces() {
        val transacciones = listOf(
            txa(description = "Netflix", amountCop = 30_000, occurredOn = "2026-07-01"),
            txa(description = "Netflix", amountCop = 30_000, occurredOn = "2026-08-01"),
        )
        val r = preguntar("mis suscripciones", transacciones = transacciones)
        // La agrupación normaliza la descripción a minúsculas antes de compararla.
        assertTrue(r.text.contains("netflix"))
        assertTrue(r.text.contains("1 gastos recurrentes"))
    }

    @Test fun unaDescripcionQueSoloApareceUnaVezNoCuentaComoRecurrente() {
        val r = preguntar("gastos fijos", transacciones = listOf(txa(description = "Netflix", occurredOn = "2026-08-01")))
        assertMatch("no he detectado", r.text)
    }

    // ── detectar y proponer un movimiento ───────────────────────────────────

    @Test fun proponeRegistrarUnGastoDictadoConElMontoYLaCategoriaCorrectos() {
        val r = preguntar("gaste 20 mil en comida")
        assertNotNull(r.action)
        assertEquals(20_000L, r.action!!.amount)
        assertEquals("gasto", r.action!!.kind)
        assertTrue(r.text.contains("20.000"))
    }

    @Test fun nuncaGuardaSoloSiemprePideConfirmacion() {
        assertMatch("quieres que lo registre", preguntar("gaste 20 mil en comida").text)
    }

    @Test fun pideElMontoSiFaltaEnVezDeInventarUnRegistro() {
        val r = preguntar("gaste en el mercado")
        assertNull(r.action)
        assertMatch("cuánto fue el monto", r.text)
    }

    @Test fun detectaVariasTransaccionesEnUnaSolaFrase() {
        val r = preguntar("gaste 50 mil en comida y 20 mil en transporte")
        assertNotNull(r.actions)
        assertEquals(2, r.actions!!.size)
        assertTrue(r.actions!!.any { it.amount == 50_000L })
        assertTrue(r.actions!!.any { it.amount == 20_000L })
    }

    @Test fun avisaSiElGastoVaASuperarElPromedioMensualHabitual() {
        val transacciones = listOf(
            txa(category = "comida", amountCop = 50_000, occurredOn = "2026-06-10"),
            txa(category = "comida", amountCop = 50_000, occurredOn = "2026-07-10"),
            txa(category = "comida", amountCop = 50_000, occurredOn = "2026-06-20"),
        )
        val r = preguntar("gaste 100 mil en comida", transacciones = transacciones)
        assertMatch("alerta|ojo ahí", r.text)
    }

    // ── memoria de corrección ───────────────────────────────────────────────

    @Test fun fueronXCorrigeElMontoUsandoLaCategoriaDeLaConversacion() {
        val r = preguntar("fueron 30 mil", context = AsesorContext(ultimoAsunto = "transporte", ultimaFecha = null))
        assertNotNull(r.action)
        assertEquals(30_000L, r.action!!.amount)
        assertEquals("transporte", r.action!!.category)
    }

    // ── preguntas de gastos por fecha ───────────────────────────────────────

    @Test fun filtraPorAyerCuandoElParserReconoceEsaFecha() {
        val transacciones = listOf(
            txa(amountCop = 15_000, occurredOn = "2026-08-19"), // ayer
            txa(amountCop = 999_000, occurredOn = "2026-08-01"), // no es ayer
        )
        val r = preguntar("cuanto gaste ayer", transacciones = transacciones)
        assertTrue(r.text.contains("15.000"))
        assertFalse(r.text.contains("999.000"))
    }

    @Test fun filtraPorMesPasado() {
        val transacciones = listOf(
            txa(amountCop = 40_000, occurredOn = "2026-07-10"),
            txa(amountCop = 999_000, occurredOn = "2026-08-10"),
        )
        val r = preguntar("cuanto gaste el mes pasado", transacciones = transacciones)
        assertTrue(r.text.contains("40.000"))
        assertFalse(r.text.contains("999.000"))
    }

    @Test fun sinMovimientosEnElFiltroDiceCeroEnVezDeNada() {
        val r = preguntar("cuanto he gastado en comida")
        assertTrue(r.text.isNotEmpty())
    }

    // ── enrutador de preguntas múltiples ("y") ──────────────────────────────

    @Test fun combinaDosPreguntasSeparadasPorYEnUnaSolaRespuesta() {
        val transacciones = listOf(txa(category = "comida", amountCop = 20_000, occurredOn = "2026-08-10"))
        val r = preguntar(
            "cuanto tengo en cuentas y cuanto gaste en comida",
            transacciones = transacciones,
            cajitas = listOf(cajita(id = "cta-1")),
            balances = mapOf("cta-1" to 100_000L),
        )
        assertTrue(r.text.contains("100.000"))
        assertTrue(r.text.contains("20.000"))
    }

    // ── saludos y charla ────────────────────────────────────────────────────

    @Test fun respondeAlgoAUnSaludo() {
        assertTrue(preguntar("hola").text.isNotEmpty())
    }

    @Test fun respondeAUnaPreguntaDeIdentidad() {
        assertMatch("luki|amigo contador", preguntar("quien eres").text)
    }

    @Test fun contestaConCercaniaCuandoLePreguntanComoEsta() {
        val r = preguntar("como estas?")
        assertMatch("gracias por preguntar|me alegra|todo bien", r.text)
        assertFalse(Regex("centrémonos|enfoquemos", RegexOption.IGNORE_CASE).containsMatchIn(r.text))
    }

    @Test fun caeEnUnaRespuestaDeCharlaParaAlgoQueNoReconoceComoFinanzas() {
        val r = preguntar("jajaja que buena")
        assertTrue(r.text.isNotEmpty())
        assertNull(r.action)
    }

    @Test fun elFallbackFinalNuncaDejaLaRespuestaVacia() {
        assertTrue(preguntar("asdkjaslkdjaslkdj").text.isNotEmpty())
    }

    // ── extras de paridad: rasgos que la web no prueba pero el puerto debe conservar ─

    @Test fun elAzarEsInyectableYElSaludoDependeDeLaHoraDeBogota() {
        // 10:00 en Bogotá → «Buenos días»; 02:00 UTC del 21 son las 21:00 → «Buenas noches».
        assertTrue(preguntar("hola").text.startsWith("¡Buenos días!"))
        val noche = responderAsesor("hola", emptyList(), emptyList(), emptyMap(), emptyList(), LEXICO_VACIO, CTX_VACIO, ahora = Instant.parse("2026-08-21T02:00:00Z"))
        assertTrue(noche.text.startsWith("¡Buenas noches!"))
        assertEquals(preguntar("hola", azar = Random(7)).text, preguntar("hola", azar = Random(7)).text)
    }

    @Test fun elFallbackFinalSeReconoceYLaFrasePropiaDeLaWebTambien() {
        assertTrue(esRespuestaFallbackAsesor(preguntar("asdkjaslkdjaslkdj")))
        val larga = preguntar("esta es una frase bastante larga que no habla de nada concreto en particular")
        assertTrue(larga.sinRespuestaPropia)
        assertTrue(esRespuestaFallbackAsesor(larga))
        assertFalse(esRespuestaFallbackAsesor(preguntar("hola")))
    }
}
