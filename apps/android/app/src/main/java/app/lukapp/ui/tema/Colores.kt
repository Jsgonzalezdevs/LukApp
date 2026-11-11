package app.lukapp.ui.tema

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

/**
 * Tokens `--fin-*` de src/features/lukapp/lukapp.css, valor por valor.
 * Claro: bloque `.fin-html` (L:21-113). Oscuro: bloque `[data-tema='oscuro']` (L:270-320).
 * Los nombres siguen al token CSS para que buscar uno lleve al otro.
 */
@Immutable
data class ColoresLukApp(
    val bg: Color,
    val bgBlur: Color,
    val card: Color,
    val glassBg: Color,
    val glassBorder: Color,
    val soft: Color,
    val line: Color,
    val scrim: Color,
    val bgSoft: Color,
    val surface: Color,
    val resumenSuperficie: Color,
    val cardHover: Color,
    val guiaCard: Color,
    val glassHighlight: Color,
    val ink: Color,
    val inkSoft: Color,
    val inkFaint: Color,
    val inkGhost: Color,
    val accent: Color,
    val accentHover: Color,
    val onAccent: Color,
    val onIn: Color,
    val onOut: Color,
    val entro: Color,
    val entroBg: Color,
    val salio: Color,
    val salioBg: Color,
    val salioInk: Color,
    val warn: Color,
    val warnBg: Color,
    val warnInk: Color,
    val mediaBg: Color,
    val mediaInk: Color,
    val bajaBg: Color,
    val bajaInk: Color,
    val esOscuro: Boolean,
)

/** `rgb(r g b / a)` de CSS. */
private fun rgb(r: Int, g: Int, b: Int, a: Float = 1f) = Color(r, g, b, (a * 255).toInt().coerceIn(0, 255))

val ColoresClaros = ColoresLukApp(
    bg = Color(0xFFFBF9F6),
    bgBlur = rgb(251, 249, 246, 0.85f),
    card = rgb(255, 255, 255, 0.72f),
    glassBg = rgb(255, 255, 255, 0.72f),
    glassBorder = rgb(255, 255, 255, 0.55f),
    soft = Color(0xFFF5F3F0),
    line = Color(0xFFEDE9E3),
    scrim = rgb(28, 25, 23, 0.4f),
    bgSoft = Color(0xFFF7F5F2),
    surface = Color(0xFFFFFFFF),
    resumenSuperficie = Color(0xFFFFFDFA),
    cardHover = Color(0xFFEFECE7),
    guiaCard = rgb(255, 255, 255, 0.92f),
    glassHighlight = rgb(255, 255, 255, 0.55f),
    ink = Color(0xFF1C1917),
    inkSoft = Color(0xFF68615B),
    inkFaint = Color(0xFF706963),
    inkGhost = Color(0xFF706963),
    accent = Color(0xFF772AEA),
    accentHover = Color(0xFF631FC9),
    onAccent = Color(0xFFFFFFFF),
    onIn = Color(0xFFFFFFFF),
    onOut = Color(0xFFFFFFFF),
    entro = Color(0xFF547C09),
    entroBg = Color(0xFFF2FCE0),
    salio = Color(0xFFD4025A),
    salioBg = Color(0xFFFDEAF1),
    salioInk = Color(0xFFA4013F),
    warn = Color(0xFF945100),
    warnBg = Color(0xFFFEF3C7),
    warnInk = Color(0xFF92400E),
    mediaBg = Color(0xFFFFF7ED),
    mediaInk = Color(0xFFC2410C),
    bajaBg = Color(0xFFFEFCE8),
    bajaInk = Color(0xFFA16207),
    esOscuro = false,
)

val ColoresOscuros = ColoresLukApp(
    bg = Color(0xFF1A1817),
    bgBlur = rgb(26, 24, 23, 0.85f),
    card = rgb(45, 42, 40, 0.6f),
    glassBg = rgb(45, 42, 40, 0.82f),
    glassBorder = rgb(255, 255, 255, 0.12f),
    soft = Color(0xFF2C2A28),
    line = Color(0xFF35322F),
    scrim = rgb(0, 0, 0, 0.6f),
    bgSoft = Color(0xFF221F1E),
    surface = Color(0xFF2D2A28),
    resumenSuperficie = Color(0xFF292624),
    cardHover = Color(0xFF3A3734),
    guiaCard = rgb(24, 22, 21, 0.94f),
    glassHighlight = rgb(255, 255, 255, 0.12f),
    ink = Color(0xFFF5F3F0),
    inkSoft = Color(0xFFC2BBB4),
    inkFaint = Color(0xFFB2ABA4),
    inkGhost = Color(0xFFAAA39B),
    // Neutro a propósito en oscuro (lukapp.css:302): el morado sobre casi negro vibraba.
    accent = Color(0xFFF5F3F0),
    accentHover = Color(0xFFFFFFFF),
    onAccent = Color(0xFF1A1817),
    onIn = Color(0xFF1A1817),
    onOut = Color(0xFF1A1817),
    entro = Color(0xFFC3EB89),
    entroBg = rgb(195, 235, 137, 0.14f),
    salio = Color(0xFFE27A97),
    salioBg = rgb(226, 122, 151, 0.14f),
    salioInk = Color(0xFFE89BB2),
    warn = Color(0xFFFBBF24),
    warnBg = rgb(251, 191, 36, 0.12f),
    warnInk = Color(0xFFFCD34D),
    mediaBg = rgb(251, 146, 60, 0.12f),
    mediaInk = Color(0xFFFDBA74),
    bajaBg = rgb(250, 204, 21, 0.12f),
    bajaInk = Color(0xFFFDE047),
    esOscuro = true,
)

/** `color-mix(in srgb, a p%, b)` de CSS. */
fun mezclar(a: Color, porcentaje: Float, b: Color): Color {
    val p = porcentaje / 100f
    return Color(
        red = a.red * p + b.red * (1 - p),
        green = a.green * p + b.green * (1 - p),
        blue = a.blue * p + b.blue * (1 - p),
        alpha = a.alpha * p + b.alpha * (1 - p),
    )
}
