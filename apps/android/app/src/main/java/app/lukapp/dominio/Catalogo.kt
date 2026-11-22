package app.lukapp.dominio

import java.text.Collator
import java.text.Normalizer
import java.util.Locale
import kotlin.random.Random

/** Origen: `types.ts` (`CATEGORIES`). El orden es el de los selectores y desempates. */
val CATEGORIES: List<String> = listOf(
    "mercado", "comida", "transporte", "servicios", "salud", "hogar", "entretenimiento",
    "ropa", "educacion", "transferencia", "ahorro", "ingreso", "otros",
)

/** Origen: `types.ts` (`CATEGORY_LABELS`). */
val CATEGORY_LABELS: Map<String, String> = mapOf(
    "mercado" to "Mercado", "comida" to "Comida", "transporte" to "Transporte", "servicios" to "Servicios",
    "salud" to "Salud", "hogar" to "Hogar", "entretenimiento" to "Entretenimiento", "ropa" to "Ropa",
    "educacion" to "Educación", "transferencia" to "Transferencia", "ahorro" to "Ahorro",
    "ingreso" to "Ingreso", "otros" to "Otros",
)

/**
 * Origen: `categorias.ts` (`CATEGORY_ICON`). Nombre del ícono lucide: el ícono es el
 * segundo canal de significado, para que el color nunca sea el único.
 */
val CATEGORY_ICON: Map<String, String> = mapOf(
    "mercado" to "ShoppingCart", "comida" to "Utensils", "transporte" to "Bus", "servicios" to "Lightbulb",
    "salud" to "Pill", "hogar" to "Home", "entretenimiento" to "Film", "ropa" to "Shirt", "educacion" to "Book",
    "transferencia" to "RefreshCw", "ahorro" to "PiggyBank", "ingreso" to "DollarSign", "otros" to "Package",
)

/** Origen: `categorias.ts` (`CATEGORY_COLOR`). Tonos elegidos para que barras vecinas no se confundan. */
val CATEGORY_COLOR: Map<String, String> = mapOf(
    "mercado" to "#F59E0B", "comida" to "#F97316", "transporte" to "#38BDF8", "servicios" to "#A78BFA",
    "salud" to "#EC4899", "hogar" to "#14B8A6", "entretenimiento" to "#C084FC", "ropa" to "#6366F1",
    "educacion" to "#3B82F6", "transferencia" to "#94A3B8", "ahorro" to "#10B981", "ingreso" to "#22C55E",
    "otros" to "#A8A29E",
)

/** Origen: `categorias.ts` (`tint`). `#RRGGBB` + alfa → `rgb(r g b / a)`. */
fun tint(hex: String, alfa: Double): String {
    val r = hex.substring(1, 3).toInt(16)
    val g = hex.substring(3, 5).toInt(16)
    val b = hex.substring(5, 7).toInt(16)
    val a = if (alfa == Math.floor(alfa) && !alfa.isInfinite()) alfa.toLong().toString() else alfa.toString()
    return "rgb($r $g $b / $a)"
}

/** Origen: `categorias.ts` (`ICONOS_CATEGORIA`). Íconos ofrecidos al crear una categoría, en orden. */
val ICONOS_CATEGORIA: List<String> = listOf(
    "ShoppingCart", "Utensils", "Coffee", "Bus", "Lightbulb", "Pill", "Home", "Film", "Gamepad2", "Shirt",
    "Book", "RefreshCw", "PiggyBank", "DollarSign", "Package", "Dumbbell", "PawPrint", "Cat", "Baby", "Gift",
    "Plane", "Smartphone", "Scissors", "Wrench", "Sparkles",
)

/** Origen: `categorias.ts` (`iconoDeCategoria`). Un ícono guardado que ya no existe cae en `Package`. */
fun iconoDeCategoria(nombre: String?): String =
    if (!nombre.isNullOrEmpty() && nombre in ICONOS_CATEGORIA) nombre else "Package"

private class Pista(val resultado: String, val palabras: List<String>)

