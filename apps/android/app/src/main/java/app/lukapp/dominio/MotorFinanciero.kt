package app.lukapp.dominio

import kotlin.math.abs

/** Origen: `lib/motorFinanciero.ts` (`ContextoFinanciero.saldo`). */
data class SaldoContexto(
    val totalActivosCop: Long,
    val totalPasivosCop: Long,
    val patrimonioCop: Long,
    val saldoCuentasCop: Long,
    val saldoAhorrosCop: Long,
    val saldoTarjetasCop: Long,
    val saldoDeudasCop: Long,
    val saldoEfectivoCop: Long,
    val saldoBancosCop: Long,
)

/** Origen: `lib/motorFinanciero.ts` (`ContextoFinanciero.compromisos`). */
data class CompromisosContexto(
    val reservasCop: Long,
    val ahorroComprometidoCop: Long,
    val obligacionesCop: Long,
    val cuotasCop: Long,
    val pagosTarjetaCop: Long,
    val totalCop: Long,
    val datosIncompletos: Boolean,
)

/** Origen: `lib/motorFinanciero.ts` (`liquidez.factores`). */
data class FactorLiquidez(val concepto: String, val montoCop: Long, val certeza: String)

/**
 * Origen: `lib/motorFinanciero.ts` (`ContextoFinanciero.liquidez`).
 * `nivel`: bien, atencion, riesgo, incompleto. `confianza`: alta, media, baja.
 */
data class LiquidezContexto(
    val dineroLibreCop: Long,
    val dineroLibreBrutoCop: Long,
    val saldoLiquidoCop: Long,
    val obligacionesPendientesCop: Long,
    val cuotasPendientesCop: Long,
    val compromisosMetasCop: Long,
    val diasRestantesPeriodo: Int,
    val disponibleDiarioCop: Long,
    val disponibleDiarioBrutoCop: Long,
    val liquidezMinimaCop: Long?,
    val nivel: String,
    val confianza: String,
    val factores: List<FactorLiquidez>,
)

/** Origen: `lib/motorFinanciero.ts` (`PuntoProyectado`). `certeza`: real, programada, estimada. */
data class PuntoProyectado(
    val fecha: String,
    val saldoCop: Long,
    val entradasCop: Long,
    val salidasCop: Long,
    val comprometidoCop: Long,
    val certeza: String,
)

/** Origen: `lib/motorFinanciero.ts` (`ContextoFinanciero.proyeccion`). */
data class ProyeccionContexto(
    val supuestos: List<String>,
    val limitada: Boolean,
    val saldoFinalEstimadoCop: Long?,
    val serie: List<PuntoProyectado>,
)

/**
 * Origen: `lib/motorFinanciero.ts` (`SenalFinanciera`) + `lib/senalesFinancieras.ts`
 * (`SenalFinancieraPredictiva`). `severidad`: informacion, atencion, riesgo, critico.
 */
data class SenalFinanciera(
    val id: String,
    val tipo: String,
    val titulo: String,
    val razon: String,
    val confianza: Double,
    val impactoCop: Long?,
    val evidencia: List<String>,
    val severidad: String,
    val periodo: String?,
    val origen: String,
    val accion: String,
    val detectadaEn: String,
)

/**
 * Origen: `lib/metasInteligentes.ts` (`MetaInteligente`). `viabilidad`: viable, ajustada,
 * en_riesgo, sin_datos.
 */
data class MetaInteligente(
    val meta: Meta,
    val progreso: ProgresoMeta,
    val restanteCop: Long?,
    val ritmoActualCop: Long?,
    val ritmoNecesarioCop: Long?,
    val fechaEstimada: String?,
    val viabilidad: String,
    val confianza: String,
    val evidencia: List<String>,
)

/** Origen: `lib/motorFinanciero.ts` (`ContextoFinanciero`). La única fotografía financiera derivada. */
data class ContextoFinanciero(
    val saldo: SaldoContexto,
    val compromisos: CompromisosContexto,
    val liquidez: LiquidezContexto,
    val proyeccion: ProyeccionContexto,
    val proyeccionCompleta: List<PuntoProyeccionCompleta>,
    val entradasFuturas: List<EntradaFutura>,
    val metas: List<MetaConProgreso>,
    val metasInteligentes: List<MetaInteligente>,
    val presupuestos: List<EstadoPresupuesto>,
    val obligaciones: List<ObligacionFutura>,
    val anomalias: List<SenalFinanciera>,
    val tarjetas: List<ResumenTarjeta>,
    val forecast: ForecastFinanciero?,
)

// `toLocaleString('es-CO')` de un entero: miles con punto.
private fun conMilesEsCo(valor: Long): String = (if (valor < 0) "-" else "") + formatAmountInput(valor)

