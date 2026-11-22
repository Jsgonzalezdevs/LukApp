package app.lukapp.nativo

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import app.lukapp.ActividadPrincipal
import app.lukapp.R
import app.lukapp.dominio.ZONA_BOGOTA
import app.lukapp.dominio.bogotaDate
import app.lukapp.dominio.debeAvisar
import app.lukapp.dominio.proximoAviso
import java.time.ZonedDateTime

/**
 * Recordatorio diario de racha: un aviso LOCAL a la hora elegida si hoy todavía no se anotó nada. La web lo hace con
 * notificaciones push; aquí no hace falta servidor y funciona sin red. Se guarda en SharedPreferences (no es dato
 * sensible) lo mínimo que el receptor necesita saber con la app cerrada: si está activo, la hora y el último día anotado.
 */
object RecordatorioRacha {
    private const val PREFS = "recordatorio_racha"
    private const val CANAL = "racha"
    private const val ID_ALARMA = 7301

    private fun prefs(c: Context) = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun hayPermiso(c: Context): Boolean =
        Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(c, android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    /** Deja guardado el estado y programa (o cancela) la alarma. Sin permiso de notificaciones no se programa nada. */
    fun aplicar(c: Context, activo: Boolean, hora: String) {
        prefs(c).edit().putBoolean("activo", activo).putString("hora", hora).apply()
        if (activo && hayPermiso(c)) programar(c) else cancelar(c)
    }

    /** El último día en que se vio anotado algo, para no avisar a quien ya anotó. */
    fun marcarAnotadoHoy(c: Context, anotadoHoy: Boolean, hoy: String) {
        if (anotadoHoy) prefs(c).edit().putString("anotadoEn", hoy).apply()
    }

    /** Al cerrar sesión: nada de avisos a una cuenta que ya no está. */
    fun olvidar(c: Context) { cancelar(c); prefs(c).edit().clear().apply() }

    internal fun programar(c: Context) {
        val hora = prefs(c).getString("hora", null)
        val cuando = proximoAviso(hora, ZonedDateTime.now(ZONA_BOGOTA)).toInstant().toEpochMilli()
        val alarmas = c.getSystemService(AlarmManager::class.java) ?: return
        // Inexacta a propósito: no pide permiso de alarmas exactas, y un aviso de «anota tus gastos» no corre prisa.
        alarmas.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cuando, intencion(c))
    }

    private fun cancelar(c: Context) { c.getSystemService(AlarmManager::class.java)?.cancel(intencion(c)) }

    private fun intencion(c: Context) = PendingIntent.getBroadcast(c, ID_ALARMA, Intent(c, ReceptorRecordatorio::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    internal fun avisar(c: Context) {
        val p = prefs(c)
        if (!debeAvisar(p.getBoolean("activo", false), p.getString("anotadoEn", null), bogotaDate()) || !hayPermiso(c)) return
        val gestor = c.getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) gestor.createNotificationChannel(NotificationChannel(CANAL, "Recordatorio de racha", NotificationManager.IMPORTANCE_DEFAULT))
        val abrir = PendingIntent.getActivity(c, 0, Intent(c, ActividadPrincipal::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)
        gestor.notify(
            ID_ALARMA,
            NotificationCompat.Builder(c, CANAL).setSmallIcon(R.drawable.ic_stat_lukapp).setContentTitle("LukApp")
                .setContentText("Aún no has anotado gastos hoy. Anótalos para mantener tu racha 🔥").setContentIntent(abrir).setAutoCancel(true).build(),
        )
    }
}

/** Suena la alarma: avisa si toca y deja programada la de mañana. */
class ReceptorRecordatorio : BroadcastReceiver() {
    override fun onReceive(contexto: Context, intent: Intent) {
        RecordatorioRacha.avisar(contexto)
        RecordatorioRacha.programar(contexto)
    }
}

/** Un reinicio borra las alarmas: se vuelven a programar. */
class ReceptorArranque : BroadcastReceiver() {
    override fun onReceive(contexto: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED && contexto.getSharedPreferences("recordatorio_racha", Context.MODE_PRIVATE).getBoolean("activo", false)) RecordatorioRacha.programar(contexto)
    }
}
