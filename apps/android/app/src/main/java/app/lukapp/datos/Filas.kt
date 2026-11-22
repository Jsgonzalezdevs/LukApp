package app.lukapp.datos

import app.lukapp.dominio.Cajita
import app.lukapp.dominio.CajitaMovimiento
import app.lukapp.dominio.CategoriaPersonal
import app.lukapp.dominio.Contacto
import app.lukapp.dominio.Libro
import app.lukapp.dominio.Meta
import app.lukapp.dominio.Presupuesto
import app.lukapp.dominio.Recurrente
import app.lukapp.dominio.RevisionDudosa
import app.lukapp.dominio.Transaccion
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/**
 * Filas de Supabase ↔ modelos, traducidas de los `aX`/`desdeX` de
 * src/features/lukapp/data/repositorioSupabase.ts:339-675.
 *
 * Se arma JSON a mano y no con @Serializable porque la RPC
 * `aplicar_cambios_financieros` rechaza columnas desconocidas y la web manda
 * `null` explícito en ciertos campos según el tipo (tarjeta, cuenta, cajita):
 * replicar esas reglas campo a campo es más claro aquí que con anotaciones.
 * Los bigint pueden llegar como número o como texto; se aceptan ambos.
 */
internal object Filas {

    private fun JsonObject.texto(c: String): String? = (this[c] as? JsonPrimitive)?.takeUnless { it is JsonNull }?.contentOrNull
    private fun JsonObject.textoO(c: String, d: String = "") = texto(c) ?: d
    private fun JsonObject.largo(c: String): Long? = texto(c)?.toDoubleOrNull()?.let { Math.round(it) }
    private fun JsonObject.entero(c: String): Int? = largo(c)?.toInt()
    private fun JsonObject.decimal(c: String): Double? = texto(c)?.toDoubleOrNull()
    private fun JsonObject.logico(c: String): Boolean? = (this[c] as? JsonPrimitive)?.booleanOrNull
    private fun JsonObject.lista(c: String): List<String> =
        (this[c] as? JsonArray)?.mapNotNull { it.jsonPrimitive.contentOrNull } ?: emptyList()

    private fun MutableMap<String, JsonElement>.p(c: String, v: String?) { this[c] = JsonPrimitive(v) }
    private fun MutableMap<String, JsonElement>.p(c: String, v: Number?) { this[c] = JsonPrimitive(v) }
    private fun MutableMap<String, JsonElement>.p(c: String, v: Boolean?) { this[c] = JsonPrimitive(v) }
    private fun fila(bloque: MutableMap<String, JsonElement>.() -> Unit) = JsonObject(LinkedHashMap<String, JsonElement>().apply(bloque))

    // ── transacciones ──
    fun aTransaccion(f: JsonObject): Transaccion {
        val cuotas = f.entero("cuotas_total")
        val financiado = cuotas != null && cuotas >= 2
        return Transaccion(
            id = f.textoO("id"),
            kind = f.textoO("kind"),
            amountCop = f.largo("amount_cop") ?: 0,
            category = f.textoO("category"),
            description = f.textoO("description"),
            occurredOn = f.textoO("occurred_on"),
            cuentaId = f.texto("cuenta_id"),
            afectaSaldo = f.logico("afecta_saldo") != false,
            rawTranscript = f.textoO("raw_transcript"),
            cuotasTotal = if (financiado) cuotas else null,
            cuotaCop = if (financiado) f.largo("cuota_cop") else null,
            createdAt = f.textoO("created_at"),
        )
    }

    fun desdeTransaccion(t: Transaccion, uid: String): JsonObject {
        val financiado = t.cuotasTotal != null && t.cuotasTotal >= 2
        return fila {
            p("id", t.id); p("user_id", uid); p("kind", t.kind); p("amount_cop", t.amountCop)
            p("category", t.category); p("description", t.description); p("occurred_on", t.occurredOn)
            p("cuenta_id", t.cuentaId); p("afecta_saldo", t.afectaSaldo); p("raw_transcript", t.rawTranscript)
            p("cuotas_total", if (financiado) t.cuotasTotal else null)
            p("cuota_cop", if (financiado && (t.cuotaCop ?: 0) > 0) t.cuotaCop else null)
            p("created_at", t.createdAt)
        }
    }

    // ── cajitas (cuentas, cajitas, deudas, tarjetas) ──
    private fun aTipo(tipo: String?) = when (tipo) {
        "cuenta", "deuda", "tarjeta" -> tipo
        else -> "cajita"
    }

