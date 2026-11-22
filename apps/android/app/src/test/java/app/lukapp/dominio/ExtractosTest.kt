package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ExtractosTest {
    private fun mov(desc: String, monto: Long, fecha: String = "2026-11-10", tipo: String = "gasto", exclusion: String? = null, confianza: String = "alta") =
        MovimientoExtraido(fecha, desc, monto, tipo, "otros", null, null, confianza, exclusion, null)
    private fun tx(id: String, desc: String, monto: Long, fecha: String = "2026-11-10", tipo: String = "gasto") =
        Transaccion(id, tipo, monto, "otros", desc, fecha, null, true, "", null, null, "2026-11-10T00:00:00Z")
    private var n = 0
    private fun plan(m: List<MovimientoExtraido>, e: List<Transaccion> = emptyList()) = planearImportacion(m, e, { "id${n++}" }, { "2026-11-18T00:00:00Z" }, "cta")

    @Test fun lasFilasNuevasSeImportanConSuCuentaYOrigen() {
        val p = plan(listOf(mov("Mercado Éxito", 80_000)))
        val t = p.nuevos.single()
        assertEquals("cta", t.cuentaId)
        assertEquals("extracto: Mercado Éxito", t.rawTranscript)
        assertEquals(true, t.afectaSaldo)
    }

    @Test fun subirElMismoExtractoDosVecesNoHaceNada() {
        val p = plan(listOf(mov("MERCADO EXITO", 80_000)), listOf(tx("a", "Mercado Éxito", 80_000)))
        assertEquals(1, p.duplicados.size)
        assertTrue(p.nuevos.isEmpty() && p.posibles.isEmpty())
    }

    @Test fun dosCafesIgualesSiguenSiendoDos() {
        assertEquals(2, plan(listOf(mov("Café", 5_000), mov("Café", 5_000))).nuevos.size)
        // Con uno ya anotado, solo entra el que sobra.
        val p = plan(listOf(mov("Café", 5_000), mov("Café", 5_000)), listOf(tx("a", "Café", 5_000)))
        assertEquals(1, p.nuevos.size); assertEquals(1, p.duplicados.size)
    }

    @Test fun mismoDiaYMontoConOtroTextoEsPosibleNoDuplicadoNiNuevo() {
        val p = plan(listOf(mov("COMPRA TIENDA 123", 20_000)), listOf(tx("a", "Almuerzo", 20_000)))
        assertEquals(1, p.posibles.size)
        assertTrue(p.nuevos.isEmpty() && p.duplicados.isEmpty())
        assertEquals("a", p.posibles[0].yaTengo.id)
    }

    @Test fun unaEntradaSoloAbsorbeUnaFilaDelExtracto() {
        val p = plan(listOf(mov("A", 20_000), mov("B", 20_000), mov("C", 20_000)), listOf(tx("x", "Almuerzo", 20_000)))
        assertEquals(1, p.posibles.size); assertEquals(2, p.nuevos.size)
    }

    @Test fun excluidasYDeCeroNoSeImportan() {
        val p = plan(listOf(mov("Traslado", 100_000, exclusion = MotivoExclusion.TRASLADO_PROPIO), mov("Interés", 0), mov("Real", 1_000)))
        assertEquals(1, p.excluidos.size); assertEquals(listOf("Real"), p.nuevos.map { it.description })
    }

    @Test fun totalesNoCuentanLasExcluidas() {
        val t = totalesDelAnalisis(listOf(mov("S", 1_000_000, tipo = "ingreso"), mov("G", 200_000), mov("Pago tarjeta", 500_000, exclusion = MotivoExclusion.PAGO_TARJETA), mov("Traslado", 50_000, exclusion = MotivoExclusion.TRASLADO_PROPIO)))
        assertEquals(1_000_000L, t.ingresos); assertEquals(200_000L, t.gastos); assertEquals(800_000L, t.balance); assertEquals(2, t.contados)
        assertEquals(listOf("Pagos a tarjeta de crédito", "Traslados entre tus cuentas"), t.excluidos.map { it.motivo })
    }

    @Test fun rebanadasOrdenadasYConPorcentaje() {
        val r = rebanadasDelAnalisis(listOf(mov("a", 75_000).copy(categoria = "comida"), mov("b", 25_000).copy(categoria = "mercado"), mov("c", 9_000, exclusion = MotivoExclusion.REVERSO)), "gasto")
        assertEquals(listOf("comida", "mercado"), r.map { it.categoria }); assertEquals(75.0, r[0].pct, 0.0)
    }

    @Test fun metricasQueNoCuadranSeDetectan() {
        fun res(declarado: Double) = AnalisisResultado(null, PeriodoExtracto(), "", listOf(FilaMetrica("Gasto total", declarado)), emptyList(), emptyList(), listOf(mov("g", 100_000)), emptyList())
        assertTrue(metricasCoherentes(res(101_000.0))); assertTrue(!metricasCoherentes(res(150_000.0)))
    }

    @Test fun respuestaDelServidorSeLee() {
        val ok = leerRespuestaExtracto("""{"ok":true,"resultado":{"entidad":"Nu","periodo":{"desde":"2026-10-01","hasta":"2026-10-31","etiqueta":"octubre 2026"},"veredicto":"v","metricas":[],"alertas":[],"recomendaciones":[{"titulo":"t","detalle":"d","ahorroMensualCop":null}],"movimientos":[{"fecha":"2026-10-02","descripcion":"X","montoCop":1500.4,"tipo":"gasto","categoria":"comida","confianza":"media","exclusion":null}],"advertencias":["a"],"extra":1}}""")
        val r = (ok as RespuestaExtracto.Listo).resultado
        assertEquals("Nu", r.entidad); assertEquals(1500L, r.movimientos[0].montoCop); assertEquals("media", r.movimientos[0].confianza)
        val pide = leerRespuestaExtracto("""{"ok":false,"codigo":"pdf-contrasena-requerida","mensaje":"Protegido"}""") as RespuestaExtracto.Error
        assertTrue(pide.pideContrasena); assertEquals("Protegido", pide.mensaje)
        assertEquals("fallo-interno", (leerRespuestaExtracto("<html>") as RespuestaExtracto.Error).codigo)
    }

    @Test fun revisionesGuardanDudosasPosiblesYTransferenciasExcluidas() {
        val dudosa = mov("Fila rara", 9_000, confianza = "baja")
        val t = tx("t1", "Fila rara", 9_000)
        val posible = PosibleDuplicado("k", mov("Extracto", 20_000), tx("ya", "Almuerzo", 20_000), tx("t2", "Extracto", 20_000))
        val traslado = mov("A Nequi", 50_000, exclusion = MotivoExclusion.TRASLADO_PROPIO)
        val r = crearRevisionesImportacion("job", "enero.pdf", listOf(t), listOf(dudosa), listOf(posible), listOf(traslado), "2026-11-18T00:00:00Z")
        assertEquals(listOf("documento:t1", "posible:t2", "transferencia-excluida:job:2026-11-10:50000:A Nequi"), r.map { it.id })
        assertEquals("resuelta", r[1].estado); assertEquals("pendiente", r[0].estado)
        assertTrue(r.all { it.documento == "enero.pdf" })
    }
}
