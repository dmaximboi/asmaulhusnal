package online.digital26.asmaclock

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat

class WidgetTickService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private val tick = object : Runnable {
        override fun run() {
            ClockWidgetProvider.refreshAll(this@WidgetTickService)
            handler.postDelayed(this, 1000)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        ensureChannel()
        val n = notice()
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIF, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIF, n)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (ClockWidgetProvider.ids(this).isEmpty()) {
            stopSelf()
            return START_NOT_STICKY
        }
        handler.removeCallbacks(tick)
        handler.post(tick)
        return START_STICKY
    }

    override fun onDestroy() {
        handler.removeCallbacks(tick)
        super.onDestroy()
    }

    private fun notice() = NotificationCompat.Builder(this, CHANNEL)
        .setSmallIcon(R.drawable.ic_notify)
        .setContentTitle(getString(R.string.widget_tick_title))
        .setContentText(getString(R.string.widget_tick_body))
        .setOngoing(true)
        .setSilent(true)
        .setContentIntent(
            PendingIntent.getActivity(
                this,
                51,
                Intent(this, MainActivity::class.java),
                run {
                    var flags = PendingIntent.FLAG_UPDATE_CURRENT
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        flags = flags or PendingIntent.FLAG_IMMUTABLE
                    }
                    flags
                }
            )
        )
        .build()

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(NotificationManager::class.java)
        val ch = NotificationChannel(
            CHANNEL,
            getString(R.string.widget_tick_channel),
            NotificationManager.IMPORTANCE_MIN
        )
        ch.setShowBadge(false)
        nm.createNotificationChannel(ch)
    }

    companion object {
        const val CHANNEL = "asma-widget"
        const val NOTIF = 2705

        fun start(ctx: Context) {
            if (ClockWidgetProvider.ids(ctx).isEmpty()) return
            val i = Intent(ctx, WidgetTickService::class.java)
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    ctx.startForegroundService(i)
                } else {
                    ctx.startService(i)
                }
            } catch (_: Exception) { }
        }

        fun stop(ctx: Context) {
            try {
                ctx.stopService(Intent(ctx, WidgetTickService::class.java))
            } catch (_: Exception) { }
        }
    }
}
