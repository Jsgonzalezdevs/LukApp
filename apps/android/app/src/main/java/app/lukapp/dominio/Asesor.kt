package app.lukapp.dominio

/** Origen: `components/AsesorView.tsx` (`SUGERENCIAS_INICIALES`). */
val SUGERENCIAS_ASESOR = listOf(
    "Dime mi resumen", "¿Cuánto puedo gastar?", "¿Debo declarar renta?",
    "¿Pagaré 4x1000 este mes?", "Mis suscripciones", "Sorpréndeme",
)

const val SALUDO_ASESOR = "¡Hola! Soy Luki, tu amigo contador. Me alegra verte por aquí. Podemos charlar un momento o revisar tus gastos, balance y metas con calma. ¿Cómo vas?"

/** Origen: `IMAGENES_LUKI_ASESOR`, en el mismo orden (el índice 10 es el easter egg de la lengua). */
val POSES_LUKI = listOf(
    "luki-nutria-saludo-transparente.png" to "Luki, la mascota de LukApp, saludando",
    "luki-leyendo-transparente.webp" to "Luki, la mascota de LukApp, leyendo un libro",
    "luki-escribiendo-transparente.webp" to "Luki, la mascota de LukApp, tomando notas",
    "luki-abierto-transparente.webp" to "Luki, la mascota de LukApp, abriendo el espacio",
    "luki-gesto-chistoso.webp" to "Luki, la mascota de LukApp, haciendo un gesto chistoso",
    "luki-durmiendo-transparente.webp" to "Luki, la mascota de LukApp, durmiendo",
    "luki-sorprendida-transparente.webp" to "Luki, la mascota de LukApp, sorprendida",
    "luki-pensando-transparente.webp" to "Luki, la mascota de LukApp, pensando",
    "luki-saltando-transparente.webp" to "Luki, la mascota de LukApp, saltando de alegría",
    "luki-timida-transparente.webp" to "Luki, la mascota de LukApp, haciendo un gesto tímido",
    "luki-easter-egg-lengua.webp" to "Luki, la mascota de LukApp, sacando la lengua",
)

private const val PROBABILIDAD_LENGUA = 0.00001
private const val PROBABILIDAD_LUKI_LOCO = 0.0001

/** Origen: `elegirIndiceImagenLuki`. El saludo pesa 40 %; el gesto chistoso y la lengua son casi invisibles. */
fun elegirIndiceImagenLuki(azar: Double): Int {
    if (azar < PROBABILIDAD_LENGUA) return 10
    if (azar < PROBABILIDAD_LENGUA + PROBABILIDAD_LUKI_LOCO) return 4
    val comun = (azar - PROBABILIDAD_LENGUA - PROBABILIDAD_LUKI_LOCO) / (1 - PROBABILIDAD_LENGUA - PROBABILIDAD_LUKI_LOCO)
    return when {
        comun < 0.40 -> 0
        comun < 0.48 -> 1
        comun < 0.56 -> 2
        comun < 0.64 -> 3
        comun < 0.72 -> 5
        comun < 0.78 -> 6
        comun < 0.84 -> 7
        comun < 0.90 -> 8
        else -> 9
    }
}

/** Origen: `limpiarTextoChat`: quita los bloques de «pensamiento» que algún modelo deja escapar. */
fun limpiarTextoChat(t: String): String =
    t.replace(Regex("<think>[\\s\\S]*?</think>", RegexOption.IGNORE_CASE), "")
        .replace(Regex("<think>[\\s\\S]*", RegexOption.IGNORE_CASE), "")
        .replace(Regex("^Here('s| is) a thinking process:[\\s\\S]*?\\n\\n", RegexOption.IGNORE_CASE), "")
        .trim()

/** Origen: `etiquetaConexion`/estados del pill: en-linea, despertando, local. */
enum class ConexionIA { EN_LINEA, DESPERTANDO, LOCAL }
