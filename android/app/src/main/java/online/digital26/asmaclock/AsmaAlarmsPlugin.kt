package online.digital26.asmaclock

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONArray

@CapacitorPlugin(
    name = "AsmaAlarms",
    permissions = [
        Permission(
            alias = "notifications",
            strings = [Manifest.permission.POST_NOTIFICATIONS]
        ),
        Permission(
            alias = "location",
            strings = [
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.ACCESS_FINE_LOCATION
            ]
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
    fun requestNotifications(call: PluginCall) {
        if (Build.VERSION.SDK_INT < 33) {
            call.resolve(JSObject().put("granted", true))
            return
        }
        if (getPermissionState("notifications") == PermissionState.GRANTED) {
            call.resolve(JSObject().put("granted", true))
            return
        }
        requestPermissionForAlias("notifications", call, "onNotifPerm")
    }

    @PermissionCallback
    fun onNotifPerm(call: PluginCall) {
        val granted = getPermissionState("notifications") == PermissionState.GRANTED
        call.resolve(JSObject().put("granted", granted))
    }

    @PluginMethod
    fun getLocation(call: PluginCall) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "onLocPerm")
            return
        }
        readLocation(call)
    }

    @PermissionCallback
    fun onLocPerm(call: PluginCall) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("location denied")
            return
        }
        readLocation(call)
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

    private fun openReadyScreens() {
        val act = activity
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
    }

    @SuppressLint("MissingPermission")
    private fun readLocation(call: PluginCall) {
        val lm = context.getSystemService(android.content.Context.LOCATION_SERVICE) as LocationManager
        val last = listOf(
            LocationManager.GPS_PROVIDER,
            LocationManager.NETWORK_PROVIDER,
            LocationManager.PASSIVE_PROVIDER
        ).mapNotNull {
            try {
                lm.getLastKnownLocation(it)
            } catch (_: Exception) {
                null
            }
        }.maxByOrNull { it.time }
        if (last != null && System.currentTimeMillis() - last.time < 10 * 60 * 1000L) {
            call.resolve(coords(last))
            return
        }
        val provider = when {
            lm.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
            lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
            else -> null
        }
        if (provider == null) {
            if (last != null) call.resolve(coords(last))
            else call.reject("no provider")
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
                } catch (_: Exception) {
                    /* ignore */
                }
                finish(location)
            }
        }
        handler.postDelayed({
            try {
                lm.removeUpdates(listener)
            } catch (_: Exception) {
                /* ignore */
            }
            finish(null)
        }, 15000)
        try {
            lm.requestLocationUpdates(provider, 0L, 0f, listener, Looper.getMainLooper())
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
        val notif = if (Build.VERSION.SDK_INT < 33) {
            true
        } else {
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
        }
        o.put("notif", notif)
        val loc = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
        o.put("location", loc)
        return o
    }
}
