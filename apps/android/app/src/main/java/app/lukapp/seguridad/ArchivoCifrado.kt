package app.lukapp.seguridad

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.io.File
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Un archivo en el almacenamiento privado de la app, cifrado con AES-GCM y una
 * llave del Keystore. Es para la copia local del libro financiero (puede pesar
 * megas: SharedPreferences no sirve) y la cola de cambios sin enviar: son
 * movimientos y saldos de una persona, no van en texto plano aunque el
 * almacenamiento interno ya sea privado, porque un respaldo o un teléfono con
 * root los dejaría a la vista.
 */
class ArchivoCifrado(contexto: Context, nombre: String) {
    private val archivo = File(contexto.filesDir, "$nombre.cifrado")
    private val alias = "lukapp_archivo_$nombre"

    private fun llave(): SecretKey {
        val almacen = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (almacen.getKey(alias, null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(
                KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setKeySize(256)
                    .build(),
            )
        }.generateKey()
    }

    @Synchronized
    fun escribir(texto: String) {
        val cifrador = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, llave()) }
        val datos = cifrador.iv + cifrador.doFinal(texto.toByteArray(Charsets.UTF_8))
        // Escribir aparte y renombrar: si la app muere a mitad, queda la copia anterior entera.
        val temporal = File(archivo.parentFile, archivo.name + ".tmp")
        temporal.writeBytes(datos)
        if (!temporal.renameTo(archivo)) { archivo.delete(); temporal.renameTo(archivo) }
    }

    @Synchronized
    fun leer(): String? {
        if (!archivo.exists()) return null
        return runCatching {
            val datos = archivo.readBytes()
            val cifrador = Cipher.getInstance("AES/GCM/NoPadding")
                .apply { init(Cipher.DECRYPT_MODE, llave(), GCMParameterSpec(128, datos.copyOfRange(0, 12))) }
            String(cifrador.doFinal(datos.copyOfRange(12, datos.size)), Charsets.UTF_8)
        }.getOrElse { archivo.delete(); null }
    }

    @Synchronized
    fun borrar() { archivo.delete() }
}
