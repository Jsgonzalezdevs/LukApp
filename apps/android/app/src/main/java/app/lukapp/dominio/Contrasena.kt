package app.lukapp.dominio

import java.util.Locale

/** Origen: `src/lib/seguridad.ts` (`LARGO_MINIMO_CONTRASENA`). */
const val LARGO_MINIMO_CONTRASENA = 6

// Igual que la web: «especial» es todo lo que no sea letra ASCII, dígito ni espacio,
// así que una tilde (í, ñ) también cuenta como carácter especial.
private val ESPECIAL = Regex("[^A-Za-z0-9\\t\\n\\u000B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]")
private val MAYUSCULA = Regex("[A-Z]")
private val MINUSCULA = Regex("[a-z]")
private val ES_CO = Locale.forLanguageTag("es-CO")

private fun normalizarClave(valor: String) = valor.trim().lowercase(ES_CO)

/** Origen: `src/lib/seguridad.ts` (`RequisitoContrasena`). `id`: largo, mayuscula, minuscula, especial. */
class RequisitoContrasena(val id: String, val texto: String, val error: String, val cumple: (String) -> Boolean)

/**
 * Origen: `src/lib/seguridad.ts` (`REQUISITOS_CONTRASENA`). Una sola lista alimenta la
 * validación y el checklist visual, para que nunca digan cosas distintas.
 */
val REQUISITOS_CONTRASENA: List<RequisitoContrasena> = listOf(
    RequisitoContrasena(
        "largo",
        "Mínimo $LARGO_MINIMO_CONTRASENA caracteres",
        "La contraseña debe tener al menos $LARGO_MINIMO_CONTRASENA caracteres.",
    ) { it.length >= LARGO_MINIMO_CONTRASENA },
    RequisitoContrasena("mayuscula", "Una mayúscula", "La contraseña debe incluir una letra mayúscula.") { MAYUSCULA.containsMatchIn(it) },
    RequisitoContrasena("minuscula", "Una minúscula", "La contraseña debe incluir una letra minúscula.") { MINUSCULA.containsMatchIn(it) },
    RequisitoContrasena("especial", "Un carácter especial (!@#$…)", "La contraseña debe incluir un carácter especial.") { ESPECIAL.containsMatchIn(it) },
)

/** Origen: `src/lib/seguridad.ts` (`evaluarRequisitosContrasena`). Fila del checklist. */
data class RequisitoEvaluado(val id: String, val texto: String, val cumple: Boolean)

/** Origen: `src/lib/seguridad.ts` (`evaluarRequisitosContrasena`). */
fun evaluarRequisitosContrasena(contrasena: String): List<RequisitoEvaluado> =
    REQUISITOS_CONTRASENA.map { RequisitoEvaluado(it.id, it.texto, it.cumple(contrasena)) }

/** Origen: `src/lib/seguridad.ts` (`coincideConIdentificador`). Sin distinguir mayúsculas ni espacios de los bordes. */
fun coincideConIdentificador(contrasena: String, identificadores: List<String?> = emptyList()): Boolean {
    val clave = normalizarClave(contrasena)
    return identificadores.filterNotNull().map(::normalizarClave).filter { it.isNotEmpty() }.any { it == clave }
}

/** Origen: `src/lib/seguridad.ts` (`validarContrasenaSegura`). Primer error pendiente, o null si sirve. */
fun validarContrasenaSegura(contrasena: String, identificadores: List<String?> = emptyList()): String? {
    REQUISITOS_CONTRASENA.firstOrNull { !it.cumple(contrasena) }?.let { return it.error }
    if (coincideConIdentificador(contrasena, identificadores)) {
        return "La contraseña no puede ser igual al nombre de usuario ni al correo."
    }
    return null
}

// ── components/loginValidation.ts y src/lib/authHelpers.ts ──

/** Origen: `components/loginValidation.ts` (`ValidationResult`). */
data class ResultadoValidacion(val valido: Boolean, val error: String? = null)

/** Origen: `components/loginValidation.ts`. */
const val MINIMO_PASSWORD = LARGO_MINIMO_CONTRASENA

/** Origen: `components/loginValidation.ts`. */
const val APODO_MINIMO = 3

