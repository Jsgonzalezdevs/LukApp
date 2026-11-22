package app.lukapp.dominio

import kotlin.math.abs

/**
 * Origen: `lib/motorFinanciero.ts` (`EntradaMotorFinanciero`). La web la arma extendiendo la
 * `Instantanea`; aquí el libro va como un campo para no repetir lo que ya recibe
 * `construirContextoFinanciero`. `ajusteFuturoCop` existe solo para simulaciones.
 */
data class EntradaMotorFinanciero(
    val libro: Libro,
    val hoy: String,
    val periodo: ConfigPeriodo,
    val ajusteFuturoCop: Long? = null,
)

/** Origen: `lib/simuladorFinanciero.ts` (`ModificadorSimulacion`). `tipo` conserva la clave de la web porque sale en los avisos. */
sealed class ModificadorSimulacion {
    abstract val tipo: String
    abstract val montoCop: Long

    data class GastoExtraordinario(override val montoCop: Long) : ModificadorSimulacion() {
        override val tipo: String get() = "gasto-extraordinario"
    }

    data class AhorroAdicional(override val montoCop: Long, val cajitaId: String? = null) : ModificadorSimulacion() {
        override val tipo: String get() = "ahorro-adicional"
    }

    data class AbonoExtraordinario(
        override val montoCop: Long,
        val deudaId: String? = null,
        val cuentaId: String? = null,
    ) : ModificadorSimulacion() {
        override val tipo: String get() = "abono-extraordinario"
    }

    data class ReduccionGasto(override val montoCop: Long, val categoria: String) : ModificadorSimulacion() {
        override val tipo: String get() = "reduccion-gasto"
    }
}

/** Origen: `lib/simuladorFinanciero.ts` (`DiferenciaFinanciera`). */
data class DiferenciaFinanciera(
    val base: Long,
    val simulado: Long,
    val cambioCop: Long,
    val cambioPct: Double?,
)

/** Origen: `lib/simuladorFinanciero.ts` (`ResultadoSimulacion.diferencia`). */
data class DiferenciasSimulacion(
    val disponibleDiario: DiferenciaFinanciera,
    val dineroLibre: DiferenciaFinanciera,
    val obligaciones: DiferenciaFinanciera,
    val patrimonio: DiferenciaFinanciera,
)

/** Origen: `lib/simuladorFinanciero.ts` (`ResultadoSimulacion`). `recuperacionDias` es nulo si no hay impacto o no hay disponible diario. */
data class ResultadoSimulacion(
    val base: ContextoFinanciero,
    val simulado: ContextoFinanciero,
    val diferencia: DiferenciasSimulacion,
    val recuperacionDias: Long?,
    val avisos: List<String>,
    val riesgo: String,
    val explicacion: List<String>,
)

private fun porcentaje(base: Long, simulado: Long): Double? =
    if (base > 0) Math.round((simulado - base).toDouble() / base * 1000) / 10.0 else null

private fun diferencia(base: Long, simulado: Long) =
    DiferenciaFinanciera(base, simulado, simulado - base, porcentaje(base, simulado))

private fun primeraCuentaActiva(libro: Libro): String? =
    libro.cajitas.firstOrNull { it.tipo == TipoCajita.CUENTA && it.archivedAt == null }?.id

private fun transaccionTemporal(entrada: EntradaMotorFinanciero, monto: Long) = Transaccion(
    id = "simulacion-gasto-extraordinario", kind = TipoTx.GASTO, amountCop = monto, category = "otros",
    description = "Simulación temporal", occurredOn = entrada.hoy, cuentaId = primeraCuentaActiva(entrada.libro),
    rawTranscript = "", createdAt = entrada.hoy,
)

private fun movimientoTemporal(entrada: EntradaMotorFinanciero, modificador: ModificadorSimulacion): CajitaMovimiento {
    val libro = entrada.libro
    val esAhorro = modificador is ModificadorSimulacion.AhorroAdicional
    val cajitaId = when (modificador) {
        is ModificadorSimulacion.AhorroAdicional ->
            modificador.cajitaId ?: libro.cajitas.firstOrNull { it.tipo == TipoCajita.CAJITA && it.archivedAt == null }?.id ?: ""
        is ModificadorSimulacion.AbonoExtraordinario ->
            modificador.deudaId ?: libro.cajitas.firstOrNull { it.tipo == TipoCajita.DEUDA && it.archivedAt == null }?.id ?: ""
        else -> ""
    }
    return CajitaMovimiento(
        id = "simulacion-${modificador.tipo}",
        cajitaId = cajitaId,
        kind = if (esAhorro) TipoMovimiento.DEPOSITO else TipoMovimiento.ABONO,
        deltaCop = if (esAhorro) modificador.montoCop else -modificador.montoCop,
        categoria = null, occurredOn = entrada.hoy, nota = "Simulación temporal", createdAt = entrada.hoy,
    )
}

