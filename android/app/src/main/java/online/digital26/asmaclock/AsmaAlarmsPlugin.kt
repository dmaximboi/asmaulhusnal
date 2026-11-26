package online.digital26.asmaclock

import android.Manifest
import android.annotation.SuppressLint
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONArray
import java.util.concurrent.Executor
import java.util.function.Consumer

@CapacitorPlugin(
    name = "AsmaAlarms",
    permissions = [
        Permission(
            alias = "notifications",
            strings = [Manifest.permission.POST_NOTIFICATIONS]
        ),
        Permission(
            alias = "fine",
            strings = [Manifest.permission.ACCESS_FINE_LOCATION]
        ),
        Permission(
            alias = "coarse",
            strings = [Manifest.permission.ACCESS_COARSE_LOCATION]
        )
    ]
)
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
    fun pushStore(call: PluginCall) {
        val json = call.getString("json") ?: ""
        AsmaStore.write(context, json)
        call.resolve()
    }

    @PluginMethod
    fun pinWidget(call: PluginCall) {
        val mgr = AppWidgetManager.getInstance(context)
        val cn = ComponentName(context, ClockWidgetProvider::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && mgr.isRequestPinAppWidgetSupported) {
            try {
                mgr.requestPinAppWidget(cn, null, null)
                WidgetTickService.start(context)
                call.resolve(JSObject().put("ok", true))
                return
            } catch (_: Exception) { }
        }
        call.resolve(JSObject().put("ok", false))
    }

    @PluginMethod
    fun requestNotifications(call: PluginCall) {
        if (notificationsOn()) {
            call.resolve(JSObject().put("granted", true))
            return
        }
        if (Build.VERSION.SDK_INT >= 33) {
            val act = activity
            val asked = AsmaStore.prefs(context).getBoolean("asked_notif", false)
            val show = act?.shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS) == true
            if (asked && !show && !notificationsOn()) {
                openAppSettings()
                call.resolve(JSObject().put("granted", false))
                return
            }
            AsmaStore.prefs(context).edit().putBoolean("asked_notif", true).apply()
            requestPermissionForAlias("notifications", call, "onNotifPerm")
            return
        }
        openAppSettings()
        call.resolve(JSObject().put("granted", notificationsOn()))
    }

    @PermissionCallback
    fun onNotifPerm(call: PluginCall) {
        call.resolve(JSObject().put("granted", notificationsOn()))
    }

    @PluginMethod
    fun getLocation(call: PluginCall) {
        if (hasLocation()) {
            readLocation(call)
            return
        }
        requestPermissionForAlias("fine", call, "onLocFine")
    }

    @PermissionCallback
    fun onLocFine(call: PluginCall) {
        if (hasLocation()) {
            readLocation(call)
            return
        }
        requestPermissionForAlias("coarse", call, "onLocCoarse")
    }

    @PermissionCallback
    fun onLocCoarse(call: PluginCall) {
        if (hasLocation()) readLocation(call)
        else {
            val act = activity
            val show = act?.shouldShowRequestPermissionRationale(Manifest.permission.ACCESS_COARSE_LOCATION) == true
            if (!show) openAppSettings()
            call.reject("denied")
        }
    }

    @PluginMethod
    fun showFastNotice(call: PluginCall) {
        val notice = Intent(context, FastNoticeService::class.java)
        notice.putExtra(ExactAlarmScheduler.EXTRA_TITLE, call.getString("title") ?: "")
        notice.putExtra(ExactAlarmScheduler.EXTRA_BODY, call.getString("body") ?: "")
        notice.putExtra(ExactAlarmScheduler.EXTRA_SPEAK, call.getString("speak") ?: "")
        notice.putExtra(ExactAlarmScheduler.EXTRA_SHARE, call.getString("share") ?: "")
        notice.putExtra(ExactAlarmScheduler.EXTRA_LANG, call.getString("lang") ?: "en")
        notice.putExtra(ExactAlarmScheduler.EXTRA_STAY, call.getBoolean("stay", true) ?: true)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(notice)
            } else {
                context.startService(notice)
            }
            call.resolve()
        } catch (e: Exception) {
            call.reject(e.message ?: "notice failed")
        }
    }

    @PluginMethod
    fun requestOverlay(call: PluginCall) {
        IslandOverlayService.prefs(context).edit().putBoolean(IslandOverlayService.KEY_WANT, true).apply()
        val granted = Settings.canDrawOverlays(context)
        if (!granted) {
            try {
                activity?.startActivity(
                    Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).setData(
                        Uri.parse("package:" + context.packageName)
                    )
                )
            } catch (_: Exception) { }
        }
        call.resolve(JSObject().put("granted", granted))
    }

    @PluginMethod
    fun startIsland(call: PluginCall) {
        IslandOverlayService.prefs(context).edit().putBoolean(IslandOverlayService.KEY_WANT, true).apply()
        if (!Settings.canDrawOverlays(context)) {
            try {
                activity?.startActivity(
                    Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).setData(
                        Uri.parse("package:" + context.packageName)
                    )
                )
            } catch (_: Exception) { }
            call.reject("overlay")
            return
        }
        IslandOverlayService.start(context)
        call.resolve(statusObject())
    }

    @PluginMethod
    fun stopIsland(call: PluginCall) {
        IslandOverlayService.prefs(context).edit().putBoolean(IslandOverlayService.KEY_WANT, false).apply()
        IslandOverlayService.stop(context)
        call.resolve(statusObject())
    }

    @PluginMethod
    fun requestReady(call: PluginCall) {
        val act = activity
        if (act != null && Build.VERSION.SDK_INT >= 33) {
            val granted = ContextCompat.checkSelfPermission(act, Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
            if (!granted) {
                requestPermissionForAlias("notifications", call, "onReadyNotif")
                return
            }
        }
        openReadyScreens()
        call.resolve(statusObject())
    }

    @PermissionCallback
    fun onReadyNotif(call: PluginCall) {
        openReadyScreens()
        call.resolve(statusObject())
    }

    override fun handleOnResume() {
        if (IslandOverlayService.prefs(context).getBoolean(IslandOverlayService.KEY_WANT, false) &&
            Settings.canDrawOverlays(context)
        ) {
            IslandOverlayService.start(context)
        }
        if (ClockWidgetProvider.ids(context).isNotEmpty()) {
            WidgetTickService.start(context)
        }
    }

    private fun openReadyScreens() {
        val act = activity
        if (!ExactAlarmScheduler.canScheduleExact(context) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                act?.startActivity(
                    Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).setData(
                        Uri.parse("package:" + context.packageName)
                    )
                )
            } catch (_: Exception) { }
        }
        val pm = context.getSystemService(android.content.Context.POWER_SERVICE) as PowerManager
        if (!pm.isIgnoringBatteryOptimizations(context.packageName)) {
            try {
                act?.startActivity(
                    Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).setData(
                        Uri.parse("package:" + context.packageName)
                    )
                )
            } catch (_: Exception) { }
        }
    }

    private fun openAppSettings() {
        try {
            activity?.startActivity(
                Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).setData(
                    Uri.parse("package:" + context.packageName)
                )
            )
        } catch (_: Exception) { }
    }

    private fun notificationsOn(): Boolean {
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return false
        if (Build.VERSION.SDK_INT < 33) return true
        return ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
    }

    private fun hasLocation(): Boolean {
        return ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
    }

    @SuppressLint("MissingPermission")
    private fun readLocation(call: PluginCall) {
        val lm = context.getSystemService(android.content.Context.LOCATION_SERVICE) as LocationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P && !lm.isLocationEnabled) {
            try {
                activity?.startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
            } catch (_: Exception) { }
            call.reject("off")
            return
        }
        val last = listOf(
            LocationManager.NETWORK_PROVIDER,
            LocationManager.GPS_PROVIDER,
            LocationManager.PASSIVE_PROVIDER
        ).mapNotNull {
            try {
                lm.getLastKnownLocation(it)
            } catch (_: Exception) {
                null
            }
        }.maxByOrNull { it.time }
        if (last != null && System.currentTimeMillis() - last.time < 15 * 60 * 1000L) {
            call.resolve(coords(last))
            return
        }
        val providers = mutableListOf<String>()
        if (lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) providers.add(LocationManager.NETWORK_PROVIDER)
        if (lm.isProviderEnabled(LocationManager.GPS_PROVIDER)) providers.add(LocationManager.GPS_PROVIDER)
        if (providers.isEmpty()) {
            if (last != null) {
                call.resolve(coords(last))
                return
            }
            try {
                activity?.startActivity(Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS))
            } catch (_: Exception) { }
            call.reject("off")
            return
        }
        val handler = Handler(Looper.getMainLooper())
        var done = false
        val finish: (Location?) -> Unit = { loc ->
            if (!done) {
                done = true
                if (loc != null) call.resolve(coords(loc))
                else if (last != null) call.resolve(coords(last))
                else call.reject("timeout")
            }
        }
        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                handler.removeCallbacksAndMessages(null)
                try {
                    lm.removeUpdates(this)
                } catch (_: Exception) { }
                finish(location)
            }
        }
        handler.postDelayed({
            try {
                lm.removeUpdates(listener)
            } catch (_: Exception) { }
            finish(null)
        }, 20000)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val exec: Executor = ContextCompat.getMainExecutor(context)
                val cancel = CancellationSignal()
                handler.postDelayed({ cancel.cancel() }, 18000)
                val cb = Consumer<Location?> { loc -> finish(loc) }
                lm.getCurrentLocation(providers[0], cancel, exec, cb)
            } else {
                lm.requestLocationUpdates(providers[0], 0L, 0f, listener, Looper.getMainLooper())
            }
        } catch (e: Exception) {
            handler.removeCallbacksAndMessages(null)
            if (last != null) call.resolve(coords(last))
            else call.reject(e.message ?: "location failed")
        }
    }

    private fun coords(loc: Location): JSObject {
        val o = JSObject()
        o.put("lat", loc.latitude)
        o.put("lng", loc.longitude)
        return o
    }

    private fun statusObject(): JSObject {
        val o = JSObject()
        o.put("exact", ExactAlarmScheduler.canScheduleExact(context))
        val pm = context.getSystemService(android.content.Context.POWER_SERVICE) as PowerManager
        o.put("battery", pm.isIgnoringBatteryOptimizations(context.packageName))
        o.put("notif", notificationsOn())
        o.put("location", hasLocation())
        o.put("overlay", Settings.canDrawOverlays(context))
        o.put("island", IslandOverlayService.prefs(context).getBoolean(IslandOverlayService.KEY, false))
        o.put("widget", ClockWidgetProvider.ids(context).isNotEmpty())
        return o
    }
}
