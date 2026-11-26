package online.digital26.asmaclock

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.view.Gravity
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.app.NotificationCompat
import kotlin.math.min

class IslandOverlayService : Service() {
    private var web: WebView? = null
    private var params: WindowManager.LayoutParams? = null
    private var wake: PowerManager.WakeLock? = null
    private val main = Handler(Looper.getMainLooper())

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        live = this
        ensureChannel()
        val n = notice()
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIF, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(NOTIF, n)
        }
        if (!Settings.canDrawOverlays(this)) {
            stopSelf()
            return
        }
        attach()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            prefs(this).edit().putBoolean(KEY, false).apply()
            stopSelf()
            return START_NOT_STICKY
        }
        prefs(this).edit().putBoolean(KEY, true).apply()
        if (web == null && Settings.canDrawOverlays(this)) attach()
        return START_STICKY
    }

    override fun onDestroy() {
        if (live === this) live = null
        detach()
        super.onDestroy()
    }

    private fun attach() {
        val wm = getSystemService(WINDOW_SERVICE) as WindowManager
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }
        val p = WindowManager.LayoutParams(
            dp(176),
            dp(48),
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        )
        p.gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
        p.y = dp(8)
        params = p
        val view = WebView(this)
        view.setBackgroundColor(Color.TRANSPARENT)
        view.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null)
        val s = view.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.allowFileAccess = true
        s.mediaPlaybackRequiresUserGesture = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
            @Suppress("DEPRECATION")
            s.allowFileAccessFromFileURLs = true
        }
        s.cacheMode = WebSettings.LOAD_DEFAULT
        view.addJavascriptInterface(Bridge(), "AsmaBridge")
        view.webViewClient = object : WebViewClient() {
            override fun onPageFinished(v: WebView?, url: String?) {
                injectStore(AsmaStore.read(this@IslandOverlayService))
            }
        }
        view.loadUrl("file:///android_asset/public/island.html")
        web = view
        try {
            wm.addView(view, p)
        } catch (_: Exception) {
            web = null
            stopSelf()
        }
    }

    private fun detach() {
        val wm = getSystemService(WINDOW_SERVICE) as WindowManager
        val view = web
        web = null
        if (view != null) {
            try {
                wm.removeView(view)
            } catch (_: Exception) {
                /* already gone */
            }
            view.destroy()
        }
        try {
            wake?.release()
        } catch (_: Exception) {
            /* ignore */
        }
        wake = null
    }

    private fun applySize(mode: String, page: Int) {
        val p = params ?: return
        val view = web ?: return
        val maxW = resources.displayMetrics.widthPixels - dp(16)
        when (mode) {
            "c" -> {
                p.width = dp(176)
                p.height = dp(48)
            }
            "al" -> {
                p.width = min(maxW, dp(448))
                p.height = dp(158)
            }
            else -> {
                p.width = min(maxW, dp(428))
                p.height = when (page) {
                    1 -> dp(312)
                    2 -> dp(226)
                    3 -> dp(216)
                    else -> dp(180)
                }
            }
        }
        try {
            (getSystemService(WINDOW_SERVICE) as WindowManager).updateViewLayout(view, p)
        } catch (_: Exception) {
            /* overlay gone */
        }
    }

    private fun dp(v: Int): Int {
        return (v * resources.displayMetrics.density).toInt()
    }

    private fun notice() = NotificationCompat.Builder(this, CHANNEL)
        .setSmallIcon(R.drawable.ic_notify)
        .setContentTitle(getString(R.string.island_notif_title))
        .setContentText(getString(R.string.island_notif_body))
        .setOngoing(true)
        .setContentIntent(
            PendingIntent.getActivity(
                this,
                41,
                Intent(this, MainActivity::class.java),
                pendingFlags()
            )
        )
        .addAction(
            0,
            getString(R.string.island_stop),
            PendingIntent.getService(
                this,
                42,
                Intent(this, IslandOverlayService::class.java).setAction(ACTION_STOP),
                pendingFlags()
            )
        )
        .build()

    private fun pendingFlags(): Int {
        var flags = PendingIntent.FLAG_UPDATE_CURRENT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags = flags or PendingIntent.FLAG_IMMUTABLE
        }
        return flags
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(NotificationManager::class.java)
        val ch = NotificationChannel(
            CHANNEL,
            getString(R.string.island_channel),
            NotificationManager.IMPORTANCE_LOW
        )
        ch.setShowBadge(false)
        nm.createNotificationChannel(ch)
    }

    inner class Bridge {
        @JavascriptInterface
        fun ignore(v: Boolean) {
            /* Window is sized to the pill, so click-through is not used. */
        }

        @JavascriptInterface
        fun show() {
            main.post { web?.bringToFront() }
        }

        @JavascriptInterface
        fun openApp() {
            val i = Intent(this@IslandOverlayService, MainActivity::class.java)
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            startActivity(i)
        }

        @JavascriptInterface
        fun holdAwake(on: Boolean) {
            main.post {
                if (on) {
                    if (wake == null) {
                        val pm = getSystemService(POWER_SERVICE) as PowerManager
                        wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "asma:island")
                        wake?.acquire(10 * 60 * 1000L)
                    }
                } else {
                    try {
                        wake?.release()
                    } catch (_: Exception) {
                        /* ignore */
                    }
                    wake = null
                }
            }
        }

        @JavascriptInterface
        fun resize(mode: String, page: Int) {
            main.post { applySize(mode, page) }
        }

        @JavascriptInterface
        fun storeJson(): String {
            return AsmaStore.read(this@IslandOverlayService)
        }
    }

    private fun injectStore(json: String) {
        val view = web ?: return
        if (json.isEmpty()) return
        val quoted = org.json.JSONObject.quote(json)
        view.evaluateJavascript(
            "(function(){try{var j=$quoted;window.__ASMA_STORE=JSON.parse(j);try{localStorage.setItem('asma.v1',j);}catch(e){}if(window.__islandReload)window.__islandReload();}catch(e){}})();",
            null
        )
    }

    companion object {
        const val ACTION_STOP = "online.digital26.asmaclock.STOP_ISLAND"
        const val CHANNEL = "asma-island"
        const val NOTIF = 2704
        const val PREFS = "asma_island"
        const val KEY = "on"
        const val KEY_WANT = "want"
        private var live: IslandOverlayService? = null

        fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, MODE_PRIVATE)

        fun start(ctx: Context) {
            if (!Settings.canDrawOverlays(ctx)) return
            val i = Intent(ctx, IslandOverlayService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(i)
            } else {
                ctx.startService(i)
            }
        }

        fun stop(ctx: Context) {
            ctx.stopService(Intent(ctx, IslandOverlayService::class.java))
            prefs(ctx).edit().putBoolean(KEY, false).apply()
        }

        fun pushStore(ctx: Context, json: String) {
            live?.main?.post { live?.injectStore(json) }
        }
    }
}
