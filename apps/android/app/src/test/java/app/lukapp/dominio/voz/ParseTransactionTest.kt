package app.lukapp.dominio.voz

import app.lukapp.dominio.CategoriaPersonal
import app.lukapp.dominio.Transaccion
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Origen: src/features/lukapp/lib/parseTransaction.test.ts */
class ParseTransactionTest {

    private fun p(texto: String) = parseTransaction(texto)

    // ── gastos ──

    @Test fun `entiende una compra dictada con tarjeta y numero de cuotas`() {
        val r = parseTransaction(
            "Compré un celular por un millón con la tarjeta Nu a seis cuotas",
            listOf(CuentaConocida("nu", "Tarjeta Nu")),
        )
        assertEquals("gasto", r.kind)
        assertEquals(1_000_000L, r.amount)
        assertEquals("nu", r.cuentaId)
        assertEquals(6, r.cuotasTotal)
        assertEquals(166_667L, r.cuotaCop)
        assertFalse(r.description.lowercase().contains("cuotas"))
        assertFalse(r.signals.ambiguousAmount)
    }

    @Test fun `en un comprobante a cuotas guarda el total y solo deja la cuota como contexto`() {
        val r = p("[OCR] 12:47 Bold Sa*Platzi \$899.259,00 en 12x de \$74.938,25 08:52, Sábado, 29 de Agosto de 2026 Resolver dudas")
        assertEquals("gasto", r.kind)
        assertEquals(899_259L, r.amount)
        assertEquals("Bold Sa*Platzi", r.description)
        assertEquals("educacion", r.category)
        assertFalse(r.signals.ambiguousAmount)
    }

    @Test fun `quita los simbolos que el OCR inventa antes del comercio en una compra a cuotas`() {
        assertEquals("Bold Sa*Platzi", p("[OCR] 0 62 < € 00 00 Bold Sa*Platzi \$899.259,00 en 12x de \$74.938,25").description)
    }

    @Test fun `lee una frase de gasto completa con comercio`() {
        val r = p("gasté 20 mil en el mercado del D1")
        assertEquals("gasto", r.kind)
        assertEquals(20000L, r.amount)
        assertEquals("mercado", r.category)
        assertTrue(r.description.contains("D1"))
        assertEquals("merchant", r.signals.categorySource)
        assertFalse(r.needsReview)
    }

    @Test fun `lee la agrupacion de digitos es-CO`() {
        val r = p("pagué 45.000 de Transmilenio")
        assertEquals("gasto", r.kind)
        assertEquals(45000L, r.amount)
        assertEquals("transporte", r.category)
    }

    @Test fun `lee una palabra de categoria sin comercio`() {
        val r = p("compré almuerzo por 15 mil")
        assertEquals("gasto", r.kind)
        assertEquals(15000L, r.amount)
        assertEquals("comida", r.category)
        assertEquals("keyword", r.signals.categorySource)
    }

    @Test fun `lee montos en jerga`() {
        val r = p("saqué 200 mil del cajero")
        assertEquals(200000L, r.amount)
        assertEquals("transferencia", r.category)
    }

    @Test fun `lee un monto de media escala`() {
        val r = p("retiré medio millón de Nequi")
        assertEquals("gasto", r.kind)
        assertEquals(500000L, r.amount)
        assertEquals("transferencia", r.category)
        assertEquals("Retiré", r.description)
    }

    @Test fun `lee marcas colombianas nuevas`() {
        val r1 = p("pagué 80 mil en Crepes & Waffles")
        assertEquals(80000L, r1.amount)
        assertEquals("comida", r1.category)
        assertTrue(r1.description.contains("Crepes & Waffles"))

        val r2 = p("compré 45 mil en Farmatodo")
        assertEquals(45000L, r2.amount)
        assertEquals("salud", r2.category)
        assertTrue(r2.description.contains("Farmatodo"))

        val r3 = p("15 mil en el Oxxo")
        assertEquals(15000L, r3.amount)
        assertEquals("mercado", r3.category)
        assertTrue(r3.description.contains("Oxxo"))

        val r4 = p("suscripción de ChatGPT por 85 mil")
        assertEquals(85000L, r4.amount)
        assertEquals("servicios", r4.category)
        assertTrue(r4.description.contains("ChatGPT"))
    }

