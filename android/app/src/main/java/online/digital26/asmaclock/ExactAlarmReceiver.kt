package online.digital26.asmaclock

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat

class ExactAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, raw: Intent) {
        val intent = clipExtras(raw)
        val key = intent.getStringExtra(ExactAlarmScheduler.EXTRA_KEY) ?: ""
        val prayers = setOf("fajr", "dhuhr", "asr", "maghrib", "isha", "test")
        if (key == "notice") {
            val notice = Intent(context, FastNoticeService::class.java)
            notice.putExtras(intent)
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(notice)
                } else {
                    context.startService(notice)
                }
            } catch (_: Exception) {
                showNotice(context, intent)
            }
            return
        }
        if (key == "dua" || !prayers.contains(key)) {
            showNotice(context, intent)
            return
        }
        val svc = Intent(context, AdhanPlayerService::class.java)
        svc.putExtras(intent)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(svc)
            } else {
                context.startService(svc)
            }
        } catch (_: Exception) {
            try {
                context.startService(svc)
            } catch (_: Exception) {
                /* cannot start playback from here */
            }
        }
        ExactAlarmScheduler.bumpNextDay(context, intent)
    }

    companion object {
        const val CHANNEL_ID = AdhanPlayerService.CHANNEL_ID
        const val NOTIF_ID = AdhanPlayerService.NOTIF_TEST
        const val NOTIF_NOTICE = 2801

        fun ensureChannel(context: Context) {
            AdhanPlayerService.ensureChannel(context)
        }

        fun showNotice(context: Context, intent: Intent) {
            ensureChannel(context)
            val title = clip(
                intent.getStringExtra(ExactAlarmScheduler.EXTRA_TITLE)
                    ?: context.getString(R.string.alarm_notif_title),
                180
            )
            val body = clip(intent.getStringExtra(ExactAlarmScheduler.EXTRA_BODY) ?: "", 4000)
            val open = Intent(context, MainActivity::class.java)
            var flags = PendingIntent.FLAG_UPDATE_CURRENT
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags = flags or PendingIntent.FLAG_IMMUTABLE
            }
            val tap = PendingIntent.getActivity(context, 2, open, flags)
            val notif = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notify)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setAutoCancel(true)
                .setContentIntent(tap)
                .build()
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val nid = (intent.getStringExtra(ExactAlarmScheduler.EXTRA_ID) ?: "dua").hashCode()
            nm.notify(if (nid == 0) NOTIF_NOTICE else nid, notif)
        }

        fun clip(s: String, max: Int): String {
            return if (s.length <= max) s else s.substring(0, max)
        }

        fun clipExtras(src: Intent): Intent {
            val i = Intent(src)
            fun cut(key: String, max: Int) {
                val v = i.getStringExtra(key) ?: return
                if (v.length > max) i.putExtra(key, v.substring(0, max))
            }
            cut(ExactAlarmScheduler.EXTRA_TITLE, 180)
            cut(ExactAlarmScheduler.EXTRA_BODY, 4000)
            cut(ExactAlarmScheduler.EXTRA_SPEAK, 2000)
            cut(ExactAlarmScheduler.EXTRA_SHARE, 2500)
            return i
        }
    }
}
