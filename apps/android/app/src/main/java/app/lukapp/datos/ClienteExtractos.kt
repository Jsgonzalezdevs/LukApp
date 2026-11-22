package app.lukapp.datos

import android.util.Base64
import app.lukapp.BuildConfig
import app.lukapp.dominio.RespuestaExtracto
import app.lukapp.dominio.leerRespuestaExtracto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.ktor.client.HttpClient
import io.ktor.client.plugins.timeout
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

/**
 * `POST /api/analizar-extracto` con `{pdfBase64, contrasena?}` y la sesión como `Bearer`: el mismo contrato que
 * `useAnalista.ts`. El servidor lee el PDF, descuenta del plan y contesta una sola vez; la contraseña viaja solo en
 * esa petición y no se guarda en ningún lado.
 */
class ClienteExtractos(private val supabase: SupabaseClient, private val http: HttpClient) {
    suspend fun analizar(pdf: ByteArray, contrasena: String? = null): RespuestaExtracto = try {
        val token = supabase.auth.currentAccessTokenOrNull()
        val r = http.post("${BuildConfig.API_URL}/api/analizar-extracto") {
            contentType(ContentType.Application.Json)
            if (token != null) header("Authorization", "Bearer $token")
            setBody(buildJsonObject {
                put("pdfBase64", JsonPrimitive(Base64.encodeToString(pdf, Base64.NO_WRAP)))
                if (!contrasena.isNullOrEmpty()) put("contrasena", JsonPrimitive(contrasena))
            }.toString())
            timeout { requestTimeoutMillis = 120_000 }
        }
        // Un 404 no es «no hay tal extracto»: es que no se llegó al servidor del analista.
        if (r.status.value == 404) RespuestaExtracto.Error("fallo-interno", "No se encontró el servidor del analista. Inténtalo de nuevo en un momento.")
        else leerRespuestaExtracto(r.bodyAsText())
    } catch (e: CancellationException) { throw e } catch (e: Exception) {
        // Solo el tipo y el mensaje: nunca el cuerpo, que lleva el PDF y la contraseña.
        android.util.Log.w("Extractos", "Falló la petición: ${e::class.java.simpleName}: ${e.message?.take(200)}")
        RespuestaExtracto.Error("fallo-interno", "No se pudo contactar al servidor.")
    }
}
