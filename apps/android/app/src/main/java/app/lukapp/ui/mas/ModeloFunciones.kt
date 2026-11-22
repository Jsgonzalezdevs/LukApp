package app.lukapp.ui.mas

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.lukapp.datos.ClienteFunciones
import app.lukapp.dominio.FuncionSolicitada
import app.lukapp.dominio.conMisVotos
import app.lukapp.dominio.conVoto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Estado de Funciones solicitadas (FuncionesSolicitadasView.tsx). `funciones == null` es «Cargando…». */
class ModeloFunciones(private val cliente: ClienteFunciones) : ViewModel() {
    private val _funciones = MutableStateFlow<List<FuncionSolicitada>?>(null)
    val funciones: StateFlow<List<FuncionSolicitada>?> = _funciones.asStateFlow()
    private val _misVotos = MutableStateFlow<Set<String>>(emptySet())
    val misVotos: StateFlow<Set<String>> = _misVotos.asStateFlow()
    private val _votando = MutableStateFlow<Set<String>>(emptySet())
    val votando: StateFlow<Set<String>> = _votando.asStateFlow()
    private val _enviando = MutableStateFlow(false)
    val enviando: StateFlow<Boolean> = _enviando.asStateFlow()
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    fun cargar() {
        _error.value = null
        viewModelScope.launch {
            runCatching { cliente.listar() }
                .onSuccess { (f, v) -> _funciones.value = f; _misVotos.value = v }
                .onFailure { _error.value = it.message ?: "No se pudieron cargar las funciones solicitadas" }
        }
    }

    fun votar(id: String) {
        if (id in _votando.value) return
        val yaVotado = id in _misVotos.value
        _votando.update { it + id }
        // Optimista: se ve el cambio antes de que el servidor responda.
        _misVotos.update { conMisVotos(it, id, yaVotado) }
        _funciones.update { it?.let { l -> conVoto(l, id, yaVotado) } }
        viewModelScope.launch {
            runCatching { cliente.votar(id, yaVotado) }.onFailure {
                // El voto no se guardó: se revierte lo optimista para no mentirle a la pantalla.
                _misVotos.update { v -> conMisVotos(v, id, !yaVotado) }
                _funciones.update { f -> f?.let { l -> conVoto(l, id, !yaVotado) } }
                _error.value = it.message ?: "No se pudo registrar el voto"
            }
            _votando.update { it - id }
        }
    }

    /** Devuelve si se envió, para que la pantalla cierre el formulario solo entonces. */
    suspend fun proponer(titulo: String, descripcion: String): Boolean {
        if (titulo.isBlank()) return false
        _enviando.value = true
        _error.value = null
        return runCatching { cliente.proponer(titulo, descripcion) }
            .onSuccess { nueva -> _funciones.update { listOf(nueva) + (it ?: emptyList()) } }
            .onFailure { _error.value = it.message ?: "No se pudo enviar la idea" }
            .isSuccess.also { _enviando.value = false }
    }
}
