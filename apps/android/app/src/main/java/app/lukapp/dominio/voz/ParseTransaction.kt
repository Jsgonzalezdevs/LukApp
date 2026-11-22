package app.lukapp.dominio.voz

import app.lukapp.dominio.CategoriaPersonal
import app.lukapp.dominio.Transaccion
import java.math.BigDecimal
import java.math.RoundingMode
import java.time.LocalDate
import java.time.ZoneId

/*
 * El intérprete local de texto dictado o escrito -> un movimiento.
 * Origen: src/features/lukapp/lib/parseTransaction.ts
 *
 * Es una traducción línea a línea: las heurísticas (puntajes, órdenes de
 * prueba, rarezas incluidas) son las de la web para que un mismo dictado dé el
 * mismo movimiento en el teléfono y en el navegador. La única diferencia
 * deliberada es que "hoy" llega por parámetro en vez de leerse del reloj.
 */

private val ZONA_VOZ: ZoneId = ZoneId.of("America/Bogota")

/** El día de hoy en Colombia: es lo que la web obtiene con `new Date()` en el navegador del usuario. */
internal fun hoyEnBogota(): LocalDate = LocalDate.now(ZONA_VOZ)

/** Copia privada de CATEGORY_LABELS (types.ts) para no chocar con el catálogo de dominio/. */
internal val ETIQUETAS_CATEGORIA: Map<String, String> = linkedMapOf(
    "mercado" to "Mercado",
    "comida" to "Comida",
    "transporte" to "Transporte",
    "servicios" to "Servicios",
    "salud" to "Salud",
    "hogar" to "Hogar",
    "entretenimiento" to "Entretenimiento",
    "ropa" to "Ropa",
    "educacion" to "Educación",
    "transferencia" to "Transferencia",
    "ahorro" to "Ahorro",
    "ingreso" to "Ingreso",
    "otros" to "Otros",
)

private val DIAS_SEMANA: Map<String, Int> = linkedMapOf(
    "domingo" to 0, "lunes" to 1, "martes" to 2, "miercoles" to 3,
    "jueves" to 4, "viernes" to 5, "sabado" to 6,
)
private val MESES_ANO: Map<String, Int> = linkedMapOf(
    "enero" to 0, "febrero" to 1, "marzo" to 2, "abril" to 3, "mayo" to 4, "junio" to 5,
    "julio" to 6, "agosto" to 7, "septiembre" to 8, "octubre" to 9, "noviembre" to 10,
    "diciembre" to 11,
)

/** Una cuenta a la que el texto puede referirse por nombre. */
data class CuentaConocida(val id: String, val nombre: String)

object AmountSource {
    const val DIGITS = "digits"
    const val DIGITS_SCALE = "digits+scale"
    const val WORDS = "words"
    const val SLANG = "slang"
    const val NONE = "none"
}

data class Senales(
    /** 'digits' | 'digits+scale' | 'words' | 'slang' | 'none' */
    val amountSource: String,
    /** 'keyword' | 'morphology' | 'category-implied' | 'default' */
    val kindSource: String,
    /** 'usuario' | 'merchant' | 'aprendida' | 'keyword' | 'default' */
    val categorySource: String,
    /**
     * Cómo se decidió la cuenta. 'preposicion' es el caso fuerte («a
     * Bancolombia», «desde Nequi»): la frase dice que es destino u origen.
     * 'preposicion' | 'nombre' | 'ninguna'
     */
    val cuentaSource: String,
    /** 'tarjeta_credito' | 'tarjeta_debito' | 'billetera_digital' | 'transferencia_bancaria' | 'efectivo' | 'cheque' | 'cripto' | 'desconocido' */
    val paymentMethod: String,
    /** 'diario' | 'semanal' | 'mensual' | 'anual' | 'ninguno' */
    val recurringPattern: String,
    /** Se encontró más de un monto viable. */
    val ambiguousAmount: Boolean,
    val destinatario: String?,
    val ubicacion: String?,
    val tags: List<String>,
)

data class ParsedTransaction(
    /** 'gasto' | 'ingreso' */
    val kind: String,
    val amount: Long?,
    /**
     * El intérprete solo produce categorías de fábrica (o la del usuario que
     * nombró); el tipo es String porque esta misma forma sirve de borrador al
     * editar un movimiento que puede estar en una categoría propia.
     */
    val category: String,
    /** El saldo que nombró el texto, si nombró uno. */
    val cuentaId: String?,
    val description: String,
    /** El texto intacto, siempre. Una mala lectura debe poder reconstruirse. */
    val raw: String,
    /** Fecha 'YYYY-MM-DD' sacada de «ayer», «anoche», «el 5 de marzo»… */
    val dateOverride: String? = null,
    val cuotasTotal: Int? = null,
    val cuotaCop: Long? = null,
    val confidence: Double,
    val confianzaGranular: ConfianzaGranular,
    val needsReview: Boolean,
    val signals: Senales,
    val suggestedCategories: List<String>,
)

/* ───────────────────────── limpieza de descripción ───────────────────────── */

private val RE_BORDES_PUNTUACION = js("""^[,.\-•\s]+|[,.\-•\s]+$""", "g")
private val RE_ME_PAGAR = js("""^me\s+pagar\b""", "i")
private val RE_SALUDOS = js(
    """^(?:hola\s+|buenas(?:\s+tardes|\s+dias|\s+días|\s+noches)?\s+|porfa(?:vor)?\s+|oye\s+|mira\s+|anota(?:me)?(?:\s+que)?\s+|registra(?:\s+que)?\s+|guarda(?:\s+que)?\s+|pon(?:me)?(?:\s+ahi|\s+ahí)?\s+|escribe(?:\s+que)?\s+)""",
    "i",
)
private val RE_VERBOS_INICIO = js(
    """^(?:me\s+)?(?:compre|compré|gaste|gasté|pague|pagué|adquiri|adquirí|pedi|pedí|anote|anoté|tome|tomé|comi|comí|tanquie|tanquié|tanquee|tanqueé|recargue|recargué|abone|aboné|cancele|cancelé|meti|metí|saque|saqué|puse)\s+(?:con\s+(?:(?:mi|la|el|una|un|mis)\s+)?(?:tarjeta(?:\s+de\s+(?:credito|crédito|debito|débito))?|de\s+(?:credito|crédito|debito|débito)|efectivo|nequi|daviplata|bancolombia|nu|nubank)\s+)?""",
    "i",
)
private val RE_PAGO_DE = js("""^(?:pago|compra|gasto)\s+de\s+""", "i")
private val RE_ME_COSTO_INICIO = js("""^(?:me\s+costo|me\s+costó|me\s+valio|me\s+valió|me\s+salio|me\s+salió)\s+""", "i")
private val RE_METODOS = js(
    """\b(?:con\s+)?(?:(?:mi|la|el|mis)\s+)?(?:tarjeta(?:\s+de\s+(?:credito|crédito|debito|débito))?|de\s+(?:credito|crédito|debito|débito)|efectivo|plata\s+en\s+mano|transferencia|nequi|daviplata|bancolombia|nu|nubank|banco)\b""",
    "gi",
)
private val RE_COLETILLA_COSTO_1 = js(
    """\s+(?:y\s+)?que\s+(?:me\s+)?(?:costaron|costo|costó|valieron|valio|valió|salieron|salio|salió)(?:\s+en)?(?:\s+y)?$""",
    "i",
)
private val RE_COLETILLA_COSTO_2 = js(
    """\s+(?:que|y)\s+(?:me\s+)?(?:costaron|costo|costó|valieron|valio|valió|salieron|salio|salió)(?:\s+en)?\s*$""",
    "i",
)
private val RE_POR_VALOR = js("""\s+(?:por\s+valor\s+de|por|por\s+un\s+valor\s+de)$""", "i")
private val RE_CIERRES = js(
    """\s+(?:y\s+ya|y\s+listo|eso\s+fue\s+todo|en\s+total|mas\s+o\s+menos|más\s+o\s+menos|aproximadamente)$""",
    "i",
)
private val RE_PESOS_1 = js("""\s+(?:que\s+)?pesos?(?:\s+[Ee]n\s+(?:\w+\s+)?mil\s+pesos?)?$""", "i")
private val RE_PESOS_2 = js("""\s+en\s+(?:\w+\s+)?(?:mil|millones|millón|lucas|palos)(?:\s+pesos?)?$""", "i")
private val RE_PESOS_3 = js("""\s+(?:y\s+)?pesos?$""", "i")
private val RE_PESOS_4 = js("""\s+(?:que\s+)?pesos?\s+como\s+\w+$""", "i")
private val RE_PESOS_INICIO = js("""^pesos?\s+""", "i")
private val RE_ARTICULO_INDEF = js("""^(?:un|una|unos|unas)\s+""", "i")
private val RE_ARTICULO_DEF = js(
    """^(?:el|la|los|las)\s+(?=factura|recibo|cuenta|arriendo|pago|cuota|tarjeta|moto|carro|auto|camioneta|mercado|almuerzo|desayuno|cena|gasolina)""",
    "i",
)
private val RE_CONECTOR_FINAL = js("""\s+(?:con|de|y|en|por|para|a|que)\s*$""", "i")
private val RE_CONECTOR_INICIO = js("""^(?:con|de|y|en|por|para|a|que)\s+""", "i")
private val RE_ESPACIOS = js("""\s+""", "g")

