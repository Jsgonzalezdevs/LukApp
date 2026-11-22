package app.lukapp.dominio

import java.text.Normalizer

/** Origen: `Onboarding.tsx` (`FuenteDinero`). */
data class FuenteDinero(val nombre: String, val claseCuenta: String)

/** Origen: `Onboarding.tsx` (`FUENTES`). Solo entidades externas: Efectivo ya viene creado. */
val FUENTES_DINERO = listOf(
    FuenteDinero("Bancolombia", ClaseCuenta.BANCO), FuenteDinero("Nu", ClaseCuenta.BANCO), FuenteDinero("Nequi", ClaseCuenta.BILLETERA),
    FuenteDinero("Daviplata", ClaseCuenta.BILLETERA), FuenteDinero("Davivienda", ClaseCuenta.BANCO), FuenteDinero("Lulo Bank", ClaseCuenta.BANCO),
    FuenteDinero("BBVA", ClaseCuenta.BANCO), FuenteDinero("Falabella", ClaseCuenta.BANCO), FuenteDinero("Otro", ClaseCuenta.BANCO),
)

/** Origen: `Onboarding.tsx` (`esNombreEfectivo`): «Efectivo» sin tildes ni mayúsculas, como palabra completa. */
fun esNombreEfectivo(valor: String): Boolean =
    Regex("\\befectivo\\b").containsMatchIn(Normalizer.normalize(valor, Normalizer.Form.NFD).replace(Regex("[\\u0300-\\u036f]"), "").trim().lowercase())

/** Lo que la bienvenida va a crear: una cuenta (banco y clase) o nada. `otroEsEfectivo` bloquea «Continuar». */
data class EleccionDinero(val banco: String?, val claseCuenta: String?, val otroEsEfectivo: Boolean)

/**
 * Origen: `Onboarding.tsx` (`bancoFinal` / `claseCuentaFinal`). «Otro» pide escribir el banco; si lo escrito es
 * «Efectivo» no se crea nada (ya existe) y se avisa; sin fuente elegida tampoco se crea cuenta.
 */
fun eleccionDeFuente(fuente: FuenteDinero?, otroBanco: String): EleccionDinero {
    val otroEsEfectivo = fuente?.nombre == "Otro" && esNombreEfectivo(otroBanco)
    val banco = when {
        fuente?.nombre == "Otro" -> if (otroEsEfectivo) null else otroBanco.trim().ifEmpty { null }
        else -> fuente?.nombre
    }
    return EleccionDinero(banco, if (banco != null) fuente?.claseCuenta ?: ClaseCuenta.BANCO else null, otroEsEfectivo)
}

/** Teclado de la bienvenida: sin ceros a la izquierda y como mucho 12 dígitos. */
fun agregarDigitos(actual: String, nuevos: String): String = (actual + nuevos).replaceFirst(Regex("^0+(?=\\d)"), "").take(12)
