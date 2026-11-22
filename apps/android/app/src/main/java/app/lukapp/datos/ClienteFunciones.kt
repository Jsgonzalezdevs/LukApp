package app.lukapp.datos

import app.lukapp.dominio.FuncionSolicitada
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Funciones solicitadas: lee y escribe directo en `funciones_solicitadas` y `funciones_solicitadas_votos`, igual que
 * la web (las políticas de la base deciden qué puede cada quien). Aquí nunca se suma: el conteo es del trigger.
 */
class ClienteFunciones(private val supabase: SupabaseClient) {
    private val columnas = Columns.list("id", "titulo", "descripcion", "votos")

    private fun usuario(): String = supabase.auth.currentUserOrNull()?.id ?: throw ErrorLukApp("Sesión no disponible")

    /** Las ideas, de más a menos votadas (y a igual voto, la más reciente), y las que ya votaste. */
    suspend fun listar(): Pair<List<FuncionSolicitada>, Set<String>> = try {
        val funciones = supabase.from("funciones_solicitadas").select(columnas) {
            order("votos", Order.DESCENDING)
            order("creada_en", Order.DESCENDING)
        }.decodeList<FuncionSolicitada>()
        val votos = supabase.from("funciones_solicitadas_votos").select(Columns.list("funcion_id")).decodeList<JsonObject>()
            .mapNotNull { (it["funcion_id"] as? JsonPrimitive)?.takeIf { p -> p.isString }?.content }.toSet()
        funciones to votos
    } catch (e: Exception) { throw traducirError("No se pudieron cargar las funciones solicitadas", e) }

    suspend fun votar(id: String, yaVotado: Boolean) {
        val uid = usuario()
        try {
            if (yaVotado) supabase.from("funciones_solicitadas_votos").delete { filter { eq("funcion_id", id); eq("user_id", uid) } }
            else supabase.from("funciones_solicitadas_votos").insert(buildJsonObject { put("funcion_id", JsonPrimitive(id)); put("user_id", JsonPrimitive(uid)) })
        } catch (e: Exception) { throw traducirError("No se pudo registrar el voto", e) }
    }

    suspend fun proponer(titulo: String, descripcion: String): FuncionSolicitada {
        val uid = usuario()
        return try {
            supabase.from("funciones_solicitadas").insert(buildJsonObject {
                put("titulo", JsonPrimitive(titulo.trim()))
                put("descripcion", descripcion.trim().ifEmpty { null }?.let { JsonPrimitive(it) } ?: JsonNull)
                put("creada_por", JsonPrimitive(uid))
            }) { select(columnas) }.decodeSingle<FuncionSolicitada>()
        } catch (e: Exception) { throw traducirError("No se pudo enviar la idea", e) }
    }
}
