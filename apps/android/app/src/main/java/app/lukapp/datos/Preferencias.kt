package app.lukapp.datos

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.almacenPreferencias by preferencesDataStore(name = "preferencias")

/**
 * Preferencias NO sensibles del teléfono (las que la web guarda en localStorage).
 * Las claves se llaman igual que en la web para que buscar una lleve a la otra.
 * Nada financiero vive aquí: eso va en el ArchivoCifrado del repositorio.
 */
class Preferencias(private val contexto: Context) {

    object Claves {
        val TEMA = stringPreferencesKey("finanzas:tema")
        val RECORDAR_USUARIO = booleanPreferencesKey("lukapp_recordar_usuario")
        val CORREO_GUARDADO = stringPreferencesKey("lukapp_correo_guardado")
        /** Propia de Android: la PWA no tenía desbloqueo biométrico. */
        /** Insights descartados: JSON `[{id, dismissedAt}]`, como en la web; cada uno reaparece a las 24 h. */
        val INSIGHTS_DESCARTADOS = stringPreferencesKey("dismissed-insights")
        val DESBLOQUEO_BIOMETRICO = booleanPreferencesKey("android:desbloqueo_biometrico")
    }

    val datos: Flow<Preferences> = contexto.almacenPreferencias.data

    val tema: Flow<String?> = datos.map { it[Claves.TEMA] }
    val recordarUsuario: Flow<Boolean> = datos.map { it[Claves.RECORDAR_USUARIO] ?: true }
    val correoGuardado: Flow<String> = datos.map { it[Claves.CORREO_GUARDADO].orEmpty() }
    val desbloqueoBiometrico: Flow<Boolean> = datos.map { it[Claves.DESBLOQUEO_BIOMETRICO] ?: false }

    suspend fun <T> guardar(clave: Preferences.Key<T>, valor: T?) {
        contexto.almacenPreferencias.edit { if (valor == null) it.remove(clave) else it[clave] = valor }
    }
}
