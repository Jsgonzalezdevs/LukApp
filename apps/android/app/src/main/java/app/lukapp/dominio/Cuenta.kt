package app.lukapp.dominio

import java.security.MessageDigest
import java.time.Instant
import java.time.ZoneId

/**
 * Origen: `CuentaView.tsx` (`idDeCuenta`). sha256 del id de usuario recortado a 20 caracteres: parece un id al azar
 * pero es el mismo cada vez, y no exige guardar nada nuevo.
 */
fun idDeCuenta(userId: String): String =
    MessageDigest.getInstance("SHA-256").digest(userId.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }.take(20)

/** Origen: `CuentaView.tsx` (`fechaCorta`): `dateStyle: 'medium'` en es-CO y hora de Bogotá, «17 nov 2026». */
fun fechaCorta(iso: String): String = Instant.parse(iso).atZone(ZoneId.of("America/Bogota")).let { "${it.dayOfMonth} ${mesCorto(it.monthValue)} ${it.year}" }

/** Origen: `CuentaView.tsx` (`EstadoPlan`), lo que la pantalla enseña: plan, vencimiento y prestaciones activas. */
data class EstadoPlan(val codigo: String, val nombre: String, val venceEn: String?, val beneficios: List<String>, val beneficiosPremium: Int) {
    val esPremium get() = codigo == "premium"
}

enum class NivelSync { BIEN, PENDIENTE, ERROR }

/** Origen: `CuentaView.tsx` (`estadoSync`): qué decir de la sincronización y con qué color. */
fun estadoSync(hayError: Boolean, cambiosPendientes: Int): Pair<String, NivelSync> = when {
    hayError -> "Hubo un problema al sincronizar" to NivelSync.ERROR
    cambiosPendientes > 0 -> "$cambiosPendientes cambio${if (cambiosPendientes == 1) "" else "s"} por subir" to NivelSync.PENDIENTE
    else -> "Todo bien" to NivelSync.BIEN
}

/** Texto que acompaña al estado de sincronización. */
fun detalleSync(hayError: Boolean, cambiosPendientes: Int): String = when {
    hayError -> "Puedes reintentar ahora. Lo que ya ves en pantalla permanece en este dispositivo."
    cambiosPendientes > 0 -> "Tus cambios locales siguen disponibles y se subirán automáticamente."
    else -> "Tus datos locales y los de tu cuenta están al día."
}
