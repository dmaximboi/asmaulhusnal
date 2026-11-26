package online.digital26.asmaclock

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.RemoteViews

class ClockWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        paint(context, manager, ids)
        WidgetTickService.start(context)
    }

    override fun onEnabled(context: Context) {
        WidgetTickService.start(context)
    }

    override fun onDisabled(context: Context) {
        WidgetTickService.stop(context)
    }

    companion object {
        fun ids(ctx: Context): IntArray {
            val mgr = AppWidgetManager.getInstance(ctx)
            return mgr.getAppWidgetIds(ComponentName(ctx, ClockWidgetProvider::class.java))
        }

        fun refreshAll(ctx: Context) {
            val list = ids(ctx)
            if (list.isEmpty()) {
                WidgetTickService.stop(ctx)
                return
            }
            paint(ctx, AppWidgetManager.getInstance(ctx), list)
        }

        fun paint(ctx: Context, manager: AppWidgetManager, ids: IntArray) {
            val bmp = NamesDialBitmap.draw(sizePx = 800)
            ids.forEach { id ->
                val views = RemoteViews(ctx.packageName, R.layout.widget_clock)
                views.setImageViewBitmap(R.id.widget_dial, bmp)
                val open = Intent(ctx, MainActivity::class.java)
                var flags = PendingIntent.FLAG_UPDATE_CURRENT
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    flags = flags or PendingIntent.FLAG_IMMUTABLE
                }
                views.setOnClickPendingIntent(
                    R.id.widget_root,
                    PendingIntent.getActivity(ctx, 40 + id, open, flags)
                )
                manager.updateAppWidget(id, views)
            }
        }
    }
}