private val RESIDUOS_DESCRIPCION = setOf(
    "me", "te", "se", "le", "nos", "de", "en", "un", "una", "el", "la", "los", "las",
    "por", "para", "con", "y", "o", "que", "mi", "mis", "tu", "tus", "su", "sus",
)

/**
 * Limpia muletillas y frases conversacionales del dictado para dejar una
 * descripción concreta («Me compré un café con mi tarjeta» -> «Café»).
 */
fun limpiarDescripcionFinanciera(desc: String): String {
    if (desc.isEmpty()) return ""
    var t = desc.trimJs().reemplazarTodos(RE_BORDES_PUNTUACION, "").trimJs()

    // Error común de transcripción: «Me pagar» -> «Pago».
    t = t.reemplazarPrimero(RE_ME_PAGAR, "Pago")

    var prev = ""
    var iteraciones = 0
    while (prev != t && iteraciones < 6) {
        prev = t
        iteraciones++

        t = t.reemplazarPrimero(RE_SALUDOS, "")
        t = t.reemplazarPrimero(RE_VERBOS_INICIO, "")
        t = t.reemplazarPrimero(RE_PAGO_DE, "")
        t = t.reemplazarPrimero(RE_ME_COSTO_INICIO, "")

        // Métodos de pago en cualquier parte.
        t = t.reemplazarTodos(RE_METODOS, "")

        // Coletillas de costo («que me costaron», «que valieron»…).
        t = t.reemplazarPrimero(RE_COLETILLA_COSTO_1, "")
        t = t.reemplazarPrimero(RE_COLETILLA_COSTO_2, "")
        t = t.reemplazarPrimero(RE_POR_VALOR, "")

        // Cierres de voz («y ya», «en total», «y listo»).
        t = t.reemplazarPrimero(RE_CIERRES, "")

        // Moneda o unidades sueltas al final.
        t = t.reemplazarPrimero(RE_PESOS_1, "")
        t = t.reemplazarPrimero(RE_PESOS_2, "")
        t = t.reemplazarPrimero(RE_PESOS_3, "")
        t = t.reemplazarPrimero(RE_PESOS_4, "")
        // Con el monto ya extraído, «pesos» puede quedar al inicio («1.500
        // pesos en Amparo»). No es parte del comercio.
        t = t.reemplazarPrimero(RE_PESOS_INICIO, "")

        t = t.reemplazarPrimero(RE_ARTICULO_INDEF, "")
        t = t.reemplazarPrimero(RE_ARTICULO_DEF, "")

        // Conectores huérfanos al final o al inicio.
        t = t.reemplazarPrimero(RE_CONECTOR_FINAL, "")
        t = t.reemplazarPrimero(RE_CONECTOR_INICIO, "")

        t = t.reemplazarTodos(RE_ESPACIOS, " ").trimJs()
        t = t.reemplazarTodos(RE_BORDES_PUNTUACION, "").trimJs()
    }

    if (t.isEmpty() || t.length < 2 || t.lowercase() in RESIDUOS_DESCRIPCION) return ""
    return capitalizarJs(t)
}

/* ───────────────────────── limpieza de OCR ───────────────────────── */

private val RE_PREFIJO_OCR = js("""^\[OCR\]""", "i")
private val RE_MENSAJE_OCR = js(
    """(?:mensaje|motivo|concepto|detalle|nota|conversación|conversacion)\s*:?\s*([\s\S]+?)(?:\s+(?:valor|fecha|costo|referencia|aprobado|hora|desde|hacia|¿cuánto\?|cuanto|numero|número|disponible|comprobante|escanea|nequi|bancolombia)|$)""",
    "i",
)
private val RE_DIACRITICOS_OCR = js("""[̀-ͯ]""", "g")
private val RUIDO_DESTINO = listOf(
    "nequi", "bancolombia", "daviplata", "comprobante", "movimiento", "envio", "realizado",
    "lizado", "exitoso", "detalle", "verificar", "instante",
)
private val LIMPIEZAS_OCR: List<Regex> = listOf(
    js("""(?:comprobante\s+de\s+pago|envío\s+realizado|envio\s+realizado|transferencia\s+exitosa|transacción\s+exitosa|transaccion\s+exitosa)""", "gi"),
    js("""detalle\s+del\s+movimiento|del\s+movimiento""", "gi"),
    js("""escanea\s+este\s+qr[\s\S]*""", "gi"),
    js("""escenea\s+este\s+or[\s\S]*""", "gi"),
    js("""número\s+nequi\s*\d+|numero\s+nequi\s*\d+""", "gi"),
    js("""referencia\s*[a-z0-9]+""", "gi"),
    js("""fecha\s+[\d\s\w:.]+""", "gi"),
    js("""valor\s*\$?\s*[\d.,]+""", "gi"),
    js("""disponible\s*\$?\s*[\d.,]+""", "gi"),
    js("""costo\s+de\s+la\s+transacción.*""", "gi"),
    js("""cta\.?\s*(?:origen|destino).*""", "gi"),
    js("""oro\s+\d+.*|o\s+i\s+e\s+h\s+r.*""", "gi"),
)
private val RE_SIMBOLOS_OCR = js("""[<>=_()¡!|—•]+""", "g")
private val RE_SOLO_DIGITOS = js("""^\d+$""")
private val PALABRAS_BASURA_OCR = setOf(
    "del", "los", "las", "con", "por", "para", "este", "esta", "nequi", "bancolombia", "daviplata",
    "oro", "envio", "envío", "realizado", "escanea", "escenea", "qr", "or", "verificar", "instante",
    "conversacion", "conversación", "comprobante", "movimiento", "detalle", "pago", "exitosa", "exitoso",
)

private fun sinTildes(texto: String): String = stripAccents(texto)

/**
 * Limpia el texto escaneado por OCR (comprobantes Nequi, Bancolombia,
 * facturas) para quedarse con el mensaje o el nombre real sin la plantilla.
 */
fun limpiarOCRDescripcion(raw: String, categoryLabel: String, destinatario: String? = null): String {
    val text = raw.reemplazarPrimero(RE_PREFIJO_OCR, "").trimJs()

    // 1. Mensaje o motivo explícito en el comprobante.
    val msgMatch = RE_MENSAJE_OCR.find(text)
    if (msgMatch != null && msgMatch.groupValues[1].isNotEmpty()) {
        val msg = msgMatch.groupValues[1].trimJs()
        val msgLower = msg.lowercase()
        if (
            msg.length >= 3 &&
            !msgLower.contains("del movimiento") &&
            !msgLower.contains("escanea") &&
            !msgLower.contains("comprobante") &&
            !msgLower.contains("envio realizado") &&
            !msgLower.contains("envío realizado")
        ) {
            return capitalizarJs(msg)
        }
    }

    // 2. Destinatario explícito válido.
    if (destinatario != null && destinatario.trimJs().length >= 2) {
        val dest = destinatario.trimJs()
        val destLower = sinTildes(dest.lowercase())
        if (RUIDO_DESTINO.none { destLower.contains(it) }) {
            return "Envío a ${capitalizarJs(dest)}"
        }
    }

    // 3. Fuera el texto de plantilla y los caracteres ruidosos de Tesseract.
    var limpia = text
    for (re in LIMPIEZAS_OCR) limpia = limpia.reemplazarTodos(re, "")
    limpia = limpia.reemplazarTodos(RE_SIMBOLOS_OCR, " ").reemplazarTodos(RE_ESPACIOS, " ").trimJs()

    val palabrasLimpias = limpia.split(" ").filter { w ->
        val norm = sinTildes(w.lowercase())
        w.length > 2 && norm !in PALABRAS_BASURA_OCR
    }

    val textoFinal = palabrasLimpias.joinToString(" ").trimJs()
    if (textoFinal.length >= 3 && !RE_SOLO_DIGITOS.containsMatchIn(textoFinal)) {
        return capitalizarJs(textoFinal)
    }

    // 4. Si todo era plantilla, la etiqueta legible de la categoría.
    return categoryLabel
}