    @Test fun `lee abreviaturas 2_5m y miles implicitos en frases completas`() {
        val r1 = p("2.5m de arriendo")
        assertEquals(2500000L, r1.amount)
        assertEquals("servicios", r1.category)

        val r2 = p("me pagaron 2 palos 400 de sueldo")
        assertEquals("ingreso", r2.kind)
        assertEquals(2400000L, r2.amount)
        assertEquals("ingreso", r2.category)
    }

    // ── ingresos conversacionales ──

    @Test fun `entiende que un dinero prestado que me pagaron es un ingreso`() {
        val r = p("El día de ayer fui a Don Pedro a comer con mi amigo y él me pagó 50 mil que me debía")
        assertEquals("ingreso", r.kind)
        assertEquals(50000L, r.amount)
        assertEquals("ingreso", r.category)
    }

    // ── la trampa del «me» ──

    @Test fun `me costo es gasto`() {
        val r = p("me costó 80 lucas el Uber")
        assertEquals("gasto", r.kind)
        assertEquals(80000L, r.amount)
        assertEquals("transporte", r.category)
        assertEquals("keyword", r.signals.kindSource)
    }

    @Test fun `me salio es gasto`() {
        assertEquals("gasto", p("me salió en 30 mil").kind)
    }

    @Test fun `separa abone de me abonaron`() {
        assertEquals("gasto", p("aboné 100 mil").kind)
        assertEquals("ingreso", p("me abonaron 100 mil").kind)
    }

    @Test fun `separa consigne de me consignaron`() {
        assertEquals("gasto", p("consigné 300 mil").kind)
        assertEquals("ingreso", p("me consignaron 1'200.000").kind)
    }

    @Test fun `me cobraron es gasto pese a terminar en aron`() {
        val r = p("me cobraron 50 mil")
        assertEquals("gasto", r.kind)
        assertEquals("keyword", r.signals.kindSource)
    }

    // ── ingresos ──

    @Test fun `lee una frase de ingreso explicita`() {
        val r = p("me entraron 2 millones")
        assertEquals("ingreso", r.kind)
        assertEquals(2000000L, r.amount)
    }

    @Test fun `lee el apostrofo de millones`() {
        assertEquals(1200000L, p("me consignaron 1'200.000").amount)
    }

    @Test fun `lee otros verbos de ingreso`() {
        assertEquals("ingreso", p("recibí 500 mil de un cliente").kind)
        assertEquals("ingreso", p("cobré 300 mil").kind)
        assertEquals("ingreso", p("gané 50 mil").kind)
        assertEquals("ingreso", p("acabo de ganar 20 mil pesos en Rappi").kind)
        assertEquals("ingreso", p("me llegó el pago de 800 mil").kind)
    }

    @Test fun `entiende formas coloquiales de plata que entro`() {
        for (texto in listOf(
            "Juan me dio 30 mil",
            "mi mamá me dieron 50 mil",
            "Laura me transfirió 120 mil",
            "me enviaron 75 mil por Nequi",
            "[OCR] Transferencia recibida Valor \$ 45.000",
        )) {
            assertEquals(texto, "ingreso", p(texto).kind)
        }
    }

    @Test fun `infiere ingreso por morfologia`() {
        val r = p("me reembolsaron 20 mil")
        assertEquals("ingreso", r.kind)
        assertEquals("morphology", r.signals.kindSource)
    }

    @Test fun `infiere ingreso por la categoria sola`() {
        val r = p("el salario de este mes")
        assertEquals("ingreso", r.kind)
        assertEquals("category-implied", r.signals.kindSource)
        assertNull(r.amount)
        assertTrue(r.needsReview)
    }

    @Test fun `cae en la categoria ingreso cuando nada mas calzo`() {
        val r = p("me pagaron 900 mil")
        assertEquals("ingreso", r.kind)
        assertEquals("ingreso", r.category)
        assertEquals("Me pagaron", r.description)
    }

    // ── nunca por subcadena ──

    @Test fun `no encuentra Ara dentro de para`() {
        assertEquals("transporte", p("pagué el pasaje para el trabajo").category)
    }

    @Test fun `no encuentra mil dentro de familia`() {
        assertNull(p("compré comida para la familia").amount)
    }

