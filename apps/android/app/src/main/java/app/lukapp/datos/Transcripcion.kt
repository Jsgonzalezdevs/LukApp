package app.lukapp.datos

import app.lukapp.BuildConfig
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
import java.net.URLEncoder
import java.text.Normalizer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject

/**
 * El mismo contrato que `peticionTranscribir` (hooks/useAudioCapture.ts):
 * audio crudo `audio/mp4`, Bearer de Supabase, modo `final`, vocabulario del
 * usuario en `X-LukApp-Vocabulario`, 18 s de espera y un único reintento si
 * el servidor falla (5xx) o la red se cae; un 4xx no mejora reenviando.
 */
class Transcripcion(private val supabase: SupabaseClient, private val http: HttpClient) {

    sealed interface Resultado {
        data class Texto(val texto: String) : Resultado
        data class Error(val mensaje: String) : Resultado
    }

    suspend fun transcribir(audio: ByteArray, vocabulario: List<String>): Resultado {
        val datos = intentar(audio, vocabulario) ?: intentar(audio, vocabulario, reintento = true)
        if (datos == null || datos["offline"]?.let { (it as? JsonPrimitive)?.booleanOrNull } == true) {
            val motivo = (datos?.get("error") as? JsonPrimitive)?.contentOrNull
            return Resultado.Error(if (motivo != null) enPalabras(motivo) else "No se pudo conectar para transcribir el audio.")
        }
        val texto = (datos["text"] as? JsonPrimitive)?.contentOrNull?.trim()
        if (texto.isNullOrEmpty() || esAlucinacion(texto)) {
            return Resultado.Error("No se entendió la grabación. Habla cerca del micrófono e intenta otra vez.")
        }
        if ((datos["calidad"] as? JsonPrimitive)?.contentOrNull == "baja") {
            return Resultado.Error("El audio no quedó suficientemente claro. Acércate al micrófono e intenta otra vez.")
        }
        return Resultado.Texto(texto)
    }

    private var ultimoFueReintentable = true

    private suspend fun intentar(audio: ByteArray, vocabulario: List<String>, reintento: Boolean = false): JsonObject? {
        if (reintento && !ultimoFueReintentable) return null
        val token = supabase.auth.currentAccessTokenOrNull()
        val vocabularioCodificado = vocabulario.takeIf { it.isNotEmpty() }?.let { lista ->
            // encodeURIComponent(JSON.stringify(...)): URLEncoder usa "+" para el espacio; se corrige a %20.
            URLEncoder.encode(Json.encodeToString(kotlinx.serialization.json.JsonArray.serializer(), buildJsonArray { lista.take(30).forEach { add(JsonPrimitive(it)) } }), "UTF-8").replace("+", "%20")
        }
        return try {
            val respuesta = http.post("${BuildConfig.API_URL}/api/transcribir") {
                contentType(ContentType.parse("audio/mp4"))
                header("X-LukApp-Transcription-Mode", "final")
                if (vocabularioCodificado != null) header("X-LukApp-Vocabulario", vocabularioCodificado)
                if (token != null) header("Authorization", "Bearer $token")
                setBody(audio)
                timeout { requestTimeoutMillis = 18_000 }
            }
            val codigo = respuesta.status.value
            ultimoFueReintentable = codigo >= 500
            if (codigo !in 200..299) {
                // Solo sesión o cupo traen un motivo que se le pueda decir a la persona.
                return if (codigo == 401 || codigo == 429) runCatching { Json.parseToJsonElement(respuesta.bodyAsText()).jsonObject }.getOrNull() else null
            }
            runCatching { Json.parseToJsonElement(respuesta.bodyAsText()).jsonObject }.getOrNull().also { if (it == null) ultimoFueReintentable = true }
        } catch (_: Exception) {
            ultimoFueReintentable = true
            null
        }
    }

    private companion object {
        val ALUCINACIONES = setOf(
            "gracias", "gracias por ver el video", "gracias por ver", "gracias por su atencion", "suscribete al canal",
            "subtitulos realizados por la comunidad de amara org", "subtitulado por la comunidad de amara org",
            "amara org", "mas videos en", "hasta la proxima", "adios",
        )

        /** `desnudo` + `esAlucinacion` de useAudioCapture.ts: Whisper inventa estas frases con silencio. */
        fun esAlucinacion(texto: String): Boolean = ALUCINACIONES.contains(
            Normalizer.normalize(texto.lowercase(), Normalizer.Form.NFD)
                .replace(Regex("[\\u0300-\\u036f]"), "").replace(Regex("[^a-z0-9\\s]"), "").replace(Regex("\\s+"), " ").trim(),
        )

        /** `enPalabras`: el motivo técnico del servidor en algo que se pueda leer. */
        fun enPalabras(motivo: String): String = when {
            "llave" in motivo || "API_KEY" in motivo || "key" in motivo || "Falta" in motivo ->
                "Falta configurar la clave de transcripción (GROQ_API_KEY) en el servidor."
            "No llegó audio" in motivo || "No audio" in motivo -> "No se grabó nada. Mantén la app abierta mientras hablas."
            else -> "No se pudo transcribir. Escríbelo a mano."
        }
    }
}
