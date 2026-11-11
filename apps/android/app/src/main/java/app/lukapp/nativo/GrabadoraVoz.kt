package app.lukapp.nativo

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import java.io.File

/**
 * Graba el dictado como hace hoy la app Expo (`useGrabacionNativa`): AAC en
 * MPEG-4, mono, con medidor de nivel para la onda de la capa de dictado.
 * El archivo vive en la caché de la app y se borra al terminar: el audio de
 * una persona hablando de su plata no tiene por qué quedarse en el teléfono.
 */
class GrabadoraVoz(private val contexto: Context) {
    private var grabadora: MediaRecorder? = null
    private var archivo: File? = null

    fun iniciar() {
        cancelar()
        val destino = File(contexto.cacheDir, "dictado-${System.currentTimeMillis()}.m4a")
        val r = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) MediaRecorder(contexto) else @Suppress("DEPRECATION") MediaRecorder()
        r.setAudioSource(MediaRecorder.AudioSource.VOICE_RECOGNITION)
        r.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        r.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
        r.setAudioChannels(1)
        r.setAudioSamplingRate(44_100)
        r.setAudioEncodingBitRate(96_000)
        // Mismo tope de 60 s que la web: un dictado más largo casi siempre es un micrófono olvidado.
        r.setMaxDuration(60_000)
        r.setOutputFile(destino.absolutePath)
        r.prepare()
        r.start()
        grabadora = r
        archivo = destino
    }

    /** Nivel 0..1 con la misma escala que la app Expo: (dB + 60) / 60. */
    fun nivel(): Float {
        val amplitud = runCatching { grabadora?.maxAmplitude ?: 0 }.getOrDefault(0)
        if (amplitud <= 0) return 0f
        val db = 20 * kotlin.math.log10(amplitud / 32767.0)
        return ((db + 60) / 60).toFloat().coerceIn(0f, 1f)
    }

    /** Detiene y devuelve el audio, o null si quedó vacío (menos de 512 bytes, como la app Expo). */
    fun terminar(): ByteArray? {
        val r = grabadora ?: return null
        val f = archivo
        grabadora = null
        archivo = null
        val ok = runCatching { r.stop() }.isSuccess
        r.release()
        val datos = if (ok) f?.takeIf { it.exists() }?.readBytes() else null
        f?.delete()
        return datos?.takeIf { it.size >= 512 }
    }

    fun cancelar() {
        grabadora?.let { runCatching { it.stop() }; it.release() }
        grabadora = null
        archivo?.delete()
        archivo = null
    }
}
