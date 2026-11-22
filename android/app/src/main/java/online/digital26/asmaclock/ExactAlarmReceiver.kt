package online.digital26.asmaclock

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

class ExactAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val svc = Intent(context, AdhanPlayerService::class.java)
        svc.putExtras(intent)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(svc)
        } else {
            context.startService(svc)
        }
        ExactAlarmScheduler.bumpNextDay(context, intent)
    }

    companion object {
        const val CHANNEL_ID = AdhanPlayerService.CHANNEL_ID
        const val NOTIF_ID = AdhanPlayerService.NOTIF_TEST

        fun ensureChannel(context: Context) {
            AdhanPlayerService.ensureChannel(context)
        }
    }
}
