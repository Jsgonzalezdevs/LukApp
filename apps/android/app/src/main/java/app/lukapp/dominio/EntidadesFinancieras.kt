package app.lukapp.dominio

import java.text.Normalizer
import java.util.Locale

/**
 * Origen: `lib/entidadesFinancieras.ts` (`EntidadFinanciera`). `logo` es la ruta
 * pública de la web (`/bancos/...`); la app nativa decide cómo resolverla.
 * `familiaColor`: morado, amarillo, rojo, naranja, azul, verde o gris.
 */
data class EntidadFinanciera(
    val nombre: String,
    val alias: List<String>,
    val fondo: String,
    val texto: String,
    val claseCuenta: String,
    val familiaColor: String,
    val logo: String,
    val fuente: String,
    val sombraLectura: Double? = null,
    val luminanciaLogo: Boolean = false,
    val encajeLogo: String? = null,
    val posicionLogo: String? = null,
)

/**
 * Origen: `lib/entidadesFinancieras.ts` (`ENTIDADES_FINANCIERAS`). Colores de los
 * sitios oficiales (consultados el 21/10/2026); el orden importa para empates.
 */
val ENTIDADES_FINANCIERAS: List<EntidadFinanciera> = listOf(
    EntidadFinanciera("Nu", listOf("nu", "nubank", "nu bank"), "#820AD1", "#FFFFFF", "banco", "morado", "/bancos/nu.svg", "https://nu.com.co/"),
    EntidadFinanciera("Nequi", listOf("nequi"), "#200020", "#FFFFFF", "billetera", "morado", "/bancos/nequi.png", "https://www.nequi.com.co/"),
    EntidadFinanciera("Bancolombia", listOf("bancolombia", "banco colombia"), "#FDDA24", "#2C2A29", "banco", "amarillo", "/bancos/bancolombia.svg", "https://www.bancolombia.com/"),
    EntidadFinanciera("Davivienda", listOf("davivienda", "davi vivienda"), "#ED1C27", "#FFFFFF", "banco", "rojo", "/bancos/davivienda.png", "https://epayco.com/wp-content/uploads/2026/04/Toolkit-ePayco.pdf", sombraLectura = 0.08, encajeLogo = "auto 80%", posicionLogo = "left center"),
    EntidadFinanciera("Rappi", listOf("rapi", "rappi", "rappipay", "rappi pay", "rappicuenta", "rappi cuenta", "rappicard"), "#FF441F", "#FFFFFF", "banco", "naranja", "/bancos/rappipay.png", "https://www.rappipay.co/", sombraLectura = 0.16, luminanciaLogo = true),
    EntidadFinanciera("DaviPlata", listOf("daviplata", "davi plata"), "#ED1C27", "#FFFFFF", "billetera", "rojo", "/bancos/daviplata.png", "https://conectesunegocio.daviplata.com/", sombraLectura = 0.08, encajeLogo = "auto 72%"),
    EntidadFinanciera("Banco Agrario", listOf("agrario", "banco agrario"), "#5BC500", "#000000", "banco", "verde", "/bancos/agrario.svg", "https://www.bancoagrario.gov.co/themes/custom/bancoagrario/logo.svg"),
    EntidadFinanciera("Bancamía", listOf("bancamia", "banco de las microfinanzas"), "#F26F21", "#000000", "banco", "naranja", "/bancos/bancamia.svg", "https://www.bancamia.com.co/wp-content/uploads/2025/04/Logo-bancamia-solo.png"),
    EntidadFinanciera("BTG Pactual", listOf("btg", "btg pactual"), "#001E61", "#FFFFFF", "banco", "azul", "/bancos/btg.svg", "https://www.btgpactual.com.co/favicon.ico"),
    EntidadFinanciera("Banco Caja Social", listOf("caja social", "banco caja social"), "#003B71", "#FFFFFF", "banco", "azul", "/bancos/cajasocial.svg", "https://www.bancocajasocial.com/content/dam/bcs/logos/logo-bcs.svg"),
    EntidadFinanciera("Banco Contactar", listOf("contactar", "banco contactar"), "#F26522", "#000000", "banco", "naranja", "/bancos/contactar.svg", "https://bancocontactar.com/wp-content/uploads/2023/09/cropped-faviconbc-192x192.png"),
    EntidadFinanciera("Ban100", listOf("ban100", "ban 100", "credifinanciera"), "#1F145D", "#FFFFFF", "banco", "morado", "/bancos/ban100.svg", "https://www.ban100.com.co/sites/default/files/favicon_b100.ico"),
    EntidadFinanciera("Banco de Bogotá", listOf("banco de bogota", "banco bogota", "bogota"), "#003DA5", "#FFFFFF", "banco", "azul", "/bancos/bogota.svg", "https://saladeprensa.bancodebogota.com/wp-content/uploads/2022/12/Isotipo.png"),
    EntidadFinanciera("GNB Sudameris", listOf("gnb", "sudameris", "gnb sudameris"), "#0073AE", "#FFFFFF", "banco", "azul", "/bancos/gnb.svg", "https://www.gnbsudameris.com.co/Content/files/images/new-home/logo-gnbsudameris.png"),
    EntidadFinanciera("Banco Popular", listOf("banco popular", "popular"), "#105163", "#FFFFFF", "banco", "verde", "/bancos/popular.svg", "https://www.bancopopular.com.co/wps/contenthandler/dav/themelist/TemaBancoPopular/images/favicon.svg"),
    EntidadFinanciera("Bancoomeva", listOf("bancoomeva", "banco coomeva", "coomeva"), "#008C4A", "#000000", "banco", "verde", "/bancos/coomeva.svg", "https://www.bancoomeva.com.co/info/bancoomeva/web/portal/img/favicon.png"),
    EntidadFinanciera("Banco Falabella", listOf("falabella", "banco falabella"), "#007A33", "#FFFFFF", "banco", "verde", "/bancos/falabella.svg", "https://www.bancofalabella.com.co/_next/static/media/bfisotype.812a4957.svg"),
    EntidadFinanciera("Santander", listOf("santander", "banco santander"), "#FE0000", "#FFFFFF", "banco", "rojo", "/bancos/santander.svg", "https://www.santander.com.co/img/santander.ico", sombraLectura = 0.16),
    EntidadFinanciera("Serfinanza", listOf("serfinanza", "banco serfinanza"), "#130488", "#FFFFFF", "banco", "azul", "/bancos/serfinanza.svg", "https://bancoserfinanza.com/favicon.ico"),
    EntidadFinanciera("Lulo Bank", listOf("lulo", "lulo bank"), "#E6FF00", "#000000", "banco", "amarillo", "/bancos/lulo.svg", "https://www.lulobank.com/favicon.ico"),
    EntidadFinanciera("Revolut", listOf("revolut", "revolut bank"), "#191C1F", "#FFFFFF", "banco", "gris", "/bancos/revolut.svg", "https://icons.duckduckgo.com/ip3/revolut.com.ico"),
    EntidadFinanciera("AV Villas", listOf("av villas", "avvillas", "banco comercial av villas"), "#D71920", "#FFFFFF", "banco", "rojo", "/bancos/avvillas.svg", "https://www.avvillas.com.co/documents/37648/54307914/favicon/415f2f56-1762-fe96-1a3b-5d00eb4f3e2f", sombraLectura = 0.16),
    EntidadFinanciera("BBVA", listOf("bbva", "bbva colombia"), "#001391", "#FFFFFF", "banco", "azul", "/bancos/bbva.svg", "https://www.bbva.com.co/content/dam/library/favicons/safari-pinned-tab.svg"),
    EntidadFinanciera("Citibank", listOf("citi", "citibank"), "#004B76", "#FFFFFF", "banco", "azul", "/bancos/citi.svg", "https://www.citibank.com/favicon.ico"),
    EntidadFinanciera("DAVIbank", listOf("davibank", "davi bank", "scotiabank", "colpatria", "scotiabank colpatria"), "#E30518", "#FFFFFF", "banco", "rojo", "/bancos/davibank.svg", "https://cdn.aglty.io/scotiabank-colombia/home-nuevo/logos/favicon-192x192.png", sombraLectura = 0.16),
    EntidadFinanciera("Coopcentral", listOf("coopcentral", "coop central", "banco cooperativo coopcentral"), "#003B71", "#FFFFFF", "banco", "azul", "/bancos/coopcentral.svg", "https://bucketimagespayments.s3.amazonaws.com/public/marcablanca/images/d91320b6-c2cb-4e28-b61c-d1f5b5c5b48d..png"),
    EntidadFinanciera("Banco de Occidente", listOf("banco de occidente", "banco occidente", "occidente"), "#008ECE", "#000000", "banco", "azul", "/bancos/occidente.svg", "https://cdn.worldvectorlogo.com/logos/logo-banco-de-occidente.svg"),
    EntidadFinanciera("J.P. Morgan", listOf("jp morgan", "j p morgan", "jpmorgan"), "#242526", "#FFFFFF", "banco", "gris", "/bancos/jpmorgan.svg", "https://www.jpmorgan.com/etc.clientlibs/cws/clientlibs/clientlib-base/resources/jpm/images/jpm-favicon-152.png"),
    EntidadFinanciera("Itaú", listOf("itau", "banco itau"), "#FF6200", "#000000", "banco", "naranja", "/bancos/itau.svg", "https://banco.itau.co/documents/43985/111719/logo-corporate.svg/dbbb1c27-5fe2-6e4e-3aae-b8d0c1119e38"),
    EntidadFinanciera("Banco W", listOf("banco w", "bancow"), "#00B1BB", "#000000", "banco", "azul", "/bancos/bancow.svg", "https://www.bancow.com.co/favicon.ico"),
    EntidadFinanciera("Banco Finandina", listOf("finandina", "banco finandina"), "#7835C3", "#FFFFFF", "banco", "morado", "/bancos/finandina.svg", "https://www.bancofinandina.com/hubfs/faviconV2.png"),
    EntidadFinanciera("Banco Pichincha", listOf("pichincha", "banco pichincha"), "#FFDD00", "#000000", "banco", "amarillo", "/bancos/pichincha.svg", "https://www.bancopichincha.com.co/o/pichincha-theme/images/icon/apple-icon-144x144.png"),
    EntidadFinanciera("Banco Mundo Mujer", listOf("mundo mujer", "banco mundo mujer", "bmm"), "#173279", "#FFFFFF", "banco", "azul", "/bancos/mundomujer.svg", "https://bmm.cdn.modyo.com/uploads/b48b4253-6a33-4668-a40b-8a6148b12328/original/BMM-logo.svg"),
    EntidadFinanciera("Mibanco", listOf("mibanco", "mi banco colombia", "banco de la microempresa"), "#009330", "#000000", "banco", "verde", "/bancos/mibanco.svg", "https://cdn.modyo.cloud/uploads/3acf119b-6c28-473f-8102-20274927ba50/C144x144/favicon_mibanco.png"),
    EntidadFinanciera("Banco Unión", listOf("banco union", "bancounion"), "#006C96", "#FFFFFF", "banco", "azul", "/bancos/union.svg", "https://www.bancounion.com/info/bancounion/web/portal/img/favicon.png"),
    EntidadFinanciera("Ualá", listOf("uala"), "#0054EA", "#FFFFFF", "billetera", "azul", "/bancos/uala.svg", "https://www.uala.com.co/favicon.ico"),
    EntidadFinanciera("Bold", listOf("bold"), "#121E6C", "#FFFFFF", "billetera", "azul", "/bancos/bold.svg", "https://bold.co/apple-touch-icon.png"),
    EntidadFinanciera("Mercado Pago", listOf("mercado pago", "mercadopago"), "#009EE3", "#000000", "billetera", "azul", "/bancos/mercadopago.svg", "https://www.google.com/s2/favicons?domain=mercadopago.com.co&sz=128"),
    EntidadFinanciera("Dale!", listOf("dale", "dale!"), "#002B49", "#FFFFFF", "billetera", "azul", "/bancos/dale.svg", "https://www.dale.com.co/sites/default/files/favicon.ico"),
    EntidadFinanciera("Coink", listOf("coink"), "#1EEB00", "#000000", "billetera", "verde", "/bancos/coink.svg", "https://coink.com/wp-content/uploads/2025/09/imgi_12_Marranito.svg"),
    EntidadFinanciera("Global66", listOf("global66", "global 66"), "#2149B6", "#FFFFFF", "billetera", "azul", "/bancos/global66.svg", "https://icons.duckduckgo.com/ip3/global66.com.ico"),
    EntidadFinanciera("Powwi", listOf("powwi", "pagos gde"), "#77AB2C", "#000000", "billetera", "verde", "/bancos/gde.svg", "https://powwi.co/wp-content/uploads/2022/03/cropped-favicon-header-x1-192x192.png"),
)

