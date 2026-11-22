package app.lukapp.dominio

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull

/** Origen: `lib/beneficiosPlan.ts` (`BeneficioPlan`). Una prestación del plan, tal como la manda el servidor. */
data class BeneficioPlan(
    val clave: String,
    val titulo: String,
    val detalle: String,
    /** "cupo" (lleva número) o "incluido". */
    val tipoValor: String,
    /** null con `tipoValor = "cupo"` significa sin límite. */
    val limite: Long?,
    val activo: Boolean,
)

data class SuscripcionPlan(val ciclo: String, val venceEn: String) {
    /** El Premium de cortesía: el que regala el equipo. */
    val esRegalo get() = ciclo == "cortesia"
}

/** Origen: `BeneficiosPremium.tsx` (`PlanParaBeneficios`): lo que la página de beneficios lee de `GET /api/mi-plan`. */
data class PlanBeneficios(val codigo: String, val beneficiosPremium: List<BeneficioPlan>, val suscripcion: SuscripcionPlan?) {
    val esPremium get() = codigo == "premium"
    val esRegalo get() = suscripcion?.esRegalo == true
    /** Solo los que el equipo tiene encendidos: uno apagado no se promete. */
    val activos get() = beneficiosPremium.filter { it.activo }
}

private fun texto(objeto: JsonObject, clave: String): String? =
    (objeto[clave] as? JsonPrimitive)?.takeIf { it.isString }?.contentOrNull

private fun leerBeneficio(elemento: Any?): BeneficioPlan? {
    val b = elemento as? JsonObject ?: return null
    val clave = texto(b, "clave") ?: return null
    val titulo = texto(b, "titulo") ?: return null
    val tipoValor = texto(b, "tipoValor")?.takeIf { it == "cupo" || it == "incluido" } ?: "cupo"
    val limite = (b["limite"] as? JsonPrimitive)?.takeIf { it !is JsonNull && !it.isString }?.doubleOrNull?.takeIf { it >= 0 }?.toLong()
    return BeneficioPlan(
        clave = clave, titulo = titulo, detalle = texto(b, "detalle") ?: "",
        tipoValor = tipoValor, limite = limite,
        activo = (b["activo"] as? JsonPrimitive)?.takeIf { !it.isString }?.booleanOrNull == true,
    )
}

/**
 * El cuerpo de `GET /api/mi-plan`, como lo valida `leerPlan` en la web: sin un código
 * conocido o sin la lista de beneficios, null, y la página enseña el error con reintento.
 * Un beneficio mal formado se salta en vez de tumbar la página entera.
 */
fun leerPlanBeneficios(texto: String): PlanBeneficios? {
    val cuerpo = runCatching { Json.parseToJsonElement(texto) as? JsonObject }.getOrNull() ?: return null
    val codigo = texto(cuerpo, "codigo")?.takeIf { it == "normal" || it == "premium" } ?: return null
    val lista = cuerpo["beneficiosPremium"] as? JsonArray ?: return null
    val suscripcion = (cuerpo["suscripcion"] as? JsonObject)?.let { s ->
        val ciclo = texto(s, "ciclo") ?: return@let null
        val vence = texto(s, "venceEn") ?: return@let null
        SuscripcionPlan(ciclo, vence)
    }
    return PlanBeneficios(codigo, lista.mapNotNull(::leerBeneficio), suscripcion)
}

/** El cupo en grande: un número, «Sin límite» o «Incluido». */
fun valorEnGrande(beneficio: BeneficioPlan): String = when {
    beneficio.tipoValor == "incluido" -> "Incluido"
    beneficio.limite == null -> "Sin límite"
    else -> formatAmountInput(beneficio.limite)
}

/** A dónde lleva el botón de cada beneficio: una sección o una herramienta de Más. */
enum class DestinoBeneficio { INICIO, ASESOR, EXTRACTOS, ESPACIOS }

/** Origen: `lib/guiaBeneficiosPremium.ts`. Para qué le sirve a la persona, con un ejemplo de su día a día. */
data class GuiaBeneficio(val explicacion: String, val accion: String, val destino: DestinoBeneficio)

/**
 * El servidor dice QUÉ beneficios están activos y con qué cupo; esto cuenta para qué
 * sirve cada uno. Una clave que todavía no está aquí sale sin explicación ni botón.
 */
val GUIA_BENEFICIOS: Map<String, GuiaBeneficio> = mapOf(
    "dictado" to GuiaBeneficio(
        "Di «gasté 25 mil en el almuerzo» y LukApp lo anota solo, con categoría y cuenta. Ideal para cuando vas de afán.",
        "Anotar por voz", DestinoBeneficio.INICIO,
    ),
    "asesor_ia" to GuiaBeneficio(
        "Pregúntale a la Estrella si te alcanza para ese viaje o cómo armar tu colchón. Te responde con tus números, no con consejos de manual.",
        "Hablar con el Asesor", DestinoBeneficio.ASESOR,
    ),
    "extracto" to GuiaBeneficio(
        "Sube el PDF que te manda el banco y LukApp separa lo nuevo de lo que ya tenías anotado. Cero digitar movimiento por movimiento.",
        "Importar un extracto", DestinoBeneficio.EXTRACTOS,
    ),
    "espacios_compartidos" to GuiaBeneficio(
        "Cuentas claras con tu pareja, el roomie o el parche del viaje: cada espacio lleva sus propios gastos, aparte de los tuyos.",
        "Crear un espacio", DestinoBeneficio.ESPACIOS,
    ),
    "integrantes_espacio" to GuiaBeneficio(
        "Invita a más gente a cada espacio y vean juntos quién puso qué y quién le debe a quién, sin hacer cuentas en servilletas.",
        "Invitar a alguien", DestinoBeneficio.ESPACIOS,
    ),
    "insights_ia" to GuiaBeneficio(
        "Cada mes la IA revisa en qué se te va la plata y te deja ideas concretas para ahorrar, en «Para ti», en tu Inicio.",
        "Ver mis recomendaciones", DestinoBeneficio.INICIO,
    ),
    "pulso_premium" to GuiaBeneficio(
        "Tu margen del día: cuánto puedes gastar hoy sin descuadrar el mes, y una ayuda para decidir antes de comprar algo grande.",
        "Ver mi Pulso", DestinoBeneficio.INICIO,
    ),
)