// Un match de palabras y no un modelo: el catálogo es fijo y esto responde al tecleo sin red.
private val PISTAS_ICONO = listOf(
    Pista("ShoppingCart", listOf("mercado", "super", "supermercado", "compras")),
    Pista("Utensils", listOf("comida", "restaurante", "almuerzo", "cena", "domicilio", "comer")),
    Pista("Coffee", listOf("cafe", "café", "snack", "onces", "desayuno")),
    Pista("Bus", listOf("transporte", "bus", "taxi", "uber", "gasolina", "carro", "metro", "parqueadero")),
    Pista("Lightbulb", listOf("servicios", "luz", "agua", "gas", "internet", "recibo", "energia", "energía")),
    Pista("Smartphone", listOf("celular", "telefono", "teléfono", "plan", "datos", "streaming", "suscripcion", "suscripción")),
    Pista("Pill", listOf("salud", "medico", "médico", "medicina", "droguer", "eps", "doctor", "clinica", "clínica")),
    Pista("Dumbbell", listOf("gimnasio", "gym", "ejercicio", "deporte")),
    Pista("Home", listOf("hogar", "casa", "arriendo", "alquiler", "administracion", "administración")),
    Pista("Film", listOf("entretenimiento", "cine", "pelicula", "película", "salida", "rumba", "fiesta")),
    Pista("Gamepad2", listOf("juego", "videojuego", "gaming")),
    Pista("Shirt", listOf("ropa", "zapatos", "vestido", "moda")),
    Pista("Scissors", listOf("peluqueria", "peluquería", "belleza", "estetica", "estética", "manicure", "barberia", "barbería")),
    Pista("Book", listOf("educacion", "educación", "colegio", "universidad", "curso", "libro", "matricula", "matrícula")),
    Pista("RefreshCw", listOf("transferencia", "traslado", "giro")),
    Pista("PiggyBank", listOf("ahorro", "ahorros")),
    Pista("DollarSign", listOf("ingreso", "sueldo", "salario", "pago", "nomina", "nómina")),
    Pista("PawPrint", listOf("mascota", "perro", "veterinaria")),
    Pista("Cat", listOf("gato")),
    Pista("Baby", listOf("bebe", "bebé", "hijo", "hija", "pañal", "panal")),
    Pista("Gift", listOf("regalo", "cumpleanos", "cumpleaños", "navidad")),
    Pista("Plane", listOf("viaje", "vuelo", "vacaciones", "tiquete")),
    Pista("Wrench", listOf("reparacion", "reparación", "mantenimiento", "arreglo", "ferreteria", "ferretería")),
)

private val MARCAS_CATEGORIA = Regex("[̀-ͯ]")

// Esta versión de la web no recorta espacios (la de modelos.ts sí).
private fun sinTildesCategoria(texto: String): String =
    MARCAS_CATEGORIA.replace(Normalizer.normalize(texto, Normalizer.Form.NFD), "").lowercase(Locale.ROOT)

/** Origen: `categorias.ts` (`CATEGORIA_EMOJI_BASE`). */
val CATEGORIA_EMOJI_BASE: Map<String, String> = mapOf(
    "mercado" to "🥑", "comida" to "🍔", "transporte" to "🚗", "servicios" to "💡", "salud" to "💊",
    "hogar" to "🏠", "entretenimiento" to "💎", "ropa" to "👕", "educacion" to "📚", "transferencia" to "🔄",
    "ahorro" to "🐷", "ingreso" to "💰", "otros" to "📦",
)

