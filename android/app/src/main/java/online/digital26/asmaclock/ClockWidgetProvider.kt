package online.digital26.asmaclock

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews

class ClockWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { id ->
            val views = RemoteViews(context.packageName, R.layout.widget_clock)
            val open = Intent(context, MainActivity::class.java)
            var flags = PendingIntent.FLAG_UPDATE_CURRENT
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags = flags or PendingIntent.FLAG_IMMUTABLE
            }
            views.setOnClickPendingIntent(
                R.id.widget_root,
                PendingIntent.getActivity(context, 40 + id, open, flags)
            )
            manager.updateAppWidget(id, views)
        }
    }
}
