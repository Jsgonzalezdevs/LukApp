package app.lukapp.nativo

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import app.lukapp.dominio.ReporteMensual
import app.lukapp.dominio.fechaDelInforme
import app.lukapp.dominio.formatCop
import java.io.ByteArrayOutputStream

/**
 * El informe mensual como PDF (`ReporteFinancieroModal.tsx` lo manda a imprimir desde el navegador; aquí se dibuja
 * con `PdfDocument` y se guarda donde la persona elija). Hoja A4, fondo blanco, sin emojis (la letra del sistema
 * no los dibuja bien en un PDF). Las cuentas largas pasan a otra hoja.
 */
object InformePdf {
    private const val ANCHO = 595
    private const val ALTO = 842
    private const val M = 40f
    private const val UTIL = ANCHO - 2 * M

    private fun pincel(tam: Float, color: Int, negrita: Boolean = false) = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        textSize = tam; this.color = color; typeface = if (negrita) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
    }

    fun generar(r: ReporteMensual, hoy: String, correo: String?): ByteArray {
        val doc = PdfDocument()
        var numero = 1
        var pagina = doc.startPage(PdfDocument.PageInfo.Builder(ANCHO, ALTO, numero).create())
        var lienzo: Canvas = pagina.canvas
        var y = M

        fun nueva() {
            doc.finishPage(pagina)
            numero++
            pagina = doc.startPage(PdfDocument.PageInfo.Builder(ANCHO, ALTO, numero).create())
            lienzo = pagina.canvas
            y = M
        }
        fun texto(t: String, x: Float, baseY: Float, p: Paint, derecha: Boolean = false) {
            lienzo.drawText(t, if (derecha) x - p.measureText(t) else x, baseY, p)
        }
        fun parrafo(t: String, x: Float, ancho: Int, p: TextPaint): Float {
            val l = StaticLayout.Builder.obtain(t, 0, t.length, p, ancho).setAlignment(Layout.Alignment.ALIGN_NORMAL).setLineSpacing(0f, 1.15f).build()
            lienzo.save(); lienzo.translate(x, y); l.draw(lienzo); lienzo.restore()
            return l.height.toFloat()
        }

        // Portada oscura
        val altoPortada = 150f
        lienzo.drawRoundRect(RectF(M, y, M + UTIL, y + altoPortada), 18f, 18f, Paint().apply { color = Color.parseColor("#18181B") })
        texto("TU MES EN PERSPECTIVA", M + 20, y + 30, pincel(9f, Color.parseColor("#DDD6FE"), true))
        y += 40
        y += parrafo("Así cerraste ${r.nombreMes.lowercase()}.", M + 20, (UTIL * 0.64f).toInt(), pincel(24f, Color.WHITE, true)) + 6
        parrafo(r.resumenBalance, M + 20, (UTIL * 0.64f).toInt(), pincel(10.5f, Color.parseColor("#B8B8BD")))
        val caja = RectF(M + UTIL - 130, M + 20, M + UTIL - 18, M + 78)
        lienzo.drawRoundRect(caja, 10f, 10f, Paint().apply { color = Color.parseColor("#33FFFFFF") })
        texto("MOVIMIENTOS", caja.left + 12, caja.top + 20, pincel(8f, Color.parseColor("#BBBBBB"), true))
        texto("${r.movimientos}", caja.left + 12, caja.top + 44, pincel(18f, Color.WHITE, true))
        y = M + altoPortada + 16

        // Balance, ingresos, gastos
        val verde = Color.parseColor("#16A34A"); val rojo = Color.parseColor("#DC2626"); val tinta = Color.parseColor("#18181B"); val suave = Color.parseColor("#52525B"); val tenue = Color.parseColor("#A1A1AA")
        val linea = Paint().apply { color = Color.parseColor("#E4E4E7"); style = Paint.Style.STROKE; strokeWidth = 1f }
        val anchoTarjeta = (UTIL - 20) / 3
        val tarjetas = listOf(
            Triple("Balance del mes", formatCop(r.balance), if (r.balancePositivo) verde else rojo),
            Triple("Ingresos", formatCop(r.ingresos), tinta),
            Triple("Gastos", formatCop(r.gastos), tinta),
        )
        tarjetas.forEachIndexed { i, (titulo, valor, color) ->
            val x = M + i * (anchoTarjeta + 10)
            lienzo.drawRoundRect(RectF(x, y, x + anchoTarjeta, y + 78), 12f, 12f, linea)
            texto(titulo, x + 14, y + 24, pincel(9.5f, suave, true))
            texto(valor, x + 14, y + 50, pincel(if (i == 0) 16f else 14f, color, true))
            if (i == 0) texto(if (r.porcentajeBalance == null) "Aún no hay ingresos este mes" else "${if (r.porcentajeBalance >= 0) "+" else ""}${r.porcentajeBalance}% frente a tus ingresos", x + 14, y + 68, pincel(7.5f, tenue))
        }
        y += 78 + 22

        // En qué se fue
        texto("En qué se fue tu dinero", M, y + 12, pincel(14f, tinta, true))
        texto("Tus gastos ordenados de mayor a menor.", M, y + 28, pincel(9f, suave))
        y += 46
        if (r.categorias.isEmpty()) {
            lienzo.drawRoundRect(RectF(M, y, M + UTIL, y + 34), 8f, 8f, Paint().apply { color = Color.parseColor("#F4F4F5") })
            texto("No registraste gastos durante este mes.", M + 12, y + 21, pincel(9.5f, suave))
            y += 34 + 20
        } else r.categorias.forEach { c ->
            texto(c.nombre, M, y + 10, pincel(10f, tinta, true))
            texto("${formatCop(c.total)}  ${c.pct}%", M + UTIL, y + 10, pincel(10f, suave), derecha = true)
            lienzo.drawRoundRect(RectF(M, y + 17, M + UTIL, y + 23), 3f, 3f, Paint().apply { color = Color.parseColor("#F4F4F5") })
            lienzo.drawRoundRect(RectF(M, y + 17, M + maxOf(6f, UTIL * c.pct / 100f), y + 23), 3f, 3f, Paint().apply { color = runCatching { Color.parseColor(c.color) }.getOrDefault(Color.parseColor("#A78BFA")) })
            y += 34
        }
        y += 6

        // Tu dinero hoy
        if (y > ALTO - 150) nueva()
        texto("Tu dinero hoy", M, y + 12, pincel(14f, tinta, true))
        texto("El saldo actual de tus cuentas activas.", M, y + 28, pincel(9f, suave))
        y += 42
        lienzo.drawRoundRect(RectF(M, y, M + UTIL, y + 50), 10f, 10f, Paint().apply { color = Color.parseColor("#F4F4F5") })
        texto("PATRIMONIO EN CUENTAS", M + 14, y + 20, pincel(8f, tenue, true))
        texto(formatCop(r.patrimonio), M + 14, y + 40, pincel(15f, tinta, true))
        y += 62
        if (r.cuentas.isEmpty()) texto("No hay cuentas activas para mostrar.", M, y + 12, pincel(9.5f, suave)).also { y += 24 }
        r.cuentas.forEach { c ->
            if (y > ALTO - 80) nueva()
            texto(c.nombre, M, y + 12, pincel(10f, tinta, true))
            texto(formatCop(c.saldo), M + UTIL, y + 12, pincel(10f, if (c.esPasivo) rojo else tinta, true), derecha = true)
            lienzo.drawLine(M, y + 22, M + UTIL, y + 22, linea)
            y += 28
        }

        // Pie
        if (y > ALTO - 60) nueva()
        val pie = pincel(8f, tenue)
        texto("Preparado el ${fechaDelInforme(hoy)}", M, ALTO - 36f, pie)
        texto((if (correo != null) "Resumen privado de $correo" else "Resumen privado de tu libro financiero") + " · LukApp", M + UTIL, ALTO - 36f, pie, derecha = true)
        doc.finishPage(pagina)
        val salida = ByteArrayOutputStream()
        doc.writeTo(salida)
        doc.close()
        return salida.toByteArray()
    }
}
