package online.digital26.asmaclock

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import androidx.core.app.NotificationCompat
import java.util.Locale

class FastNoticeService : Service(), TextToSpeech.OnInitListener {
    private var tts: TextToSpeech? = null
    private var speakText = ""
    private var lang = "en"
    private var stayNotif: Notification? = null
    private val handler = Handler(Looper.getMainLooper())
    private val stopLater = Runnable { stopSelf() }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        ensureChannel(this)
        val title = intent?.getStringExtra(ExactAlarmScheduler.EXTRA_TITLE)
            ?: getString(R.string.alarm_notif_title)
        val body = intent?.getStringExtra(ExactAlarmScheduler.EXTRA_BODY) ?: ""
        val share = intent?.getStringExtra(ExactAlarmScheduler.EXTRA_SHARE) ?: body
        speakText = intent?.getStringExtra(ExactAlarmScheduler.EXTRA_SPEAK) ?: body
        lang = intent?.getStringExtra(ExactAlarmScheduler.EXTRA_LANG) ?: "en"
        val stay = intent?.getBooleanExtra(ExactAlarmScheduler.EXTRA_STAY, true) ?: true
        val notif = buildNotif(title, body, share, stay)
        stayNotif = notif
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIF_ID, notif)
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                startForeground(NOTIF_SPEAK, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            } else {
                startForeground(NOTIF_SPEAK, notif)
            }
        } catch (_: Exception) {
            try {
                startForeground(NOTIF_SPEAK, notif)
            } catch (_: Exception) {
                /* notice is already posted */
            }
        }
        tts = TextToSpeech(this, this)
        handler.removeCallbacks(stopLater)
        handler.postDelayed(stopLater, 45_000L)
        return START_NOT_STICKY
    }

    override fun onInit(status: Int) {
        if (status != TextToSpeech.SUCCESS) return
        val engine = tts ?: return
        val loc = when (lang) {
            "ar" -> Locale("ar")
            "fr" -> Locale.FRENCH
            else -> Locale.ENGLISH
        }
        val ok = engine.setLanguage(loc)
        if (ok == TextToSpeech.LANG_MISSING_DATA || ok == TextToSpeech.LANG_NOT_SUPPORTED) {
            engine.language = Locale.ENGLISH
        }
        engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {}
            override fun onDone(utteranceId: String?) {
                handler.post { stopSelf() }
            }
            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) {
                handler.post { stopSelf() }
            }
        })
        val text = speakText.trim()
        if (text.isEmpty()) {
            handler.postDelayed(stopLater, 4_000L)
            return
        }
        engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "asma-fast")
    }

    private fun buildNotif(title: String, body: String, share: String, stay: Boolean): Notification {
        val open = Intent(this, MainActivity::class.java)
        var flags = PendingIntent.FLAG_UPDATE_CURRENT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags = flags or PendingIntent.FLAG_IMMUTABLE
        }
        val tap = PendingIntent.getActivity(this, 2, open, flags)
        val send = Intent(Intent.ACTION_SEND)
            .setType("text/plain")
            .putExtra(Intent.EXTRA_SUBJECT, title)
            .putExtra(Intent.EXTRA_TEXT, share)
        val chooser = Intent.createChooser(send, getString(R.string.share_fast))
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val shareTap = PendingIntent.getActivity(this, 3, chooser, flags)
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notify)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setOngoing(stay)
            .setAutoCancel(!stay)
            .setContentIntent(tap)
            .addAction(0, getString(R.string.share_fast), shareTap)
            .build()
    }

    override fun onDestroy() {
        handler.removeCallbacks(stopLater)
        try {
            tts?.stop()
            tts?.shutdown()
        } catch (_: Exception) {
            /* already gone */
        }
        tts = null
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                stopForeground(STOP_FOREGROUND_DETACH)
            }
        } catch (_: Exception) {
            /* shade notice 2801 stays */
        }
        val keep = stayNotif
        if (keep != null) {
            try {
                (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIF_ID, keep)
            } catch (_: Exception) {
                /* already posted */
            }
        }
        super.onDestroy()
    }

    companion object {
        const val CHANNEL_ID = "asma-fast"
        const val NOTIF_ID = 2801
        const val NOTIF_SPEAK = 2803

        fun ensureChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val ch = NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.fast_channel_name),
                NotificationManager.IMPORTANCE_HIGH
            )
            ch.description = context.getString(R.string.fast_channel_desc)
            ch.enableVibration(true)
            val attrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            ch.setSound(Settings.System.DEFAULT_NOTIFICATION_URI, attrs)
            nm.createNotificationChannel(ch)
        }
    }
}
