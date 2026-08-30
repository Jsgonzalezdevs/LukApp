/**
 * LA VERSIÓN DE LUKAPP. FUENTE ÚNICA DE VERDAD.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SI ERES UNA IA (Claude, Gemini, Copilot, la que sea) LEE ESTO ANTES DE TOCAR
 * NADA. Este proyecto se maneja POR VERSIONES. No es opcional.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * 1. MIRA LA VERSIÓN ANTES DE EMPEZAR. Es el número de abajo. Léelo y tenlo en
 *    cuenta: el código que estás viendo es el de esa versión, no el de otra.
 *
 * 2. TODO CAMBIO SUBE LA VERSIÓN. Por pequeño que sea. Un texto, un color, un
 *    espacio. No existe el cambio "demasiado chico para versionar".
 *
 * 3. EL FORMATO ES V0.0.0 — tres números, nada más:
 *
 *       MAYOR . MENOR . PARCHE
 *
 *       MAYOR  se sube cuando la app cambia de forma: se rehace una pantalla,
 *              cambia cómo se guardan los datos, se rompe algo de antes.
 *       MENOR  se sube cuando se agrega una función nueva que el usuario nota.
 *       PARCHE se sube para arreglos, ajustes visuales y cambios internos.
 *
 *    Al subir un número, los de su derecha vuelven a 0:
 *    1.0.3 → 1.1.0 → 1.1.1 → 2.0.0
 *
 * 4. DILO SIEMPRE. En cada respuesta donde entregues un cambio, di en qué
 *    versión quedó. "Listo, v1.0.1." El usuario tiene que poder seguir el hilo
 *    sin abrir el código.
 *
 * 5. SUBIRLA SON TRES SITIOS Y EL TEST LO VIGILA:
 *      a) la constante `VERSION` de este archivo,
 *      b) el campo `version` de package.json,
 *      c) una entrada nueva ARRIBA de NOVEDADES en src/features/lukapp/novedades.ts
 *         (esa entrada es lo que el usuario lee dentro de la app).
 *    Si los tres no coinciden, version.test.ts falla. Es a propósito: así no se
 *    puede subir la versión a medias.
 *
 * 6. AL CERRAR UNA VERSIÓN se hace commit y una etiqueta de git: `v1.0.0`.
 *
 * El detalle completo está en CLAUDE.md, en la raíz del repo.
 */
export const VERSION = '2.0.6';

/** Con la V delante, para enseñarla en pantalla. */
export const VERSION_ETIQUETA = `v${VERSION}`;
