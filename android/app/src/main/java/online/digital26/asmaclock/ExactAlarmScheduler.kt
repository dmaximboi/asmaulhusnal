package online.digital26.asmaclock

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject

object ExactAlarmScheduler {
    const val REQUEST_CODE = 2601
    const val EXTRA_WHEN = "when"
    const val EXTRA_ID = "id"
    const val EXTRA_KEY = "key"
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"
    const val EXTRA_TEST = "test"

    private const val PREFS = "asma_alarms"
    private const val KEY_ITEMS = "items"

    fun canScheduleExact(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        return am.canScheduleExactAlarms()
    }

    fun requestCodeFor(id: String): Int {
        return when (id) {
            "fajr" -> 101
            "dhuhr" -> 102
            "asr" -> 103
            "maghrib" -> 104
            "isha" -> 105
            else -> (id.hashCode() and 0x7fffffff) % 9000 + 200
        }
    }

    fun scheduleInOneMinute(context: Context): Long {
        val whenAt = System.currentTimeMillis() + 60_000L
        val intent = Intent(context, ExactAlarmReceiver::class.java)
            .putExtra(EXTRA_WHEN, whenAt)
            .putExtra(EXTRA_TEST, true)
            .putExtra(EXTRA_KEY, "test")
            .putExtra(EXTRA_TITLE, context.getString(R.string.alarm_notif_title))
            .putExtra(EXTRA_BODY, context.getString(R.string.alarm_notif_body))
        setExact(context, REQUEST_CODE, whenAt, intent)
        return whenAt
    }

    fun replacePrayers(context: Context, items: JSONArray) {
        cancelPrayers(context)
        val keep = JSONArray()
        val now = System.currentTimeMillis()
        for (i in 0 until items.length()) {
            val o = items.getJSONObject(i)
            val id = o.optString("id")
            if (id.isEmpty()) continue
            val at = numberLong(o, "at")
            if (at <= now + 8_000L) continue
            val key = o.optString("key", id)
            val title = o.optString("title")
            val body = o.optString("body")
            val stored = JSONObject()
            stored.put("id", id)
            stored.put("at", at)
            stored.put("key", key)
            stored.put("title", title)
            stored.put("body", body)
            keep.put(stored)
            schedulePrayer(context, id, at, key, title, body)
        }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_ITEMS, keep.toString())
            .apply()
    }

    fun restore(context: Context) {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_ITEMS, "[]") ?: "[]"
        try {
            replacePrayers(context, JSONArray(raw))
        } catch (_: Exception) {
            /* ignore bad prefs */
        }
    }

    fun cancelPrayers(context: Context) {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_ITEMS, "[]") ?: "[]"
        try {
            val arr = JSONArray(raw)
            for (i in 0 until arr.length()) {
                val id = arr.getJSONObject(i).optString("id")
                if (id.isNotEmpty()) cancelCode(context, requestCodeFor(id))
            }
        } catch (_: Exception) {
            /* ignore */
        }
        listOf("fajr", "dhuhr", "asr", "maghrib", "isha").forEach { cancelCode(context, requestCodeFor(it)) }
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(KEY_ITEMS).apply()
    }

    fun schedulePrayer(context: Context, id: String, whenAt: Long, key: String, title: String, body: String) {
        val intent = Intent(context, ExactAlarmReceiver::class.java)
            .putExtra(EXTRA_WHEN, whenAt)
            .putExtra(EXTRA_ID, id)
            .putExtra(EXTRA_KEY, key)
            .putExtra(EXTRA_TITLE, title)
            .putExtra(EXTRA_BODY, body)
            .putExtra(EXTRA_TEST, false)
        setExact(context, requestCodeFor(id), whenAt, intent)
    }

    fun bumpNextDay(context: Context, intent: Intent) {
        if (intent.getBooleanExtra(EXTRA_TEST, false)) return
        val id = intent.getStringExtra(EXTRA_ID) ?: return
        val whenAt = intent.getLongExtra(EXTRA_WHEN, 0L)
        if (id.isEmpty() || whenAt <= 0L) return
        val next = whenAt + 24L * 60L * 60L * 1000L
        val key = intent.getStringExtra(EXTRA_KEY) ?: id
        val title = intent.getStringExtra(EXTRA_TITLE) ?: ""
        val body = intent.getStringExtra(EXTRA_BODY) ?: ""
        schedulePrayer(context, id, next, key, title, body)
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val arr = try {
            JSONArray(prefs.getString(KEY_ITEMS, "[]") ?: "[]")
        } catch (_: Exception) {
            JSONArray()
        }
        var found = false
        for (i in 0 until arr.length()) {
            val o = arr.getJSONObject(i)
            if (o.optString("id") == id) {
                o.put("at", next)
                found = true
                break
            }
        }
        if (!found) {
            val o = JSONObject()
            o.put("id", id)
            o.put("at", next)
            o.put("key", key)
            o.put("title", title)
            o.put("body", body)
            arr.put(o)
        }
        prefs.edit().putString(KEY_ITEMS, arr.toString()).apply()
    }

    private fun setExact(context: Context, code: Int, whenAt: Long, intent: Intent) {
        var flags = PendingIntent.FLAG_UPDATE_CURRENT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags = flags or PendingIntent.FLAG_IMMUTABLE
        }
        val pending = PendingIntent.getBroadcast(context, code, intent, flags)
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, whenAt, pending)
        } else {
            am.setExact(AlarmManager.RTC_WAKEUP, whenAt, pending)
        }
    }

    private fun cancelCode(context: Context, code: Int) {
        val intent = Intent(context, ExactAlarmReceiver::class.java)
        var flags = PendingIntent.FLAG_UPDATE_CURRENT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags = flags or PendingIntent.FLAG_IMMUTABLE
        }
        val pending = PendingIntent.getBroadcast(context, code, intent, flags)
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(pending)
    }

    private fun numberLong(o: JSONObject, key: String): Long {
        if (!o.has(key)) return 0L
        return try {
            o.getLong(key)
        } catch (_: Exception) {
            try {
                o.getDouble(key).toLong()
            } catch (_: Exception) {
                0L
            }
        }
    }
}