// El orden importa: «comida para el perro» debe dar 🐶 antes que 🍔.
private val PISTAS_EMOJI = listOf(
    Pista("🐶", listOf("comida para el perro", "comida de perro", "comida para perro", "comida perro", "perro", "perros", "perrito", "canino", "purina", "dog chow", "pedigree", "chunky", "agrocampo")),
    Pista("🐱", listOf("gato", "gatos", "gatito", "michi", "comida para gato", "comida de gato", "whiskas", "felino")),
    Pista("🐾", listOf("mascota", "mascotas", "veterinaria", "veterinario", "concentrado", "croquetas", "cat", "pet shop", "petys", "arenas")),
    Pista("🥑", listOf("mercado", "super", "supermercado", "compras", "fruta", "verdura", "carulla", "exito", "jumbo")),
    Pista("🍕", listOf("pizza", "pizzas")),
    Pista("☕", listOf("cafe", "café", "snack", "onces", "desayuno", "panaderia", "panadería", "mecato", "snacks")),
    Pista("🍺", listOf("cerveza", "trago", "licor", "bar", "polas", "cervezas", "ron", "whisky")),
    Pista("🍔", listOf("comida", "restaurante", "almuerzo", "cena", "domicilio", "comer", "hamburguesa", "comidas")),
    Pista("🚗", listOf("transporte", "bus", "taxi", "uber", "gasolina", "carro", "metro", "parqueadero", "peaje", "didi", "indrive", "gas")),
    Pista("💡", listOf("servicios", "luz", "agua", "gas", "internet", "recibo", "energia", "energía", "epm", "enel", "acueducto")),
    Pista("📱", listOf("celular", "telefono", "teléfono", "plan", "datos", "streaming", "suscripcion", "suscripción", "netflix", "spotify", "apple", "google", "digital", "trabajo digital")),
    Pista("💊", listOf("salud", "medico", "médico", "medicina", "droguer", "eps", "doctor", "clinica", "clínica", "farmacia", "pastillas")),
    Pista("🏋️", listOf("gimnasio", "gym", "ejercicio", "deporte", "fitness", "crossfit", "smartfit")),
    Pista("🏠", listOf("hogar", "casa", "arriendo", "alquiler", "administracion", "administración", "muebles", "decoracion")),
    Pista("💎", listOf("entretenimiento", "cine", "pelicula", "película", "salida", "rumba", "fiesta", "ocio", "diversion", "disco")),
    Pista("🎮", listOf("juego", "videojuego", "gaming", "playstation", "xbox", "nintendo", "steam")),
    Pista("👕", listOf("ropa", "zapatos", "vestido", "moda", "calzado", "chaqueta", "pantalon", "zara", "h&m")),
    Pista("✂️", listOf("peluqueria", "peluquería", "belleza", "estetica", "estética", "manicure", "barberia", "barbería", "corte")),
    Pista("📚", listOf("educacion", "educación", "colegio", "universidad", "curso", "libro", "matricula", "matrícula", "estudio", "cursos")),
    Pista("🔄", listOf("transferencia", "traslado", "giro")),
    Pista("🐷", listOf("ahorro", "ahorros", "alcancia", "inversion", "inversión")),
    Pista("💰", listOf("ingreso", "sueldo", "salario", "pago", "nomina", "nómina", "trabajo", "honorarios", "trabajos")),
    Pista("👶", listOf("bebe", "bebé", "hijo", "hija", "pañal", "panal", "guarderia")),
    Pista("🎁", listOf("regalo", "cumpleanos", "cumpleaños", "navidad", "detalle")),
    Pista("✈️", listOf("viaje", "vuelo", "vacaciones", "tiquete", "hotel", "turismo", "playa", "viajes")),
    Pista("🔧", listOf("reparacion", "reparación", "mantenimiento", "arreglo", "ferreteria", "ferretería")),
)

/** Origen: `categorias.ts` (`EMOJIS_POPULARES_CATEGORIA`). */
val EMOJIS_POPULARES_CATEGORIA: List<String> = listOf(
    "🥑", "🍔", "🍕", "☕", "🍷", "🍺", "🚗", "✈️", "💡", "📱",
    "💊", "🏠", "💎", "👕", "📚", "🐾", "💰", "🎁", "🏋️", "🎬",
    "🎮", "🛒", "✂️", "🔧", "👶", "🏖️", "📦", "🏷️", "💵", "💳",
    "🥐", "🥪", "🍜", "🍣", "🎂", "🚲", "⚡", "🩺", "🎓", "🐶",
)

private fun sugerir(nombre: String, pistas: List<Pista>, porDefecto: String): String {
    val texto = sinTildesCategoria(nombre.trim())
    if (texto.isEmpty()) return porDefecto
    return pistas.firstOrNull { p -> p.palabras.any { texto.contains(sinTildesCategoria(it)) } }?.resultado ?: porDefecto
}

