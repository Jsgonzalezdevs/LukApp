package app.lukapp.dominio.voz

import app.lukapp.dominio.Cajita
import app.lukapp.dominio.TipoCajita
import java.time.LocalDate

/*
 * Órdenes de voz que cambian saldos, separadas de un gasto/ingreso ordinario.
 * Origen: src/features/lukapp/lib/parseComandoVoz.ts
 */

/** Lo que la web toma de una cajita con `Pick<Cajita, 'id' | 'nombre' | 'tipo' | 'archivedAt'>`. */
data class EntidadVoz(
    val id: String,
    val nombre: String,
    val tipo: String,
    val archivedAt: String? = null,
)

fun Cajita.comoEntidadVoz(): EntidadVoz = EntidadVoz(id, nombre, tipo, archivedAt)

/** Puede venir incompleta: la confirmación pregunta lo que falte. */
sealed class ComandoVoz {
    abstract val raw: String

    data class Transferencia(
        val origenId: String?,
        val destinoId: String?,
        val montoCop: Long?,
        val occurredOn: String? = null,
        override val raw: String,
    ) : ComandoVoz()

    data class Abono(
        val deudaId: String?,
        val cuentaId: String?,
        val montoCop: Long?,
        val occurredOn: String? = null,
        override val raw: String,
    ) : ComandoVoz()

    data class Saldo(
        val cajitaId: String?,
        val saldoCop: Long?,
        override val raw: String,
    ) : ComandoVoz()

    data class Rendimiento(
        val cajitaId: String?,
        val montoCop: Long?,
        val occurredOn: String? = null,
        override val raw: String,
    ) : ComandoVoz()
}

private val RE_NO_ALFANUM_CV = js("""[^a-z0-9\s]""", "g")
private val RE_ESPACIOS_CV = js("""\s+""", "g")

private fun plano(texto: String): String =
    normalizeWord(texto).reemplazarTodos(RE_NO_ALFANUM_CV, " ").reemplazarTodos(RE_ESPACIOS_CV, " ").trimJs()

private val RE_SIN_TIPO = js("""^(?:tarjeta(?: de credito)?|credito|prestamo|deuda|cuenta|cajita)(?: de)?(?: la| el)?\s+""")

private fun patronesEspeciales(nombre: String): List<String> {
    val limpio = plano(nombre)
    val patrones = mutableListOf(limpio)
    val sinTipo = limpio.reemplazarPrimero(RE_SIN_TIPO, "").trimJs()
    if (sinTipo.length >= 2) patrones.add(sinTipo)
    if (limpio.contains("nequi")) patrones.add(limpio.replaceFirst("nequi", "neki"))
    if (limpio.contains("daviplata")) patrones.add(limpio.replaceFirst("daviplata", "davi plata"))
    if (limpio.contains("davivienda")) patrones.add(limpio.replaceFirst("davivienda", "davienda"))
    if (limpio.contains("bancolombia")) patrones.add(limpio.replaceFirst("bancolombia", "banco colombia"))
    if (limpio.contains("nubank")) patrones.add(limpio.replaceFirst("nubank", "nu bank"))
    return LinkedHashSet(patrones).filter { it.isNotEmpty() }
}

private fun menciona(texto: String, entidad: EntidadVoz): Boolean =
    patronesEspeciales(entidad.nombre).any { patron ->
        js("""(?:^|\s)${RegexJs.escapar(patron)}(?:$|\s)""").containsMatchIn(texto)
    }

private fun mencionadas(texto: String, entidades: List<EntidadVoz>): List<EntidadVoz> =
    entidades.filter { menciona(texto, it) }.sortedByDescending { it.nombre.length }

private fun trasPreposicion(texto: String, preposiciones: String, entidades: List<EntidadVoz>): EntidadVoz? {
    for (entidad in entidades.sortedByDescending { it.nombre.length }) {
        for (patron in patronesEspeciales(entidad.nombre)) {
            val re = js("""\b(?:$preposiciones)\s+(?:(?:mi|la|el|una|un)\s+)?${RegexJs.escapar(patron)}(?:$|\s)""")
            if (re.containsMatchIn(texto)) return entidad
        }
    }
    return null
}

