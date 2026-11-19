package app.lukapp.dominio

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** Un archivo adjunto de un correo recibido; `id` es el que el servidor usa para pedir la descarga. */
@Serializable
data class AdjuntoCorreo(val id: String, val nombre: String = "", val tipo: String = "")

/** Fila de `comprobantes_correo` tal como la devuelve la base (la lectura está limitada a las filas de la persona por RLS). */
@Serializable
data class FilaComprobanteCorreo(
    val id: String,
    val remitente: String = "",
    val asunto: String = "",
    @kotlinx.serialization.SerialName("recibido_en") val recibidoEn: String,
    val adjuntos: List<AdjuntoCorreo> = emptyList(),
)

/** Lo que la bandeja muestra: la fecha ya legible, como `Intl.DateTimeFormat('es-CO')` de la web (día/mes/año). */
data class ComprobanteCorreo(
    val id: String,
    val remitente: String,
    val asunto: String,
    val fechaLegible: String,
    val adjuntos: List<AdjuntoCorreo>,
)

private val formatoFecha = DateTimeFormatter.ofPattern("d/M/yyyy")

/** La web formatea en la zona del dispositivo; un recibido ilegible se deja como llegó en vez de romper la lista. */
fun fechaDeComprobante(recibidoEn: String, zona: ZoneId = ZoneId.systemDefault()): String =
    try { OffsetDateTime.parse(recibidoEn).atZoneSameInstant(zona).format(formatoFecha) } catch (_: Exception) { recibidoEn.take(10) }

fun aComprobantes(filas: List<FilaComprobanteCorreo>, zona: ZoneId = ZoneId.systemDefault()): List<ComprobanteCorreo> =
    filas.map { ComprobanteCorreo(it.id, it.remitente, it.asunto, fechaDeComprobante(it.recibidoEn, zona), it.adjuntos) }

@Serializable private data class RespuestaDestino(val direccion: String? = null, val error: String? = null)
@Serializable private data class RespuestaAdjunto(val url: String? = null, val error: String? = null)

private val json = Json { ignoreUnknownKeys = true; isLenient = true }

/** Resultado de una llamada al servidor: o el dato, o el mensaje del servidor listo para mostrar. */
sealed interface ResultadoCorreo<out T> {
    data class Ok<T>(val valor: T) : ResultadoCorreo<T>
    data class Falla(val mensaje: String) : ResultadoCorreo<Nothing>
}

/** `GET /api/comprobantes-correo/destino`: la dirección personal, o el motivo por el que no hay (p. ej. 503 sin configurar). */
fun leerDestino(estado: Int, cuerpo: String): ResultadoCorreo<String> {
    val r = try { json.decodeFromString<RespuestaDestino>(cuerpo) } catch (_: Exception) { null }
    val direccion = r?.direccion
    return if (estado in 200..299 && !direccion.isNullOrBlank()) ResultadoCorreo.Ok(direccion)
    else ResultadoCorreo.Falla(r?.error?.takeIf { it.isNotBlank() } ?: "No se pudo preparar la dirección.")
}

/**
 * `GET /api/comprobantes-correo/:id/adjunto/:adjuntoId`: la URL firmada de descarga. Solo se acepta `https` hacia el CDN de
 * Resend: el servidor ya lo exige, pero la app no abre en el navegador una dirección que le llegue distinta.
 */
fun leerUrlAdjunto(estado: Int, cuerpo: String): ResultadoCorreo<String> {
    val r = try { json.decodeFromString<RespuestaAdjunto>(cuerpo) } catch (_: Exception) { null }
    val url = r?.url
    if (estado !in 200..299 || url.isNullOrBlank()) return ResultadoCorreo.Falla(r?.error?.takeIf { it.isNotBlank() } ?: "No se pudo preparar la descarga.")
    val valida = try { java.net.URI(url).let { it.scheme == "https" && it.host == "inbound-cdn.resend.com" } } catch (_: Exception) { false }
    return if (valida) ResultadoCorreo.Ok(url) else ResultadoCorreo.Falla("El enlace seguro del adjunto no es válido.")
}
