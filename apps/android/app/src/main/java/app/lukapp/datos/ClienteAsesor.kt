package app.lukapp.datos

import app.lukapp.BuildConfig
import app.lukapp.dominio.limpiarTextoChat
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.ktor.client.HttpClient
import io.ktor.client.plugins.timeout
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put

/** Un turno que se manda como historial: `role` es «user» o «bot», como en la web. */
data class TurnoChat(val id: String, val rol: String, val texto: String)

/**
 * Los mismos contratos que AsesorView.tsx: `GET /api/asesor-ia/disponibilidad` y
 * `POST /api/asesor-ia` con `{prompt, history(5), memoriaUsuario, idConsulta}`, 60 s.
 * Con sesión, el servidor relee el perfil financiero por su cuenta, así que no se
 * manda `finanzasContext`. Los textos de error son los de la web.
 */
class ClienteAsesor(private val supabase: SupabaseClient, private val http: HttpClient) {

    sealed interface Respuesta {
        data class Texto(val texto: String, val proveedor: String?) : Respuesta
        data class Error(val mensaje: String) : Respuesta
    }

    /** true solo si el servidor confirma que hay un proveedor de IA; cualquier otra cosa es «local». */
    suspend fun disponible(): Boolean = try {
        val token = supabase.auth.currentAccessTokenOrNull()
        val r = http.get("${BuildConfig.API_URL}/api/asesor-ia/disponibilidad") {
            if (token != null) header("Authorization", "Bearer $token")
            timeout { requestTimeoutMillis = 60_000 }
        }
        r.status.value in 200..299 && objeto(r.bodyAsText())?.get("ia")?.let { (it as? JsonPrimitive)?.booleanOrNull } == true
    } catch (e: CancellationException) { throw e } catch (_: Exception) { false }

    suspend fun consultar(prompt: String, historial: List<TurnoChat>, idConsulta: String): Respuesta {
        val token = supabase.auth.currentAccessTokenOrNull()
        return try {
            val cuerpo = buildJsonObject {
                put("prompt", prompt)
                put("history", buildJsonArray {
                    historial.takeLast(5).forEach { add(buildJsonObject { put("id", it.id); put("role", it.rol); put("text", it.texto) }) }
                })
                put("memoriaUsuario", buildJsonArray { })
                put("idConsulta", idConsulta)
            }
            val r = http.post("${BuildConfig.API_URL}/api/asesor-ia") {
                contentType(ContentType.Application.Json)
                if (token != null) header("Authorization", "Bearer $token")
                setBody(cuerpo.toString())
                timeout { requestTimeoutMillis = 60_000 }
            }
            val datos = objeto(r.bodyAsText())
            val codigo = r.status.value
            if (codigo in 200..299) {
                val offline = (datos?.get("offline") as? JsonPrimitive)?.booleanOrNull == true
                val texto = (datos?.get("text") as? JsonPrimitive)?.contentOrNull?.let(::limpiarTextoChat)
                if (offline || texto.isNullOrEmpty()) Respuesta.Error("No encontramos ningún proveedor de IA disponible.")
                else Respuesta.Texto(texto, (datos?.get("provider") as? JsonPrimitive)?.contentOrNull)
            } else {
                val api = (datos?.get("error") as? JsonPrimitive)?.contentOrNull
                Respuesta.Error(
                    when {
                        codigo == 401 -> "Tu sesión venció. Entra de nuevo para consultar la IA."
                        codigo == 403 -> api ?: "Tu plan actual no incluye esta función de IA."
                        codigo == 429 -> api ?: "Alcanzaste el límite de solicitudes. Intenta de nuevo en un momento."
                        codigo >= 500 -> api ?: "La IA no pudo preparar tu consulta. Intenta de nuevo en unos minutos."
                        else -> api ?: "La IA respondió con un error ($codigo)."
                    },
                )
            }
        } catch (e: CancellationException) { throw e } catch (e: io.ktor.client.plugins.HttpRequestTimeoutException) {
            Respuesta.Error("La IA tardó demasiado en responder. Puedes reintentarlo.")
        } catch (_: Exception) {
            Respuesta.Error("No pudimos conectar con la IA.")
        }
    }

    private fun objeto(texto: String): JsonObject? = runCatching { Json.parseToJsonElement(texto).jsonObject }.getOrNull()
}
