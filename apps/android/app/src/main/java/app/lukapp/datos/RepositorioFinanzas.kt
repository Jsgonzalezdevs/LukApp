package app.lukapp.datos

import android.content.Context
import app.lukapp.dominio.BonoRacha
import app.lukapp.dominio.Libro
import app.lukapp.seguridad.ArchivoCifrado
import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Count
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

enum class EstadoSincronizacion { CARGANDO, AL_DIA, SIN_CONEXION, ERROR }

/**
 * El libro financiero de la persona: lo mismo que `RepositorioConCola` +
 * `RepositorioSupabase` de la web, con las mismas garantías.
 *
 * - Lee las 9 tablas paginando de a 500 (repositorioSupabase.ts:119-180).
 * - Escribe SOLO con la RPC `aplicar_cambios_financieros`, que es atómica e
 *   idempotente por `id_operacion`: reintentar un cambio que ya llegó no lo
 *   duplica. Por eso cada cambio se guarda en la cola con su id ANTES de
 *   enviarlo; si la app muere o no hay señal, se reenvía el mismo id.
 * - La cola se vacía en orden y se detiene en el primer fallo, para no aplicar
 *   un cambio que depende de otro que todavía no llegó.
 * - Si el servidor devuelve todo vacío y hay copia local, se conserva la local
 *   (misma salvaguarda que la web contra perder datos por una lectura rara).
 */
class RepositorioFinanzas(private val supabase: SupabaseClient, private val contexto: Context) {

    private val json = Json { ignoreUnknownKeys = true }
    private val candado = Mutex()

    private val _libro = MutableStateFlow(Libro())
    val libro: StateFlow<Libro> = _libro.asStateFlow()

    private val _estado = MutableStateFlow(EstadoSincronizacion.CARGANDO)
    val estado: StateFlow<EstadoSincronizacion> = _estado.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    // Van aparte del libro: no son movimientos y no deben terminar en la copia ni en un respaldo.
    private val _bonosRacha = MutableStateFlow<List<BonoRacha>>(emptyList())
    val bonosRacha: StateFlow<List<BonoRacha>> = _bonosRacha.asStateFlow()

    private var uid: String? = null
    private var copia: ArchivoCifrado? = null
    private var cola: ArchivoCifrado? = null

    /** Abre el libro de esta cuenta: primero la copia local (abre al instante), luego el servidor. */
    suspend fun abrir(usuario: String) = withContext(Dispatchers.IO) {
        candado.withLock {
            uid = usuario
            // Un archivo por cuenta: si alguien cambia de cuenta en el mismo teléfono, no ve el libro anterior.
            copia = ArchivoCifrado(contexto, "libro_$usuario")
            cola = ArchivoCifrado(contexto, "cola_$usuario")
            copia?.leer()?.let { runCatching { _libro.value = libroDesdeJson(json.parseToJsonElement(it).jsonObject) } }
        }
        sincronizar()
    }

    fun cerrar() {
        uid = null; copia = null; cola = null
        _libro.value = Libro()
        _bonosRacha.value = emptyList()
        _estado.value = EstadoSincronizacion.CARGANDO
    }

    /** Borra la copia local y la cola de la cuenta (al cerrar sesión). */
    fun olvidarLocal(usuario: String) {
        ArchivoCifrado(contexto, "libro_$usuario").borrar()
        ArchivoCifrado(contexto, "cola_$usuario").borrar()
    }

    val pendientes: Int get() = leerCola().size

