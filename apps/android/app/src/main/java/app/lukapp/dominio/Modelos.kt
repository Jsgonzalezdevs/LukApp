package app.lukapp.dominio

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Modelos del libro financiero, campo por campo iguales a los de la web
 * (`src/features/lukapp/types.ts` y `data/modelos.ts`).
 *
 * Los "kind", "tipo" y categorías se dejan como String y no como enum: la base
 * acepta categorías propias (`p-…`) y cualquier valor nuevo que agregue la web
 * no debe tumbar la lectura en un teléfono con una versión vieja.
 * Montos en pesos enteros (Long), fechas de negocio como 'YYYY-MM-DD' de Bogotá.
 */

object TipoTx {
    const val GASTO = "gasto"
    const val INGRESO = "ingreso"
    const val TRANSFERENCIA = "transferencia"
}

@Serializable
data class Transaccion(
    val id: String,
    val kind: String,
    val amountCop: Long,
    val category: String,
    val description: String,
    val occurredOn: String,
    val cuentaId: String?,
    val afectaSaldo: Boolean = true,
    val rawTranscript: String = "",
    val cuotasTotal: Int? = null,
    val cuotaCop: Long? = null,
    val createdAt: String,
)

object TipoCajita {
    const val CUENTA = "cuenta"
    const val CAJITA = "cajita"
    const val DEUDA = "deuda"
    const val TARJETA = "tarjeta"

    fun esPasivo(tipo: String) = tipo == DEUDA || tipo == TARJETA

    val ETIQUETAS = mapOf(
        CUENTA to "Cuenta",
        CAJITA to "Cajita de ahorro",
        DEUDA to "Deuda",
        TARJETA to "Tarjeta de crédito",
    )
}

object ClaseCuenta {
    const val EFECTIVO = "efectivo"
    const val BANCO = "banco"
    const val BILLETERA = "billetera"

    val ETIQUETAS = mapOf(
        EFECTIVO to "Efectivo",
        BANCO to "Cuenta bancaria",
        BILLETERA to "Billetera digital",
    )
}

@Serializable
data class Cajita(
    val id: String,
    val nombre: String,
    val icon: String,
    val tipo: String,
    val claseCuenta: String? = null,
    val metaCop: Long? = null,
    val tasaEaPct: Double? = null,
    val createdAt: String,
    val archivedAt: String? = null,
    val esBajoMonto: Boolean = false,
    val limiteCreditoCop: Long? = null,
    val diaCorte: Int? = null,
    val diaPago: Int? = null,
    val pagoMinimoCop: Long? = null,
    val esInversion: Boolean = false,
    val moneda: String = "COP",
)

object TipoMovimiento {
    const val DEPOSITO = "deposito"
    const val RETIRO = "retiro"
    const val RENDIMIENTO = "rendimiento"
    const val VALORACION = "valoracion"
    const val AJUSTE = "ajuste"
    const val COMPRA = "compra"
    const val ABONO = "abono"

    val ETIQUETAS = mapOf(
        COMPRA to "Compra",
        ABONO to "Abono",
        DEPOSITO to "Depósito",
        RETIRO to "Retiro",
        RENDIMIENTO to "Rendimiento",
        VALORACION to "Valoración",
        AJUSTE to "Ajuste de saldo",
    )
}

@Serializable
data class CajitaMovimiento(
    val id: String,
    val cajitaId: String,
    val kind: String,
    val deltaCop: Long,
    val categoria: String?,
    val occurredOn: String,
    val nota: String,
    val createdAt: String,
    val cuotasTotal: Int? = null,
    val cuotaCop: Long? = null,
    val interesPct: Double? = null,
    val cuotaManejoCop: Long? = null,
    val montoOriginal: Double? = null,
    val monedaOriginal: String? = null,
    val tasaCambioCop: Double? = null,
)

@Serializable
data class Meta(
    val id: String,
    val nombre: String,
    val icon: String,
    val objetivoCop: Long,
    val fechaObjetivo: String?,
    val cajitaId: String?,
    val ahorradoCop: Long,
    val createdAt: String,
    val completedAt: String?,
)

@Serializable
data class CategoriaPersonal(
    val id: String,
    val nombre: String,
    val icon: String,
    val emoji: String? = null,
    val color: String,
    val archivedAt: String? = null,
    val createdAt: String,
)

@Serializable
data class Contacto(
    val id: String,
    val nombre: String,
    val alias: List<String>,
    val separadoDe: List<String>,
    val apodos: List<String>,
    val createdAt: String,
    val archivedAt: String? = null,
)

@Serializable
data class Presupuesto(
    val categoria: String,
    val montoCop: Long,
    val createdAt: String,
)

@Serializable
data class Recurrente(
    val id: String,
    val nombre: String,
    val kind: String,
    val amountCop: Long,
    val categoria: String,
    val cuentaId: String?,
    val diaDelMes: Int,
    val createdAt: String,
    val archivedAt: String? = null,
)

@Serializable
data class RevisionDudosa(
    val id: String,
    val tipo: String,
    val estado: String,
    val referenciaId: String?,
    val titulo: String,
    val detalle: String,
    val documento: String?,
    val resolucion: String?,
    val createdAt: String,
    val updatedAt: String,
)

/** Todo lo que el usuario tiene guardado: lo que la web llama el "almacén". */
@Serializable
data class Libro(
    val transacciones: List<Transaccion> = emptyList(),
    val cajitas: List<Cajita> = emptyList(),
    // Con el nombre de la web: un respaldo hecho aquí lo lee la web y al revés.
    @SerialName("cajitaMovimientos") val movimientos: List<CajitaMovimiento> = emptyList(),
    val metas: List<Meta> = emptyList(),
    val categorias: List<CategoriaPersonal> = emptyList(),
    val contactos: List<Contacto> = emptyList(),
    val presupuestos: List<Presupuesto> = emptyList(),
    val recurrentes: List<Recurrente> = emptyList(),
    val revisiones: List<RevisionDudosa> = emptyList(),
)

const val ID_EFECTIVO = "00000000-0000-4000-8000-0000000000ef"
const val ID_EFECTIVO_VIEJO = "efectivo"
