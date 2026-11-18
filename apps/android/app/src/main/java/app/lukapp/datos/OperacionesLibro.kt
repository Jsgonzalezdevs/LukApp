package app.lukapp.datos

import app.lukapp.dominio.CATEGORIES
import app.lukapp.dominio.CajitaMovimiento
import app.lukapp.dominio.ajusteHacia
import app.lukapp.dominio.bogotaDate
import app.lukapp.dominio.CategoriaPersonal
import app.lukapp.dominio.nuevaClaveCategoria
import app.lukapp.dominio.nuevoId
import app.lukapp.dominio.saldoDeCajita
import app.lukapp.dominio.tieneSaldoConfirmado
import java.time.Instant
import app.lukapp.dominio.Libro
import app.lukapp.dominio.Meta
import app.lukapp.dominio.Pendiente
import app.lukapp.dominio.Presupuesto
import app.lukapp.dominio.Recurrente
import app.lukapp.dominio.comoTransaccion
import app.lukapp.dominio.TipoTx
import app.lukapp.dominio.Transaccion
import app.lukapp.dominio.emparejarComprasTarjeta
import app.lukapp.dominio.idsPasivos
import kotlin.math.abs
import kotlin.math.sqrt

/**
 * Las operaciones compuestas de `useAlmacen.ts` como funciones puras: reciben el
 * libro y devuelven el cambio atómico que se manda a la RPC. Separadas del
 * repositorio para poder probarlas sin red.
 */
object OperacionesLibro {

    /**
     * Origen: `actualizarTransaccion`. Una compra en tarjeta o deuda vive en dos
     * sitios (el movimiento del libro y la `compra` de la tarjeta): editarla
     * actualiza los dos, y si deja de ser compra de un pasivo se borra la `compra`.
     */
    fun actualizarTransaccion(libro: Libro, tx: Transaccion): Cambios {
        val pasivos = idsPasivos(libro.cajitas)
        val movimientoId = emparejarComprasTarjeta(libro.movimientos, libro.transacciones, pasivos)[tx.id]
        val anterior = movimientoId?.let { id -> libro.movimientos.firstOrNull { it.id == id } }
        val sigueSiendoCompra = tx.kind == TipoTx.GASTO && tx.cuentaId != null && tx.cuentaId in pasivos
        if (anterior != null && sigueSiendoCompra) {
            val actualizado = anterior.copy(
                cajitaId = tx.cuentaId!!,
                deltaCop = abs(tx.amountCop),
                categoria = tx.category.takeIf { it in CATEGORIES },
                occurredOn = tx.occurredOn,
                nota = tx.description,
                cuotasTotal = tx.cuotasTotal,
                cuotaCop = tx.cuotaCop,
            )
            return Cambios(guardar = Libro(transacciones = listOf(tx), movimientos = listOf(actualizado)))
        }
        return Cambios(
            guardar = Libro(transacciones = listOf(tx)),
            borrar = if (anterior != null) mapOf("cajitaMovimientos" to listOf(anterior.id)) else emptyMap(),
        )
    }

    /**
     * Origen: `fijarSaldo` + `registrarMovimiento`. «Mi saldo es X»: se mide contra el saldo EFECTIVO
     * (movimientos de la cuenta más lo que se le atribuyó) y se registra un movimiento `ajuste` por la
     * diferencia. Devuelve null si no hay nada que ajustar; confirmar por primera vez un cero sí cuenta,
     * porque antes el saldo era desconocido.
     */
    fun fijarSaldo(libro: Libro, cajitaId: String, objetivo: Long, nota: String = "Saldo actualizado"): Cambios? {
        val cajita = libro.cajitas.firstOrNull { it.id == cajitaId } ?: return null
        val actual = saldoDeCajita(libro.movimientos, cajitaId, libro.transacciones, idsPasivos(libro.cajitas))
        val delta = ajusteHacia(actual, objetivo)
        if (delta == 0L && (cajita.tipo != "cuenta" || tieneSaldoConfirmado(cajitaId, libro.movimientos))) return null
        val movimiento = CajitaMovimiento(
            id = nuevoId(), cajitaId = cajitaId, kind = "ajuste", deltaCop = delta, categoria = null,
            occurredOn = bogotaDate(), nota = nota, createdAt = Instant.now().toString(),
        )
        return Cambios(guardar = Libro(movimientos = listOf(movimiento)))
    }