    suspend fun sincronizar() = withContext(Dispatchers.IO) {
        val usuario = uid ?: return@withContext
        candado.withLock {
            _estado.value = if (_libro.value == Libro()) EstadoSincronizacion.CARGANDO else _estado.value
            try {
                vaciarCola(usuario)
                val remoto = cargarTodo(usuario)
                val local = _libro.value
                val conservarLocal = remoto == Libro() && local != Libro()
                if (conservarLocal) {
                    // Respuesta vacía con copia local válida: suele ser RLS o sesión aún no lista.
                    // En una app de dinero es mejor mostrar lo conocido que reemplazarlo por ceros.
                    _estado.value = EstadoSincronizacion.ERROR
                    _error.value = "El servidor devolvió un historial vacío. Conservamos la copia de este dispositivo; revisa tu sesión antes de reemplazarla."
                } else {
                    _libro.value = remoto
                    copia?.escribir(json.encodeToString(JsonObject.serializer(), libroAJson(remoto, usuario)))
                    _estado.value = EstadoSincronizacion.AL_DIA
                    _error.value = null
                }
            } catch (e: SinConexion) {
                _estado.value = EstadoSincronizacion.SIN_CONEXION
            } catch (e: Exception) {
                _estado.value = EstadoSincronizacion.ERROR
                _error.value = (e as? ErrorLukApp)?.message ?: traducirError("No se pudo sincronizar", e).message
            }
        }
        // Es un extra: si falla (o la tabla aún no existe), la racha sale solo de los movimientos.
        runCatching {
            supabase.from("racha_bonos").select(Columns.list("inicio_racha", "dias")) { filter { eq("user_id", usuario) } }
                .decodeList<JsonObject>().mapNotNull { fila ->
                    val inicio = fila["inicio_racha"]?.jsonPrimitive?.content ?: return@mapNotNull null
                    val dias = fila["dias"]?.jsonPrimitive?.content?.toIntOrNull() ?: return@mapNotNull null
                    BonoRacha(inicio, dias)
                }
        }.onSuccess { if (uid == usuario) _bonosRacha.value = it }
    }

    /**
     * Aplica un cambio: se ve al instante, queda en la cola cifrada y se envía.
     * Si no hay red, sigue en la cola y se manda en la próxima sincronización.
     * Un error del servidor (no de red) se propaga para que la pantalla lo diga.
     */
    suspend fun aplicar(cambios: Cambios) = withContext(Dispatchers.IO) {
        val usuario = uid ?: throw ErrorLukApp("Tu sesión no está activa. Vuelve a entrar.")
        candado.withLock {
            val anterior = _libro.value
            _libro.update { aplicarLocal(it, cambios) }
            val entrada = cargaRpc(cambios, usuario)
            escribirCola(leerCola() + entrada)
            try {
                vaciarCola(usuario)
                copia?.escribir(json.encodeToString(JsonObject.serializer(), libroAJson(_libro.value, usuario)))
                _estado.value = EstadoSincronizacion.AL_DIA
            } catch (e: SinConexion) {
                _estado.value = EstadoSincronizacion.SIN_CONEXION
                copia?.escribir(json.encodeToString(JsonObject.serializer(), libroAJson(_libro.value, usuario)))
            } catch (e: Exception) {
                // El servidor lo rechazó: sacarlo de la cola y deshacer lo que se mostró.
                escribirCola(leerCola().filterNot { it == entrada })
                _libro.value = anterior
                throw e
            }
        }
    }

    // ── lectura remota ──

    private suspend fun leerTabla(tabla: String, clave: String = "id", usuario: String): List<JsonObject> {
        val filas = mutableListOf<JsonObject>()
        while (true) {
            val respuesta = try {
                supabase.from(tabla).select(Columns.ALL) {
                    count(Count.EXACT)
                    filter { eq("user_id", usuario) }
                    order(clave, Order.ASCENDING)
                    range(filas.size.toLong(), filas.size.toLong() + 499)
                }
            } catch (e: Exception) {
                throw traducirError(mensajeLectura[tabla] ?: "No se pudo leer $tabla", e)
            }
            val pagina = respuesta.decodeList<JsonObject>()
            filas += pagina
            val total = respuesta.countOrNull()
            if (total != null) {
                if (filas.size >= total) break
                if (pagina.isEmpty()) throw ErrorLukApp("El historial llegó incompleto. Vuelve a sincronizar antes de hacer cambios.")
            } else if (pagina.size < 500) break
        }
        return filas
    }

