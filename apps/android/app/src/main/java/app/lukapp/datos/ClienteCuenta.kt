package app.lukapp.datos

import app.lukapp.BuildConfig
import app.lukapp.dominio.EstadoPlan
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.statement.bodyAsText
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull

/** Lo que la pantalla Cuenta pide al servidor: el apodo, el plan y la eliminación de la cuenta. */
class ClienteCuenta(private val supabase: SupabaseClient, private val http: HttpClient) {
    private fun objeto(texto: String): JsonObject? = runCatching { Json.parseToJsonElement(texto) as? JsonObject }.getOrNull()
    private fun token(): String = supabase.auth.currentAccessTokenOrNull() ?: throw ErrorLukApp("Sesión no disponible")

    /** `perfiles.usuario`. null si no hay o no se pudo leer: la pantalla cae al correo. */
    suspend fun apodo(userId: String): String? = try {
        supabase.from("perfiles").select(Columns.list("usuario")) { filter { eq("id", userId) } }
            .decodeList<JsonObject>().firstOrNull()?.get("usuario")?.let { (it as? JsonPrimitive)?.contentOrNull }
    } catch (e: CancellationException) { throw e } catch (_: Exception) { null }

    /** `GET /api/mi-plan`. Lanza con el mensaje del servidor para poder enseñarlo y reintentar. */
    suspend fun plan(): EstadoPlan {
        val r = try { http.get("${BuildConfig.API_URL}/api/mi-plan") { header("Authorization", "Bearer ${token()}") } }
        catch (e: CancellationException) { throw e } catch (e: ErrorLukApp) { throw e } catch (e: Exception) { throw traducirError("No se pudo consultar tu plan.", e) }
        val cuerpo = objeto(r.bodyAsText())
        if (r.status.value !in 200..299) throw ErrorLukApp((cuerpo?.get("error") as? JsonPrimitive)?.contentOrNull ?: "No se pudo consultar tu plan.")
        cuerpo ?: throw ErrorLukApp("No se pudo consultar tu plan.")
        fun activos(clave: String) = (cuerpo[clave] as? JsonArray).orEmpty().mapNotNull { it as? JsonObject }
            .filter { (it["activo"] as? JsonPrimitive)?.booleanOrNull == true }.mapNotNull { (it["titulo"] as? JsonPrimitive)?.contentOrNull }
        return EstadoPlan(
            codigo = (cuerpo["codigo"] as? JsonPrimitive)?.contentOrNull ?: "normal",
            nombre = (cuerpo["nombre"] as? JsonPrimitive)?.contentOrNull ?: "",
            venceEn = ((cuerpo["suscripcion"] as? JsonObject)?.get("venceEn") as? JsonPrimitive)?.contentOrNull,
            beneficios = activos("beneficios"), beneficiosPremium = activos("beneficiosPremium").size,
        )
    }

    /** `POST /api/mi-cuenta/eliminar`: borra la cuenta y todos sus datos. Devuelve el error, o null si se eliminó. */
    suspend fun eliminar(): String? = try {
        val r = http.post("${BuildConfig.API_URL}/api/mi-cuenta/eliminar") { header("Authorization", "Bearer ${token()}") }
        if (r.status.value in 200..299) null
        else (objeto(r.bodyAsText())?.get("error") as? JsonPrimitive)?.contentOrNull ?: "No se pudo eliminar la cuenta."
    } catch (e: CancellationException) { throw e } catch (e: ErrorLukApp) { e.message } catch (e: Exception) { traducirError("No se pudo eliminar la cuenta.", e).message }
}