    /**
     * Origen: `abonarDeuda`. Pagar una deuda o tarjeta con plata de una cuenta son DOS movimientos y una sola
     * escritura: baja la deuda y baja la cuenta. No es un gasto del libro porque no es consumo nuevo: mueve
     * plata que ya se contó, y anotarlo como gasto inflaría el mes cada vez que se paga una tarjeta.
     */
    /** `almacen.fijarPresupuesto`: un tope de cero o menos no es presupuesto, y al reajustar se conserva la fecha original. */
    fun fijarPresupuesto(libro: Libro, categoria: String, montoCop: Long): Cambios? {
        if (montoCop <= 0) return null
        val previo = libro.presupuestos.firstOrNull { it.categoria == categoria }
        return Cambios(guardar = Libro(presupuestos = listOf(Presupuesto(categoria, montoCop, previo?.createdAt ?: Instant.now().toString()))))
    }

    /** `quitarPresupuesto`: el tope se borra por su categoría (la RPC usa `categoria` como clave de esa tabla). */
    /** `almacen.crearCategoria`: clave nueva con prefijo `p-`, sin archivar. */
    fun crearCategoria(nombre: String, icon: String, emoji: String, color: String): Cambios =
        Cambios(guardar = Libro(categorias = listOf(CategoriaPersonal(nuevaClaveCategoria(), nombre, icon, emoji, color, null, Instant.now().toString()))))

    /** `almacen.actualizarCategoria` (editar, y también reactivar con `archivedAt = null`). */
    fun actualizarCategoria(c: CategoriaPersonal): Cambios = Cambios(guardar = Libro(categorias = listOf(c)))

    /** `almacen.archivarCategoria`: los movimientos que ya tenía siguen apuntándole. */
    fun archivarCategoria(c: CategoriaPersonal): Cambios = Cambios(guardar = Libro(categorias = listOf(c.copy(archivedAt = Instant.now().toString()))))

    /** `almacen.borrarCategoria`: solo se ofrece cuando nada la usa; con movimientos lo honesto es archivar. */
    fun borrarCategoria(id: String): Cambios = Cambios(borrar = mapOf("categorias" to listOf(id)))

    fun quitarPresupuesto(categoria: String): Cambios = Cambios(borrar = mapOf("presupuestos" to listOf(categoria)))

    /** `almacen.crearRecurrente`: el día se acota a 1..31 en el formulario; `archivedAt` empieza vacío. */
    fun crearRecurrente(nombre: String, kind: String, montoCop: Long, categoria: String, cuentaId: String?, diaDelMes: Int): Cambios =
        Cambios(guardar = Libro(recurrentes = listOf(Recurrente(nuevoId(), nombre, kind, montoCop, categoria, cuentaId, diaDelMes, Instant.now().toString(), null))))

    /** `almacen.actualizarRecurrente` (lo usa «Actualizar precio» de las sugerencias). */
    fun actualizarRecurrente(r: Recurrente): Cambios = Cambios(guardar = Libro(recurrentes = listOf(r)))

    fun borrarRecurrente(id: String): Cambios = Cambios(borrar = mapOf("recurrentes" to listOf(id)))

    /** `almacen.confirmarRecurrente`: «Sí pasó» crea el movimiento real con la fecha que le tocaba; antes de eso no hay nada en el libro. */
    fun confirmarRecurrente(p: Pendiente): Cambios =
        Cambios(guardar = Libro(transacciones = listOf(comoTransaccion(p, nuevoId(), Instant.now().toString()))))