/** Origen: `lib/metasInteligentes.ts` (`evaluarMetas`). Interpreta metas sin volverlas obligaciones. */
fun evaluarMetas(contexto: ContextoFinanciero): List<MetaInteligente> = contexto.metas.map { fila ->
    val p = fila.progreso
    val tieneObjetivo = p.objetivoCop > 0
    val necesario = p.ritmoMensualCop
    val viabilidad = when {
        !tieneObjetivo -> "sin_datos"
        p.completada -> "viable"
        necesario == null -> "sin_datos"
        necesario <= contexto.liquidez.dineroLibreCop -> "viable"
        else -> "en_riesgo"
    }
    val evidencia = when {
        !tieneObjetivo -> listOf("Falta monto objetivo.")
        p.completada -> listOf("Meta alcanzada.")
        else -> listOf("El modelo no identifica ahorro nuevo sin confundir transferencias internas con ahorro.")
    }
    // ritmoActual queda null: no hay forma de separar ahorro nuevo de traslados internos.
    MetaInteligente(fila.meta, p, if (tieneObjetivo) p.faltaCop else null, null, necesario, null, viabilidad, "baja", evidencia)
}

/** Origen: `lib/senalesFinancieras.ts` (`construirSenalesFinancieras`). Interpreta, no recalcula. */
fun construirSenalesFinancieras(contexto: ContextoFinanciero, hoy: String): List<SenalFinanciera> {
    val senales = mutableListOf<SenalFinanciera>()
    val serie = contexto.proyeccionCompleta
    val mes = hoy.take(7)
    serie.firstOrNull { it.riesgo == "deficit-proyectado" }?.let { d ->
        senales.add(SenalFinanciera("liquidez-deficit-proyectado", "liquidez", "Déficit proyectado",
            "La liquidez proyectada cae por debajo de cero el ${d.fecha}.", 0.9, d.saldoLiquidoCop, d.evidencia, "critico",
            d.fecha.take(7), "proyeccionFinanciera", "Revisa las obligaciones próximas y el disponible diario.", hoy))
    }
    val limite = serie.getOrNull(minOf(10, serie.size - 1))?.fecha
    val cercanas = contexto.obligaciones.filter { it.fecha != null && it.fecha >= hoy && limite != null && it.fecha <= limite }
    val totalCercano = cercanas.sumOf { it.montoCop ?: 0L }
    if (cercanas.size >= 3 && totalCercano > 0) {
        senales.add(SenalFinanciera("concentracion-$hoy", "concentracion-pagos", "Pagos concentrados",
            "${cercanas.size} obligaciones reúnen ${conMilesEsCo(totalCercano)} COP en los próximos días.", 0.85, totalCercano,
            cercanas.map { it.concepto }, "atencion", mes, "obligacionesFuturas", "Revisa las fechas y prioriza los pagos.", hoy))
    }
    for (p in contexto.presupuestos) {
        if (p.excedidoCop > 0) {
            senales.add(SenalFinanciera("presupuesto-${p.categoria}", "presupuesto", "Presupuesto excedido",
                "El gasto supera el tope en ${conMilesEsCo(p.excedidoCop)} COP.", 1.0, p.excedidoCop, listOf(p.categoria),
                "riesgo", mes, "presupuestos", "Revisa los gastos de esta categoría.", hoy))
        }
    }
    for (t in contexto.tarjetas) {
        val limiteCredito = t.limiteCreditoCop
        if (limiteCredito != null && limiteCredito > 0 && t.saldoUtilizadoCop.toDouble() / limiteCredito >= 0.8) {
            senales.add(SenalFinanciera("tarjeta-utilizacion-${t.tarjetaId}", "tarjeta", "Utilización alta de tarjeta",
                "El saldo utilizado supera el 80% del límite configurado.", 1.0, t.saldoUtilizadoCop, listOf(t.tarjetaId),
                "atencion", mes, "tarjetas", "Revisa el pago próximo y el cupo disponible.", hoy))
        }
    }
    for (m in contexto.metasInteligentes) {
        val dias = m.progreso.diasRestantes
        if (!m.progreso.completada && dias != null && dias <= 0) {
            senales.add(SenalFinanciera("meta-atrasada-${m.meta.id}", "meta", "Meta atrasada",
                "La meta “${m.meta.nombre}” superó su fecha objetivo sin completarse.", 1.0, m.restanteCop, m.evidencia,
                "riesgo", m.meta.fechaObjetivo?.take(7), "metasInteligentes", "Revisa el objetivo o define un nuevo ritmo de ahorro.", hoy))
        }
    }
    return senales
}