/* ───────────────────────── tokens y montos ───────────────────────── */

data class Token(val raw: String, val norm: String)

internal data class Candidate(
    val value: Long,
    val start: Int,
    val end: Int,
    val score: Int,
    val hasScale: Boolean,
    val usedDigits: Boolean,
    val usedWords: Boolean,
    val usedSlang: Boolean,
)

private object Pesos {
    const val AMOUNT = 0.5
    const val KIND_KEYWORD = 0.3
    const val KIND_IMPLIED = 0.15
    // Una categoría que el usuario nombró vale como una marca: es una señal
    // explícita suya, no una adivinanza de una lista genérica.
    const val USER_CATEGORY = 0.2
    const val MERCHANT = 0.2
    // Lo aprendido del historial pesa más que la lista genérica —es lo que
    // TÚ haces— pero menos que una señal explícita del momento.
    const val LEARNED = 0.16
    const val CATEGORY_KEYWORD = 0.12
    const val AMBIGUITY_PENALTY = 0.1
}

private const val REVIEW_THRESHOLD = 0.7

private val RE_ESPACIOS_TOKEN = js("""\s+""")
private val RE_BORDE_INICIO = js("""^[^\p{L}\p{N}$]+""", "u")
private val RE_BORDE_FIN = js("""[^\p{L}\p{N}]+$""", "u")

/**
 * Parte por espacios y quita la puntuación de los bordes, normalizando cada
 * token por separado. Es a propósito: quitar tildes cambia el largo del texto,
 * así que un índice calculado sobre una copia normalizada entera se correría
 * para todo lo que viene después de la primera tilde.
 */
fun tokenize(input: String): List<Token> {
    val out = mutableListOf<Token>()
    for (piece in input.split(RE_ESPACIOS_TOKEN)) {
        if (piece.isEmpty()) continue
        var trimmed = piece.reemplazarPrimero(RE_BORDE_INICIO, "").reemplazarPrimero(RE_BORDE_FIN, "")
        if (trimmed.isEmpty() && piece.contains('$')) trimmed = "$"
        if (trimmed.isEmpty()) continue
        for (norm in normalizeNumericToken(normalizeWord(trimmed))) {
            if (norm.isNotEmpty()) out.add(Token(trimmed, norm))
        }
    }
    return out
}

private val RE_NO_ALFANUM = js("""[^a-z0-9\s]""", "g")

/** Normalización de frase completa para reconocer etiquetas del comprobante. */
private fun normalizarTextoOCR(texto: String): String =
    normalizeWord(texto).reemplazarTodos(RE_NO_ALFANUM, " ").reemplazarTodos(RE_ESPACIOS, " ").trimJs()

private data class CompraACuotasOCR(val totalCop: Long, val cuotas: Int, val cuotaCop: Long, val comercio: String)

private data class CuotasVoz(val cuotas: Int, val indices: List<Int>)

private val RE_CUOTAS = js("""^cuotas?$""")

/**
 * «A seis cuotas» contiene un número, pero ese número no es dinero. Detectarlo
 * antes de buscar montos evita que el seis compita con el precio y permite
 * guardar la financiación dicha por voz sin ensuciar la descripción.
 */
private fun cuotasDesdeVoz(tokens: List<Token>): CuotasVoz? {
    val normas = tokens.map { it.norm }
    for (i in 0 until normas.size - 2) {
        if (normas[i] != "a" && normas[i] != "en") continue
        val leido = readNumberAt(normas, i + 1) ?: continue
        if (leido.value < 2 || leido.value > 120) continue
        if (!RE_CUOTAS.containsMatchIn(normas.getOrNull(leido.next) ?: "")) continue
        return CuotasVoz(
            cuotas = leido.value.toInt(),
            indices = List(leido.next - i + 1) { desplazamiento -> i + desplazamiento },
        )
    }
    return null
}

private val RE_COMPRA_CUOTAS_OCR =
    js("""\$\s*([\d.]+(?:,\d{2})?)\s+en\s+(\d{1,2})\s*[x×]\s*(?:de\s*)?\$\s*([\d.]+(?:,\d{2})?)""", "i")
private val RE_HORA_SUELTA = js("""\b\d{1,2}:\d{2}\b""", "g")
private val RE_PRIMERA_LETRA = js("""[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]""")
private val RE_GUIONES_BORDE = js("""^[-–—:]+|[-–—:]+$""", "g")
private val RE_PREFIJO_OCR_ESPACIOS = js("""^\[OCR\]\s*""", "i")

/** `Number(s)` de JS para cadenas de dígitos y punto: la vacía vale 0. */
private fun numeroJs(s: String): Double? = if (s.isEmpty()) 0.0 else s.toDoubleOrNull()

/**
 * En el detalle de una compra a cuotas el último monto es la cuota, no la
 * compra. El OCR no conoce esa jerarquía visual, así que hay que leer la frase
 * completa antes de escoger el número que aparece más cerca del final.
 */
private fun compraACuotasDesdeOCR(raw: String): CompraACuotasOCR? {
    if (!raw.startsWith("[OCR]")) return null
    val match = RE_COMPRA_CUOTAS_OCR.find(raw) ?: return null

    val totalCop = numeroJs(match.groupValues[1].replace(".", "").replaceFirst(",", "."))
    val cuotas = match.groupValues[2].toInt()
    val cuotaCop = numeroJs(match.groupValues[3].replace(".", "").replaceFirst(",", "."))
    if (totalCop == null || totalCop <= 0 || cuotas < 2) return null

    val prefijo = raw.substring(0, match.range.first)
        .reemplazarPrimero(RE_PREFIJO_OCR_ESPACIOS, "")
        .reemplazarTodos(RE_HORA_SUELTA, "")
        .reemplazarTodos(RE_ESPACIOS, " ")
        .trimJs()
    // Los iconos del comprobante (red, batería, botones) suelen quedar como
    // cifras y símbolos antes del comercio. Se conserva desde la primera letra:
    // «0 62 < € 00 00 Bold Sa*Platzi» pasa a «Bold Sa*Platzi».
    val inicioComercio = RE_PRIMERA_LETRA.find(prefijo)?.range?.first ?: -1
    val comercio = (if (inicioComercio >= 0) prefijo.substring(inicioComercio) else prefijo)
        .reemplazarTodos(RE_GUIONES_BORDE, "")
        .trimJs()
    return CompraACuotasOCR(
        totalCop = Math.round(totalCop),
        cuotas = cuotas,
        // NaN no es posible: el grupo solo trae dígitos y puntos.
        cuotaCop = Math.round(cuotaCop ?: 0.0),
        comercio = comercio,
    )
}

// En facturas y comprobantes suele haber fecha, referencia y número de cuenta
// antes del dinero. Estas etiquetas hacen que el total real gane sobre esos
// números incidentales.
private val STRONG_CUES = setOf(
    "$", "usd", "cop", "cuanto", "valor", "total", "importe", "monto", "pagado", "recibido",
)

