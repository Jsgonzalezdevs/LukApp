package app.lukapp.nativo

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Paint
import android.net.Uri
import app.lukapp.dominio.limpiarTextoOcr
import app.lukapp.dominio.textoOcrUtil
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.math.roundToInt

/** Lo que salió de leer una foto. */
sealed class LecturaImagen {
    /** El texto ya limpio, listo para el intérprete (con el prefijo `[OCR]` que activa las reglas de comprobantes). */
    data class Texto(val texto: String) : LecturaImagen()
    data object SinTexto : LecturaImagen()
    data object Fallo : LecturaImagen()
}

/**
 * `useImageOCR.ts`: lee el texto de la foto de un comprobante o factura con ML Kit, en el teléfono. Igual que la web:
 * se reduce a 2.000 px de lado mayor y se sube el contraste (la letra pequeña sobre degradados lo agradece); si esa
 * versión no da texto útil, la imagen original tiene una segunda oportunidad antes de culpar a la foto.
 */
object LectorImagen {
    private const val LADO_MAXIMO = 2000

    /**
     * `conLineas`: para un extracto, donde cada fila es una línea. El comprobante se junta en una sola línea (es lo que
     * espera el intérprete de voz); el extracto necesita los saltos para separar un movimiento de otro.
     */
    suspend fun leer(contexto: Context, uri: Uri, conLineas: Boolean = false): LecturaImagen = withContext(Dispatchers.Default) {
        try {
            val original = decodificar(contexto, uri, null) ?: return@withContext LecturaImagen.Fallo
            val mejorada = realzar(original)
            var texto = reconocer(mejorada, conLineas)
            if (!textoOcrUtil(texto)) texto = reconocer(original, conLineas)
            if (!textoOcrUtil(texto)) LecturaImagen.SinTexto else LecturaImagen.Texto(if (conLineas) texto else "[OCR] $texto")
        } catch (e: kotlinx.coroutines.CancellationException) { throw e } catch (_: Exception) { LecturaImagen.Fallo }
    }

    private fun decodificar(contexto: Context, uri: Uri, ladoMax: Int?): Bitmap? {
        val limites = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        contexto.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, limites) }
        val mayor = maxOf(limites.outWidth, limites.outHeight)
        if (mayor <= 0) return null
        // Reduce al decodificar (potencias de 2) para no cargar una foto de 48 MP entera, y ajusta fino después.
        var muestreo = 1
        while (mayor / (muestreo * 2) >= LADO_MAXIMO) muestreo *= 2
        val bmp = contexto.contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = muestreo }) } ?: return null
        val lado = maxOf(bmp.width, bmp.height)
        if (lado <= LADO_MAXIMO) return bmp
        val k = LADO_MAXIMO.toFloat() / lado
        return Bitmap.createScaledBitmap(bmp, (bmp.width * k).roundToInt(), (bmp.height * k).roundToInt(), true)
    }

    /** `grayscale(1) contrast(1.55) brightness(1.1)` del canvas de la web. */
    private fun realzar(origen: Bitmap): Bitmap {
        val salida = Bitmap.createBitmap(origen.width, origen.height, Bitmap.Config.ARGB_8888)
        val gris = ColorMatrix().apply { setSaturation(0f) }
        val contraste = 1.55f
        val traslado = (-0.5f * contraste + 0.5f) * 255f
        gris.postConcat(ColorMatrix(floatArrayOf(contraste, 0f, 0f, 0f, traslado, 0f, contraste, 0f, 0f, traslado, 0f, 0f, contraste, 0f, traslado, 0f, 0f, 0f, 1f, 0f)))
        gris.postConcat(ColorMatrix().apply { setScale(1.1f, 1.1f, 1.1f, 1f) })
        Canvas(salida).drawBitmap(origen, 0f, 0f, Paint().apply { colorFilter = ColorMatrixColorFilter(gris) })
        return salida
    }

    private suspend fun reconocer(imagen: Bitmap, conLineas: Boolean): String = suspendCancellableCoroutine { k ->
        val reconocedor = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
        reconocedor.process(InputImage.fromBitmap(imagen, 0))
            .addOnSuccessListener { k.resume(if (conLineas) it.text.replace('|', 'I').trim() else limpiarTextoOcr(it.text)); reconocedor.close() }
            .addOnFailureListener { k.resumeWithException(it); reconocedor.close() }
    }
}
