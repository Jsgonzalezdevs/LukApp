package app.lukapp.dominio

/** Origen: `DivisionCuentasModal.tsx`. Hasta 50 personas, como la web. */
const val MAX_PERSONAS_DIVISION = 50

/** La propina que ofrece la web; 10 % es la típica en Colombia. */
val PROPINAS_DIVISION = listOf(0, 10, 15, 20)

data class ParticipanteDivision(val nombre: String, val pagoConfirmado: Boolean = false)

/** Origen: `crearParticipantes`. */
fun participantesIniciales(cantidad: Int): List<ParticipanteDivision> = List(cantidad) { ParticipanteDivision("Persona ${it + 1}") }

/** Lo que sale de la cuenta: la propina se redondea, la cuota siempre sube al peso (nadie queda debiendo). */
data class ResultadoDivision(val totalBase: Long, val propina: Long, val totalConPropina: Long, val cuota: Long)

/** Origen: el cálculo de `DivisionCuentasModal` (`Math.round` de la propina, `Math.ceil` de la cuota). */
fun dividirCuenta(totalBase: Long, porcentajePropina: Int, personas: Int): ResultadoDivision {
    val propina = Math.round(totalBase.toDouble() * porcentajePropina / 100)
    val total = totalBase + propina
    val cuota = if (personas > 0) Math.ceil(total.toDouble() / personas).toLong() else 0L
    return ResultadoDivision(totalBase, propina, total, cuota)
}

/** Origen: `copiarMensaje`: el texto de cobro que se manda por WhatsApp o donde sea. */
fun mensajeDeCobro(lugar: String, porcentajePropina: Int, r: ResultadoDivision, participantes: List<ParticipanteDivision>): String {
    val enLugar = if (lugar.trim().isNotEmpty()) " en ${lugar.trim()}" else ""
    return "🧾 *División de cuenta$enLugar*\n" +
        "• Total cuenta: ${formatCop(r.totalBase)}\n" +
        (if (porcentajePropina > 0) "• Propina ($porcentajePropina%): ${formatCop(r.propina)}\n• Total con propina: ${formatCop(r.totalConPropina)}\n" else "") +
        "Dividido entre ${participantes.size} personas: *${formatCop(r.cuota)} cada uno*\n\n" +
        participantes.joinToString("\n") { "• ${it.nombre.ifEmpty { "Sin nombre" }}: ${if (it.pagoConfirmado) "Pagó" else "Pendiente"}" } +
        "\n\nCreado con LukApp"
}

/** Origen: `handleAnotar`: la descripción del gasto de «mi parte». */
fun descripcionMiParte(lugar: String, personas: Int): String =
    if (lugar.trim().isNotEmpty()) "Mi parte en ${lugar.trim()}" else "Mi parte de cuenta ($personas personas)"
