package online.digital26.asmaclock

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat

class ExactAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val key = intent.getStringExtra(ExactAlarmScheduler.EXTRA_KEY) ?: ""
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
            val title = intent.getStringExtra(ExactAlarmScheduler.EXTRA_TITLE)
                ?: context.getString(R.string.alarm_notif_title)
            val body = intent.getStringExtra(ExactAlarmScheduler.EXTRA_BODY) ?: ""
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
            nm.notify(NOTIF_NOTICE, notif)
        }
    }
}