    /**
     * `almacen.crearCajita` (cuentas y ahorros; las tarjetas llevan además cupo, corte y pago, aún sin migrar).
     * El nombre se vuelve único sin distinguir mayúsculas («Nequi (2)»), y el saldo inicial es un MOVIMIENTO de
     * apertura, no un campo: un saldo es la suma de sus movimientos, y de ahí sale desde cuándo rinde.
     * Una cuenta con saldo en blanco (`null`) queda pendiente de confirmar; un ahorro en 0 no abre movimiento.
     */
    fun crearCajita(
        libro: Libro, nombre: String, icon: String, tipo: String, claseCuenta: String?, metaCop: Long?, tasaEaPct: Double?,
        esInversion: Boolean, moneda: String, saldoInicialCop: Long?,
    ): Cambios {
        val base = nombre.trim()
        val es = java.util.Locale.forLanguageTag("es")
        val repetidas = libro.cajitas.filter { it.archivedAt == null }.map { it.nombre.trim().lowercase(es) }.toSet()
        var unico = base
        var sufijo = 2
        while (unico.lowercase(es) in repetidas) { unico = "$base ($sufijo)"; sufijo++ }
        val ahora = Instant.now().toString()
        val cajita = app.lukapp.dominio.Cajita(
            id = nuevoId(), nombre = unico, icon = icon, tipo = tipo,
            claseCuenta = if (tipo == app.lukapp.dominio.TipoCajita.CUENTA) claseCuenta ?: app.lukapp.dominio.claseDeCuenta(app.lukapp.dominio.Cajita("", base, icon, tipo, null, createdAt = ahora)) else null,
            metaCop = metaCop, tasaEaPct = tasaEaPct,
            esInversion = tipo == app.lukapp.dominio.TipoCajita.CAJITA && esInversion,
            moneda = if (tipo == app.lukapp.dominio.TipoCajita.CAJITA) moneda else "COP",
            createdAt = ahora,
        )
        val apertura = if (saldoInicialCop != null && (saldoInicialCop > 0 || tipo == app.lukapp.dominio.TipoCajita.CUENTA))
            listOf(CajitaMovimiento(nuevoId(), cajita.id, app.lukapp.dominio.TipoMovimiento.DEPOSITO, saldoInicialCop, null, bogotaDate(), "Saldo inicial", ahora)) else emptyList()
        return Cambios(guardar = Libro(cajitas = listOf(cajita), movimientos = apertura))
    }

    /**
     * `almacen.transferirEntreCuentas`: un PAR de movimientos de cajita y una fila de transferencia neutral, nunca un
     * gasto y un ingreso: plata que sale de Nequi hacia un ahorro no se gastó ni entró, y contarla inflaría ambos lados del mes.
     * Mover plata a sí misma, o $0, no es transferencia.
     */
    fun transferir(libro: Libro, origenId: String, destinoId: String, montoCop: Long, fecha: String = bogotaDate()): Cambios? {
        val monto = abs(montoCop)
        if (monto == 0L || origenId == destinoId) return null
        fun nombre(id: String) = libro.cajitas.firstOrNull { it.id == id }?.nombre.orEmpty()
        val ahora = Instant.now().toString()
        val par = listOf(
            CajitaMovimiento(nuevoId(), origenId, app.lukapp.dominio.TipoMovimiento.RETIRO, -monto, null, fecha, "Enviado a ${nombre(destinoId)}".trim(), ahora),
            CajitaMovimiento(nuevoId(), destinoId, app.lukapp.dominio.TipoMovimiento.DEPOSITO, monto, null, fecha, "Recibido de ${nombre(origenId)}".trim(), ahora),
        )
        val tx = Transaccion(nuevoId(), TipoTx.TRANSFERENCIA, monto, "transferencia", "Transferencia de ${nombre(origenId)} a ${nombre(destinoId)}".trim(), fecha, null, createdAt = ahora)
        return Cambios(guardar = Libro(movimientos = par, transacciones = listOf(tx)))
    }

    /** `almacen.actualizarCajita`: reemplaza la fila entera (lo usa editar una tarjeta o deuda). */
    fun actualizarCajita(c: app.lukapp.dominio.Cajita): Cambios = Cambios(guardar = Libro(cajitas = listOf(c)))

    /** `almacen.crearMeta`: la meta nueva empieza sin completar. */
    fun crearMeta(libro: Libro, nombre: String, objetivoCop: Long, fechaObjetivo: String?, icon: String = "Target", ahorradoCop: Long = 0): Cambios =
        Cambios(guardar = Libro(metas = listOf(Meta(nuevoId(), nombre, icon, objetivoCop, fechaObjetivo, null, ahorradoCop, Instant.now().toString(), null))))

    fun abonarDeuda(libro: Libro, deudaId: String, cuentaId: String, montoCop: Long, fecha: String = bogotaDate()): Cambios? {
        val monto = abs(montoCop)
        if (monto == 0L) return null
        fun nombre(id: String) = libro.cajitas.firstOrNull { it.id == id }?.nombre.orEmpty()
        val creado = Instant.now().toString()
        val base = CajitaMovimiento("", "", "", 0, null, fecha, "", creado)
        return Cambios(guardar = Libro(movimientos = listOf(
            base.copy(id = nuevoId(), cajitaId = deudaId, kind = "abono", deltaCop = -monto, nota = "Pagado desde ${nombre(cuentaId)}".trim()),
            base.copy(id = nuevoId(), cajitaId = cuentaId, kind = "retiro", deltaCop = -monto, nota = "Abono a ${nombre(deudaId)}".trim()),
        )))
    }

