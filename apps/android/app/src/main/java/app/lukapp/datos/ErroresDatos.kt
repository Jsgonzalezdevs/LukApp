package app.lukapp.datos

/** Falló la red: el cambio queda en la cola y se reintenta; no es culpa del usuario. */
class SinConexion(mensaje: String) : Exception(mensaje)

/** Un error que se le puede mostrar tal cual a la persona. */
class ErrorLukApp(mensaje: String) : Exception(mensaje)

/**
 * Traducción de `RepositorioSupabase.fallar` (repositorioSupabase.ts:51-117):
 * los nombres de restricciones son vocabulario del esquema, no del usuario.
 */
internal fun traducirError(contexto: String, error: Throwable): Exception {
    val m = error.message.orEmpty()
    val i = { patron: String -> Regex(patron, RegexOption.IGNORE_CASE).containsMatchIn(m) }
    return when {
        error is java.io.IOException || i("failed to fetch|network|load failed|unable to resolve host|timeout") -> SinConexion(m)
        "amount_cop_check" in m -> ErrorLukApp("El monto debe ser mayor que cero.")
        "objetivo_cop_check" in m -> ErrorLukApp("El objetivo de la meta debe ser mayor que cero.")
        "transacciones_kind_check" in m -> ErrorLukApp(
            "La base de datos todavía no admite transferencias en el historial. Aplica la migración 20260830183300_permitir_transferencias_en_historial.sql y vuelve a intentar.",
        )
        "_kind_check" in m || "_rol_check" in m -> ErrorLukApp("Ese valor no es uno de los permitidos.")
        "violates row-level security" in m -> ErrorLukApp("Tu sesión no tiene permiso para este cambio. Vuelve a entrar.")
        i("issued at future|not yet valid") -> ErrorLukApp(
            "La hora del servidor no coincide con la de tu sesión. Espera unos segundos e inténtalo de nuevo.",
        )
        i("jwt expired|token is expired") -> ErrorLukApp("Tu sesión venció. Vuelve a entrar.")
        i("jwt|jws") -> ErrorLukApp("Tu sesión ya no es válida. Vuelve a entrar.")
        "duplicate key" in m -> ErrorLukApp("Ese registro ya existe.")
        i("cuotas_total|cuota_cop") -> ErrorLukApp(
            "Falta actualizar Supabase para guardar comprobantes a cuotas. Ejecuta la migración supabase/migrations/20260830190000_cuotas_tarjetas.sql y vuelve a intentar.",
        )
        "schema cache" in m || i("relation .* does not exist|column .* does not exist") -> ErrorLukApp(
            "La base de datos de LukApp está incompleta o desactualizada. Ejecuta, en orden, las migraciones de la carpeta supabase/migrations/ en el SQL Editor de Supabase y vuelve a cargar la app.",
        )
        else -> ErrorLukApp("$contexto: $m")
    }
}