private val RE_SALDO_1 = js("""\b(?:actualiza|actualizar|ajusta|ajustar|corrige|corregir|cambia|cambiar|fija|fijar|pon|poner)\b.{0,40}\bsaldo\b""")
private val RE_SALDO_2 = js("""\bsaldo\s+(?:actual|de|del|en)\b""")
private val RE_SALDO_3 = js("""\b(?:tengo|hay)\b.{0,35}\b(?:en|dentro de)\b""")
private val RE_SALDO_4 = js("""\b(?:en|dentro de)\b.{0,35}\b(?:tengo|hay)\b""")
private val RE_SALDO_DEUDA = js("""\b(?:debo|deuda actual)\b""")
private val RE_CERO = js("""(?:^|\s)(?:0|cero)(?:$|\s)""")
private val RE_VERBO_ABONO = js("""\b(?:abona|abone|abonar|abono|paga|pague|pagar|pago|cancela|cancele|cancelar)\b""")
private val RE_CONTEXTO_PASIVO = js("""\b(?:tarjeta(?: de credito)?|credito|deuda|prestamo|cuota de la tarjeta)\b""")
private val RE_CON_TARJETA = js("""\bcon\s+(?:(?:mi|la|una)\s+)?tarjeta\b""")
private val RE_PALABRAS_DEUDA = js("""\b(?:saldo|deuda|cuota|abono)\b""")
private val RE_RENDIMIENTO = js("""\b(?:rendimiento|rendimientos|interes ganado|intereses ganados)\b""")
private val RE_REGISTRAR = js("""\b(?:registra|registre|registrar|anota|anote|anotar|agrega|agregue|sumale|suma)\b""")
private val RE_VERBO_TRANSFERENCIA = js("""\b(?:transfiere|transferir|transferi|pasa|pasar|mueve|mover|aparta|apartar|mete|meter|saca|sacar|retira|retirar)\b""")
private val RE_VERBO_INTERNO = js("""\b(?:pasa|pasar|mueve|mover|aparta|apartar|mete|meter|saca|sacar)\b""")
private val RE_CONTEXTO_INTERNO = js("""\b(?:entre mis cuentas|entre cuentas|mi cajita|mis cajitas|mis ahorros)\b""")

/** Atajo para pasar directamente las cajitas del libro. */
fun parseComandoVozCajitas(raw: String, cajitas: List<Cajita>, hoy: LocalDate = hoyEnBogota()): ComandoVoz? =
    parseComandoVoz(raw, cajitas.map { it.comoEntidadVoz() }, hoy)

/**
 * Separa órdenes que cambian saldos de un gasto/ingreso ordinario.
 *
 * Devuelve también órdenes incompletas: la pantalla de confirmación pregunta
 * por la cuenta o tarjeta que falte. Nunca rellena en silencio una pieza
 * financiera que la persona no dijo.
 */