    /**
     * Origen: `registrarMovimiento` con `kind = compra`. Una compra con tarjeta vive en dos sitios con el MISMO id:
     * el movimiento `compra` de la tarjeta (sube el saldo usado) y el gasto del libro (entra en los reportes).
     * Las cuotas solo cuentan si son 2 o más; la cuota mensual por defecto es el total repartido.
     */
    fun registrarCompra(
        libro: Libro, tarjetaId: String, montoCop: Long, categoria: String, nota: String = "",
        cuotasTotal: Int? = null, cuotaCop: Long? = null, interesPct: Double? = null, cuotaManejoCop: Long? = null,
        fecha: String = bogotaDate(),
    ): Cambios {
        val financiado = cuotasTotal != null && cuotasTotal >= 2
        val cuotas = if (financiado) cuotasTotal else null
        val cuota = if (financiado && cuotaCop != null && cuotaCop > 0) cuotaCop else null
        val id = nuevoId()
        val creado = Instant.now().toString()
        val mov = CajitaMovimiento(
            id, tarjetaId, "compra", abs(montoCop), categoria.takeIf { it in CATEGORIES }, fecha, nota, creado,
            cuotas, cuota, interesPct, cuotaManejoCop,
        )
        val gasto = Transaccion(
            id, TipoTx.GASTO, abs(montoCop), categoria, nota.ifEmpty { "Compra con tarjeta" }, fecha, tarjetaId, true, "", cuotas, cuota, creado,
        )
        return Cambios(guardar = Libro(movimientos = listOf(mov), transacciones = listOf(gasto)))
    }

    /**
     * Origen: `borrarCajita`. Se va la cuenta con su historial; los movimientos del libro, los recurrentes y las
     * metas que la nombraban sobreviven sin vínculo (en la base lo hace la cascada; aquí se manda explícito
     * porque la RPC no la hace por sí sola y la copia local debe quedar igual al instante).
     */
    fun borrarCajita(libro: Libro, id: String): Cambios = Cambios(
        guardar = Libro(
            transacciones = libro.transacciones.filter { it.cuentaId == id }.map { it.copy(cuentaId = null) },
            recurrentes = libro.recurrentes.filter { it.cuentaId == id }.map { it.copy(cuentaId = null) },
            metas = libro.metas.filter { it.cajitaId == id }.map { it.copy(cajitaId = null) },
        ),
        borrar = mapOf(
            "cajitas" to listOf(id),
            "cajitaMovimientos" to libro.movimientos.filter { it.cajitaId == id }.map { it.id },
        ),
    )

    /** Origen: `borrarTransaccion`. Borra también la `compra` emparejada de la tarjeta, si la hay. */
    fun borrarTransaccion(libro: Libro, id: String): Cambios {
        val movimientoId = emparejarComprasTarjeta(libro.movimientos, libro.transacciones, idsPasivos(libro.cajitas))[id]
        return Cambios(
            borrar = buildMap {
                put("transacciones", listOf(id))
                if (movimientoId != null) put("cajitaMovimientos", listOf(movimientoId))
            },
        )
    }
}

/** Origen: `lib/senalesAvanzadas.ts` (`AnálisisAnomalia`). */
data class AnalisisAnomalia(val esAnomalia: Boolean, val percentil: Long, val promedio: Double, val desv: Double)

/** Origen: `lib/senalesAvanzadas.ts` (`analizarAnomalias`). Raro = fuera de ±2σ de lo gastado en esa categoría. */
fun analizarAnomalias(transacciones: List<Transaccion>, categoria: String, montoActual: Long): AnalisisAnomalia {
    val montos = transacciones.filter { it.category == categoria }.map { it.amountCop }.sorted()
    if (montos.isEmpty()) return AnalisisAnomalia(false, 50, 0.0, 0.0)
    val promedio = montos.sum().toDouble() / montos.size
    val desv = sqrt(montos.sumOf { (it - promedio) * (it - promedio) } / montos.size)
    val percentil = Math.round(montos.count { it <= montoActual }.toDouble() / montos.size * 100)
    return AnalisisAnomalia(abs(montoActual - promedio) > 2 * desv && desv > 0, percentil, promedio, desv)
}