    @Test fun `no encuentra uno dentro de desayuno`() {
        val r = p("el desayuno")
        assertNull(r.amount)
        assertEquals("comida", r.category)
    }

    @Test fun `no encuentra D1 dentro de d10`() {
        assertEquals("ropa", p("gasté en camisetas d10").category)
    }

    // ── selección del monto ──

    @Test fun `prefiere el monto con escala sobre una cantidad inicial`() {
        val r = p("compré 2 pizzas por 30 mil")
        assertEquals(30000L, r.amount)
        assertEquals("comida", r.category)
        assertTrue(r.signals.ambiguousAmount)
    }

    @Test fun `prefiere el monto sobre una cantidad de meses`() {
        assertEquals(300000L, p("pagué 3 meses de gym por 300 mil").amount)
    }

    @Test fun `un monto sin ambiguedad se reporta asi`() {
        assertFalse(p("gasté 30 mil").signals.ambiguousAmount)
    }

    // ── revisión ──

    @Test fun `marca un monto sin verbo de direccion`() {
        val r = p("20 mil")
        assertEquals(20000L, r.amount)
        assertEquals("gasto", r.kind)
        assertEquals("default", r.signals.kindSource)
        assertTrue(r.needsReview)
    }

    @Test fun `marca una frase sin monto y conserva el texto`() {
        val r = p("compré algo")
        assertNull(r.amount)
        assertTrue(r.needsReview)
        assertEquals("compré algo", r.raw)
    }

    @Test fun `no falla con texto vacio`() {
        val r = p("")
        assertNull(r.amount)
        assertTrue(r.needsReview)
        assertEquals("none", r.signals.amountSource)
    }

    // ── descripción ──

    @Test fun `saca descripciones concretas del dictado conversacional`() {
        assertEquals("Banderitas", p("Compré con mi tarjeta de crédito unas banderitas que me costaron 16 mil pesos.").description)
        assertEquals("Café", p("Me compré un café con mi tarjeta").description)
        assertEquals("Detodito picante", p("Me compré un detodito picante que me valió 2800 y").description)
        assertEquals("Mercado del D1", p("gasté 20 mil en el mercado del D1").description)
        assertEquals("Tintico en Juan Valdez", p("Me tomé un tintico en juan valdez por 4 lucas").description)
        assertEquals("Zapatos en Falabella", p("Compré unos zapatos en falabella que me valieron 180 mil con la de crédito").description)
        assertEquals("Factura de Enel", p("Pagué la factura de enel 85000").description)
        assertEquals("Hamburguesa doble con queso", p("Me comí una hamburguesa doble con queso por 25 mil y ya").description)
        assertEquals("Moto en Terpel", p("Tanquié la moto en terpel con 20 mil").description)
        assertEquals("TuLlave", p("Recargué la tarjeta tullave con 15 mil").description)
    }

    @Test fun `conserva el verbo si no queda nada mas`() {
        assertEquals("Gasté", p("gasté 20 mil").description)
    }

    @Test fun `devuelve tildes y mayusculas de marcas`() {
        assertEquals("Éxito", p("gasté 50 mil en exito").description)
        assertEquals("TransMilenio", p("pagué 45 mil de transmilenio").description)
    }

    @Test fun `conserva una cantidad que no es el monto`() {
        assertEquals("2 pizzas", p("compré 2 pizzas por 30 mil").description)
    }

    @Test fun `saca el mensaje concreto de comprobantes OCR`() {
        assertEquals("Para la pizza de anoche", p("[OCR] Envío exitoso Destino Julian Mensaje Para la pizza de anoche Valor \$ 50.000").description)
        assertEquals("Pago de arriendo", p("[OCR] Aprobado Motivo Pago de arriendo Fecha 12 de Agosto").description)
        val nequiRaw = "[OCR] € comprobante de pago (O Envío Realizado A [a] Le I \"| E _— L.] NN L a La “ EH El [m] P E, h: O ¡Escanea este GR con Nequi para verificar tu envío al instante! Para Josue Conversación Te envío esto como prueba para la app de finanzas gracias bro ¿Cuánto? \$ 100,00 Número Nequi 310 2201494 Fecha 16 de agosto de 2026 alas 06:15 p.m. Referencia M16482536"
        val nequiTx = p(nequiRaw)
        assertEquals("Te envío esto como prueba para la app de finanzas gracias bro (06:15)", nequiTx.description)
        assertEquals(100L, nequiTx.amount)
    }

