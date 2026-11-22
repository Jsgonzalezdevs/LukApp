package app.lukapp.dominio

import kotlin.math.abs

// Todo aquí son ESTIMACIONES: quien liquida el GMF es el banco, con datos que la app no tiene.

/** Origen: `lib/gmf.ts` (`TARIFA_GMF`). Cuatro por mil. */
const val TARIFA_GMF = 0.004

/** Origen: `lib/gmf.ts` (`TOPE_EXENTO_UVT`). E.T. art. 879 num. 1. */
const val TOPE_EXENTO_UVT = 350

/** Origen: `lib/gmf.ts` (`TOPE_BAJO_MONTO_UVT`). Exención propia de los depósitos de bajo monto. */
const val TOPE_BAJO_MONTO_UVT = 65

/**
 * Origen: `lib/gmf.ts` (`ValorUvt`). Cambia cada año por resolución DIAN; se guarda
 * con año y fuente para que la pantalla pueda decir de cuándo es el número.
 */
data class ValorUvt(val anio: Int, val pesos: Long, val fuente: String)

/** Origen: `lib/gmf.ts` (`UVT_POR_DEFECTO`). */
val UVT_POR_DEFECTO = ValorUvt(2026, 52_374, "Resolución DIAN 000238 del 15 de diciembre de 2025")

/** Origen: `lib/gmf.ts` (`uvtDesactualizada`). */
fun uvtDesactualizada(uvt: ValorUvt, anioActual: Int): Boolean = uvt.anio < anioActual

/** Origen: `lib/gmf.ts` (`topeExentoCop`). */
fun topeExentoCop(uvt: ValorUvt): Long = TOPE_EXENTO_UVT * uvt.pesos

/** Origen: `lib/gmf.ts` (`topeBajoMontoCop`). */
fun topeBajoMontoCop(uvt: ValorUvt): Long = TOPE_BAJO_MONTO_UVT * uvt.pesos

/** Origen: `lib/gmf.ts` (`gmfDe`). */
fun gmfDe(montoCop: Long): Long = Math.round(abs(montoCop.toDouble()) * TARIFA_GMF)

/** Origen: `lib/gmf.ts` (`RegimenGmf`). */
object RegimenGmf {
    /** El cupo es de la persona y se reparte entre sus cuentas (desde dic. 2024). */
    const val DISTRIBUIDO = "distribuido"

    /** Solo una cuenta marcada goza del cupo; las demás pagan desde el primer peso. */
    const val MARCADA = "marcada"
}

/** Origen: `lib/gmf.ts` (`ConsumoDelMes`). */
data class ConsumoDelMes(
    val mes: String,
    val salidasCop: Long,
    val baseCop: Long,
    val topeCop: Long,
    val disponibleCop: Long,
    val sinCupoCop: Long,
    val gravadoCop: Long,
    val gmfEstimadoCop: Long,
    val pctUsado: Double,
    val bajoMontoGravadoCop: Long,
)

/**
 * Origen: `lib/gmf.ts` (`consumoDelMes`). Solo cuentan SALIDAS (el GMF grava disponer
 * del dinero, no recibirlo). Los traslados cuentan por su retiro «Enviado a …».
 */
fun consumoDelMes(
    transacciones: List<Transaccion>,
    mes: String,
    uvt: ValorUvt,
    cuentasCubiertas: Set<String>,
    regimen: String = RegimenGmf.DISTRIBUIDO,
    cuentaExentaId: String? = null,
    bajoMontoIds: Set<String> = emptySet(),
    movimientosTransferencia: List<CajitaMovimiento> = emptyList(),
): ConsumoDelMes {
    var base = 0L
    var sinCupo = 0L
    var salidas = 0L
    val consumoBajoMonto = LinkedHashMap<String, Long>()

    fun agregarSalida(cuentaId: String, occurredOn: String, monto: Long) {
        if (cuentaId !in cuentasCubiertas || monthKey(occurredOn) != mes) return
        salidas += monto
        if (cuentaId in bajoMontoIds) {
            consumoBajoMonto[cuentaId] = (consumoBajoMonto[cuentaId] ?: 0L) + monto
            return
        }
        // Bajo `marcada` lo de otras cuentas nunca tuvo cupo: meterlo en la base
        // haría creer que el cupo se agotó cuando ni siquiera aplicaba.
        if (regimen == RegimenGmf.MARCADA && cuentaId != cuentaExentaId) {
            sinCupo += monto
            return
        }
        base += monto
    }

    for (tx in transacciones) {
        val cuenta = tx.cuentaId
        if (tx.kind != TipoTx.GASTO || cuenta == null) continue
        agregarSalida(cuenta, tx.occurredOn, tx.amountCop)
    }
    for (mov in movimientosTransferencia) {
        if (mov.kind != TipoMovimiento.RETIRO || !mov.nota.startsWith("Enviado a ")) continue
        agregarSalida(mov.cajitaId, mov.occurredOn, abs(mov.deltaCop))
    }

    val tope = topeExentoCop(uvt)
    val excedido = maxOf(0L, base - tope)
    val topeBajo = topeBajoMontoCop(uvt)
    val gravadoBajoMonto = consumoBajoMonto.values.filter { it > topeBajo }.sumOf { it - topeBajo }
    val gravado = excedido + sinCupo + gravadoBajoMonto

    return ConsumoDelMes(
        mes = mes,
        salidasCop = salidas,
        baseCop = base,
        topeCop = tope,
        disponibleCop = maxOf(0L, tope - base),
        sinCupoCop = sinCupo,
        gravadoCop = gravado,
        gmfEstimadoCop = gmfDe(gravado),
        pctUsado = if (tope == 0L) 0.0 else minOf(100.0, Math.round(base.toDouble() / tope * 1000) / 10.0),
        bajoMontoGravadoCop = gravadoBajoMonto,
    )
}

