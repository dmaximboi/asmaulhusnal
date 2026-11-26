package online.digital26.asmaclock

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootCompletedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        ExactAlarmScheduler.restore(context)
        if (ClockWidgetProvider.ids(context).isNotEmpty()) {
            WidgetTickService.start(context)
        }
        if (IslandOverlayService.prefs(context).getBoolean(IslandOverlayService.KEY, false)) {
            IslandOverlayService.start(context)
        }
    }
}