/**
 * Origen: `lib/motorFinanciero.ts` (`construirContextoFinanciero`). Alimenta Inicio, el
 * calendario y el asesor con una sola lectura del libro.
 *
 * `ajusteFuturoCop` existe solo para simulaciones y nunca se persiste.
 */
fun construirContextoFinanciero(libro: Libro, hoy: String, periodo: ConfigPeriodo, ajusteFuturoCop: Long = 0): ContextoFinanciero {
    val cajitas = libro.cajitas
    val movs = libro.movimientos
    val txs = libro.transacciones
    val pasivos = idsPasivos(cajitas)
    val saldos = saldosPorCajita(movs, txs, pasivos)
    val p = patrimonio(cajitas, movs, txs)
    val saldoTarjetas = abs(totalPorTipo(cajitas, movs, TipoCajita.TARJETA, txs))
    val mes = hoy.take(7)
    val obligaciones = construirObligacionesFuturas(libro, hoy, 90)
    val tarjetas = cajitas.filter { it.tipo == TipoCajita.TARJETA && it.archivedAt == null }.map { t ->
        val usado = abs(totalPorTipo(listOf(t), movs, TipoCajita.TARJETA, txs))
        resumenTarjeta(t, usado, txs, movs, mes, hoy)
    }
    val metas = metasConProgreso(libro.metas, saldos, hoy)
    // Las cajitas ya están dentro del patrimonio: se apartan como reserva, no se restan otra vez como meta.
    val reservas = maxOf(0L, totalPorTipo(cajitas.filter { it.tipo == TipoCajita.CAJITA }, movs, TipoCajita.CAJITA, txs))
    val ahorroComprometido = 0L
    val conImporte = obligaciones.filter { it.montoCop != null }
    val obligacionesTotal = conImporte.sumOf { it.montoCop!! }
    val clavePeriodo = claveDePeriodo(hoy, periodo)
    val finPeriodo = finDePeriodoMotor(clavePeriodo, hoy, periodo)
    val delPeriodo = conImporte.filter { it.fecha != null && (finPeriodo == null || it.fecha <= finPeriodo) }
    val obligacionesDelPeriodo = delPeriodo.sumOf { it.montoCop!! }
    // Una compra con tarjeta todavía no sacó plata de las cuentas: ni la deuda ni su
    // pago estimado deben vaciar el disponible antes del abono real.
    val reducenDisponible = delPeriodo.filter { it.origen != "tarjeta" }.sumOf { it.montoCop!! }
    val libreBruto = p.netoCop + saldoTarjetas - reservas - reducenDisponible + ajusteFuturoCop
    val totalDias = diasDelPeriodo(clavePeriodo, periodo)
    val transcurridos = diasTranscurridosEnPeriodo(clavePeriodo, hoy, periodo)
    val dias = maxOf(1, (totalDias ?: 1) - (transcurridos ?: 0) + 1)
    val diarioBruto = Math.round(libreBruto.toDouble() / dias)
    val presupuestos = estadoDeTodos(libro.presupuestos, txs, clavePeriodo, hoy, periodo)
    val gastosMes = txs.filter { it.kind == TipoTx.GASTO && it.occurredOn.startsWith(mes) }.sumOf { it.amountCop }
    val serie = listOf(PuntoProyectado(hoy, p.netoCop, 0, gastosMes, obligacionesTotal, "real"))
    val datosIncompletos = libro.recurrentes.isEmpty() || libro.metas.isEmpty()
    val pagosTarjeta = conImporte.filter { it.origen == "tarjeta" }.sumOf { it.montoCop!! }
    // Aquí la web clasifica solo por clase de cuenta (no por el id fijo), a diferencia de saldoEfectivo().
    val saldoEfectivo = cajitas.filter { it.tipo == TipoCajita.CUENTA && it.archivedAt == null && claseDeCuenta(it) == ClaseCuenta.EFECTIVO }
        .sumOf { saldos[it.id] ?: 0L }
    val entradasFuturas = construirEntradasFuturas(libro, hoy, 90)
    val proyeccionCompleta = proyectarFinanzas(libro, hoy, obligaciones, entradasFuturas, 90)
    val minimo = proyeccionCompleta.reduceOrNull { min, punto -> if (punto.saldoLiquidoCop < min.saldoLiquidoCop) punto else min }?.saldoLiquidoCop
    val confianza = when {
        datosIncompletos -> "baja"
        obligaciones.any { it.certeza == "estimada" } -> "media"
        else -> "alta"
    }
    val base = ContextoFinanciero(
        saldo = SaldoContexto(
            totalActivosCop = p.totalCop,
            totalPasivosCop = p.deudasCop,
            patrimonioCop = p.netoCop,
            saldoCuentasCop = p.cuentasCop,
            saldoAhorrosCop = p.cajitasCop,
            saldoTarjetasCop = saldoTarjetas,
            saldoDeudasCop = abs(totalPorTipo(cajitas, movs, TipoCajita.DEUDA, txs)),
            saldoEfectivoCop = saldoEfectivo,
            saldoBancosCop = p.cuentasCop - saldoEfectivo,
        ),
        compromisos = CompromisosContexto(reservas, ahorroComprometido, obligacionesDelPeriodo, pagosTarjeta, pagosTarjeta,
            reservas + ahorroComprometido + obligacionesDelPeriodo, datosIncompletos),
        liquidez = LiquidezContexto(
            dineroLibreCop = maxOf(0L, libreBruto),
            dineroLibreBrutoCop = libreBruto,
            saldoLiquidoCop = p.cuentasCop,
            obligacionesPendientesCop = obligacionesDelPeriodo,
            cuotasPendientesCop = pagosTarjeta,
            compromisosMetasCop = ahorroComprometido,
            diasRestantesPeriodo = dias,
            disponibleDiarioCop = maxOf(0L, diarioBruto),
            disponibleDiarioBrutoCop = diarioBruto,
            liquidezMinimaCop = minimo,
            nivel = if (libreBruto <= 0) "riesgo" else if (datosIncompletos) "incompleto" else "bien",
            confianza = confianza,
            factores = delPeriodo.map { FactorLiquidez(it.concepto, it.montoCop!!, it.certeza) },
        ),
        proyeccion = ProyeccionContexto(
            listOf("El saldo actual se toma como punto de partida.", "Solo se proyectan obligaciones conocidas."),
            txs.size < 10, p.netoCop - obligacionesTotal, serie,
        ),
        proyeccionCompleta = proyeccionCompleta,
        entradasFuturas = entradasFuturas,
        metas = metas,
        metasInteligentes = emptyList(),
        presupuestos = presupuestos,
        obligaciones = obligaciones,
        anomalias = emptyList(),
        tarjetas = tarjetas,
        forecast = null,
    )
    // Igual que la web: las señales se calculan sobre el contexto base, cuyas metas
    // inteligentes aún están vacías, así que nunca emiten «meta atrasada».
    val anomalias = construirSenalesFinancieras(base, hoy)
    return base.copy(metasInteligentes = evaluarMetas(base), anomalias = anomalias, forecast = construirForecast(proyeccionCompleta, confianza))
}

