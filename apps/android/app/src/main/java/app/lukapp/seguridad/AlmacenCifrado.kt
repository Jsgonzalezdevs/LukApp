package app.lukapp.seguridad

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Guarda textos cifrados con AES-GCM usando una llave que nunca sale del Keystore.
 *
 * La sesión de Supabase (access y refresh token) es lo único que permite leer las
 * finanzas de alguien sin su contraseña; por eso no se guarda en texto plano ni en
 * DataStore. Si la llave se invalida (restauración, cambio de bloqueo) el texto
 * deja de descifrarse y se trata como "sin sesión": volver a entrar es preferible
 * a abrir con datos corruptos.
 */
class AlmacenCifrado(contexto: Context, nombre: String) {

    private val preferencias = contexto.getSharedPreferences("cifrado_$nombre", Context.MODE_PRIVATE)
    private val alias = "lukapp_$nombre"

    private fun llave(): SecretKey {
        val almacen = KeyStore.getInstance(PROVEEDOR).apply { load(null) }
        (almacen.getKey(alias, null) as? SecretKey)?.let { return it }
        val generador = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, PROVEEDOR)
        generador.init(
            KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build(),
        )
        return generador.generateKey()
    }

    fun guardar(clave: String, valor: String) {
        val cifrador = Cipher.getInstance(TRANSFORMACION).apply { init(Cipher.ENCRYPT_MODE, llave()) }
        val cifrado = cifrador.doFinal(valor.toByteArray(Charsets.UTF_8))
        val paquete = cifrador.iv + cifrado
        preferencias.edit().putString(clave, Base64.encodeToString(paquete, Base64.NO_WRAP)).apply()
    }

    fun leer(clave: String): String? {
        val texto = preferencias.getString(clave, null) ?: return null
        return runCatching {
            val paquete = Base64.decode(texto, Base64.NO_WRAP)
            val iv = paquete.copyOfRange(0, LARGO_IV)
            val cifrador = Cipher.getInstance(TRANSFORMACION)
                .apply { init(Cipher.DECRYPT_MODE, llave(), GCMParameterSpec(128, iv)) }
            String(cifrador.doFinal(paquete.copyOfRange(LARGO_IV, paquete.size)), Charsets.UTF_8)
        }.getOrElse {
            borrar(clave)
            null
        }
    }

    fun borrar(clave: String) {
        preferencias.edit().remove(clave).apply()
    }

    private companion object {
        const val PROVEEDOR = "AndroidKeyStore"
        const val TRANSFORMACION = "AES/GCM/NoPadding"
        const val LARGO_IV = 12
    }
}
