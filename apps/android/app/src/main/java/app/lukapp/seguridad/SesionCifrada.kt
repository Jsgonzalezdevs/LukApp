package app.lukapp.seguridad

import io.github.jan.supabase.auth.SessionManager
import io.github.jan.supabase.auth.exception.NoSessionFoundException
import io.github.jan.supabase.auth.user.UserSession
import kotlinx.serialization.json.Json

/** Le dice a supabase-kt que guarde la sesión en el almacén cifrado y no en texto plano. */
class SesionCifrada(private val almacen: AlmacenCifrado) : SessionManager {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    override suspend fun saveSession(session: UserSession) =
        almacen.guardar(CLAVE, json.encodeToString(UserSession.serializer(), session))

    override suspend fun loadSession(): UserSession =
        almacen.leer(CLAVE)?.let { runCatching { json.decodeFromString(UserSession.serializer(), it) }.getOrNull() }
            ?: throw NoSessionFoundException()

    override suspend fun deleteSession() = almacen.borrar(CLAVE)

    private companion object { const val CLAVE = "sesion_supabase" }
}