fun parseComandoVoz(
    raw: String,
    entidadesEntrada: List<EntidadVoz>,
    hoy: LocalDate = hoyEnBogota(),
): ComandoVoz? {
    val texto = plano(raw)
    val entidades = entidadesEntrada.filter { it.archivedAt == null }
    val activos = entidades.filter { !TipoCajita.esPasivo(it.tipo) }
    val cuentas = activos.filter { it.tipo == TipoCajita.CUENTA }
    val pasivos = entidades.filter { TipoCajita.esPasivo(it.tipo) }
    val cajitas = entidades.filter { it.tipo == TipoCajita.CAJITA }
    // El intérprete financiero puntúa todas las cifras y sabe que «100 mil»
    // pesa más que el 2 del nombre «Cuenta 2». Leer el primer número cambiaría
    // el saldo a $2, uno de los errores más peligrosos para una orden de voz.
    val lecturaFinanciera = parseTransaction(
        raw,
        entidades.map { CuentaConocida(it.id, it.nombre) },
        hoy = hoy,
    )
    val monto = lecturaFinanciera.amount
    val fecha = lecturaFinanciera.dateOverride?.takeIf { it.isNotEmpty() }

    val mencionesTodas = mencionadas(texto, entidades)
    val mencionesActivos = mencionadas(texto, activos)
    val mencionesCuentas = mencionadas(texto, cuentas)
    val mencionesPasivos = mencionadas(texto, pasivos)
    val mencionesCajitas = mencionadas(texto, cajitas)

    val diceSaldo =
        RE_SALDO_1.containsMatchIn(texto) ||
            RE_SALDO_2.containsMatchIn(texto) ||
            RE_SALDO_3.containsMatchIn(texto) ||
            RE_SALDO_4.containsMatchIn(texto) ||
            (RE_SALDO_DEUDA.containsMatchIn(texto) && mencionesPasivos.isNotEmpty())

    if (diceSaldo) {
        return ComandoVoz.Saldo(
            cajitaId = if (mencionesTodas.size == 1) mencionesTodas[0].id else null,
            saldoCop = monto ?: if (RE_CERO.containsMatchIn(texto)) 0L else null,
            raw = raw,
        )
    }

    val verboAbono = RE_VERBO_ABONO.containsMatchIn(texto)
    val contextoPasivo = mencionesPasivos.isNotEmpty() || RE_CONTEXTO_PASIVO.containsMatchIn(texto)
    val pareceCompraConTarjeta =
        RE_CON_TARJETA.containsMatchIn(texto) && !RE_PALABRAS_DEUDA.containsMatchIn(texto)

    if (verboAbono && contextoPasivo && !pareceCompraConTarjeta) {
        val fuenteExplicita = trasPreposicion(texto, "desde|con|de", mencionesCuentas)
        return ComandoVoz.Abono(
            deudaId = if (mencionesPasivos.size == 1) mencionesPasivos[0].id else null,
            cuentaId = fuenteExplicita?.id ?: if (mencionesCuentas.size == 1) mencionesCuentas[0].id else null,
            montoCop = monto,
            occurredOn = fecha,
            raw = raw,
        )
    }

    val diceRendimiento = RE_RENDIMIENTO.containsMatchIn(texto)
    val pideRegistrar = RE_REGISTRAR.containsMatchIn(texto)
    if (diceRendimiento && pideRegistrar) {
        return ComandoVoz.Rendimiento(
            cajitaId = if (mencionesCajitas.size == 1) mencionesCajitas[0].id else null,
            montoCop = monto,
            occurredOn = fecha,
            raw = raw,
        )
    }

    val transferenciaCompleta = parseTransferenciaVoz(raw, activos.map { CuentaConocida(it.id, it.nombre) }, hoy)
    if (transferenciaCompleta != null) {
        return ComandoVoz.Transferencia(
            origenId = transferenciaCompleta.origenId,
            destinoId = transferenciaCompleta.destinoId,
            montoCop = transferenciaCompleta.montoCop,
            occurredOn = fecha,
            raw = transferenciaCompleta.raw,
        )
    }

    val verboTransferencia = RE_VERBO_TRANSFERENCIA.containsMatchIn(texto)
    val verboClaramenteInterno = RE_VERBO_INTERNO.containsMatchIn(texto)
    val contextoInterno = RE_CONTEXTO_INTERNO.containsMatchIn(texto)
    if (
        verboTransferencia &&
        (mencionesActivos.size >= 2 || ((verboClaramenteInterno || contextoInterno) && mencionesActivos.isNotEmpty()))
    ) {
        val origen = trasPreposicion(texto, "de|desde", mencionesActivos)
        val destino = trasPreposicion(texto, "a|hacia|para|en", mencionesActivos)
        val ordenadas = mencionesActivos.reversed()
        return ComandoVoz.Transferencia(
            origenId = origen?.id ?: if (mencionesActivos.size >= 2) ordenadas.getOrNull(0)?.id else null,
            destinoId = destino?.id ?: when {
                mencionesActivos.size >= 2 -> ordenadas.getOrNull(1)?.id
                origen != null -> null
                else -> mencionesActivos.getOrNull(0)?.id
            },
            montoCop = monto,
            occurredOn = fecha,
            raw = raw,
        )
    }

    return null
}
