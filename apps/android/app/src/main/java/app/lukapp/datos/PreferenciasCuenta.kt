package app.lukapp.datos

import app.lukapp.dominio.ConfigPeriodo
import app.lukapp.dominio.PERIODO_POR_DEFECTO
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive

/** Ajustes de la cuenta que la web sincroniza en `user_metadata` (usePreferencias.ts). */
data class AjustesCuenta(
    val contarAhorros: Boolean = true,
    val efectivoSeparado: Boolean = false,
    val decisiones: Boolean = true,
    val proximosPagos: Boolean = true,
    val privacidad: Boolean = false,
    val periodo: ConfigPeriodo = PERIODO_POR_DEFECTO,
    val cuentaFavoritaId: String? = null,
    val alertasPresupuesto: Boolean = true,
    val umbralAlertaPct: Int = 80,
)

/**
 * Lee los ajustes desde `user_metadata` y escribe con `updateUser`, igual que
 * `sincronizarDesdeSupabase`/`guardarEnSupabase` de la web. Así un cambio en el
 * computador aparece en el teléfono y al revés. Los valores por defecto son los
 * mismos de `leerBooleano(clave, porDefecto)` en usePreferencias.ts.
 */
class PreferenciasCuenta(private val supabase: SupabaseClient) {
    private val _ajustes = MutableStateFlow(AjustesCuenta())
    val ajustes: StateFlow<AjustesCuenta> = _ajustes.asStateFlow()

    fun recargar() {
        val meta = supabase.auth.currentUserOrNull()?.userMetadata ?: JsonObject(emptyMap())
        fun bool(c: String, d: Boolean) = (meta[c] as? JsonPrimitive)?.booleanOrNull ?: d
        _ajustes.value = AjustesCuenta(
            contarAhorros = bool("finanzas:resumen:ahorro", true),
            efectivoSeparado = bool("finanzas:resumen:efectivo-separado", false),
            decisiones = bool("finanzas:resumen:decisiones", true),
            proximosPagos = bool("finanzas:inicio:proximos-pagos", true),
            privacidad = bool("finanzas:modo-privacidad", false),
            periodo = (meta["finanzas:periodo"] as? JsonObject)?.let(::periodoDe) ?: PERIODO_POR_DEFECTO,
            // La web guarda el id como texto, o un falso/vacío para "ninguna".
            alertasPresupuesto = bool("finanzas:presupuestos:alertas-activas", true),
            // `setUmbralAlertaPct` acota a 1..100 y guarda un entero.
            umbralAlertaPct = ((meta["finanzas:presupuestos:umbral-alerta"] as? JsonPrimitive)?.doubleOrNull ?: 80.0).let { Math.round(it).toInt().coerceIn(1, 100) },
            cuentaFavoritaId = (meta["finanzas:cuenta-favorita"] as? JsonPrimitive)?.takeIf { it.isString }?.content?.ifBlank { null },
        )
    }

    suspend fun privacidad(valor: Boolean) {
        _ajustes.update { it.copy(privacidad = valor) }
        guardar("finanzas:modo-privacidad", JsonPrimitive(valor))
    }

    /** `setCuentaFavorita`: marcar o desmarcar la cuenta principal (null se guarda como null, igual que la web). */
    suspend fun cuentaFavorita(id: String?) {
        _ajustes.update { it.copy(cuentaFavoritaId = id) }
        guardar("finanzas:cuenta-favorita", if (id == null) kotlinx.serialization.json.JsonNull else JsonPrimitive(id))
    }

    private suspend fun guardar(clave: String, valor: JsonElement) {
        // Igual que la web: si falla, el interruptor sigue funcionando en este teléfono.
        runCatching { supabase.auth.updateUser { data = buildJsonObject { put(clave, valor) } } }
    }

    /** `leerPeriodo` de usePreferencias.ts:669-699, con las mismas validaciones: un valor pisado vuelve al mensual. */
    private fun periodoDe(o: JsonObject): ConfigPeriodo? {
        val frecuencia = (o["frecuencia"] as? JsonPrimitive)?.takeIf { it.isString }?.content ?: return null
        if (frecuencia !in FRECUENCIAS_VALIDAS) return null
        val desfase = (o["desfaseDiasMensual"] as? JsonPrimitive)?.takeIf { !it.isString }?.doubleOrNull ?: return null
        if (!desfase.isFinite() || desfase < 0 || desfase > 27) return null
        val dias = (o["diasPersonalizados"] as? JsonPrimitive)?.takeIf { !it.isString }?.doubleOrNull
            ?.takeIf { it.isFinite() }?.let { Math.round(it).coerceIn(1, 90).toDouble() }
        val ancla = (o["fechaAnclaPersonalizada"] as? JsonPrimitive)?.takeIf { it.isString }?.content
            ?.takeIf { v -> runCatching { java.time.LocalDate.parse(v).toString() == v }.getOrDefault(false) }
            ?: if (frecuencia == "personalizado") app.lukapp.dominio.bogotaDate() else null
        return ConfigPeriodo(frecuencia, desfase.toInt(), dias, ancla)
    }

    private companion object {
        // FRECUENCIAS_VALIDAS de usePreferencias.ts:652.
        val FRECUENCIAS_VALIDAS = setOf("semanal", "quincenal", "quincenas-mes", "mensual", "personalizado", "todo-el-tiempo")
    }
}
