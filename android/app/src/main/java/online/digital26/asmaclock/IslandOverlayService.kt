package online.digital26.asmaclock

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import kotlin.math.min

class IslandOverlayService : Service() {
    private var host: FrameLayout? = null
    private var pill: View? = null
    private var pillTime: TextView? = null
    private var web: WebView? = null
    private var params: WindowManager.LayoutParams? = null
    private var wake: PowerManager.WakeLock? = null
    private val main = Handler(Looper.getMainLooper())
    private val pillTick = object : Runnable {
        override fun run() {
            paintPill()
            main.postDelayed(this, 1000)
        }
    }

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
        attachPill()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            prefs(this).edit().putBoolean(KEY, false).apply()
            stopSelf()
            return START_NOT_STICKY
        }
        prefs(this).edit().putBoolean(KEY, true).apply()
        if (host == null && Settings.canDrawOverlays(this)) attachPill()
        return START_STICKY
    }

    override fun onDestroy() {
        if (live === this) live = null
        main.removeCallbacks(pillTick)
        detach()
        super.onDestroy()
    }

    private fun attachPill() {
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
        val box = FrameLayout(this)
        box.setBackgroundColor(Color.TRANSPARENT)
        val pillView = LayoutInflater.from(this).inflate(R.layout.island_pill, box, false)
        pillView.setOnClickListener { openExpanded() }
        box.addView(pillView)
        host = box
        pill = pillView
        pillTime = pillView.findViewById(R.id.island_pill_time)
        try {
            wm.addView(box, p)
            paintPill()
            main.removeCallbacks(pillTick)
            main.post(pillTick)
        } catch (_: Exception) {
            host = null
            stopSelf()
        }
    }

    private fun paintPill() {
        val tv = pillTime ?: return
        val now = java.util.Calendar.getInstance()
        val h24 = try {
            val raw = AsmaStore.read(this)
            raw.isNotEmpty() && org.json.JSONObject(raw).optBoolean("h24", false)
        } catch (_: Exception) {
            false
        }
        tv.text = WidgetCopy.timeLine(now, h24)
    }

    private fun openExpanded() {
        if (web != null) {
            showWeb()
            return
        }
        val box = host ?: return
        val view = WebView(this)
        view.setBackgroundColor(Color.TRANSPARENT)
        view.setLayerType(View.LAYER_TYPE_NONE, null)
        val s = view.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.allowFileAccess = true
        s.mediaPlaybackRequiresUserGesture = true
        s.cacheMode = WebSettings.LOAD_NO_CACHE
        s.blockNetworkImage = true
        s.blockNetworkLoads = true
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
            @Suppress("DEPRECATION")
            s.allowFileAccessFromFileURLs = false
            @Suppress("DEPRECATION")
            s.allowUniversalAccessFromFileURLs = false
        }
        view.addJavascriptInterface(Bridge(), "AsmaBridge")
        view.webViewClient = object : WebViewClient() {
            private fun assetOk(url: String?): Boolean {
                return url != null && url.startsWith("file:///android_asset/")
            }

            override fun shouldOverrideUrlLoading(v: WebView?, url: String?): Boolean {
                return !assetOk(url)
            }

            override fun shouldOverrideUrlLoading(v: WebView?, req: android.webkit.WebResourceRequest?): Boolean {
                return !assetOk(req?.url?.toString())
            }

            override fun onPageFinished(v: WebView?, url: String?) {
                if (!assetOk(url)) return
                injectStore(AsmaStore.read(this@IslandOverlayService))
                v?.evaluateJavascript(
                    "if(window.__island&&window.__island.expand)window.__island.expand(0);",
                    null
                )
                showWeb()
            }
        }
        view.visibility = View.GONE
        box.addView(
            view,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        )
        web = view
        view.loadUrl("file:///android_asset/public/island.html")
    }

    private fun showWeb() {
        pill?.visibility = View.GONE
        web?.visibility = View.VISIBLE
        applySize("e", 0)
    }

    private fun closeWeb() {
        val box = host
        val view = web
        web = null
        if (view != null && box != null) {
            try {
                box.removeView(view)
            } catch (_: Exception) { }
            view.destroy()
        }
        pill?.visibility = View.VISIBLE
        applySize("c", 0)
        paintPill()
    }

    private fun detach() {
        main.removeCallbacks(pillTick)
        val wm = getSystemService(WINDOW_SERVICE) as WindowManager
        val box = host
        host = null
        pill = null
        pillTime = null
        val view = web
        web = null
        if (view != null) {
            try {
                view.destroy()
            } catch (_: Exception) { }
        }
        if (box != null) {
            try {
                wm.removeView(box)
            } catch (_: Exception) { }
        }
        try {
            wake?.release()
        } catch (_: Exception) { }
        wake = null
    }

    private fun applySize(mode: String, page: Int) {
        val p = params ?: return
        val box = host ?: return
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
            (getSystemService(WINDOW_SERVICE) as WindowManager).updateViewLayout(box, p)
        } catch (_: Exception) { }
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
        fun ignore(v: Boolean) { }

        @JavascriptInterface
        fun show() {
            main.post { showWeb() }
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
                    } catch (_: Exception) { }
                    wake = null
                }
            }
        }

        @JavascriptInterface
        fun resize(mode: String, page: Int) {
            main.post {
                if (mode == "c") closeWeb()
                else applySize(mode, page)
            }
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
