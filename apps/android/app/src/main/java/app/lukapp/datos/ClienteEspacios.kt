package app.lukapp.datos

import app.lukapp.dominio.EspacioCompartido
import app.lukapp.dominio.FilaEspacio
import app.lukapp.dominio.FilaGasto
import app.lukapp.dominio.FilaIntegrante
import app.lukapp.dominio.YO
import app.lukapp.dominio.armarEspacios
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Espacios compartidos reales (migración 0020): lee y escribe en las mismas tablas y funciones que la web
 * (`useEspaciosCompartidos.ts`). Quién puede ver o tocar qué lo deciden las políticas de la base, no esta clase.
 */
class ClienteEspacios(private val supabase: SupabaseClient) {
    private fun usuario(): String = supabase.auth.currentUserOrNull()?.id ?: throw ErrorLukApp("Sesión no disponible")

    suspend fun cargar(): List<EspacioCompartido> {
        val uid = usuario()
        return try {
            val ids = supabase.from("espacios_integrantes").select(Columns.list("espacio_id")) { filter { eq("user_id", uid) } }
                .decodeList<JsonObject>().mapNotNull { (it["espacio_id"] as? JsonPrimitive)?.content }.distinct()
            if (ids.isEmpty()) return emptyList()
            val espacios = supabase.from("espacios_compartidos").select(Columns.list("id", "nombre", "icono", "color", "created_at")) { filter { isIn("id", ids) } }.decodeList<FilaEspacio>()
            val miembros = supabase.from("espacios_integrantes").select(Columns.list("espacio_id", "user_id", "nombre", "emoji")) { filter { isIn("espacio_id", ids) } }.decodeList<FilaIntegrante>()
            val gastos = supabase.from("gastos_compartidos").select(Columns.list("id", "espacio_id", "descripcion", "monto_cop", "fecha", "pagado_por", "categoria")) {
                filter { isIn("espacio_id", ids) }
                order("created_at", Order.DESCENDING)
            }.decodeList<FilaGasto>()
            armarEspacios(uid, espacios, miembros, gastos)
        } catch (e: Exception) { throw traducirError("No se pudieron cargar tus espacios compartidos", e) }
    }

    /** Devuelve el id del espacio nuevo. */
    suspend fun crearEspacio(nombre: String, icono: String): String = try {
        supabase.postgrest.rpc("crear_espacio_compartido", buildJsonObject {
            put("nombre_espacio", JsonPrimitive(nombre.trim())); put("icono_espacio", JsonPrimitive(icono)); put("color_espacio", JsonPrimitive("#8b5cf6"))
        }).data.let { Regex("[0-9a-fA-F-]{36}").find(it)?.value ?: throw ErrorLukApp("No se pudo crear el espacio compartido.") }
    } catch (e: ErrorLukApp) { throw e } catch (e: Exception) { throw traducirError("No se pudo crear el espacio compartido", e) }

    suspend fun agregarGasto(espacioId: String, descripcion: String, montoCop: Long, pagadoPorId: String) {
        val uid = usuario()
        try {
            supabase.from("gastos_compartidos").insert(buildJsonObject {
                put("espacio_id", JsonPrimitive(espacioId)); put("creado_por", JsonPrimitive(uid))
                put("pagado_por", JsonPrimitive(if (pagadoPorId == YO) uid else pagadoPorId))
                put("descripcion", JsonPrimitive(descripcion)); put("monto_cop", JsonPrimitive(montoCop)); put("categoria", JsonPrimitive("otros"))
            })
        } catch (e: Exception) { throw traducirError("No se pudo guardar el gasto compartido", e) }
    }

    suspend fun borrarGasto(id: String) {
        try { supabase.from("gastos_compartidos").delete { filter { eq("id", id) } } } catch (e: Exception) { throw traducirError("No se pudo borrar el gasto", e) }
    }

    /** «Saldar a $0»: la web borra todos los gastos del espacio, para los dos. */
    suspend fun saldar(espacioId: String) {
        try { supabase.from("gastos_compartidos").delete { filter { eq("espacio_id", espacioId) } } } catch (e: Exception) { throw traducirError("No se pudieron saldar las cuentas", e) }
    }

    /** El token de una invitación nueva; la anterior pendiente queda cancelada (lo hace la función de la base). */
    suspend fun crearInvitacion(espacioId: String): String = try {
        supabase.postgrest.rpc("crear_invitacion_compartida", buildJsonObject { put("espacio", JsonPrimitive(espacioId)) }).data
            .let { Regex("[0-9a-fA-F]{8}-[0-9a-fA-F-]{27}").find(it)?.value ?: throw ErrorLukApp("No se pudo crear la invitación.") }
    } catch (e: ErrorLukApp) { throw e } catch (e: Exception) { throw traducirError("No se pudo crear la invitación", e) }

    suspend fun aceptarInvitacion(token: String) {
        try {
            supabase.postgrest.rpc("aceptar_invitacion_compartida", buildJsonObject {
                put("token_invitacion", JsonPrimitive(token)); put("nombre_integrante", JsonPrimitive("Pareja")); put("emoji_integrante", JsonPrimitive("🙂"))
            })
        } catch (e: Exception) { throw traducirError("No se pudo aceptar la invitación", e) }
    }
}