/** Todo numeral máximo del texto, con el tramo de tokens que ocupa. */
internal fun findAmountCandidates(tokens: List<Token>): List<Candidate> {
    val norms = tokens.map { it.norm }
    val out = mutableListOf<Candidate>()

    var i = 0
    while (i < norms.size) {
        val match = readNumberAt(norms, i)
        if (match == null) {
            i += 1
            continue
        }

        val before = if (i > 0) norms[i - 1] else null
        val after = norms.getOrNull(match.next)

        var score = 0
        if (match.hasScale) score += 3
        if (match.value >= 1000) score += 2

        if (before != null) {
            if (before in AMOUNT_CUES) score += 5
            if (before in STRONG_CUES) score += 15
        }

        // Si el token escrito traía símbolo de moneda, casi seguro es el monto.
        for (k in i until match.next) {
            val r = tokens[k].raw
            if (r.contains('$') || r.lowercase().contains("usd") || r.lowercase().contains("cop")) {
                score += 15
                break
            }
        }

        // Multidivisa automática.
        var finalValue = match.value
        var endToken = match.next
        val isUSD = after == "usd" || after == "dolares" || after == "dolar"
        val isEUR = after == "eur" || after == "euros" || after == "euro" ||
            (tokens.getOrNull(match.next - 1)?.raw?.contains('€') == true)
        if (isUSD) {
            finalValue = match.value * 4000
            score += 15 // Decir «dólares» es una señal enorme de monto.
            endToken += 1 // Se consume la palabra de la moneda.
        } else if (isEUR) {
            finalValue = match.value * 4400
            score += 15
            if (after == "eur" || after == "euros" || after == "euro") endToken += 1
        }

        // «compré 2 pizzas por 30 mil»: el 2 es cantidad, no monto.
        if (after != null && after in COUNT_NOUNS) score -= 6

        // «un café / una empanada»: «un/una/uno» es artículo, no $1.
        if (match.value == 1L && match.usedWords && !match.hasScale) {
            val esUnoExplicito = after == "peso" || after == "pesos" || after == "dolar" ||
                after == "dolares" || after == "usd" || after == "cop" || after == "euro" ||
                after == "euros"
            if (!esUnoExplicito) score -= 10
        }

        out.add(
            Candidate(
                value = finalValue,
                start = i,
                end = endToken,
                score = score,
                hasScale = match.hasScale,
                usedDigits = match.usedDigits,
                usedWords = match.usedWords,
                usedSlang = match.usedSlang,
            ),
        )

        i = endToken
    }

    return out
}

private fun pickBest(candidates: List<Candidate>): Candidate? {
    if (candidates.isEmpty()) return null

    val valid = candidates.filter { it.score >= 0 }
    if (valid.isEmpty()) {
        // Si todos están muy castigados (un «un café» suelto), no se inventa un monto.
        val noFalsos = candidates.filter { !(it.value == 1L && it.usedWords && !it.hasScale) }
        if (noFalsos.isEmpty()) return null
        return noFalsos.reduce { best, c -> if (c.score > best.score) c else best }
    }

    return valid.reduce { best, c ->
        when {
            c.score != best.score -> if (c.score > best.score) c else best
            c.hasScale != best.hasScale -> if (c.hasScale) c else best
            c.value != best.value -> if (c.value > best.value) c else best
            else -> best
        }
    }
}

private fun classifyAmountSource(c: Candidate): String = when {
    c.usedSlang -> AmountSource.SLANG
    c.usedDigits && c.hasScale -> AmountSource.DIGITS_SCALE
    c.usedWords && !c.usedDigits -> AmountSource.WORDS
    else -> AmountSource.DIGITS
}

/** Quita un plural para que `clases` encuentre `clase`. Conservador: solo
 *  tokens largos, y solo después de que falló la búsqueda exacta. */
private fun <T> lookupWithStem(table: Map<String, T>, norm: String): T? {
    table[norm]?.let { return it }
    if (norm.length <= 4) return null
    if (norm.endsWith("es")) {
        table[norm.dropLast(2)]?.let { return it }
    }
    if (norm.endsWith("s")) return table[norm.dropLast(1)]
    return null
}

private val MORPHOLOGICAL_INCOME = js("""(aron|eron|ieron)$""")

/**
 * Palabras que vuelven dirección una mención. «me transfirieron 20 mil A
 * BANCOLOMBIA» dice dónde cayó la plata; un «Bancolombia» suelto puede ser
 * parte de la descripción. Ambos valen, pero gana el que lleva preposición.
 */
private val PREPOSICIONES_DE_CUENTA = setOf(
    "a", "al", "de", "del", "en", "desde", "con", "hacia", "para", "hasta", "por",
)

private val ACCOUNT_DETERMINERS = setOf(
    "mi", "tu", "su", "el", "la", "los", "las", "un", "una", "unos", "unas",
)

private data class CuentaHallada(val id: String, val start: Int, val end: Int, val source: String)

private val RE_ESPACIOS_NOMBRE = js("""\s+""")

/**
 * Busca una cuenta nombrada en el texto.
 *
 * El nombre más largo primero, para que «Banco de Bogotá» nunca se resuelva
 * como un «Banco» suelto. Igualdad de token completo y no subcadena: «NU» no
 * debe calzar dentro de «nunca».
 */
private fun buscarCuenta(
    tokens: List<Token>,
    consumed: BooleanArray,
    cuentas: List<CuentaConocida>,
): CuentaHallada? {
    val candidatas = cuentas
        .map { c -> c.id to c.nombre.split(RE_ESPACIOS_NOMBRE).map(::normalizeWord).filter { it.isNotEmpty() } }
        .filter { it.second.isNotEmpty() }
        .sortedByDescending { it.second.size }

    val hallazgos = mutableListOf<CuentaHallada>()

    for ((id, seq) in candidatas) {
        val span = seq.size
        var i = 0
        while (i + span <= tokens.size) {
            var calza = true
            for (k in 0 until span) {
                if (consumed[i + k] || tokens[i + k].norm != seq[k]) {
                    calza = false
                    break
                }
            }
            if (!calza) { i += 1; continue }

            // Si pisa un nombre más largo ya hallado, es un fragmento de él.
            val inicio = i
            if (hallazgos.any { inicio < it.end && inicio + span > it.start }) { i += 1; continue }

            var start = i
            var source = "nombre"

            if (i > 0 && !consumed[i - 1]) {
                val prev1 = tokens[i - 1].norm
                if (prev1 in PREPOSICIONES_DE_CUENTA) {
                    start = i - 1
                    source = "preposicion"
                } else if (prev1 in ACCOUNT_DETERMINERS && i > 1 && !consumed[i - 2]) {
                    val prev2 = tokens[i - 2].norm
                    if (prev2 in PREPOSICIONES_DE_CUENTA) {
                        start = i - 2
                        source = "preposicion"
                    }
                }
            }

            hallazgos.add(CuentaHallada(id, start, i + span, source))
            i += 1
        }
    }

    if (hallazgos.isEmpty()) return null
    return hallazgos.firstOrNull { it.source == "preposicion" } ?: hallazgos[0]
}

private val PREVIOS_METODO = listOf("con", "en", "por", "usando", "mi", "la", "el", "una", "un", "mis", "de", "mediante")

private fun detectAndConsumePaymentMethod(tokens: List<Token>, consumed: BooleanArray): String {
    for (i in tokens.indices) {
        if (consumed[i]) continue
        val method = PAYMENT_METHODS[tokens[i].norm] ?: continue
        consumed[i] = true

        // Preposiciones y artículos que preceden («con mi», «en», «con la de»).
        var p = i - 1
        while (p >= 0 && !consumed[p] && tokens[p].norm in PREVIOS_METODO) {
            consumed[p] = true
            p--
        }

        // Calificadores que siguen («de crédito», «virtual», «física»).
        val n = i + 1
        if (n < tokens.size && !consumed[n] && tokens[n].norm == "de") {
            if (n + 1 < tokens.size && !consumed[n + 1] &&
                tokens[n + 1].norm in listOf("credito", "debito", "ahorros", "corriente")
            ) {
                consumed[n] = true
                consumed[n + 1] = true
            }
        } else if (n < tokens.size && !consumed[n] &&
            tokens[n].norm in listOf("credito", "debito", "digital", "virtual", "fisica")
        ) {
            consumed[n] = true
        }

        return method
    }
    return "desconocido"
}

/**
 * Lo mínimo que debe medir una descripción para que el Oráculo se fíe de ella.
 *
 * El Oráculo hereda el monto de un apunte viejo cuando el dictado no trae
 * cifra. Sin piso de largo una palabra suelta cazaba con cualquier apunte por
 * coincidencia («Gracias» contra la «as» de otra descripción), y Whisper
 * devuelve justamente «Gracias» cuando le llega silencio.
 */