private val MARCAS = Regex("[̀-ͯ]")
private val NO_ALFANUMERICO = Regex("[^a-z0-9]+")

private fun normalizar(texto: String): String =
    NO_ALFANUMERICO.replace(MARCAS.replace(Normalizer.normalize(texto, Normalizer.Form.NFD), "").lowercase(Locale.ROOT), " ").trim()

private val PALABRAS_GENERICAS = setOf(
    "banco", "bank", "cuenta", "ahorro", "ahorros", "personal", "colombia", "nomina", "bancos", "banc", "bancode", "bancodel", "bankcolombia",
)

private val ALIAS_COMPACTOS: List<Pair<EntidadFinanciera, List<String>>> =
    ENTIDADES_FINANCIERAS.map { e -> e to e.alias.map { normalizar(it).replace(" ", "") }.distinct() }

private val LONGITUD_MAXIMA: Int = ALIAS_COMPACTOS.flatMap { it.second }.maxOf { it.length } + 1

// Una edición es omitir, añadir, sustituir o intercambiar dos letras contiguas.
private fun distanciaDeEscritura(a: String, b: String): Int {
    if (Math.abs(a.length - b.length) > 1) return 2
    val d = Array(a.length + 1) { i -> IntArray(b.length + 1) { j -> if (i == 0) j else if (j == 0) i else 0 } }
    for (i in 1..a.length) {
        for (j in 1..b.length) {
            d[i][j] = minOf(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + if (a[i - 1] == b[j - 1]) 0 else 1)
            if (i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1]) {
                d[i][j] = minOf(d[i][j], d[i - 2][j - 2] + 1)
            }
        }
    }
    return d[a.length][b.length]
}