/** Origen: `categorias.ts` (`sugerirEmojiCategoria`). `🏷️` si nada calza. */
fun sugerirEmojiCategoria(nombre: String): String = sugerir(nombre, PISTAS_EMOJI, "🏷️")

/** Origen: `categorias.ts` (`sugerirIconoCategoria`). `Package` si nada calza. */
fun sugerirIconoCategoria(nombre: String): String = sugerir(nombre, PISTAS_ICONO, "Package")

/** Origen: `categorias.ts` (`COLORES_CATEGORIA`). Los mismos tonos de las básicas, para que una propia no desentone. */
val COLORES_CATEGORIA: List<String> = listOf(
    "#F59E0B", "#F97316", "#EF4444", "#EC4899", "#C084FC", "#A78BFA",
    "#6366F1", "#3B82F6", "#38BDF8", "#14B8A6", "#10B981", "#84CC16",
)

/** Origen: `categorias.ts` (`EntradaCategoria`). `icono` es el nombre lucide. */
data class EntradaCategoria(
    val clave: String,
    val nombre: String,
    val icono: String,
    val emoji: String,
    val color: String,
    val propia: Boolean,
    val archivada: Boolean,
)

private fun deBase(c: String) = EntradaCategoria(
    clave = c,
    nombre = CATEGORY_LABELS.getValue(c),
    icono = CATEGORY_ICON.getValue(c),
    emoji = CATEGORIA_EMOJI_BASE[c] ?: "🏷️",
    color = CATEGORY_COLOR.getValue(c),
    propia = false,
    archivada = false,
)

private fun dePersonal(c: CategoriaPersonal) = EntradaCategoria(
    clave = c.id,
    nombre = c.nombre,
    icono = iconoDeCategoria(c.icon),
    emoji = c.emoji?.takeIf { it.isNotEmpty() } ?: sugerirEmojiCategoria(c.nombre),
    color = c.color,
    propia = true,
    archivada = c.archivedAt != null,
)

// Una clave borrada o de una versión vieja se degrada a «Otros» conservando la
// clave: el movimiento sigue contando, agrupando y se puede reclasificar.
private fun desconocida(clave: String) = deBase("otros").copy(clave = clave, emoji = "🏷️")

/**
 * Origen: `categorias.ts` (`Catalogo` / `hacerCatalogo`). `lista` = básicas + propias
 * activas (para selectores); `todas` incluye archivadas; `de` siempre responde.
 */
class Catalogo(val lista: List<EntradaCategoria>, val todas: List<EntradaCategoria>) {
    private val porClave = todas.associateBy { it.clave }

    fun de(clave: String): EntradaCategoria = porClave[clave] ?: desconocida(clave)
}

/** Origen: `categorias.ts` (`hacerCatalogo`). Propias ordenadas por nombre con reglas del español. */
fun hacerCatalogo(personales: List<CategoriaPersonal> = emptyList()): Catalogo {
    val base = CATEGORIES.map(::deBase)
    val colador = Collator.getInstance(Locale.forLanguageTag("es"))
    val propias = personales.sortedWith { a, b -> colador.compare(a.nombre, b.nombre) }.map(::dePersonal)
    return Catalogo(lista = base + propias.filter { !it.archivada }, todas = base + propias)
}

/** Origen: `categorias.ts` (`CATALOGO_BASE`). */
val CATALOGO_BASE: Catalogo by lazy { hacerCatalogo(emptyList()) }

private var contadorClave = 0

/**
 * Origen: `categorias.ts` (`nuevaClaveCategoria`). `p-<ms base36>-<contador>-<6 al azar>`;
 * el prefijo impide chocar con una básica presente o futura.
 */
@Synchronized
fun nuevaClaveCategoria(): String {
    contadorClave = (contadorClave + 1) % 1_000_000
    val azar = (1..6).map { "0123456789abcdefghijklmnopqrstuvwxyz"[Random.nextInt(36)] }.joinToString("")
    return "p-${System.currentTimeMillis().toString(36)}-${contadorClave.toString(36)}-$azar"
}

/** Origen: `categorias.ts` (`ES_CLAVE_PROPIA`). */
fun esClavePropia(clave: String): Boolean = clave.startsWith("p-")
