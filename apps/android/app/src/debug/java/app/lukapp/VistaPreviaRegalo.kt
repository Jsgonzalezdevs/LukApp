package app.lukapp

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import app.lukapp.dominio.RegaloPremium
import app.lukapp.ui.mas.DialogoRegaloPremium
import app.lukapp.ui.tema.LukApp
import app.lukapp.ui.tema.PreferenciaTema
import app.lukapp.ui.tema.TemaLukApp

/**
 * El regalo de Premium solo sale si el equipo regaló uno de verdad. Esta pantalla,
 * que no existe en la app publicada, lo enseña con datos de ejemplo para revisarlo:
 * `adb shell am start -n lukApp.App.nativa.debug/app.lukapp.VistaPreviaRegalo --ei dias 30`.
 */
class VistaPreviaRegalo : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val regalo = RegaloPremium(id = 1, dias = intent.getIntExtra("dias", 30), venceEn = intent.getStringExtra("venceEn") ?: "2026-12-23T04:59:00+00:00")
        setContent {
            TemaLukApp(PreferenciaTema.SISTEMA) {
                Box(Modifier.fillMaxSize().background(LukApp.colores.bg)) {
                    DialogoRegaloPremium(regalo, alCerrar = ::finish)
                }
            }
        }
    }
}