/** Origen: `lib/gmf.ts` (`NotaLegal`). Normativa con fuente y fecha, porque envejece. */
data class NotaLegal(
    val id: String,
    val titulo: String,
    val cuerpo: String,
    val fundamento: String,
    val verificado: String,
)

/** Origen: `lib/gmf.ts` (`NOTAS_GMF`). */
val NOTAS_GMF: List<NotaLegal> = listOf(
    NotaLegal(
        "que-es",
        "Qué es",
        "El 4x1000 es el Gravamen a los Movimientos Financieros. Se cobra cuando dispones de plata que tienes en el sistema financiero: retiros, transferencias, pagos desde tu cuenta. Son $4 por cada $1.000, o sea el 0,4%.",
        "Estatuto Tributario, artículos 870 a 881",
        "2026-08-12",
    ),
    NotaLegal(
        "exencion",
        "El cupo exento",
        "Cada persona natural tiene exentos hasta 350 UVT al mes en retiros de cuentas de ahorro, depósitos electrónicos o tarjetas prepago. Pasado ese monto, lo que exceda sí paga.",
        "Estatuto Tributario, artículo 879 numeral 1",
        "2026-08-12",
    ),
    NotaLegal(
        "ya-no-se-marca",
        "Ya no tienes que marcar una sola cuenta",
        "Antes había que decirle al banco cuál era LA cuenta exenta, y usar otra te hacía perder el beneficio. Desde el 13 de diciembre de 2024 el cupo es de la persona, no de la cuenta: se reparte entre tus cuentas, incluso en bancos distintos. El límite sigue siendo 350 UVT en total al mes.",
        "Estatuto Tributario, artículo 881-1 (Ley 2277 de 2022) — Concepto DIAN 10196 del 30 de julio de 2025",
        "2026-08-12",
    ),
    NotaLegal(
        "bancos-atrasados",
        "Por qué tu banco quizá siga cobrando",
        "El reparto automático depende de que cada entidad haya montado el sistema de información que exige la norma. Mientras una no lo tenga, puede seguir aplicando el esquema viejo. Si te cobran y crees que no debían, eso se reclama en el banco.",
        "Artículo 881-1, régimen de transición",
        "2026-08-12",
    ),
)

/** Origen: `lib/gmf.ts` (`ADVERTENCIA_GMF`). La línea entre informar y asesorar, visible en el código. */
const val ADVERTENCIA_GMF =
    "Esto es informativo y son estimaciones. Quien liquida y cobra el 4x1000 es tu banco, y quien interpreta la norma es la DIAN. Si algo no te cuadra, revisa con tu banco antes de dar por buena una cifra de aquí."

/** Una cuenta tal como la ofrece el panel del 4x1000 (`cuentasParaElegir` de LukAppApp.tsx). */
data class CuentaGmf(val id: String, val nombre: String, val etiqueta: String, val esBajoMonto: Boolean, val esFinanciera: Boolean)

/**
 * Origen: `cuentasParaElegir` de LukAppApp.tsx. Solo cuentas vivas: ni ahorros ni tarjetas ni deudas son
 * un lugar del que «sale» plata. El efectivo no está en una entidad financiera, así que no consume cupo.
 */
fun cuentasParaGmf(cajitas: List<Cajita>): List<CuentaGmf> =
    cajitas.filter { it.archivedAt == null && it.tipo == TipoCajita.CUENTA }.map {
        CuentaGmf(it.id, it.nombre, "${it.nombre} · ${etiquetaTipoCajita(it)}", it.esBajoMonto, claseDeCuenta(it) != ClaseCuenta.EFECTIVO)
    }
