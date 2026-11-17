package app.lukapp.dominio

import app.lukapp.dominio.voz.js
import java.text.Normalizer

private fun normalizarAyuda(texto: String): String =
    Normalizer.normalize(texto, Normalizer.Form.NFD)
        .replace(Regex("[\\u0300-\\u036f]"), "")
        .lowercase()

/** Origen: `lib/contextoProductoIA.ts` (`CONTEXTO_PRODUCTO_LUKAPP`). Mapa breve de funciones y rutas confirmadas en la interfaz de LukApp. */
const val CONTEXTO_PRODUCTO_LUKAPP = """LukApp es una app de finanzas personales en Colombia. Su navegación principal es:
- Inicio: resumen financiero y movimientos recientes.
- Dinero: cuentas, efectivo, cajitas de ahorro, tarjetas, deudas, metas e Importar extractos.
- Mes: balance del período, topes de gasto y pagos fijos.
- Asesor: preguntas sobre las finanzas y funciones de LukApp.
- Más: categorías, período, copia de seguridad, cuenta y otras herramientas generales.
Para importar movimientos abre Dinero > Importar extractos. Acepta PDF, fotos, Excel .xlsx y CSV; permite varios archivos de hasta 4 MB cada uno. Las filas se revisan antes de confirmar y se buscan posibles duplicados. Para CSV/XLSX hacen falta columnas que permitan identificar fecha, descripción y monto; pueden incluir columnas separadas de débito y crédito o un campo de monto con tipo Ingreso/Gasto. La importación agrega movimientos a una cuenta existente, no crea cuentas nuevas.
Para crear una cuenta, abre Dinero y pulsa Agregar cuenta. Las tarjetas, deudas y cajitas se crean desde su grupo correspondiente en Dinero.
En Más, las opciones tienen su nombre visible; para encontrar una herramienta, orienta por la pestaña y el nombre exacto, y evita inventar botones o rutas. Si los documentos de conocimiento no confirman un paso, dilo y pregunta qué pantalla ve la persona.
Estructura técnica del proyecto (solo si preguntan cómo está construido): React y TypeScript muestran la app; src/features/lukapp/components contiene pantallas y componentes; data maneja sesión y sincronización; hooks reúne integraciones de interfaz; lib contiene reglas de negocio; server.ts atiende la API; server_lib contiene lógica del servidor; supabase/migrations versiona cambios de base de datos. No afirmes que puedes inspeccionar la pantalla actual ni cambiar ajustes por la persona."""

private val RE_ENCABEZADOS = js("""\b(encabezado|encabezados|columnas|columna)\b""")
private val RE_INGRESO_GASTO = js("""\b(ingreso.?gasto|gasto.?ingreso)\b""")
private val RE_FORMATO_ARCHIVO = js("""\b(excel|xlsx|csv|importar|importacion)\b""")
private val RE_IMPORTAR = js("""\b(importar|importacion|extracto)\b""")
private val RE_SUBIR = js("""\b(subir|cargar)\b""")
private val RE_ARCHIVO = js("""\b(excel|xlsx|csv|archivo)\b""")
private val RE_CREAR_CUENTA = js("""\b(agregar|anadir|crear|nueva|abrir)\b.*\b(cuenta|banco|billetera)\b""")
private val RE_TOPES = js("""\b(top(e|es)|limite|presupuesto)\b""")
private val RE_DONDE_VER = js("""\b(donde|como|ver|buscar|encontrar|consultar)\b""")
private val RE_PAGOS_FIJOS = js("""\b(pago fijo|pagos fijos|recurrente|recurrentes|suscripcion|suscripciones)\b""")
private val RE_DONDE_ADMIN = js("""\b(donde|como|ver|buscar|encontrar|consultar|administrar|acceder)\b""")
private val RE_COPIA = js("""\b(copia de seguridad|respaldo|backup|restaurar)\b""")
private val RE_CATEGORIA = js("""\b(categoria|categorias)\b""")
private val RE_CATEGORIA_ACCION = js("""\b(crear|cambiar|editar|donde|como|agregar)\b""")
private val RE_QUE_HACE = js("""\b(que hace lukapp|como se usa lukapp|ayuda con lukapp|funciones de lukapp|donde encuentro)\b""")

/** Origen: `lib/contextoProductoIA.ts` (`responderAyudaLukApp`). Respuestas sin costo para las preguntas de navegación más frecuentes. */
fun responderAyudaLukApp(pregunta: String): String? {
    val texto = normalizarAyuda(pregunta)

    if (RE_ENCABEZADOS.containsMatchIn(texto) && RE_INGRESO_GASTO.containsMatchIn(texto) && RE_FORMATO_ARCHIVO.containsMatchIn(texto)) {
        return "Ese formato puede importarse: LukApp reconoce **Fecha y hora**, **Descripción**, **Importe** y **Ingreso/Gasto** para fecha, detalle, valor y tipo. **Cuenta**, **Categoría** y **Subcategorías** también aportan información. Revisa la vista previa y elige una cuenta existente; la importación no crea cuentas."
    }

    val esConsultaDeImportacion = RE_IMPORTAR.containsMatchIn(texto) ||
        (RE_SUBIR.containsMatchIn(texto) && RE_ARCHIVO.containsMatchIn(texto))
    if (esConsultaDeImportacion) {
        return "Para importar movimientos, abre **Dinero → Importar extractos**. Puedes subir PDF, fotos, Excel .xlsx o CSV. Revisa las filas detectadas antes de confirmarlas; la importación no crea cuentas nuevas."
    }

    if (RE_CREAR_CUENTA.containsMatchIn(texto)) {
        return "Entra en **Dinero** y pulsa **Agregar cuenta**. Allí puedes indicar el nombre y el tipo de cuenta. Si no ves ese botón, dime qué aparece en tu pantalla."
    }

    if (RE_TOPES.containsMatchIn(texto) && RE_DONDE_VER.containsMatchIn(texto)) {
        return "Los **Topes de gasto** están en la sección **Mes**. Abre esa herramienta para crear o revisar el límite de una categoría."
    }

    if (RE_PAGOS_FIJOS.containsMatchIn(texto) && RE_DONDE_ADMIN.containsMatchIn(texto)) {
        return "Los **Pagos fijos** están en **Mes**. Desde allí puedes consultar y administrar cobros recurrentes."
    }

    if (RE_COPIA.containsMatchIn(texto)) {
        return "La **Copia de seguridad** está en **Más**. Puedes descargar un respaldo o restaurar uno que tengas guardado."
    }

    if (RE_CATEGORIA.containsMatchIn(texto) && RE_CATEGORIA_ACCION.containsMatchIn(texto)) {
        return "Abre **Más → Categorías** para crear una categoría o cambiar las que usas."
    }

    if (RE_QUE_HACE.containsMatchIn(texto)) {
        return "LukApp se organiza en cinco secciones: **Inicio** resume tus finanzas, **Dinero** reúne cuentas y ahorros, **Mes** muestra el período y sus topes, **Asesor** responde consultas y **Más** reúne ajustes y herramientas."
    }

    return null
}
