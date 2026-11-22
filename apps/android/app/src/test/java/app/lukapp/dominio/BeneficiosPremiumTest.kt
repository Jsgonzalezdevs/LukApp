package app.lukapp.dominio

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BeneficiosPremiumTest {
    private val cuerpoRegalo = """
        {"codigo":"premium","nombre":"Premium","beneficios":[],
         "suscripcion":{"ciclo":"cortesia","venceEn":"2026-12-23T04:59:00Z"},
         "beneficiosPremium":[
           {"clave":"dictado","titulo":"Registros por voz","detalle":"al mes","tipoValor":"cupo","limite":300,"activo":true},
           {"clave":"asesor_ia","titulo":"Asesor IA","detalle":"consultas al mes","tipoValor":"cupo","limite":null,"activo":true},
           {"clave":"pulso_premium","titulo":"Pulso Premium","detalle":"","tipoValor":"incluido","limite":null,"activo":true},
           {"clave":"extracto","titulo":"Extractos","detalle":"al mes","tipoValor":"cupo","limite":5,"activo":false}
         ]}
    """.trimIndent()

    @Test fun leeElPlanConSuRegalo() {
        val plan = leerPlanBeneficios(cuerpoRegalo)!!
        assertTrue(plan.esPremium)
        assertTrue(plan.esRegalo)
        assertEquals("2026-12-23T04:59:00Z", plan.suscripcion?.venceEn)
        assertEquals(4, plan.beneficiosPremium.size)
    }

    @Test fun soloSeMuestranLosActivos() {
        val plan = leerPlanBeneficios(cuerpoRegalo)!!
        assertEquals(listOf("dictado", "asesor_ia", "pulso_premium"), plan.activos.map { it.clave })
    }

    @Test fun elCupoEnGrande() {
        val (dictado, asesor, pulso) = leerPlanBeneficios(cuerpoRegalo)!!.activos
        assertEquals("300", valorEnGrande(dictado))
        assertEquals("Sin límite", valorEnGrande(asesor))
        assertEquals("Incluido", valorEnGrande(pulso))
        assertEquals("1.500", valorEnGrande(dictado.copy(limite = 1500)))
    }

    @Test fun unPlanPagadoNoEsRegalo() {
        val plan = leerPlanBeneficios("""{"codigo":"premium","beneficiosPremium":[],"suscripcion":{"ciclo":"anual","venceEn":"2027-01-01T00:00:00Z"}}""")!!
        assertTrue(plan.esPremium)
        assertFalse(plan.esRegalo)
    }

    @Test fun elPlanNormalNoTraeSuscripcion() {
        val plan = leerPlanBeneficios("""{"codigo":"normal","beneficiosPremium":[],"suscripcion":null}""")!!
        assertFalse(plan.esPremium)
        assertNull(plan.suscripcion)
        assertNull(leerPlanBeneficios("""{"codigo":"normal","beneficiosPremium":[]}""")!!.suscripcion)
    }

    @Test fun sinCodigoOSinListaEsError() {
        assertNull(leerPlanBeneficios("""{"codigo":"oro","beneficiosPremium":[]}"""))
        assertNull(leerPlanBeneficios("""{"beneficiosPremium":[]}"""))
        assertNull(leerPlanBeneficios("""{"codigo":"premium"}"""))
        assertNull(leerPlanBeneficios("""{"codigo":"premium","beneficiosPremium":{}}"""))
        assertNull(leerPlanBeneficios(""))
        assertNull(leerPlanBeneficios("no es json"))
        assertNull(leerPlanBeneficios("[]"))
    }

    @Test fun unBeneficioRaroSeSaltaSinTumbarLaPagina() {
        val plan = leerPlanBeneficios(
            """{"codigo":"premium","beneficiosPremium":[
                 42, {"titulo":"Sin clave","activo":true}, {"clave":"dictado","activo":true},
                 {"clave":"extracto","titulo":"Extractos","activo":"true"},
                 {"clave":"insights_ia","titulo":"Ideas","tipoValor":"raro","limite":"10","activo":true}
               ]}""",
        )!!
        assertEquals(listOf("extracto", "insights_ia"), plan.beneficiosPremium.map { it.clave })
        // `"true"` como texto no enciende nada.
        assertEquals(listOf("insights_ia"), plan.activos.map { it.clave })
        val ideas = plan.activos.single()
        assertEquals("cupo", ideas.tipoValor)
        assertNull(ideas.limite)
    }

    @Test fun cadaBeneficioDelCatalogoTieneSuGuia() {
        val claves = listOf("dictado", "asesor_ia", "extracto", "espacios_compartidos", "integrantes_espacio", "insights_ia", "pulso_premium")
        assertEquals(claves.toSet(), GUIA_BENEFICIOS.keys)
        assertEquals(DestinoBeneficio.ASESOR, GUIA_BENEFICIOS["asesor_ia"]?.destino)
        assertEquals(DestinoBeneficio.EXTRACTOS, GUIA_BENEFICIOS["extracto"]?.destino)
        assertEquals(DestinoBeneficio.ESPACIOS, GUIA_BENEFICIOS["integrantes_espacio"]?.destino)
    }
}