private fun aplicarModificador(entrada: EntradaMotorFinanciero, modificador: ModificadorSimulacion): EntradaMotorFinanciero {
    val libro = entrada.libro
    val transacciones = libro.transacciones.toMutableList()
    val movimientos = libro.movimientos.toMutableList()
    var ajuste = entrada.ajusteFuturoCop
    when (modificador) {
        is ModificadorSimulacion.GastoExtraordinario -> transacciones.add(transaccionTemporal(entrada, modificador.montoCop))
        is ModificadorSimulacion.AhorroAdicional -> {
            val mov = movimientoTemporal(entrada, modificador)
            if (mov.cajitaId.isNotEmpty()) {
                movimientos.add(mov)
                val cuentaId = primeraCuentaActiva(libro)
                if (cuentaId != null) {
                    movimientos.add(mov.copy(id = "${mov.id}-cuenta", cajitaId = cuentaId, kind = TipoMovimiento.RETIRO, deltaCop = -modificador.montoCop))
                }
            }
        }
        is ModificadorSimulacion.AbonoExtraordinario -> {
            val deuda = movimientoTemporal(entrada, modificador)
            if (deuda.cajitaId.isNotEmpty()) {
                movimientos.add(deuda)
                val cuentaId = modificador.cuentaId ?: primeraCuentaActiva(libro)
                if (cuentaId != null) {
                    movimientos.add(deuda.copy(id = "${deuda.id}-cuenta", cajitaId = cuentaId, kind = TipoMovimiento.RETIRO, deltaCop = -modificador.montoCop))
                }
            }
        }
        is ModificadorSimulacion.ReduccionGasto -> ajuste = (ajuste ?: 0L) + modificador.montoCop
    }
    return entrada.copy(
        libro = libro.copy(transacciones = transacciones, movimientos = movimientos),
        ajusteFuturoCop = ajuste,
    )
}

private fun construir(entrada: EntradaMotorFinanciero): ContextoFinanciero =
    construirContextoFinanciero(entrada.libro, entrada.hoy, entrada.periodo, entrada.ajusteFuturoCop ?: 0L)

/**
 * Origen: `lib/simuladorFinanciero.ts` (`simularDecisiones`). Determinista y temporal:
 * nunca toca el libro real, solo calcula uno paralelo con los modificadores aplicados.
 */
fun simularDecisiones(entrada: EntradaMotorFinanciero, modificadores: List<ModificadorSimulacion>): ResultadoSimulacion {
    val base = construir(entrada)
    val avisos = mutableListOf<String>()
    val simulada = modificadores.fold(entrada) { actual, modificador ->
        if (modificador.montoCop <= 0) {
            avisos.add("${modificador.tipo}: el monto debe ser mayor que cero.")
            return@fold actual
        }
        if (modificador is ModificadorSimulacion.AhorroAdicional &&
            actual.libro.cajitas.none { it.tipo == TipoCajita.CAJITA && it.archivedAt == null }
        ) {
            avisos.add("No hay una cajita activa para simular este ahorro.")
            return@fold actual
        }
        if (modificador is ModificadorSimulacion.AbonoExtraordinario) {
            val cajitas = actual.libro.cajitas
            val deudaId = modificador.deudaId ?: cajitas.firstOrNull { it.tipo == TipoCajita.DEUDA && it.archivedAt == null }?.id
            val cuentaId = modificador.cuentaId ?: cajitas.firstOrNull { it.tipo == TipoCajita.CUENTA && it.archivedAt == null }?.id
            if (deudaId.isNullOrEmpty() || cuentaId.isNullOrEmpty()) {
                avisos.add("El abono requiere una deuda y una cuenta activas.")
                return@fold actual
            }
            val saldos = saldosPorCajita(actual.libro.movimientos, actual.libro.transacciones, idsPasivos(cajitas))
            val disponibleDeuda = maxOf(0L, abs(saldos[deudaId] ?: 0L))
            val disponibleCuenta = maxOf(0L, saldos[cuentaId] ?: 0L)
            val aplicable = minOf(modificador.montoCop, disponibleDeuda, disponibleCuenta)
            if (aplicable <= 0) {
                avisos.add("El abono no puede aplicarse: la deuda o la cuenta no tienen saldo disponible.")
                return@fold actual
            }
            if (aplicable < modificador.montoCop) avisos.add("El abono se limitó a $aplicable porque no puede superar la deuda o el saldo de la cuenta.")
            return@fold aplicarModificador(actual, modificador.copy(montoCop = aplicable))
        }
        aplicarModificador(actual, modificador)
    }
    val simulado = construir(simulada)
    val impactoUnicoCop = modificadores.sumOf { if (it is ModificadorSimulacion.ReduccionGasto) -it.montoCop else it.montoCop }
    val recuperacionDias = if (impactoUnicoCop != 0L && base.liquidez.disponibleDiarioCop > 0)
        Math.ceil(abs(impactoUnicoCop).toDouble() / base.liquidez.disponibleDiarioCop).toLong() else null
    return ResultadoSimulacion(
        base = base,
        simulado = simulado,
        diferencia = DiferenciasSimulacion(
            disponibleDiario = diferencia(base.liquidez.disponibleDiarioCop, simulado.liquidez.disponibleDiarioCop),
            dineroLibre = diferencia(base.liquidez.dineroLibreCop, simulado.liquidez.dineroLibreCop),
            obligaciones = diferencia(base.liquidez.obligacionesPendientesCop, simulado.liquidez.obligacionesPendientesCop),
            patrimonio = diferencia(base.saldo.patrimonioCop, simulado.saldo.patrimonioCop),
        ),
        recuperacionDias = recuperacionDias,
        avisos = avisos,
        riesgo = simulado.liquidez.nivel,
        explicacion = listOf("La simulación es temporal y no modifica tus finanzas reales.") +
            simulado.liquidez.factores.map { "${it.concepto}: ${it.montoCop} (${it.certeza})." },
    )
}
