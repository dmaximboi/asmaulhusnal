package online.digital26.asmaclock

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONArray

@CapacitorPlugin(name = "AsmaAlarms")
class AsmaAlarmsPlugin : Plugin() {

    @PluginMethod
    fun schedule(call: PluginCall) {
        val arr = call.getArray("items") ?: JSONArray()
        ExactAlarmScheduler.replacePrayers(context, arr)
        call.resolve()
    }

    @PluginMethod
    fun cancelAll(call: PluginCall) {
        ExactAlarmScheduler.cancelPrayers(context)
        call.resolve()
    }

    @PluginMethod
    fun getStatus(call: PluginCall) {
        call.resolve(statusObject())
    }

    @PluginMethod
    fun requestReady(call: PluginCall) {
        val act = activity
        if (act != null && Build.VERSION.SDK_INT >= 33) {
            val granted = ContextCompat.checkSelfPermission(act, Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
            if (!granted) {
                act.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 33)
            }
        }
        if (!ExactAlarmScheduler.canScheduleExact(context) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                act?.startActivity(
                    Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).setData(
                        Uri.parse("package:" + context.packageName)
                    )
                )
            } catch (_: Exception) {
                /* no settings screen */
            }
        }
        val pm = context.getSystemService(android.content.Context.POWER_SERVICE) as PowerManager
        if (!pm.isIgnoringBatteryOptimizations(context.packageName)) {
            try {
                act?.startActivity(
                    Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).setData(
                        Uri.parse("package:" + context.packageName)
                    )
                )
            } catch (_: Exception) {
                /* no settings screen */
            }
        }
        call.resolve(statusObject())
    }

    private fun statusObject(): JSObject {
        val o = JSObject()
        o.put("exact", ExactAlarmScheduler.canScheduleExact(context))
        val pm = context.getSystemService(android.content.Context.POWER_SERVICE) as PowerManager
        o.put("battery", pm.isIgnoringBatteryOptimizations(context.packageName))
        val notif = if (Build.VERSION.SDK_INT < 33) {
            true
        } else {
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
        }
        o.put("notif", notif)
        return o
    }
}
