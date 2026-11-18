package app.lukapp.dominio

/** Origen: `parseComandoVoz.ts` (`ComandoVozConfirmado`). Lo que queda tras revisar y completar la orden por voz. */
sealed class OrdenConfirmada {
    data class Transferencia(val origenId: String, val destinoId: String, val montoCop: Long, val occurredOn: String?) : OrdenConfirmada()
    data class Abono(val deudaId: String, val cuentaId: String, val montoCop: Long, val occurredOn: String?) : OrdenConfirmada()
    data class Saldo(val cajitaId: String, val saldoCop: Long) : OrdenConfirmada()
    data class Rendimiento(val cajitaId: String, val montoCop: Long, val occurredOn: String?) : OrdenConfirmada()
}

/** Qué falta o qué conviene avisar antes de aplicar una orden por voz. */
data class ValidacionComando(
    val monto: Long?, val mismaCuenta: Boolean, val abonoExcedeDeuda: Boolean, val saldoInsuficiente: Boolean,
    val camposCompletos: Boolean, val saldoOrigenCop: Long, val deudaActualCop: Long,
)

/**
 * Origen: `ConfirmarComandoVoz.tsx`. Mismas reglas: una orden nunca se aplica con un campo sin elegir; el abono no
 * puede pasar de la deuda (se pide actualizar primero el saldo) y un saldo de origen corto solo avisa, porque ese
 * saldo puede estar desactualizado.
 */
fun validarComando(
    tipo: String, montoTexto: String, origenId: String, destinoId: String, deudaId: String, cuentaId: String, cajitaId: String,
    saldos: Map<String, Long>,
): ValidacionComando {
    val monto = if (tipo == "saldo") parseSaldoInput(montoTexto) else parseAmountInput(montoTexto)
    val saldoOrigen = saldos[if (tipo == "abono") cuentaId else origenId] ?: 0L
    val deudaActual = Math.abs(saldos[deudaId] ?: 0L)
    val mismaCuenta = tipo == "transferencia" && origenId.isNotEmpty() && origenId == destinoId
    val excede = tipo == "abono" && monto != null && deudaId.isNotEmpty() && monto > deudaActual
    val insuficiente = monto != null && (tipo == "transferencia" || tipo == "abono") &&
        (if (tipo == "abono") cuentaId else origenId).isNotEmpty() && monto > saldoOrigen
    val completos = when {
        monto == null -> false
        tipo == "transferencia" -> origenId.isNotEmpty() && destinoId.isNotEmpty() && !mismaCuenta
        tipo == "abono" -> deudaId.isNotEmpty() && cuentaId.isNotEmpty() && !excede
        else -> cajitaId.isNotEmpty()
    }
    return ValidacionComando(monto, mismaCuenta, excede, insuficiente, completos, saldoOrigen, deudaActual)
}
