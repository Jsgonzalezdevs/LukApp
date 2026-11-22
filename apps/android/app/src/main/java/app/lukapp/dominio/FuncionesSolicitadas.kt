package app.lukapp.dominio

import kotlinx.serialization.Serializable

/** Origen: `FuncionesSolicitadasView.tsx` (`Funcion`). El conteo de votos lo mantiene un trigger de la base. */
@Serializable
data class FuncionSolicitada(val id: String, val titulo: String, val descripcion: String? = null, val votos: Int = 0)

/**
 * El voto optimista de la web: la flecha y el número cambian antes de que el servidor confirme, y si falla
 * se revierte con `yaVotado` invertido. Nunca baja de cero.
 */
fun conVoto(funciones: List<FuncionSolicitada>, id: String, yaVotado: Boolean): List<FuncionSolicitada> =
    funciones.map { if (it.id == id) it.copy(votos = maxOf(it.votos + if (yaVotado) -1 else 1, 0)) else it }

fun conMisVotos(votos: Set<String>, id: String, yaVotado: Boolean): Set<String> = if (yaVotado) votos - id else votos + id
