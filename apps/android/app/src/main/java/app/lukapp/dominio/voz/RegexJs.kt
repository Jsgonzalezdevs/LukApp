package app.lukapp.dominio.voz

import java.util.regex.Pattern

/**
 * Compila una expresión regular escrita en sintaxis de JavaScript para que
 * se comporte en la JVM y en Android exactamente como en el navegador.
 *
 * Por qué hace falta: el intérprete de voz web está lleno de `\b`, `\s`, `\w`
 * y `$`, y cada motor los entiende distinto:
 * - En JS `\b`, `\w` y `\d` son ASCII. En la JVM moderna también, pero en
 *   Android (ICU) `\b` y `\d` son Unicode, así que «costó\b» calzaría en el
 *   teléfono y no en la web. Se reescriben a clases ASCII explícitas.
 * - En JS `\s` incluye espacios Unicode (U+00A0, U+2028…); en Java es ASCII.
 * - En JS `$` (sin bandera m) es solo el final; en Java también acepta un
 *   salto de línea final. Se traduce a `\z`.
 * - En JS `.` excluye \n, \r, U+2028 y U+2029; Java además excluye U+0085.
 * - La bandera `i` de JS sin `u` pliega mayúsculas Unicode (é/É); Java necesita
 *   UNICODE_CASE para eso.
 *
 * Así cada patrón se copia tal cual del TS y la traducción vive en un solo sitio.
 */
internal object RegexJs {
    private const val PALABRA = "A-Za-z0-9_"
    private const val ESPACIOS =
        "\\t\\n\\u000B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF"
    private const val LIMITE =
        "(?:(?<=[$PALABRA])(?![$PALABRA])|(?<![$PALABRA])(?=[$PALABRA]))"
    private const val NO_LIMITE =
        "(?:(?<=[$PALABRA])(?=[$PALABRA])|(?<![$PALABRA])(?![$PALABRA]))"
    private const val PUNTO = "[^\\n\\r\\u2028\\u2029]"

    fun traducir(fuente: String): String {
        val sb = StringBuilder()
        var enClase = false
        var claseNegada = false
        var i = 0
        while (i < fuente.length) {
            val c = fuente[i]
            if (c == '\\' && i + 1 < fuente.length) {
                val sig = fuente[i + 1]
                when (sig) {
                    'b' -> sb.append(if (enClase) "\\x08" else LIMITE)
                    'B' -> sb.append(NO_LIMITE)
                    'w' -> sb.append(if (enClase) PALABRA else "[$PALABRA]")
                    'd' -> sb.append(if (enClase) "0-9" else "[0-9]")
                    's' -> sb.append(if (enClase) ESPACIOS else "[$ESPACIOS]")
                    'W', 'D', 'S' -> {
                        val base = when (sig) {
                            'W' -> PALABRA
                            'D' -> "0-9"
                            else -> ESPACIOS
                        }
                        // Una clase anidada dentro de una negada cambia de sentido en
                        // Java; ningún patrón del intérprete lo usa y así se sabría.
                        require(!(enClase && claseNegada)) { "Clase negada con \\$sig: $fuente" }
                        sb.append("[^$base]")
                    }
                    else -> sb.append(c).append(sig)
                }
                i += 2
                continue
            }
            if (enClase) {
                when (c) {
                    ']' -> enClase = false
                    // `[` dentro de una clase abre otra en Java, en JS es literal.
                    '[' -> { sb.append("\\["); i += 1; continue }
                    '&' -> { sb.append("\\&"); i += 1; continue }
                }
                sb.append(c)
                i += 1
                continue
            }
            when (c) {
                '[' -> {
                    enClase = true
                    claseNegada = i + 1 < fuente.length && fuente[i + 1] == '^'
                    sb.append(c)
                }
                '$' -> sb.append("\\z")
                '.' -> sb.append(PUNTO)
                else -> sb.append(c)
            }
            i += 1
        }
        return sb.toString()
    }

    fun compilar(fuente: String, banderas: String = ""): Regex {
        var f = 0
        if ('i' in banderas) f = f or Pattern.CASE_INSENSITIVE or Pattern.UNICODE_CASE
        return Pattern.compile(traducir(fuente), f).toRegex()
    }

    /** Equivale al `texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')` de la web. */
    fun escapar(texto: String): String {
        val sb = StringBuilder()
        for (c in texto) {
            if (c in ".*+?^\${}()|[]\\") sb.append('\\')
            sb.append(c)
        }
        return sb.toString()
    }
}

/** Atajo para los patrones copiados del TS. */
internal fun js(fuente: String, banderas: String = ""): Regex = RegexJs.compilar(fuente, banderas)

/** `str.replace(/re/, s)` de JS: sin bandera g reemplaza solo la primera. */
internal fun String.reemplazarPrimero(re: Regex, por: String): String = re.replaceFirst(this, por)

/** `str.replace(/re/g, s)` de JS. */
internal fun String.reemplazarTodos(re: Regex, por: String): String = re.replace(this, por)

/** `charAt(0).toUpperCase() + slice(1)`, por unidad UTF-16 como en JS. */
internal fun capitalizarJs(texto: String): String =
    if (texto.isEmpty()) "" else texto.substring(0, 1).uppercase() + texto.substring(1)

/** Los caracteres que quita `String.prototype.trim` (difiere de `isWhitespace`: incluye U+FEFF y no U+001C–U+001F). */
private fun esEspacioJs(c: Char): Boolean =
    c == '\t' || c == '\n' || c == '\u000B' || c == '\u000C' || c == '\r' || c == ' ' ||
        c == ' ' || c == ' ' || c in ' '..' ' || c == ' ' ||
        c == ' ' || c == ' ' || c == ' ' || c == '　' || c == '﻿'

/** `String.prototype.trim` de JS. */
internal fun String.trimJs(): String = trim(::esEspacioJs)