private const val MINIMO_ORACULO = 4

/** Si `texto` menciona `buscado` como palabra entera, no como trozo de letras. */
private fun mencionaEntera(texto: String, buscado: String): Boolean {
    val aguja = buscado.trimJs().lowercase()
    if (aguja.length < MINIMO_ORACULO) return false
    val escapada = RegexJs.escapar(aguja)
    return js("""(^|\W)$escapada(\W|$)""", "i").containsMatchIn(texto.lowercase())
}

/** `Number(x.toFixed(2))` de JS: redondeo mitad hacia arriba sobre el valor binario exacto. */
private fun aDosDecimales(x: Double): Double =
    BigDecimal(x).setScale(2, RoundingMode.HALF_UP).toDouble()

/** `new Date(año, mes, día)` de JS: un día fuera de rango se desborda al mes siguiente. */
private fun fechaDesbordada(anio: Int, mes0: Int, dia: Int): LocalDate =
    LocalDate.of(anio, 1, 1).plusMonths(mes0.toLong()).plusDays((dia - 1).toLong())

private val RE_COMPROBANTE_INGRESO = js(
    """\b(?:transferencia|pago|abono|deposito|dinero|saldo) recibid[oa]\b|\bingreso\b|\bcredito aplicado\b|\bsaldo a favor\b""",
)
private val RE_COMPROBANTE_EGRESO = js(
    """\b(?:envio|transferencia|pago) realizad[oa]\b|\benviado(?:\s+a)?\b|\bde\s+d[oó]nde\s+sali[oó]\b|\bcompra aprobada\b|\bdebito\b|\bcobro exitoso\b|\btotal a pagar\b|\bgracias por su compra\b""",
)
private val RE_COMPROBANTE_CANAL = js("""\b(?:comprobante|envio|transferencia|nequi|daviplata|bancolombia)\b""")
private val RE_SEPARADOR_COMERCIO = js("""[^a-z0-9]+""")

private val RE_ZS_COMIDA = js("""\b(burger|pizza|sushi|taco|asadero|restaurante|empanada|panaderia|helado|almuerzo|comida|cena|desayuno|kfc|corrientazo)\b""")
private val RE_ZS_TRANSPORTE = js("""\b(uber|taxi|didi|cabify|bus|transmilenio|metro|gasolina|peaje|parqueadero|pasaje)\b""")
private val RE_ZS_OCIO = js("""\b(discoteca|bar|pub|club|cine|pelicula|concierto|boleta|netflix|spotify|suscripcion)\b""")
private val RE_ZS_SALUD = js("""\b(medico|pastilla|farmacia|drogueria|hospital|clinica|eps|cita|salud)\b""")
private val RE_ZS_COMPRAS = js("""\b(ropa|zapato|camisa|pantalon|chaqueta|zapatilla|falda|vestido|outfit)\b""")
private val RE_ZS_MERCADO = js("""\b(mercado|supermercado|exito|carulla|jumbo|tienda|fruver|carniceria|viveres)\b""")
private val RE_ZS_HOGAR = js("""\b(luz|agua|gas|internet|celular|plan|factura|recibo|arriendo)\b""")

private val RE_DESTINO_OCR = js(
    """(?:para|destino|hacia|enviado(?:\s+a)?)\s*:?\s*([a-zA-ZáéíóúÁÉÍÓÚñÑ]{2,20}(?:\s+[a-zA-ZáéíóúÁÉÍÓÚñÑ]{2,20}){0,5})""",
    "gi",
)
private val RE_CORTE_DESTINO_OCR =
    js("""\s+(?:celular|tel[eé]fono|cuenta|valor|fecha|referencia|nuevo\s+saldo)\b""", "i")
private val RUIDO_DESTINO_OCR = listOf(
    "nequi", "bancolombia", "daviplata", "comprobante", "movimiento", "envio", "realizado",
    "exitoso", "valor", "fecha", "cuenta", "verificar", "instante", "envio",
)
private val RE_HORA = js("""\b([01]?[0-9]|2[0-3]):([0-5][0-9])\b""")

private val CONJUNCIONES = setOf("y", "e", "mas", "más", "con", "propina", "de")
private val PALABRAS_ETIQUETA = listOf(
    "viaje", "regalo", "emergencia", "salud", "vacaciones", "fiesta", "prestamo", "comida",
    "transporte", "suscripcion",
)
private val ARTICULOS = listOf("el", "la", "los", "las", "un", "una", "unos", "unas")
private val PARADAS_BIGRAMA_CAT = setOf("en", "el", "la", "de", "del", "a", "los", "las", "un", "una")
private val PARADAS_BIGRAMA_DESC = setOf("en", "el", "la", "de", "del", "a", "los", "las", "un", "una", "con", "por")
private val RUIDO_SALUDOS = setOf(
    "hola", "como", "estas", "estás", "buenas", "buenos", "dias", "días", "tardes", "noches",
    "porfa", "porfavor", "por", "favor", "anota", "registra", "guarda", "pon", "pón", "escribe",
    "oye", "mira", "saludos", "holaa", "holaaa",
)

private data class Disponible(val token: Token, val index: Int) {
    val norm: String get() = token.norm
    val raw: String get() = token.raw
}

private data class PuntajeCategoria(val source: String, val score: Int)

/**
 * Interpreta una frase dictada o escrita.
 *
 * @param cuentas cuentas que el texto puede nombrar; opcional para que el
 *   intérprete siga siendo función pura de sus entradas.
 * @param categorias las categorías que creó el usuario: ganan sobre las de fábrica.
 * @param lexico lo aprendido del historial; gana sobre la lista genérica pero no
 *   sobre una categoría nombrada o una marca conocida.
 * @param transacciones historial para el Oráculo (montos de apuntes conocidos).
 * @param hoy fecha base para «ayer», «el lunes pasado», «el 5 de marzo».
 */
