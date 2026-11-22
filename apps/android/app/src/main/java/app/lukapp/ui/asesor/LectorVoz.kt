package app.lukapp.ui.asesor

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import app.lukapp.dominio.limpiarTextoChat
import kotlinx.coroutines.flow.MutableStateFlow
import java.util.Locale

/** «Leer en voz alta» (handleLeerEnVozAlta): una sola lectura a la vez, y tocar la que suena la detiene. */
class LectorVoz(contexto: Context) {
    /** Id del mensaje que está sonando, o null. */
    val hablando = MutableStateFlow<String?>(null)
    /** Aviso corto para mostrar, como los toasts de la web. */
    val aviso = MutableStateFlow<String?>(null)
    private var listo = false
    private var tts: TextToSpeech? = TextToSpeech(contexto.applicationContext) { estado ->
        val t = tts
        if (estado == TextToSpeech.SUCCESS && t != null) {
            // Como la web: voz en español si existe (es-ES primero, luego cualquier es).
            val r = t.setLanguage(Locale.forLanguageTag("es-ES"))
            listo = r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED
            t.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(id: String?) { aviso.value = "Leyendo consejo…" }
                override fun onDone(id: String?) { hablando.compareAndSet(id, null) }
                @Deprecated("Deprecated in Java") override fun onError(id: String?) { hablando.compareAndSet(id, null) }
            })
        }
    }

    fun alternar(id: String, texto: String) {
        val t = tts
        if (t == null || !listo) { aviso.value = "Tu teléfono no tiene voz en español para leer en voz alta"; return }
        if (hablando.value == id) { t.stop(); hablando.value = null; aviso.value = "Lectura pausada"; return }
        t.stop()
        val limpio = limpiarTextoChat(texto)
        if (limpio.isEmpty()) return
        hablando.value = id
        t.speak(limpio, TextToSpeech.QUEUE_FLUSH, null, id)
    }

    fun detener() { tts?.stop(); hablando.value = null }
    fun liberar() { tts?.shutdown(); tts = null; hablando.value = null }
}
