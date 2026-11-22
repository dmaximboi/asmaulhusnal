package online.digital26.asmaclock

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

object ExactAlarmScheduler {
    const val REQUEST_CODE = 2601
    const val EXTRA_WHEN = "when"

    fun canScheduleExact(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        return am.canScheduleExactAlarms()
    }

    fun scheduleInOneMinute(context: Context): Long {
        val whenAt = System.currentTimeMillis() + 60_000L
        val intent = Intent(context, ExactAlarmReceiver::class.java).putExtra(EXTRA_WHEN, whenAt)
        var flags = PendingIntent.FLAG_UPDATE_CURRENT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags = flags or PendingIntent.FLAG_IMMUTABLE
        }
        val pending = PendingIntent.getBroadcast(context, REQUEST_CODE, intent, flags)
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, whenAt, pending)
        } else {
            am.setExact(AlarmManager.RTC_WAKEUP, whenAt, pending)
        }
        return whenAt
    }
}