private data class Coincidencia(val entidad: EntidadFinanciera, val inicio: Int, val fin: Int, val longitud: Int, val exacta: Boolean)

/**
 * Origen: `lib/entidadesFinancieras.ts` (`reconocerEntidad`). Tolera un error de
 * escritura en alias de 5+ letras; dos marcas distintas en el nombre → null.
 */
fun reconocerEntidad(nombre: String): EntidadFinanciera? {
    val normal = normalizar(nombre)
    if (normal in listOf("mi banco", "banco", "cuenta bancaria")) return null
    val palabras = normal.split(" ").filter { it.isNotEmpty() }
    val coincidencias = mutableListOf<Coincidencia>()
    for (i in palabras.indices) {
        var compacto = ""
        for (j in i until palabras.size) {
            compacto += palabras[j]
            if (compacto.length > LONGITUD_MAXIMA) break
            for ((entidad, alias) in ALIAS_COMPACTOS) {
                for (texto in alias) {
                    val exacta = compacto == texto
                    val aproximada = texto.length >= 5 && compacto.length >= 4 &&
                        compacto !in PALABRAS_GENERICAS && distanciaDeEscritura(compacto, texto) <= 1
                    if (exacta || aproximada) coincidencias.add(Coincidencia(entidad, i, j, texto.length, exacta))
                }
            }
        }
    }
    // Una marca completa prevalece sobre fragmentos parecidos de su propio nombre.
    val ordenadas = coincidencias.sortedWith(compareByDescending<Coincidencia> { it.longitud }.thenByDescending { it.exacta })
    val seleccionadas = mutableListOf<Coincidencia>()
    for (c in ordenadas) {
        if (seleccionadas.none { c.inicio <= it.fin && c.fin >= it.inicio }) seleccionadas.add(c)
    }
    val entidades = seleccionadas.map { it.entidad }.distinct()
    return if (entidades.size == 1) entidades[0] else null
}

/** Origen: `lib/entidadesFinancieras.ts` (`entidadDeCuenta`). Solo cuentas y tarjetas que no son efectivo. */
fun entidadDeCuenta(cuenta: Cajita): EntidadFinanciera? =
    if ((cuenta.tipo == TipoCajita.CUENTA || cuenta.tipo == TipoCajita.TARJETA) && cuenta.claseCuenta != ClaseCuenta.EFECTIVO) {
        reconocerEntidad(cuenta.nombre)
    } else {
        null
    }

// `\b` de JS es ASCII; el de Java considera letras Unicode. Se replica a mano.
private val RAPI = Regex("(?<![A-Za-z0-9_])rapi(?![A-Za-z0-9_])", RegexOption.IGNORE_CASE)

/** Origen: `lib/entidadesFinancieras.ts` (`nombreVisibleCuenta`). Corrige «Rapi» al mostrar, sin tocar lo guardado. */
fun nombreVisibleCuenta(cuenta: Cajita): String =
    if (entidadDeCuenta(cuenta)?.nombre == "Rappi") RAPI.replace(cuenta.nombre, "Rappi") else cuenta.nombre
