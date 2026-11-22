package app.lukapp.datos

import android.content.Context
import app.lukapp.dominio.Vaquita
import app.lukapp.dominio.vaquitasATexto
import app.lukapp.dominio.vaquitasDeTexto

/**
 * Las vaquitas viven solo en este teléfono, igual que en la web (`lukapp_vaquitas_v1:<usuario>` en localStorage):
 * no pasan por Supabase ni por la copia de seguridad. Una por usuario, para que dos cuentas no se mezclen.
 */
class AlmacenVaquitas(contexto: Context, usuario: String?) {
    private val prefs = contexto.applicationContext.getSharedPreferences("vaquitas", Context.MODE_PRIVATE)
    private val clave = "lukapp_vaquitas_v1:${usuario ?: "local"}"

    fun leer(): List<Vaquita> = vaquitasDeTexto(prefs.getString(clave, null))

    fun guardar(l: List<Vaquita>) { prefs.edit().putString(clave, vaquitasATexto(l)).apply() }
}