    @Test fun `limpia el ruido de comprobantes OCR sin volcar plantilla en la descripcion`() {
        val tx = p("[OCR] Del movimiento < (O Envío Realizado ORO 0 I E h r =_ ME (1) ¡Escanea este QR con Nequi para verificar tu envío al instante! Valor \$13.000")
        assertEquals(13000L, tx.amount)
        assertFalse(tx.description.contains("Del movimiento"))
        assertFalse(tx.description.contains("Escanea"))
        assertEquals("Transferencia", tx.description)
    }

    @Test fun `prioriza el total y la direccion explicita de facturas y comprobantes`() {
        val factura = p("[OCR] FACTURA DE VENTA Fecha 28/08/2026 Referencia 989010 Total a pagar \$ 128.900 Gracias por su compra")
        assertEquals("gasto", factura.kind)
        assertEquals(128900L, factura.amount)

        val recibido = p("[OCR] Comprobante Transferencia recibida Fecha 28/08/2026 Valor \$ 350.000 Referencia 123456")
        assertEquals("ingreso", recibido.kind)
        assertEquals(350000L, recibido.amount)

        val enviado = p("[OCR] Envío realizado exitosamente Valor \$ 85.000 Cuenta destino 123456789")
        assertEquals("gasto", enviado.kind)
        assertEquals(85000L, enviado.amount)
    }

    @Test fun `lee un comprobante de Nequi como envio y conserva el destinatario`() {
        val m = p("[OCR] Comprobante de pago Envío realizado ¡Escanea este QR con Nequi para verificar tu envío al instante! Para Julián González ¿Cuánto? \$ 9.000,00 Número Nequi 318 786 5403 Fecha 25 de septiembre de 2026 Referencia M24388321")
        assertEquals("gasto", m.kind)
        assertEquals("transferencia", m.category)
        assertEquals(9000L, m.amount)
        assertEquals("Envío a Julián González", m.description)
    }

    @Test fun `lee el comprobante bancario como salida con el nombre completo del destinatario`() {
        val m = p("[OCR] Transferencia exitosa Valor transferencia \$ 6.500 ¿A quién le llegó la plata? Enviado a Julián Santiago González Reina Celular 3187865403 ¿De dónde salió? Cuenta de Ahorros Ahorros *1718")
        assertEquals("gasto", m.kind)
        assertEquals("transferencia", m.category)
        assertEquals(6500L, m.amount)
        assertEquals("Envío a Julián Santiago González Reina", m.description)
    }

    // ── confianza ──

    @Test fun `baja a medida que desaparecen senales`() {
        val full = p("gasté 20 mil en el D1")
        val noCategory = p("gasté 20 mil")
        val amountOnly = p("20 mil")
        val empty = p("")
        assertTrue(full.confidence > noCategory.confidence)
        assertTrue(noCategory.confidence > amountOnly.confidence)
        assertTrue(amountOnly.confidence > empty.confidence)
        assertEquals(0.0, empty.confidence, 0.0)
    }

    @Test fun `queda entre 0 y 1`() {
        for (input in listOf("gasté 20 mil en el D1", "", "hola", "me entraron 2 millones")) {
            val c = p(input).confidence
            assertTrue(c in 0.0..1.0)
        }
    }

    // ── robustez y pureza ──

    private val entradasSucias = listOf(
        "GASTÉ 20 MIL EN EL D1",
        "   gasté 20 mil   ",
        "gasté  20  mil  en  mercado.",
        "¿gasté 20 mil?",
        "me entraron 2 millones 🎉",
        "divagando mucho ${"texto ".repeat(80)}gasté 20 mil",
    )

    @Test fun `aguanta transcripciones desordenadas`() {
        for (input in entradasSucias) p(input)
    }

    @Test fun `encuentra el monto entre el ruido`() {
        assertEquals(20000L, p("GASTÉ 20 MIL EN EL D1").amount)
        assertEquals(20000L, p("¿gasté 20 mil?").amount)
    }

    @Test fun `conserva raw byte a byte`() {
        for (input in entradasSucias + listOf("", "hola")) assertEquals(input, p(input).raw)
    }

