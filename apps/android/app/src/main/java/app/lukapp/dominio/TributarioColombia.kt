package app.lukapp.dominio

import kotlin.math.abs

/**
 * Inteligencia tributaria para personas naturales: aquí solo lo que el Asesor local usa
 * (los topes para declarar renta). Origen: `lib/tributarioColombia.ts`.
 * Basado en el Estatuto Tributario y la normatividad DIAN.
 */

/** Origen: `lib/tributarioColombia.ts` (`TOPES_RENTA_UVT`). */
object TopesRentaUvt {
    const val INGRESOS_BRUTOS = 1400
    const val COMPRAS_CONSUMOS = 1400
    const val TARJETAS_CREDITO = 1400
    const val CONSIGNACIONES_DEPOSITOS = 1400
    const val PATRIMONIO_BRUTO = 4500
}

/** Origen: `lib/tributarioColombia.ts` (`EstadoSemaforoRenta.detalles`). */
data class DetallesSemaforoRenta(
    val umbralUVT: Int,
    val faltanteParaTope: Long,
    val debeDeclararEstimado: Boolean,
)

/** Origen: `lib/tributarioColombia.ts` (`EstadoSemaforoRenta`). `semaforoGeneral`: verde, amarillo, alerta. */
data class EstadoSemaforoRenta(
    val anio: Int,
    val uvt: ValorUvt,
    val topeConsignacionesPesos: Long,
    val acumuladoConsignacionesPesos: Long,
    val porcentajeConsignaciones: Int,
    val topeComprasPesos: Long,
    val acumuladoComprasPesos: Long,
    val porcentajeCompras: Int,
    val semaforoGeneral: String,
    val mensajeConsejo: String,
    val detalles: DetallesSemaforoRenta,
)

/**
 * Origen: `lib/tributarioColombia.ts` (`analizarTopesRenta`). Evalúa el acumulado del año
 * frente a los topes de la DIAN para saber si la persona se acerca o supera la obligación
 * de declarar renta.
 */
fun analizarTopesRenta(
    transacciones: List<Transaccion>,
    anio: Int = bogotaDate().take(4).toInt(),
    uvt: ValorUvt = UVT_POR_DEFECTO,
): EstadoSemaforoRenta {
    val anioStr = anio.toString()
    val delAnio = transacciones.filter { it.occurredOn.isNotEmpty() && it.occurredOn.startsWith(anioStr) }

    val acumuladoConsignaciones = delAnio.filter { it.kind == TipoTx.INGRESO }.sumOf { abs(it.amountCop) }
    val acumuladoCompras = delAnio.filter { it.kind == TipoTx.GASTO }.sumOf { abs(it.amountCop) }

    val topePesos = TopesRentaUvt.INGRESOS_BRUTOS * uvt.pesos

    val pctConsignaciones = minOf(100L, Math.round(acumuladoConsignaciones.toDouble() / topePesos * 100)).toInt()
    val pctCompras = minOf(100L, Math.round(acumuladoCompras.toDouble() / topePesos * 100)).toInt()
    val pctMax = maxOf(pctConsignaciones, pctCompras)

    val mayorAcumulado = maxOf(acumuladoConsignaciones, acumuladoCompras)
    val faltante = maxOf(0L, topePesos - mayorAcumulado)
    val debeDeclarar = acumuladoConsignaciones >= topePesos || acumuladoCompras >= topePesos

    val semaforo: String
    val consejo: String
    if (debeDeclarar) {
        semaforo = "alerta"
        consejo = "¡Atención! Tus movimientos de $anio superaron el tope de ${TopesRentaUvt.INGRESOS_BRUTOS} UVT (\$${milesEsCo(topePesos)}). Deberás presentar declaración de renta ante la DIAN el próximo año."
    } else if (pctMax >= 75) {
        semaforo = "amarillo"
        consejo = "Llevas el $pctMax% del tope de movimientos para declarar renta (\$${milesEsCo(mayorAcumulado)} de \$${milesEsCo(topePesos)}). Te faltan \$${milesEsCo(faltante)} antes de alcanzar el umbral."
    } else {
        semaforo = "verde"
        consejo = "Tranquilo: llevas el $pctMax% del tope de movimientos anuales. Tu margen libre antes de declarar es de \$${milesEsCo(faltante)}."
    }

    return EstadoSemaforoRenta(
        anio = anio,
        uvt = uvt,
        topeConsignacionesPesos = topePesos,
        acumuladoConsignacionesPesos = acumuladoConsignaciones,
        porcentajeConsignaciones = pctConsignaciones,
        topeComprasPesos = topePesos,
        acumuladoComprasPesos = acumuladoCompras,
        porcentajeCompras = pctCompras,
        semaforoGeneral = semaforo,
        mensajeConsejo = consejo,
        detalles = DetallesSemaforoRenta(
            umbralUVT = TopesRentaUvt.INGRESOS_BRUTOS,
            faltanteParaTope = faltante,
            debeDeclararEstimado = debeDeclarar,
        ),
    )
}
