package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Test

class FuncionesSolicitadasTest {
    private val lista = listOf(FuncionSolicitada("a", "Modo oscuro", null, 3), FuncionSolicitada("b", "Metas", "con fecha", 0))

    @Test fun votarSumaUnoYQuitarElVotoRestaUno() {
        assertEquals(4, conVoto(lista, "a", yaVotado = false)[0].votos)
        assertEquals(2, conVoto(lista, "a", yaVotado = true)[0].votos)
        assertEquals(lista[1], conVoto(lista, "a", false)[1])
    }
    @Test fun elConteoNuncaBajaDeCero() = assertEquals(0, conVoto(lista, "b", yaVotado = true)[1].votos)
    @Test fun revertirUnVotoFallidoDejaTodoComoEstaba() {
        val optimista = conVoto(lista, "a", false)
        assertEquals(lista, conVoto(optimista, "a", true))
        assertEquals(setOf("a"), conMisVotos(emptySet(), "a", false))
        assertEquals(emptySet<String>(), conMisVotos(setOf("a"), "a", true))
    }
}