    @Test fun `es determinista`() {
        for (input in entradasSucias) assertEquals(p(input), p(input))
    }

    // ── de qué cuenta habla el texto ──

    private val cuentas = listOf(
        CuentaConocida("nequi", "Nequi"),
        CuentaConocida("banco", "Bancolombia"),
        CuentaConocida("davi", "Davivienda"),
        CuentaConocida("efec", "Efectivo"),
        CuentaConocida("bogota", "Banco de Bogotá"),
    )

    private fun leer(texto: String) = parseTransaction(texto, cuentas)

    @Test fun `reconoce el banco al que le entro la plata`() {
        val r = leer("me transfirieron 20.000 pesos a Bancolombia")
        assertEquals("ingreso", r.kind)
        assertEquals(20000L, r.amount)
        assertEquals("banco", r.cuentaId)
    }

    @Test fun `reconoce de donde salio un gasto`() {
        val r = leer("pagué 45 mil de Nequi")
        assertEquals("gasto", r.kind)
        assertEquals("nequi", r.cuentaId)
    }

    @Test fun `entiende el efectivo como cualquier otra cuenta`() {
        assertEquals("efec", leer("gasté 12 mil en efectivo").cuentaId)
    }

    @Test fun `no le importan tildes ni mayusculas`() {
        assertEquals("bogota", leer("me llegaron 50 mil a BANCO DE BOGOTA").cuentaId)
    }

    @Test fun `prefiere el nombre largo cuando uno contiene al otro`() {
        assertEquals("bogota", leer("me consignaron 100 mil al Banco de Bogotá").cuentaId)
    }

    @Test fun `no repite el banco en la descripcion`() {
        assertFalse(leer("me transfirieron 20 mil a Bancolombia").description.lowercase().contains("bancolombia"))
    }

    @Test fun `deja la cuenta en nulo cuando el texto no nombra ninguna`() {
        assertNull(leer("gasté 20 mil en almuerzo").cuentaId)
        assertEquals("ninguna", leer("gasté 20 mil en almuerzo").signals.cuentaSource)
    }

    @Test fun `no inventa cuentas cuando no le pasan ninguna`() {
        assertNull(p("me transfirieron 20 mil a Bancolombia").cuentaId)
    }

    @Test fun `no confunde un nombre metido dentro de otra palabra`() {
        assertNull(parseTransaction("gasté 20 mil en nequitos", listOf(CuentaConocida("nequi", "Nequi"))).cuentaId)
    }

    @Test fun `marca cuando la frase de verdad senalo la cuenta`() {
        assertEquals("preposicion", leer("me pagaron 80 mil a Nequi").signals.cuentaSource)
        assertEquals("nombre", leer("Nequi 80 mil").signals.cuentaSource)
    }

    @Test fun `con dos cuentas nombradas gana la que lleva preposicion`() {
        assertEquals("nequi", leer("Bancolombia me devolvió 30 mil a Nequi").cuentaId)
    }

    @Test fun `el monto sigue saliendo bien con el banco de por medio`() {
        val r = leer("me transfirieron 1.200.000 a Davivienda")
        assertEquals(1_200_000L, r.amount)
        assertEquals("davi", r.cuentaId)
    }

    // ── categorías del usuario ──

    private fun cat(id: String, nombre: String, archivedAt: String? = null) = CategoriaPersonal(
        id = id, nombre = nombre, icon = "Package", color = "#A8A29E",
        createdAt = "2026-08-01T00:00:00.000Z", archivedAt = archivedAt,
    )

    @Test fun `reconoce una categoria que el usuario creo por su nombre`() {
        val r = parseTransaction("gasté 30 mil en mascotas", emptyList(), listOf(cat("c-masc", "Mascotas")))
        assertEquals(30000L, r.amount)
        assertEquals("c-masc", r.category)
        assertEquals("usuario", r.signals.categorySource)
        assertTrue(r.description.lowercase().contains("mascotas"))
    }

    @Test fun `la categoria del usuario gana sobre la palabra generica`() {
        val r = parseTransaction("gasté 5 mil en cafe", emptyList(), listOf(cat("c-cafe", "Café")))
        assertEquals("c-cafe", r.category)
        assertEquals("usuario", r.signals.categorySource)
    }