    private suspend fun cargarTodo(usuario: String): Libro = coroutineScope {
        val tablas = listOf("transacciones", "cajitas", "cajita_movimientos", "metas", "categorias",
            "contactos", "presupuestos", "recurrentes", "revisiones_dudosas")
        val r = tablas.map { t -> async { leerTabla(t, if (t == "presupuestos") "categoria" else "id", usuario) } }.awaitAll()
        Libro(
            transacciones = r[0].map(Filas::aTransaccion),
            cajitas = r[1].map(Filas::aCajita),
            movimientos = r[2].map(Filas::aMovimiento),
            metas = r[3].map(Filas::aMeta),
            categorias = r[4].map(Filas::aCategoria),
            contactos = r[5].map(Filas::aContacto),
            presupuestos = r[6].map(Filas::aPresupuesto),
            recurrentes = r[7].map(Filas::aRecurrente),
            revisiones = r[8].map(Filas::aRevision),
        )
    }

    private val mensajeLectura = mapOf(
        "transacciones" to "No se pudieron leer los movimientos",
        "cajitas" to "No se pudieron leer las cajitas",
        "cajita_movimientos" to "No se pudo leer el historial de cajitas",
        "metas" to "No se pudieron leer las metas",
        "categorias" to "No se pudieron leer las categorías",
        "contactos" to "No se pudieron leer los contactos",
        "presupuestos" to "No se pudieron leer los presupuestos",
        "recurrentes" to "No se pudieron leer los recurrentes",
        "revisiones_dudosas" to "No se pudieron leer las revisiones",
    )

    // ── escritura: cola + RPC ──

    private fun leerCola(): List<JsonObject> =
        cola?.leer()?.let { runCatching { json.parseToJsonElement(it).jsonArray.map { e -> e.jsonObject } }.getOrNull() } ?: emptyList()

    private fun escribirCola(entradas: List<JsonObject>) {
        if (entradas.isEmpty()) cola?.borrar() else cola?.escribir(json.encodeToString(JsonArray.serializer(), JsonArray(entradas)))
    }

    private suspend fun vaciarCola(usuario: String) {
        var pendientes = leerCola()
        while (pendientes.isNotEmpty()) {
            val entrada = pendientes.first()
            try {
                supabase.postgrest.rpc("aplicar_cambios_financieros", entrada)
            } catch (e: Exception) {
                throw traducirError("No se pudo completar la operación financiera", e)
            }
            pendientes = pendientes.drop(1)
            escribirCola(pendientes)
        }
    }

    private fun cargaRpc(c: Cambios, usuario: String): JsonObject {
        val g = c.guardar
        val guardar = buildJsonObject {
            fun <T> tabla(nombre: String, filas: List<T>, a: (T, String) -> JsonObject) {
                if (filas.isNotEmpty() || c.reemplazar) put(nombre, JsonArray(filas.map { a(it, usuario) }))
            }
            tabla("transacciones", g.transacciones, Filas::desdeTransaccion)
            tabla("cajitas", g.cajitas, Filas::desdeCajita)
            tabla("cajita_movimientos", g.movimientos, Filas::desdeMovimiento)
            tabla("metas", g.metas, Filas::desdeMeta)
            tabla("categorias", g.categorias, Filas::desdeCategoria)
            tabla("contactos", g.contactos, Filas::desdeContacto)
            tabla("presupuestos", g.presupuestos, Filas::desdePresupuesto)
            tabla("recurrentes", g.recurrentes, Filas::desdeRecurrente)
            tabla("revisiones_dudosas", g.revisiones, Filas::desdeRevision)
        }
        val borrar = buildJsonObject {
            c.borrar.forEach { (tabla, ids) ->
                val nombre = when (tabla) { "cajitaMovimientos" -> "cajita_movimientos"; "revisiones" -> "revisiones_dudosas"; else -> tabla }
                put(nombre, buildJsonArray { ids.forEach { add(JsonPrimitive(it)) } })
            }
        }
        return buildJsonObject {
            put("cambios", buildJsonObject { put("guardar", guardar); put("borrar", borrar); put("reemplazar", c.reemplazar) })
            put("id_operacion", c.idOperacion)
        }
    }