    fun aCajita(f: JsonObject) = Cajita(
        id = f.textoO("id"),
        nombre = f.textoO("nombre"),
        icon = f.textoO("emoji"),
        tipo = aTipo(f.texto("tipo")),
        esBajoMonto = f.logico("es_bajo_monto") ?: false,
        claseCuenta = f.texto("clase_cuenta")?.takeIf { it in setOf("efectivo", "banco", "billetera") },
        metaCop = f.largo("meta_cop"),
        tasaEaPct = f.decimal("tasa_ea_pct"),
        createdAt = f.textoO("created_at"),
        archivedAt = f.texto("archived_at"),
        limiteCreditoCop = f.largo("limite_credito_cop"),
        diaCorte = f.entero("dia_corte"),
        diaPago = f.entero("dia_pago"),
        pagoMinimoCop = f.largo("pago_minimo_cop"),
        esInversion = f.logico("es_inversion") ?: false,
        moneda = f.texto("moneda") ?: "COP",
    )

    fun desdeCajita(c: Cajita, uid: String): JsonObject {
        val tarjeta = c.tipo == "tarjeta"
        return fila {
            p("id", c.id); p("user_id", uid); p("nombre", c.nombre); p("emoji", c.icon); p("tipo", c.tipo)
            p("es_bajo_monto", c.esBajoMonto)
            p("clase_cuenta", if (c.tipo == "cuenta") c.claseCuenta else null)
            p("meta_cop", c.metaCop); p("tasa_ea_pct", c.tasaEaPct)
            p("created_at", c.createdAt); p("archived_at", c.archivedAt)
            p("limite_credito_cop", if (tarjeta) c.limiteCreditoCop else null)
            p("dia_corte", if (tarjeta) c.diaCorte else null)
            p("dia_pago", if (tarjeta) c.diaPago else null)
            p("pago_minimo_cop", if (tarjeta) c.pagoMinimoCop else null)
            p("es_inversion", if (c.tipo == "cajita") c.esInversion else false)
            p("moneda", if (c.tipo == "cajita") c.moneda else "COP")
        }
    }

    // ── cajita_movimientos ──
    fun aMovimiento(f: JsonObject) = CajitaMovimiento(
        id = f.textoO("id"),
        cajitaId = f.textoO("cajita_id"),
        kind = f.textoO("kind"),
        cuotasTotal = f.entero("cuotas_total"),
        cuotaCop = f.largo("cuota_cop"),
        interesPct = f.decimal("interes_pct"),
        cuotaManejoCop = f.largo("cuota_manejo_cop"),
        montoOriginal = f.decimal("monto_original"),
        monedaOriginal = f.texto("moneda_original"),
        tasaCambioCop = f.decimal("tasa_cambio_cop"),
        deltaCop = f.largo("delta_cop") ?: 0,
        categoria = f.texto("categoria"),
        occurredOn = f.textoO("occurred_on"),
        nota = f.textoO("nota"),
        createdAt = f.textoO("created_at"),
    )

    fun desdeMovimiento(m: CajitaMovimiento, uid: String) = fila {
        p("id", m.id); p("user_id", uid); p("cajita_id", m.cajitaId)
        p("cuotas_total", m.cuotasTotal); p("cuota_cop", m.cuotaCop); p("interes_pct", m.interesPct)
        p("cuota_manejo_cop", m.cuotaManejoCop); p("monto_original", m.montoOriginal)
        p("moneda_original", m.monedaOriginal); p("tasa_cambio_cop", m.tasaCambioCop)
        p("kind", m.kind); p("delta_cop", m.deltaCop); p("categoria", m.categoria)
        p("occurred_on", m.occurredOn); p("nota", m.nota); p("created_at", m.createdAt)
    }

    // ── metas ──
    fun aMeta(f: JsonObject) = Meta(
        id = f.textoO("id"), nombre = f.textoO("nombre"), icon = f.textoO("emoji"),
        objetivoCop = f.largo("objetivo_cop") ?: 0, fechaObjetivo = f.texto("fecha_objetivo"),
        cajitaId = f.texto("cajita_id"), ahorradoCop = f.largo("ahorrado_cop") ?: 0,
        createdAt = f.textoO("created_at"), completedAt = f.texto("completed_at"),
    )

    fun desdeMeta(m: Meta, uid: String) = fila {
        p("id", m.id); p("user_id", uid); p("nombre", m.nombre); p("emoji", m.icon)
        p("objetivo_cop", m.objetivoCop); p("fecha_objetivo", m.fechaObjetivo); p("cajita_id", m.cajitaId)
        p("ahorrado_cop", m.ahorradoCop); p("created_at", m.createdAt); p("completed_at", m.completedAt)
    }

