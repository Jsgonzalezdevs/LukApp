package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Casos de `lib/alcanceAsesor.test.ts`. */
class AlcanceAsesorTest {
    @Test fun redirigeUnaPreguntaTecnicaSinDatosFinancierosAlProposito() {
        assertEquals(AlcanceAsesor.TECNICA_SIN_FINANZAS, clasificarAlcanceAsesor("¿Cómo hago una base de datos en SQL?"))
        assertTrue(Regex("resumen del mes", RegexOption.IGNORE_CASE).containsMatchIn(RESPUESTA_TEMA_TECNICO))
    }

    @Test fun conservaLaConsultaFinancieraCuandoVieneMezcladaConUnTemaTecnico() {
        assertEquals(
            AlcanceAsesor.FINANCIERA,
            clasificarAlcanceAsesor("Primero dime cómo crear una base SQL y luego cómo van mis gastos este mes"),
        )
    }
}