    // ── copia local ──

    private fun libroAJson(l: Libro, usuario: String) = buildJsonObject {
        put("transacciones", JsonArray(l.transacciones.map { Filas.desdeTransaccion(it, usuario) }))
        put("cajitas", JsonArray(l.cajitas.map { Filas.desdeCajita(it, usuario) }))
        put("cajita_movimientos", JsonArray(l.movimientos.map { Filas.desdeMovimiento(it, usuario) }))
        put("metas", JsonArray(l.metas.map { Filas.desdeMeta(it, usuario) }))
        put("categorias", JsonArray(l.categorias.map { Filas.desdeCategoria(it, usuario) }))
        put("contactos", JsonArray(l.contactos.map { Filas.desdeContacto(it, usuario) }))
        put("presupuestos", JsonArray(l.presupuestos.map { Filas.desdePresupuesto(it, usuario) }))
        put("recurrentes", JsonArray(l.recurrentes.map { Filas.desdeRecurrente(it, usuario) }))
        put("revisiones_dudosas", JsonArray(l.revisiones.map { Filas.desdeRevision(it, usuario) }))
    }

    private fun libroDesdeJson(o: JsonObject): Libro {
        fun filas(c: String): List<JsonObject> = (o[c] as? JsonArray)?.map { it.jsonObject } ?: emptyList()
        return Libro(
            transacciones = filas("transacciones").map(Filas::aTransaccion),
            cajitas = filas("cajitas").map(Filas::aCajita),
            movimientos = filas("cajita_movimientos").map(Filas::aMovimiento),
            metas = filas("metas").map(Filas::aMeta),
            categorias = filas("categorias").map(Filas::aCategoria),
            contactos = filas("contactos").map(Filas::aContacto),
            presupuestos = filas("presupuestos").map(Filas::aPresupuesto),
            recurrentes = filas("recurrentes").map(Filas::aRecurrente),
            revisiones = filas("revisiones_dudosas").map(Filas::aRevision),
        )
    }
}

/** El mismo efecto que tendrá la RPC, aplicado ya en memoria para que la pantalla no espere a la red. */
internal fun aplicarLocal(libro: Libro, c: Cambios): Libro {
    if (c.reemplazar) return c.guardar
    fun <T> fusionar(actual: List<T>, nuevos: List<T>, borrar: List<String>?, id: (T) -> String): List<T> {
        val porId = LinkedHashMap<String, T>()
        actual.forEach { porId[id(it)] = it }
        borrar?.forEach { porId.remove(it) }
        nuevos.forEach { porId[id(it)] = it }
        return porId.values.toList()
    }
    val b = c.borrar
    val g = c.guardar
    return Libro(
        transacciones = fusionar(libro.transacciones, g.transacciones, b["transacciones"]) { it.id },
        cajitas = fusionar(libro.cajitas, g.cajitas, b["cajitas"]) { it.id },
        movimientos = fusionar(libro.movimientos, g.movimientos, b["cajitaMovimientos"] ?: b["cajita_movimientos"]) { it.id },
        metas = fusionar(libro.metas, g.metas, b["metas"]) { it.id },
        categorias = fusionar(libro.categorias, g.categorias, b["categorias"]) { it.id },
        contactos = fusionar(libro.contactos, g.contactos, b["contactos"]) { it.id },
        presupuestos = fusionar(libro.presupuestos, g.presupuestos, b["presupuestos"]) { it.categoria },
        recurrentes = fusionar(libro.recurrentes, g.recurrentes, b["recurrentes"]) { it.id },
        revisiones = fusionar(libro.revisiones, g.revisiones, b["revisiones"] ?: b["revisiones_dudosas"]) { it.id },
    )
}