/** Origen: `components/loginValidation.ts`. */
const val APODO_MAXIMO = 30

/** Origen: `components/loginValidation.ts`. */
const val INTENTOS_MAX_LOGIN = 5

/** Origen: `components/loginValidation.ts`. */
const val LOCKOUT_MINUTOS = 15

private val CORREO = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
private val APODO_VALIDO = Regex("^[a-zA-Z0-9_-]+$")

/** Origen: `src/lib/authHelpers.ts` (`normalizeEmail`). */
fun normalizeEmail(email: String?): String = (email?.trim() ?: "").lowercase(Locale.ROOT)

/** Origen: `src/lib/authHelpers.ts` (`isValidEmail`). */
fun isValidEmail(email: String?): Boolean {
    if (email.isNullOrEmpty()) return false
    return CORREO.matches(normalizeEmail(email))
}

/** Origen: `components/loginValidation.ts` (`validateEmail`). */
fun validateEmail(email: String?): ResultadoValidacion {
    val normal = normalizeEmail(email)
    if (normal.isEmpty()) return ResultadoValidacion(false, "Email requerido")
    if (!isValidEmail(normal)) return ResultadoValidacion(false, "Email inválido. Ejemplo: usuario@ejemplo.com")
    return ResultadoValidacion(true)
}

/** Origen: `components/loginValidation.ts` (`validatePassword`). */
fun validatePassword(password: String?): ResultadoValidacion {
    if (password.isNullOrEmpty()) return ResultadoValidacion(false, "Contraseña requerida")
    validarContrasenaSegura(password)?.let { return ResultadoValidacion(false, it) }
    if (password.length > 128) return ResultadoValidacion(false, "Contraseña muy larga")
    return ResultadoValidacion(true)
}

/** Origen: `components/loginValidation.ts` (`validateUsername`). */
fun validateUsername(username: String?): ResultadoValidacion {
    if (username.isNullOrEmpty()) return ResultadoValidacion(false, "Nombre de usuario requerido")
    val recortado = username.trim()
    if (recortado.length < APODO_MINIMO) return ResultadoValidacion(false, "Mínimo $APODO_MINIMO caracteres")
    if (recortado.length > APODO_MAXIMO) return ResultadoValidacion(false, "Máximo $APODO_MAXIMO caracteres")
    if (!APODO_VALIDO.matches(recortado)) return ResultadoValidacion(false, "Solo letras, números, _ y - permitidos")
    return ResultadoValidacion(true)
}

/** Origen: `components/loginValidation.ts` (`validateLoginForm`). */
fun validateLoginForm(email: String, password: String): ResultadoValidacion {
    validateEmail(email).takeIf { !it.valido }?.let { return it }
    validatePassword(password).takeIf { !it.valido }?.let { return it }
    return ResultadoValidacion(true)
}

/** Origen: `components/loginValidation.ts` (`validateSignupForm`). */
fun validateSignupForm(email: String, password: String, username: String): ResultadoValidacion {
    validateEmail(email).takeIf { !it.valido }?.let { return it }
    validatePassword(password).takeIf { !it.valido }?.let { return it }
    validateUsername(username).takeIf { !it.valido }?.let { return it }
    return ResultadoValidacion(true)
}

/** Origen: `components/loginValidation.ts` (`isLockedOut`). `ahora` en ms, inyectable para tests. */
fun isLockedOut(intentos: List<Long>, ahora: Long = System.currentTimeMillis()): Boolean {
    if (intentos.size < INTENTOS_MAX_LOGIN) return false
    return intentos.count { ahora - it < LOCKOUT_MINUTOS * 60 * 1000L } >= INTENTOS_MAX_LOGIN
}

/** Origen: `components/loginValidation.ts` (`getLockoutRemainingMinutes`). */
fun getLockoutRemainingMinutes(intentos: List<Long>, ahora: Long = System.currentTimeMillis()): Int {
    if (intentos.isEmpty()) return 0
    val transcurrido = ahora - intentos.min()
    val bloqueo = LOCKOUT_MINUTOS * 60 * 1000L
    if (transcurrido >= bloqueo) return 0
    return Math.ceil((bloqueo - transcurrido) / 60.0 / 1000.0).toInt()
}