fun parseTransaction(
    raw: String,
    cuentas: List<CuentaConocida> = emptyList(),
    categorias: List<CategoriaPersonal> = emptyList(),
    lexico: LexicoAprendido = LEXICO_VACIO,
    transacciones: List<Transaccion> = emptyList(),
    hoy: LocalDate = hoyEnBogota(),
): ParsedTransaction {
    val tokens = tokenize(raw)
    val consumed = BooleanArray(tokens.size)
    val compraACuotasOCR = compraACuotasDesdeOCR(raw)
    val compraACuotasVoz = if (raw.startsWith("[OCR]")) null else cuotasDesdeVoz(tokens)
    for (indice in compraACuotasVoz?.indices ?: emptyList()) consumed[indice] = true

    // 1 — Monto. Se extrae PRIMERO y sus tokens salen de todo lo demás, así el
    // detector de categoría nunca ve `mil` y la descripción no repite el número.
    val candidates = findAmountCandidates(tokens).filter { candidato ->
        compraACuotasVoz?.indices?.any { it >= candidato.start && it < candidato.end } != true
    }

    // Fracciones dichas («la mitad de», «el doble de»).
    var fractionMultiplier = 1.0
    val rawLowerForMath = raw.lowercase()
    if (rawLowerForMath.contains("la mitad de") || rawLowerForMath.contains("mitad de")) {
        fractionMultiplier = 0.5
    } else if (rawLowerForMath.contains("un tercio de") || rawLowerForMath.contains("tercera parte de")) {
        fractionMultiplier = 1.0 / 3
    } else if (rawLowerForMath.contains("un cuarto de") || rawLowerForMath.contains("cuarta parte de")) {
        fractionMultiplier = 0.25
    } else if (rawLowerForMath.contains("el doble de")) {
        fractionMultiplier = 2.0
    } else if (rawLowerForMath.contains("el triple de")) {
        fractionMultiplier = 3.0
    }

    // Suma de montos unidos por conjunciones («20 mil y 3 mil»).
    var amount: Long? = null
    val best = pickBest(candidates)

    if (best != null) {
        val valid = candidates.filter { it.score >= 0 }.sortedBy { it.start }

        var bestChainTotal = 0L
        var bestChainIndices: MutableList<Int> = mutableListOf()
        var bestChainScore = Int.MIN_VALUE

        for (startIdx in valid.indices) {
            var chainTotal = valid[startIdx].value
            val chainIndices = mutableListOf<Int>()
            var chainMaxScore = valid[startIdx].score
            for (j in valid[startIdx].start until valid[startIdx].end) chainIndices.add(j)

            var curr = valid[startIdx]
            for (i in startIdx + 1 until valid.size) {
                val next = valid[i]
                if (next.start - curr.end <= 2) {
                    val middle = tokens.subList(curr.end, maxOf(curr.end, next.start)).map { it.norm }
                    if (middle.isEmpty() || middle.any { it in CONJUNCIONES }) {
                        chainTotal += next.value
                        chainMaxScore = maxOf(chainMaxScore, next.score)
                        for (j in curr.end until next.end) chainIndices.add(j)
                        curr = next
                    } else {
                        break
                    }
                } else {
                    break
                }
            }
            if (chainTotal > bestChainTotal) {
                bestChainTotal = chainTotal
                bestChainIndices = chainIndices
                bestChainScore = chainMaxScore
            }
        }

        if (bestChainTotal > best.value && bestChainScore >= best.score) {
            amount = Math.round(bestChainTotal * fractionMultiplier)
            for (idx in bestChainIndices) consumed[idx] = true
            // También los tokens del medio entre montos encadenados.
            var curr = valid.first { it.start == bestChainIndices[0] }
            for (i in valid.indexOf(curr) + 1 until valid.size) {
                val next = valid[i]
                if (bestChainIndices.contains(next.start)) {
                    for (j in curr.end until next.start) consumed[j] = true
                    curr = next
                }
            }
        } else {
            amount = Math.round(best.value * fractionMultiplier)
            for (i in best.start until best.end) consumed[i] = true
        }

        // Se consume la señal de monto anterior («por», «vale», «son»).
        val firstStart = if (bestChainTotal > best.value) bestChainIndices[0] else best.start
        if (firstStart > 0 && tokens[firstStart - 1].norm in AMOUNT_CUES) {
            consumed[firstStart - 1] = true
        }
    }

    // Una compra a cuotas presenta dos precios. El total es el costo de la
    // compra; la cuota solo explica cómo se pagará.
    if (compraACuotasOCR != null) amount = compraACuotasOCR.totalCop

    fun available(): List<Disponible> =
        tokens.mapIndexedNotNull { index, t -> if (consumed[index]) null else Disponible(t, index) }

    // 2 — Dirección. La frase más larga primero, para que «me costó» (gasto)
    // nunca se confunda con el sentido de ingreso de un «me» inicial.
    var kind = "gasto"
    var kindSource = "default"

    // Todas las frases de dirección, para quitar las redundantes.
    data class CoincidenciaTipo(val kind: String, val startIndex: Int, val endIndex: Int)
    val kindMatches = mutableListOf<CoincidenciaTipo>()

    run {
        var i = 0
        while (i < tokens.size) {
            for (phrase in KIND_PHRASES) {
                val span = phrase.seq.size
                if (i + span <= tokens.size) {
                    if (phrase.seq.withIndex().all { (k, s) -> tokens[i + k].norm == s }) {
                        kindMatches.add(CoincidenciaTipo(phrase.kind, i, i + span))
                        i += span - 1
                        break
                    }
                }
            }
            i += 1
        }
    }

    if (kindMatches.isNotEmpty()) {
        kind = kindMatches[0].kind
        kindSource = "keyword"

        // La PRIMERA frase se queda en la descripción (para que arranque natural:
        // «Me compré…»), pero las redundantes siguientes («pagué», «me costó») se consumen.
        for (m in 1 until kindMatches.size) {
            for (k in kindMatches[m].startIndex until kindMatches[m].endIndex) consumed[k] = true
        }
    }

    if (raw.startsWith("[OCR]")) {
        val ocrNormalizado = normalizarTextoOCR(raw)
        val esIngresoEnComprobante = RE_COMPROBANTE_INGRESO.containsMatchIn(ocrNormalizado)
        val esEgresoEnComprobante = RE_COMPROBANTE_EGRESO.containsMatchIn(ocrNormalizado)
        if (esIngresoEnComprobante || esEgresoEnComprobante) {
            kind = if (esIngresoEnComprobante) "ingreso" else "gasto"
            // La dirección impresa en el comprobante manda sobre una palabra
            // suelta que Tesseract haya confundido con un verbo de voz.
            kindSource = "keyword"
        }
    }

    if (kindSource == "default") {
        // Generaliza más allá de la tabla: el dictado produce conjugaciones que
        // nadie enumeró. Solo se infiere el ingreso; los verbos de gasto en
        // -aron («me cobraron») están en KIND_PHRASES justo para ganar antes.
        val list = available()
        for (i in 0 until list.size - 1) {
            if (list[i].norm == "me" && MORPHOLOGICAL_INCOME.containsMatchIn(list[i + 1].norm)) {
                kind = "ingreso"
                kindSource = "morphology"
                break
            }
        }
    }

    if (kindSource == "default") {
        // «el salario de este mes» no necesita verbo de dirección.
        if (available().any { it.norm in INCOME_IMPLIED }) {
            kind = "ingreso"
            kindSource = "category-implied"
        }
    }

    // 4 — Cuenta. Sus tokens SÍ se consumen: con el banco como campo propio,
    // repetirlo en la descripción dice lo mismo dos veces.
    val hallada = buscarCuenta(tokens, consumed, cuentas)
    if (hallada != null) {
        for (i in hallada.start until hallada.end) consumed[i] = true
    }
    var cuentaId: String? = hallada?.id
    var cuentaSource = hallada?.source ?: "ninguna"

    // 5 — Método de pago. Se consume para que «en efectivo» no quede en la descripción.
    val paymentMethod = detectAndConsumePaymentMethod(tokens, consumed)

    // Fechas relativas. Se recorre todo: si hay varias menciones gana la última.
    var dateOverride: String? = null
    val normas = tokens.map { it.norm }
    for (i in tokens.indices) {
        if (consumed[i]) continue
        val norm = tokens[i].norm
        var d: LocalDate? = null
        var consumedIdx: List<Int> = emptyList()

        // 1. Días relativos simples.
        if (norm == "ayer" || norm == "anoche") {
            d = hoy.minusDays(1)
            consumedIdx = listOf(i)
        } else if (norm == "anteayer" || norm == "antier") {
            d = hoy.minusDays(2)
            consumedIdx = listOf(i)
        } else if (norm == "hoy") {
            d = hoy
            consumedIdx = listOf(i)
        }

        // 2. «hace X días». La tercera variante trae un guion suave invisible
        // en la web y nunca calza; se conserva por fidelidad.
        if (d == null && norm == "hace" && i + 2 < tokens.size &&
            (tokens[i + 2].norm == "dias" || tokens[i + 2].norm == "dia" || tokens[i + 2].norm == "dí­as")
        ) {
            val match = readNumberAt(normas, i + 1)
            if (match != null && match.value > 0) {
                d = hoy.minusDays(match.value)
                consumedIdx = listOf(i, i + 1, match.next)
            }
        }

        // 3. «el [lunes] pasado».
        if (d == null && norm == "el" && i + 2 < tokens.size && tokens[i + 2].norm == "pasado") {
            val targetDay = DIAS_SEMANA[tokens[i + 1].norm]
            if (targetDay != null) {
                var f = hoy.minusDays(1) // Se empieza a buscar desde ayer.
                while (f.dayOfWeek.value % 7 != targetDay) f = f.minusDays(1)
                d = f
                consumedIdx = listOf(i, i + 1, i + 2)
            }
        }

        // 4. «el [número] de [mes]».
        if (d == null && norm == "el" && i + 3 < tokens.size && tokens[i + 2].norm == "de") {
            val match = readNumberAt(normas, i + 1)
            if (match != null && match.value in 1..31) {
                val mesIdx = match.next + 1
                if (mesIdx < tokens.size) {
                    val mesNum = MESES_ANO[tokens[mesIdx].norm]
                    if (mesNum != null) {
                        var f = fechaDesbordada(hoy.year, mesNum, match.value.toInt())
                        // Una fecha futura casi seguro fue del año pasado.
                        if (f.isAfter(hoy)) f = fechaDesbordada(f.year - 1, f.monthValue - 1, f.dayOfMonth)
                        d = f
                        consumedIdx = listOf(i, i + 1, match.next, mesIdx)
                    }
                }
            }
        }

        if (d != null) {
            dateOverride = d.toString()
            for (idx in consumedIdx) consumed[idx] = true
        }
    }

    // Cuenta implícita por método de pago.
    if (cuentaId == null) {
        if (paymentMethod == "efectivo") {
            val efectivoAcc = cuentas.firstOrNull {
                it.nombre.lowercase().contains("efectivo") || it.nombre.lowercase().contains("billetera")
            }
            if (efectivoAcc != null) {
                cuentaId = efectivoAcc.id
                cuentaSource = "nombre"
            }
        } else if (paymentMethod == "tarjeta_credito" || paymentMethod == "tarjeta_debito") {
            val tarjetaAcc = cuentas.firstOrNull {
                it.nombre.lowercase().contains("tarjeta") || it.nombre.lowercase().contains("credito")
            }
            if (tarjetaAcc != null) {
                cuentaId = tarjetaAcc.id
                cuentaSource = "nombre"
            }
        }
    }

    // 3 — Categoría. Solo igualdad de token, nunca subcadena: `ara` está en
    // «para», `mil` en «familia», `d1` en «d10», `uno` en «desayuno».
    var category = "otros"
    var categorySource = "default"
    val categoryCandidates = LinkedHashMap<String, PuntajeCategoria>()

    fun addCategoryScore(cat: String, source: String, score: Int) {
        val existing = categoryCandidates[cat]
        if (existing == null || existing.score < score) categoryCandidates[cat] = PuntajeCategoria(source, score)
    }

    // 3a — Las categorías del usuario, por nombre. Van PRIMERO y sus tokens no
    // se consumen: para una categoría «Mascotas», «mascotas» es justo lo que la
    // fila debe decir.
    val frasesCat = frasesDeCategorias(categorias)
    val dispon = available()

    for (frase in frasesCat) {
        val span = frase.seq.size
        var i = 0
        while (i + span <= dispon.size) {
            val calza = frase.seq.withIndex().all { (k, s) ->
                val t = dispon[i + k].norm
                t == s || t + "s" == s || s + "s" == t || t + "es" == s || s + "es" == t
            }
            if (calza) addCategoryScore(frase.id, "usuario", 100)
            i += 1
        }
    }

    for (i in dispon.indices) {
        val token = dispon[i]

        // Bigramas de marcas («cruz verde» -> «cruzverde»).
        if (i < dispon.size - 1) {
            if (token.norm !in PARADAS_BIGRAMA_CAT && dispon[i + 1].norm !in PARADAS_BIGRAMA_CAT) {
                val bigramMerchant = MERCHANTS[token.norm + dispon[i + 1].norm]
                if (bigramMerchant != null) addCategoryScore(bigramMerchant, "merchant", 85)
            }
        }

        val merchant = MERCHANTS[token.norm]
        if (merchant != null) {
            // Billeteras y bancos (Nequi, Bancolombia) son medio de pago: puntaje
            // bajo para que una palabra de gasto explícita gane.
            addCategoryScore(merchant, "merchant", if (merchant == "transferencia") 25 else 80)
        } else if (token.norm.length > 5) {
            val similar = buscarSimilar(token.norm, MERCHANTS.keys, 2)
            if (similar != null && Math.abs(similar.length - token.norm.length) <= 1 && similar.length > 4) {
                val target = MERCHANTS.getValue(similar)
                addCategoryScore(target, "merchant", if (target == "transferencia") 20 else 70)
            }
        }

        val aprendida = lexico.categoriaDe(token.norm)
        if (!aprendida.isNullOrEmpty()) addCategoryScore(aprendida, "aprendida", 60)

        val keyword = lookupWithStem(CATEGORY_KEYWORDS, token.norm)
        if (keyword != null) {
            addCategoryScore(keyword, "keyword", 50)
        } else if (token.norm.length > 5) {
            val similar = buscarSimilar(token.norm, CATEGORY_KEYWORDS.keys, 2)
            if (similar != null && Math.abs(similar.length - token.norm.length) <= 1 && similar.length > 4) {
                val keywordSimilar = lookupWithStem(CATEGORY_KEYWORDS, similar)
                if (keywordSimilar != null) addCategoryScore(keywordSimilar, "keyword", 40)
            }
        }
    }

    val sortedCandidates = categoryCandidates.entries.map { it.key to it.value }
        .sortedByDescending { it.second.score }

    if (sortedCandidates.isNotEmpty()) {
        category = sortedCandidates[0].first
        categorySource = sortedCandidates[0].second.source
    }

    // Nequi y otras billeteras imprimen «pago» y «envío» en la misma plantilla.
    // Eso describe el canal, no una compra: el comprobante abre como
    // transferencia y la persona lo cambia si hace falta.
    if (raw.startsWith("[OCR]") && RE_COMPROBANTE_CANAL.containsMatchIn(normalizarTextoOCR(raw))) {
        category = if (kind == "ingreso") "ingreso" else "transferencia"
        categorySource = "keyword"
    }

    // El total y las cuotas pueden consumir tokens cercanos al comercio. Con un
    // comprobante de tarjeta se usa el comercio ya aislado como segunda fuente.
    if (category == "otros" && !compraACuotasOCR?.comercio.isNullOrEmpty()) {
        val categoriaComercio = normalizeWord(compraACuotasOCR.comercio)
            .split(RE_SEPARADOR_COMERCIO)
            .filter { it.isNotEmpty() }
            .firstNotNullOfOrNull { MERCHANTS[it] }
        if (categoriaComercio != null) {
            category = categoriaComercio
            categorySource = "merchant"
            addCategoryScore(categoriaComercio, "merchant", 80)
        }
    }

    if (categorySource == "default" && kind == "ingreso") {
        category = "ingreso"
        addCategoryScore("ingreso", "default", 10)
    } else if (categorySource == "default" && kind == "gasto") {
        // Respaldo de palabras sueltas sobre el texto crudo. Ojo: 'ocio' y
        // 'compras' no son categorías de fábrica; la web los produce igual.
        val textNorm = raw.lowercase()
        val respaldo = when {
            RE_ZS_COMIDA.containsMatchIn(textNorm) -> "comida"
            RE_ZS_TRANSPORTE.containsMatchIn(textNorm) -> "transporte"
            RE_ZS_OCIO.containsMatchIn(textNorm) -> "ocio"
            RE_ZS_SALUD.containsMatchIn(textNorm) -> "salud"
            RE_ZS_COMPRAS.containsMatchIn(textNorm) -> "compras"
            RE_ZS_MERCADO.containsMatchIn(textNorm) -> "mercado"
            RE_ZS_HOGAR.containsMatchIn(textNorm) -> "hogar"
            else -> null
        }
        if (respaldo != null) {
            category = respaldo
            categorySource = "keyword"
        }
    }

    // 6 — Fragmentos semánticos: destinatario, ubicación y motivo.
    var destinatario: String? = null
    var ubicacion: String? = null
    val tags = mutableListOf<String>()

    val isOCR = raw.startsWith("[OCR]")

    if (!isOCR) {
        var currentChunk = "motivo"
        val chunkDestinatario = mutableListOf<Disponible>()
        val chunkUbicacion = mutableListOf<Disponible>()
        val avail = available()
        for (i in avail.indices) {
            val t = avail[i]
            val n = t.norm
            val nextToken = if (i + 1 < avail.size) avail[i + 1].norm else ""

            if (n == "a" || n == "hacia") { currentChunk = "destinatario"; continue }
            if (n == "para") {
                currentChunk = if (nextToken in ARTICULOS) "motivo" else "destinatario"
                continue
            }
            if (n == "en" || n == "desde") { currentChunk = "ubicacion"; continue }
            if (n == "por" || n == "concepto") { currentChunk = "motivo"; continue }
            if (n == "con") { currentChunk = "motivo"; continue }

            if (n in PALABRAS_ETIQUETA && !tags.contains(t.raw)) tags.add(t.raw)

            when (currentChunk) {
                "destinatario" -> chunkDestinatario.add(t)
                "ubicacion" -> chunkUbicacion.add(t)
            }
        }

        if (chunkDestinatario.isNotEmpty()) destinatario = capitalizarJs(chunkDestinatario.joinToString(" ") { it.raw })
        if (chunkUbicacion.isNotEmpty()) ubicacion = capitalizarJs(chunkUbicacion.joinToString(" ") { it.raw })
    } else {
        // Destinatario propio de comprobantes OCR.
        for (destMatch in RE_DESTINO_OCR.findAll(raw)) {
            val grupo = destMatch.groupValues[1]
            if (grupo.isEmpty()) continue
            val candidateDest = grupo.split(RE_CORTE_DESTINO_OCR)[0].trimJs()
            val lowerDest = sinTildes(candidateDest.lowercase())
            val palabrasDestino = lowerDest.split(RE_ESPACIOS)
            if (palabrasDestino.none { it in RUIDO_DESTINO_OCR }) {
                destinatario = capitalizarJs(candidateDest)
                break
            }
        }
    }

    // 6 — Descripción (la frase conversacional completa, ya limpia).
    var description: String

    if (isOCR) {
        val catLabel = ETIQUETAS_CATEGORIA[category] ?: if (category == "ingreso") "Ingreso" else "Transferencia"
        val comercio = compraACuotasOCR?.comercio
        description = if (!comercio.isNullOrEmpty()) comercio else limpiarOCRDescripcion(raw, catLabel, destinatario)
    } else {
        val availTokens = tokens.withIndex().filter { (i, t) ->
            !consumed[i] && sinTildes(t.norm.lowercase()) !in RUIDO_SALUDOS
        }.map { it.value }

        val words = mutableListOf<String>()
        var k = 0
        while (k < availTokens.size) {
            val curr = availTokens[k]
            if (k + 1 < availTokens.size) {
                val next = availTokens[k + 1]
                if (curr.norm !in PARADAS_BIGRAMA_DESC || next.norm !in PARADAS_BIGRAMA_DESC) {
                    val bigrama = MERCHANT_DISPLAY[curr.norm + next.norm]
                    if (!bigrama.isNullOrEmpty()) {
                        words.add(bigrama)
                        k += 2
                        continue
                    }
                }
            }
            words.add(MERCHANT_DISPLAY[curr.norm] ?: curr.raw)
            k += 1
        }

        val limpia = words.joinToString(" ").trimJs()
        val limpiaLower = sinTildes(limpia.lowercase())
        description = if (limpia == "" || limpiaLower in RUIDO_SALUDOS || limpiaLower == "hola como estas") {
            ETIQUETAS_CATEGORIA[category] ?: category
        } else {
            capitalizarJs(limpia)
        }

        description = limpiarDescripcionFinanciera(description)
        if (description.trimJs().isEmpty()) description = ETIQUETAS_CATEGORIA[category] ?: category
    }

    val timeMatch = RE_HORA.find(raw)
    // En el recibo de tarjeta el comercio ya está aislado; pegarle la hora del
    // encabezado ensuciaría justo la descripción recién limpiada.
    if (timeMatch != null && compraACuotasOCR == null && !description.contains(timeMatch.value)) {
        description += " (${timeMatch.value})"
    }

    // 6 — Confianza. Solo decide la PRESENTACIÓN: la hoja de confirmación
    // siempre abre, y esto elige qué campo resaltar y enfocar.
    var confidence = 0.0
    if (amount != null) confidence += Pesos.AMOUNT
    if (kindSource == "keyword" || kindSource == "morphology") confidence += Pesos.KIND_KEYWORD
    else if (kindSource == "category-implied") confidence += Pesos.KIND_IMPLIED
    when (categorySource) {
        "usuario" -> confidence += Pesos.USER_CATEGORY
        "merchant" -> confidence += Pesos.MERCHANT
        "aprendida" -> confidence += Pesos.LEARNED
        "keyword" -> confidence += Pesos.CATEGORY_KEYWORD
    }

    val ambiguousAmount = candidates.size > 1
    if (ambiguousAmount) confidence -= Pesos.AMBIGUITY_PENALTY
    confidence = maxOf(0.0, minOf(1.0, aDosDecimales(confidence)))

    val confianzaGranular = calcularConfianzaGranular(
        amount,
        kindSource != "default",
        categorySource,
        cuentaId != null,
        paymentMethod != "desconocido",
    )

    // El Oráculo: memoria de gastos conocidos cuando el dictado no trae cifra.
    if (amount == null && description.trimJs().length >= MINIMO_ORACULO && transacciones.isNotEmpty()) {
        val descLower = description.lowercase()
        // Del más nuevo al más viejo.
        for (i in transacciones.indices.reversed()) {
            val t = transacciones[i]
            if (mencionaEntera(t.description, descLower) || mencionaEntera(descLower, t.description)) {
                amount = t.amountCop
                if (category == "otros" || categorySource == "default") {
                    category = t.category
                    categorySource = "aprendida"
                }
                if (cuentaId == null) {
                    cuentaId = t.cuentaId
                    cuentaSource = "nombre"
                }
                confidence += 0.4
                confidence = maxOf(0.0, minOf(1.0, aDosDecimales(confidence)))
                break
            }
        }
    }

    // Etiquetas automáticas por contexto.
    val rawLower = raw.lowercase()
    if (rawLower.contains("viaje") || rawLower.contains("vacaciones") || rawLower.contains("vuelo") || rawLower.contains("hotel")) tags.add("viaje")
    if (rawLower.contains("cumpleaños") || rawLower.contains("regalo") || rawLower.contains("sorpresa")) tags.add("regalo")
    if (rawLower.contains("fiesta") || rawLower.contains("rumba") || rawLower.contains("salida")) tags.add("fiesta")
    if (rawLower.contains("multa") || rawLower.contains("infraccion") || rawLower.contains("intereses")) tags.add("multa")
    if (rawLower.contains("domicilio") || rawLower.contains("delivery") || rawLower.contains("rappi")) tags.add("domicilio")

    val suggestedCategories = (
        listOf(category) +
            sortedCandidates.filter { it.first != category }.map { it.first } +
            listOf("otros", "comida", "transporte")
        ).distinct().take(3)

    return ParsedTransaction(
        kind = kind,
        amount = amount,
        category = category,
        dateOverride = dateOverride,
        cuotasTotal = compraACuotasOCR?.cuotas ?: compraACuotasVoz?.cuotas,
        cuotaCop = compraACuotasOCR?.cuotaCop
            ?: if (compraACuotasVoz != null && amount != null) {
                Math.round(amount.toDouble() / compraACuotasVoz.cuotas)
            } else {
                null
            },
        suggestedCategories = suggestedCategories,
        cuentaId = cuentaId,
        description = description,
        raw = raw,
        confidence = confidence,
        confianzaGranular = confianzaGranular,
        needsReview = amount == null || kindSource == "default" || confidence < REVIEW_THRESHOLD,
        signals = Senales(
            amountSource = when {
                compraACuotasOCR != null -> AmountSource.DIGITS
                best != null -> classifyAmountSource(best)
                else -> AmountSource.NONE
            },
            kindSource = kindSource,
            categorySource = categorySource,
            cuentaSource = cuentaSource,
            paymentMethod = paymentMethod,
            recurringPattern = detectarRecurrencia(raw).patron,
            ambiguousAmount = if (compraACuotasOCR != null || compraACuotasVoz != null) false else ambiguousAmount,
            destinatario = destinatario,
            ubicacion = ubicacion,
            tags = tags,
        ),
    )
}

/**
 * Un movimiento vacío para llenar a mano. La misma forma que devuelve el
 * intérprete, así la hoja de confirmación no distingue «dictado» de «escrito».
 */
fun movimientoEnBlanco(): ParsedTransaction = ParsedTransaction(
    kind = "gasto",
    amount = null,
    category = "otros",
    cuentaId = null,
    description = "",
    raw = "",
    dateOverride = null,
    confidence = 0.0,
    confianzaGranular = ConfianzaGranular(0.0, 0.0, 0.0, 0.0, 0.0),
    needsReview = true,
    signals = Senales(
        amountSource = AmountSource.NONE,
        kindSource = "default",
        categorySource = "default",
        cuentaSource = "ninguna",
        paymentMethod = "desconocido",
        recurringPattern = "ninguno",
        ambiguousAmount = false,
        destinatario = null,
        ubicacion = null,
        tags = emptyList(),
    ),
    suggestedCategories = listOf("otros", "comida", "transporte"),
)
