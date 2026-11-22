package app.lukapp.dominio

/** Qué recorrido toca enseñar ahora. */
enum class GuiaPendiente { NINGUNA, BASICA, SECCION }

/** Secciones con globo propio la primera vez que se entra (`PASOS_POR_SECCION` sin el Calendario, que aquí es una pantalla encima). */
val SECCIONES_CON_GUIA = setOf("dinero", "mes", "asesor", "ajustes")

/**
 * Origen: `LukAppApp.tsx` (`guiaBasicaAbierta` / `guiaSeccionAbierta`). Primero el básico, una sola vez al terminar la
 * bienvenida; después, un globo por sitio la primera vez que se entra, y solo cuando el básico ya pasó: llegar a
 * Dinero con dos capas de explicación encima es lo que se quería evitar. Nunca con una pantalla encima, porque
 * iluminar lo de debajo no señalaría nada.
 */
fun guiaPendiente(bienvenidaTerminada: Boolean, basicaVista: Boolean, seccionesVistas: List<String>, seccion: String, hayPanelAbierto: Boolean): GuiaPendiente = when {
    !bienvenidaTerminada || hayPanelAbierto -> GuiaPendiente.NINGUNA
    !basicaVista -> if (seccion == "inicio") GuiaPendiente.BASICA else GuiaPendiente.NINGUNA
    seccion in SECCIONES_CON_GUIA && seccion !in seccionesVistas -> GuiaPendiente.SECCION
    else -> GuiaPendiente.NINGUNA
}
