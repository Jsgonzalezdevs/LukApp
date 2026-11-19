package app.lukapp.datos

import app.lukapp.BuildConfig
import app.lukapp.dominio.ComprobanteCorreo
import app.lukapp.dominio.FilaComprobanteCorreo
import app.lukapp.dominio.ResultadoCorreo
import app.lukapp.dominio.aComprobantes
import app.lukapp.dominio.leerDestino
import app.lukapp.dominio.leerUrlAdjunto
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import io.ktor.client.HttpClient
import io.ktor.client.plugins.timeout
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.statement.bodyAsText
import kotlinx.coroutines.CancellationException

/** La bandeja de comprobantes por correo: dirección y descargas por la API; la lista, de `comprobantes_correo` (RLS). */
class ClienteCorreo(private val supabase: SupabaseClient, private val http: HttpClient) {
    private fun token(): String? = supabase.auth.currentAccessTokenOrNull()

    /** La dirección personal; el servidor la crea la primera vez. */
    suspend fun direccion(): ResultadoCorreo<String> {
        val t = token() ?: return ResultadoCorreo.Falla(SIN_SESION)
        return try {
            val r = http.get("${BuildConfig.API_URL}/api/comprobantes-correo/destino") { header("Authorization", "Bearer $t"); timeout { requestTimeoutMillis = 30_000 } }
            leerDestino(r.status.value, r.bodyAsText())
        } catch (e: CancellationException) { throw e } catch (e: Exception) { caida("destino", e) }
    }

    /** Los últimos 20, el mismo tope que la web. */
    suspend fun comprobantes(): ResultadoCorreo<List<ComprobanteCorreo>> = try {
        val filas = supabase.from("comprobantes_correo").select(Columns.list("id", "remitente", "asunto", "recibido_en", "adjuntos")) {
            order("recibido_en", Order.DESCENDING); limit(20)
        }.decodeList<FilaComprobanteCorreo>()
        ResultadoCorreo.Ok(aComprobantes(filas))
    } catch (e: CancellationException) { throw e } catch (e: Exception) { caida("lista", e) }

    /** La URL firmada de un adjunto, que vence pronto: se pide al tocar, nunca se guarda. */
    suspend fun urlAdjunto(comprobanteId: String, adjuntoId: String): ResultadoCorreo<String> {
        val t = token() ?: return ResultadoCorreo.Falla(SIN_SESION)
        return try {
            val r = http.get("${BuildConfig.API_URL}/api/comprobantes-correo/$comprobanteId/adjunto/$adjuntoId") { header("Authorization", "Bearer $t"); timeout { requestTimeoutMillis = 30_000 } }
            leerUrlAdjunto(r.status.value, r.bodyAsText())
        } catch (e: CancellationException) { throw e } catch (e: Exception) { caida("adjunto", e) }
    }

    // Solo el tipo de la excepción: ni la URL ni la sesión salen al registro.
    private fun caida(paso: String, e: Exception): ResultadoCorreo.Falla {
        android.util.Log.w("Correo", "Falló $paso: ${e::class.java.simpleName}")
        return ResultadoCorreo.Falla(
            if (e is java.io.IOException || Regex("resolve host|timeout|network", RegexOption.IGNORE_CASE).containsMatchIn(e.message.orEmpty()))"No se pudo contactar al servidor."
            else "No se pudo cargar la bandeja de correo.",
        )
    }

    private companion object { const val SIN_SESION = "Inicia sesión para activar tu dirección personal de comprobantes." }
}
