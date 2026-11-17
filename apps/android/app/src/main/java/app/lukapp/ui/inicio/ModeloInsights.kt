package app.lukapp.ui.inicio

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.lukapp.datos.ClienteAsesor
import app.lukapp.datos.Preferencias
import app.lukapp.dominio.Insight
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.json.put

/**
 * `useAiInsights` + `useDismissedInsights`. Los insights locales se calculan en pantalla (no necesitan red);
 * aquí viven el plan, los de IA —solo si el plan los incluye— y los descartes.
 */
class ModeloInsights(private val cliente: ClienteAsesor, private val preferencias: Preferencias) : ViewModel() {
    val prestaciones = MutableStateFlow(ClienteAsesor.Prestaciones())
    val insightsIa = MutableStateFlow<List<Insight>>(emptyList())
    val cargandoIa = MutableStateFlow(false)
    /** id → cuándo se descartó (ms). */
    private val descartes = MutableStateFlow<Map<String, Long>>(emptyMap())
    val descartados get() = descartes

    private var ultimaClave = ""

    init {
        viewModelScope.launch {
            val guardado = preferencias.datos.first()[Preferencias.Claves.INSIGHTS_DESCARTADOS]
            val ahora = System.currentTimeMillis()
            val vigentes = leer(guardado).filterValues { ahora - it < VIGENCIA_MS }
            descartes.value = vigentes
            if (guardado != null && vigentes.size != leer(guardado).size) escribir(vigentes)
        }
    }

    /** Vuelve a leer el plan; si cambió lo que incluye, la clave de la última carga ya no sirve. */
    fun actualizarPlan(mes: String, nTransacciones: Int) {
        viewModelScope.launch {
            val nuevo = cliente.prestaciones()
            prestaciones.value = nuevo
            cargarIa(mes, nTransacciones, forzar = false)
        }
    }

    /** Pide los de IA una vez por (mes, cantidad de movimientos), como `lastFetchKey`. Sin la prestación no gasta llamadas. */
    fun cargarIa(mes: String, nTransacciones: Int, forzar: Boolean) {
        if (!prestaciones.value.insightsIa) { insightsIa.value = emptyList(); cargandoIa.value = false; return }
        val clave = "$mes-$nTransacciones"
        if (!forzar && clave == ultimaClave) return
        ultimaClave = clave
        viewModelScope.launch {
            cargandoIa.value = true
            // Si falla, se quedan los locales: no se borra lo que ya había mostrado la IA.
            cliente.insightsIa()?.let { insightsIa.value = it }
            cargandoIa.value = false
        }
    }

    fun refrescar(mes: String, nTransacciones: Int) { ultimaClave = ""; cargarIa(mes, nTransacciones, forzar = true) }

    fun descartar(id: String) {
        val nuevo = descartes.value + (id to System.currentTimeMillis())
        descartes.value = nuevo
        viewModelScope.launch { escribir(nuevo) }
    }

    private suspend fun escribir(m: Map<String, Long>) {
        val json = if (m.isEmpty()) null else Json.encodeToString(JsonArray.serializer(), buildJsonArray {
            m.forEach { (id, t) -> add(buildJsonObject { put("id", id); put("dismissedAt", t) }) }
        })
        preferencias.guardar(Preferencias.Claves.INSIGHTS_DESCARTADOS, json)
    }

    private fun leer(texto: String?): Map<String, Long> = runCatching {
        (Json.parseToJsonElement(texto ?: return emptyMap()) as JsonArray).mapNotNull {
            val o = it as? JsonObject ?: return@mapNotNull null
            val id = (o["id"] as? JsonPrimitive)?.contentOrNull ?: return@mapNotNull null
            val t = (o["dismissedAt"] as? JsonPrimitive)?.longOrNull ?: return@mapNotNull null
            id to t
        }.toMap()
    }.getOrDefault(emptyMap())

    private companion object { const val VIGENCIA_MS = 24L * 3600_000 }
}