    @Test fun `resuelve un nombre de categoria de varias palabras`() {
        val r = parseTransaction("pagué 80 mil en cosas de la casa", emptyList(), listOf(cat("c-casa", "Cosas de la casa")))
        assertEquals("c-casa", r.category)
        assertEquals("usuario", r.signals.categorySource)
    }

    @Test fun `prefiere el nombre mas largo cuando dos calzan`() {
        val r = parseTransaction("80 mil en cosas de la casa", emptyList(), listOf(cat("c-casa", "Casa"), cat("c-cosas", "Cosas de la casa")))
        assertEquals("c-cosas", r.category)
    }

    @Test fun `no matchea el nombre dentro de otra palabra`() {
        val r = parseTransaction("gasté 200 mil en un viaje a Europa", emptyList(), listOf(cat("c-ropa", "Ropa")))
        assertNotEquals("c-ropa", r.category)
    }

    @Test fun `un nombre de categoria archivada no resuelve`() {
        val r = parseTransaction("gasté 30 mil en mascotas", emptyList(), listOf(cat("c-x", "Mascotas", "2026-01-01T00:00:00.000Z")))
        assertNotEquals("c-x", r.category)
    }

    @Test fun `sin categorias del usuario todo sigue igual`() {
        val r = parseTransaction("compré almuerzo por 15 mil", emptyList(), emptyList())
        assertEquals("comida", r.category)
        assertEquals("keyword", r.signals.categorySource)
    }

    // ── aprendido del historial ──

    private fun lexico(f: (String) -> String?) = object : LexicoAprendido {
        override fun categoriaDe(norm: String) = f(norm)
        override val tamano = 2
    }

    private val lex = lexico { n -> if (n == "croquetas") "c-mascotas" else if (n == "cine") "salud" else null }

    @Test fun `usa lo aprendido cuando la lista de fabrica no sabe`() {
        val r = parseTransaction("gasté 20 mil en croquetas", emptyList(), emptyList(), lex)
        assertEquals("c-mascotas", r.category)
        assertEquals("aprendida", r.signals.categorySource)
    }

    @Test fun `lo aprendido gana sobre la palabra generica de fabrica`() {
        val r = parseTransaction("pagué 18 mil de cine", emptyList(), emptyList(), lex)
        assertEquals("salud", r.category)
        assertEquals("aprendida", r.signals.categorySource)
    }

    @Test fun `una categoria nombrada explicitamente gana sobre lo aprendido`() {
        val r = parseTransaction("pagué 18 mil de cine", emptyList(), listOf(cat("c-cine-real", "Cine")), lex)
        assertEquals("c-cine-real", r.category)
        assertEquals("usuario", r.signals.categorySource)
    }

    @Test fun `una marca conocida gana sobre lo aprendido`() {
        val conExito = lexico { n -> if (n == "exito") "salud" else null }
        val r = parseTransaction("gasté 50 mil en Éxito", emptyList(), emptyList(), conExito)
        assertEquals("mercado", r.category)
        assertEquals("merchant", r.signals.categorySource)
    }

    @Test fun `sin lexico todo sigue igual`() {
        val r = p("gasté 20 mil en croquetas")
        assertEquals("otros", r.category)
        assertEquals("default", r.signals.categorySource)
    }

    // ── el Oráculo no inventa montos ──

    private val almuerzo = Transaccion(
        id = "t-viejo", kind = "gasto", amountCop = 13_500, category = "comida",
        description = "Almuerzo", occurredOn = "2026-08-01", cuentaId = null,
        rawTranscript = "", createdAt = "2026-08-01T12:00:00.000Z",
    )

    @Test fun `hereda el monto cuando la palabra si esta entera`() {
        assertEquals(13_500L, parseTransaction("almuerzo", transacciones = listOf(almuerzo)).amount)
    }

    @Test fun `no hereda nada de una coincidencia de letras sueltas`() {
        assertNull(parseTransaction("Gracias", transacciones = listOf(almuerzo)).amount)
    }

    @Test fun `una palabra muy corta no dispara la memoria`() {
        assertNull(parseTransaction("en", transacciones = listOf(almuerzo.copy(description = "Uber"))).amount)
    }
}
