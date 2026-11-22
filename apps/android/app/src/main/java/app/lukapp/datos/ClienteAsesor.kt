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

    /**
     * `POST /api/asesor-ia/respaldo-local`: cuando la IA falla y contesta el motor local, se le cuenta al servidor qué
     * recibió la persona para que el historial de Superadmin explique el fallo. Comparte `idConsulta` con la petición
     * principal (así la telemetría es idempotente). Mejor esfuerzo: si falla, no pasa nada.
     */
    suspend fun respaldoLocal(idConsulta: String, prompt: String, respuestaTexto: String, motivo: String) {
        try {
            val token = supabase.auth.currentAccessTokenOrNull()
            http.post("${BuildConfig.API_URL}/api/asesor-ia/respaldo-local") {
                contentType(ContentType.Application.Json)
                if (token != null) header("Authorization", "Bearer $token")
                setBody(buildJsonObject {
                    put("idConsulta", JsonPrimitive(idConsulta)); put("prompt", JsonPrimitive(prompt))
                    put("respuestaTexto", JsonPrimitive(respuestaTexto)); put("motivo", JsonPrimitive(motivo))
                }.toString())
            }
        } catch (e: CancellationException) { throw e } catch (_: Exception) { }
    }

    /** Lo que incluye el plan, como `prestaciones` de `useAiInsights`. Todo false si no se pudo comprobar. */
    data class Prestaciones(val asesorIa: Boolean = false, val insightsIa: Boolean = false, val pulsoPremium: Boolean = false, val esPremium: Boolean = false)

    /** `GET /api/mi-plan`. Sin sesión, sin red o con cualquier fallo no se arriesga una llamada a IA ni se muestra una marca sin comprobar. */
    suspend fun prestaciones(): Prestaciones = try {
        val token = supabase.auth.currentAccessTokenOrNull()
        if (token == null) Prestaciones() else {
            val r = http.get("${BuildConfig.API_URL}/api/mi-plan") { header("Authorization", "Bearer $token") }
            val plan = objeto(r.bodyAsText())
            val ok = r.status.value in 200..299
            val beneficios = plan?.get("beneficios") as? kotlinx.serialization.json.JsonArray
            fun tiene(clave: String) = ok && beneficios?.any { b ->
                val o = b as? JsonObject
                (o?.get("clave") as? JsonPrimitive)?.contentOrNull == clave && (o["activo"] as? JsonPrimitive)?.booleanOrNull == true
            } == true
            Prestaciones(tiene("asesor_ia"), tiene("insights_ia"), tiene("pulso_premium"), ok && (plan?.get("codigo") as? JsonPrimitive)?.contentOrNull == "premium")
        }
    } catch (e: CancellationException) { throw e } catch (_: Exception) { Prestaciones() }

    /**
     * `POST /api/finanzas-insights-ia` con cuerpo vacío: el servidor arma el perfil desde la cuenta autenticada,
     * así el cliente no manda cifras. null = falló o no hay insights (se queda con los locales).
     */
    suspend fun insightsIa(): List<app.lukapp.dominio.Insight>? = try {
        val token = supabase.auth.currentAccessTokenOrNull()
        val r = http.post("${BuildConfig.API_URL}/api/finanzas-insights-ia") {
            contentType(ContentType.Application.Json)
            if (token != null) header("Authorization", "Bearer $token")
            setBody("{}")
            timeout { requestTimeoutMillis = 60_000 }
        }
        val o = objeto(r.bodyAsText())
        val lista = (o?.get("insights") as? kotlinx.serialization.json.JsonArray)?.mapNotNull { e ->
            val i = e as? JsonObject ?: return@mapNotNull null
            fun t(k: String) = (i[k] as? JsonPrimitive)?.contentOrNull
            val id = t("id"); val titulo = t("titulo"); val detalle = t("detalle")
            if (id == null || titulo == null || detalle == null) null
            // El servidor devuelve el contenido; «IA» lo marca este lado, que es quien comprobó el plan.
            else app.lukapp.dominio.Insight(id, titulo, detalle, t("tono")?.takeIf { it in setOf("neutral", "bien", "atento") } ?: "neutral", t("seccion")?.takeIf { it == "mes" || it == "dinero" }, true)
        }
        if (r.status.value in 200..299 && (o?.get("success") as? JsonPrimitive)?.booleanOrNull == true && !lista.isNullOrEmpty()) lista else null
    } catch (e: CancellationException) { throw e } catch (_: Exception) { null }

    suspend fun consultar(prompt: String, historial: List<TurnoChat>, idConsulta: String, memoria: List<String> = emptyList()): Respuesta {
        val token = supabase.auth.currentAccessTokenOrNull()
        return try {
            val cuerpo = buildJsonObject {
                put("prompt", prompt)
                put("history", buildJsonArray {
                    historial.takeLast(5).forEach { add(buildJsonObject { put("id", it.id); put("role", it.rol); put("text", it.texto) }) }
                })
                put("memoriaUsuario", buildJsonArray { memoria.forEach { add(JsonPrimitive(it)) } })
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

    data class Conversacion(val id: String, val titulo: String, val recordar: Boolean, val actualizadoEn: String)
    data class Mensaje(val id: String, val rol: String, val texto: String, val proveedor: String?)
    data class DatoMemoria(val clave: String, val valor: String)

    private suspend fun leer(ruta: String): JsonObject? = try {
        val token = supabase.auth.currentAccessTokenOrNull()
        val r = http.get("${BuildConfig.API_URL}$ruta") { if (token != null) header("Authorization", "Bearer $token") }
        if (r.status.value in 200..299) objeto(r.bodyAsText()) else null
    } catch (e: CancellationException) { throw e } catch (_: Exception) { null }

    private fun JsonObject.texto(k: String) = (get(k) as? JsonPrimitive)?.contentOrNull

    /** Las 30 más recientes, como `GET /api/asesor/conversaciones`; null si no se pudo leer. */
    suspend fun conversaciones(): List<Conversacion>? = (leer("/api/asesor/conversaciones")?.get("conversaciones") as? kotlinx.serialization.json.JsonArray)?.mapNotNull {
        val o = it as? JsonObject ?: return@mapNotNull null
        Conversacion(o.texto("id") ?: return@mapNotNull null, o.texto("titulo").orEmpty(), (o["recordar"] as? JsonPrimitive)?.booleanOrNull != false, o.texto("actualizado_en").orEmpty())
    }

    suspend fun memoria(): List<DatoMemoria>? = (leer("/api/asesor/memoria")?.get("memoria") as? kotlinx.serialization.json.JsonArray)?.mapNotNull {
        val o = it as? JsonObject ?: return@mapNotNull null
        DatoMemoria(o.texto("clave") ?: return@mapNotNull null, o.texto("valor").orEmpty())
    }

    suspend fun mensajes(conversacionId: String): List<Mensaje>? = (leer("/api/asesor/conversaciones/$conversacionId/mensajes")?.get("mensajes") as? kotlinx.serialization.json.JsonArray)?.mapNotNull {
        val o = it as? JsonObject ?: return@mapNotNull null
        Mensaje(o.texto("id") ?: return@mapNotNull null, o.texto("rol").orEmpty(), o.texto("texto").orEmpty(), o.texto("proveedor"))
    }

    private suspend fun escribir(ruta: String, cuerpo: JsonObject): JsonObject? = try {
        val token = supabase.auth.currentAccessTokenOrNull()
        val r = http.post("${BuildConfig.API_URL}$ruta") {
            contentType(ContentType.Application.Json)
            if (token != null) header("Authorization", "Bearer $token")
            setBody(cuerpo.toString())
        }
        if (r.status.value in 200..299) objeto(r.bodyAsText()) ?: JsonObject(emptyMap()) else null
    } catch (e: CancellationException) { throw e } catch (_: Exception) { null }

    suspend fun crearConversacion(titulo: String): Conversacion? {
        val o = escribir("/api/asesor/conversaciones", buildJsonObject { put("titulo", titulo) })?.get("conversacion") as? JsonObject ?: return null
        return Conversacion(o.texto("id") ?: return null, o.texto("titulo").orEmpty(), (o["recordar"] as? JsonPrimitive)?.booleanOrNull != false, o.texto("actualizado_en") ?: java.time.Instant.now().toString())
    }

    suspend fun guardarMensaje(conversacionId: String, esAsistente: Boolean, texto: String, proveedor: String?): Boolean =
        escribir("/api/asesor/mensajes", buildJsonObject {
            put("conversacionId", conversacionId); put("rol", if (esAsistente) "assistant" else "user"); put("texto", texto)
            if (proveedor != null) put("proveedor", proveedor)
        }) != null

    private fun objeto(texto: String): JsonObject? = runCatching { Json.parseToJsonElement(texto).jsonObject }.getOrNull()
}