    // ── categorias propias ──
    fun aCategoria(f: JsonObject) = CategoriaPersonal(
        id = f.textoO("id"), nombre = f.textoO("nombre"), icon = f.texto("icon") ?: "Package",
        color = f.texto("color") ?: "#A8A29E", createdAt = f.textoO("created_at"), archivedAt = f.texto("archived_at"),
    )

    fun desdeCategoria(c: CategoriaPersonal, uid: String) = fila {
        p("id", c.id); p("user_id", uid); p("nombre", c.nombre); p("icon", c.icon); p("color", c.color)
        p("created_at", c.createdAt); p("archived_at", c.archivedAt)
    }

    // ── contactos ──
    fun aContacto(f: JsonObject) = Contacto(
        id = f.textoO("id"), nombre = f.textoO("nombre"), alias = f.lista("alias"),
        separadoDe = f.lista("separado_de"), apodos = f.lista("apodos"),
        createdAt = f.textoO("created_at"), archivedAt = f.texto("archived_at"),
    )

    fun desdeContacto(c: Contacto, uid: String) = fila {
        p("id", c.id); p("user_id", uid); p("nombre", c.nombre)
        this["alias"] = JsonArray(c.alias.map(::JsonPrimitive))
        this["separado_de"] = JsonArray(c.separadoDe.map(::JsonPrimitive))
        this["apodos"] = JsonArray(c.apodos.map(::JsonPrimitive))
        p("created_at", c.createdAt); p("archived_at", c.archivedAt)
    }

    // ── presupuestos ──
    fun aPresupuesto(f: JsonObject) = Presupuesto(
        categoria = f.textoO("categoria"), montoCop = f.largo("monto_cop") ?: 0, createdAt = f.textoO("created_at"),
    )

    fun desdePresupuesto(p: Presupuesto, uid: String) = buildJsonObject {
        put("user_id", uid); put("categoria", p.categoria); put("monto_cop", p.montoCop); put("created_at", p.createdAt)
    }

    // ── recurrentes ──
    fun aRecurrente(f: JsonObject) = Recurrente(
        id = f.textoO("id"), nombre = f.textoO("nombre"),
        kind = if (f.texto("kind") == "ingreso") "ingreso" else "gasto",
        amountCop = f.largo("amount_cop") ?: 0, categoria = f.textoO("categoria"),
        cuentaId = f.texto("cuenta_id"), diaDelMes = f.entero("dia_del_mes") ?: 1,
        createdAt = f.textoO("created_at"), archivedAt = f.texto("archived_at"),
    )

    fun desdeRecurrente(r: Recurrente, uid: String) = fila {
        p("id", r.id); p("user_id", uid); p("nombre", r.nombre); p("kind", r.kind); p("amount_cop", r.amountCop)
        p("categoria", r.categoria); p("cuenta_id", r.cuentaId); p("dia_del_mes", r.diaDelMes)
        p("created_at", r.createdAt); p("archived_at", r.archivedAt)
    }

    // ── revisiones_dudosas ──
    fun aRevision(f: JsonObject) = RevisionDudosa(
        id = f.textoO("id"), tipo = f.textoO("tipo"), estado = f.textoO("estado"),
        referenciaId = f.texto("referencia_id"), titulo = f.textoO("titulo"), detalle = f.textoO("detalle"),
        documento = f.texto("documento"), resolucion = f.texto("resolucion"),
        createdAt = f.textoO("created_at"), updatedAt = f.textoO("updated_at"),
    )

    fun desdeRevision(r: RevisionDudosa, uid: String) = fila {
        p("id", r.id); p("user_id", uid); p("tipo", r.tipo); p("estado", r.estado)
        p("referencia_id", r.referenciaId); p("titulo", r.titulo); p("detalle", r.detalle)
        p("documento", r.documento); p("resolucion", r.resolucion)
        p("created_at", r.createdAt); p("updated_at", r.updatedAt)
    }
}

/** Lo mismo que `CambiosFinancieros` de la web: qué guardar y qué borrar en una sola operación atómica. */
data class Cambios(
    val guardar: Libro = Libro(),
    val borrar: Map<String, List<String>> = emptyMap(),
    val reemplazar: Boolean = false,
    val idOperacion: String = java.util.UUID.randomUUID().toString(),
)