/**
 * La web llama `finDePeriodo(clave)` también con la clave 'YYYY-MM' del mensual puro;
 * ahí arma '…-undefined' y termina en 'NaN-NaN-NaN', que por comparación de texto
 * queda después de toda fecha real: en la práctica no hay tope y cuentan todas las
 * obligaciones fechadas del horizonte de 90 días. Se replica ese resultado.
 */
private fun finDePeriodoMotor(clave: String, hoy: String, periodo: ConfigPeriodo): String? {
    if (periodo.frecuencia == FrecuenciaPeriodo.TODO_EL_TIEMPO) return finDePeriodo(hoy, periodo)
    if (clave.split("-").size < 3) return "NaN-NaN-NaN"
    return finDePeriodo(clave, periodo)
}

/** Origen: `lib/preparacionInicio.ts` (`tieneSaldoConfirmado`). Un gasto registrado no prueba cuánto había antes. */
fun tieneSaldoConfirmado(cuentaId: String, movimientos: List<CajitaMovimiento>): Boolean =
    movimientos.any { it.cajitaId == cuentaId && (it.kind == TipoMovimiento.AJUSTE || it.nota == "Saldo inicial") }

/** Origen: `lib/preparacionInicio.ts` (resultado de `preparacionInicio`). */
data class PreparacionInicio(
    val cuentas: List<Cajita>,
    val sinSaldo: List<Cajita>,
    val saldosCompletos: Boolean,
    val primerMovimiento: Boolean,
)

/** Origen: `lib/preparacionInicio.ts` (`preparacionInicio`). Qué le falta a Inicio para mostrar cifras confiables. */
fun preparacionInicio(libro: Libro): PreparacionInicio {
    val cuentas = libro.cajitas.filter { it.tipo == TipoCajita.CUENTA && it.archivedAt == null }
    val sinSaldo = cuentas.filter { !tieneSaldoConfirmado(it.id, libro.movimientos) }
    return PreparacionInicio(cuentas, sinSaldo, cuentas.isNotEmpty() && sinSaldo.isEmpty(), libro.transacciones.isNotEmpty())
}
