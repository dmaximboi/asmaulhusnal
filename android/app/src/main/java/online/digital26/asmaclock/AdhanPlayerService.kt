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
import android.media.MediaPlayer
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat

class AdhanPlayerService : Service() {
    private var player: MediaPlayer? = null
    private var wake: PowerManager.WakeLock? = null
    private val handler = Handler(Looper.getMainLooper())
    private val stopLater = Runnable { stopSelf() }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        ensureChannel(this)
        val test = intent?.getBooleanExtra(ExactAlarmScheduler.EXTRA_TEST, false) == true
        val key = intent?.getStringExtra(ExactAlarmScheduler.EXTRA_KEY) ?: if (test) "test" else "isha"
        val title = intent?.getStringExtra(ExactAlarmScheduler.EXTRA_TITLE)
            ?: getString(R.string.alarm_notif_title)
        val body = intent?.getStringExtra(ExactAlarmScheduler.EXTRA_BODY)
            ?: getString(if (test) R.string.alarm_notif_body else R.string.adhan_notif_body)
        val notifId = if (test) NOTIF_TEST else NOTIF_ADHAN
        val notif = buildNotif(title, body, test)
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                startForeground(notifId, notif, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
            } else {
                startForeground(notifId, notif)
            }
        } catch (_: Exception) {
            try {
                startForeground(notifId, notif)
            } catch (_: Exception) {
                stopSelf()
                return START_NOT_STICKY
            }
        }
        play(if (test) "test" else key)
        handler.removeCallbacks(stopLater)
        handler.postDelayed(stopLater, 12L * 60L * 1000L)
        return START_REDELIVER_INTENT
    }

    private fun play(key: String) {
        releasePlayer()
        try {
            val mp = MediaPlayer()
            mp.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build()
            )
            val res = rawFor(key)
            val fd = resources.openRawResourceFd(res)
            mp.setDataSource(fd.fileDescriptor, fd.startOffset, fd.length)
            fd.close()
            mp.setOnCompletionListener { stopSelf() }
            mp.setOnErrorListener { _, _, _ -> stopSelf(); true }
            mp.prepare()
            mp.start()
            player = mp
            val pm = getSystemService(POWER_SERVICE) as PowerManager
            wake = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "asma:adhan").also {
                it.setReferenceCounted(false)
                it.acquire(12L * 60L * 1000L)
            }
        } catch (_: Exception) {
            stopSelf()
        }
    }

    private fun rawFor(key: String): Int {
        return when (key) {
            "fajr" -> R.raw.adhan_fajr
            "dhuhr", "asr" -> R.raw.adhan_dhuhr
            else -> R.raw.adhan_other
        }
    }

    private fun buildNotif(title: String, body: String, test: Boolean): Notification {
        val open = Intent(this, MainActivity::class.java)
        var flags = PendingIntent.FLAG_UPDATE_CURRENT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags = flags or PendingIntent.FLAG_IMMUTABLE
        }
        val tap = PendingIntent.getActivity(this, if (test) 0 else 1, open, flags)
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notify)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setOngoing(true)
            .setContentIntent(tap)
            .setSilent(true)
            .build()
    }

    private fun releasePlayer() {
        try {
            player?.stop()
        } catch (_: Exception) {
            /* already stopped */
        }
        try {
            player?.release()
        } catch (_: Exception) {
            /* ignore */
        }
        player = null
        try {
            if (wake?.isHeld == true) wake?.release()
        } catch (_: Exception) {
            /* ignore */
        }
        wake = null
    }

    override fun onDestroy() {
        handler.removeCallbacks(stopLater)
        releasePlayer()
        super.onDestroy()
    }

    companion object {
        const val CHANNEL_ID = "asma-adhan"
        const val NOTIF_TEST = 2601
        const val NOTIF_ADHAN = 2701

        fun ensureChannel(context: Context) {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val ch = NotificationChannel(
                CHANNEL_ID,
                context.getString(R.string.adhan_channel_name),
                NotificationManager.IMPORTANCE_HIGH
            )
            ch.description = context.getString(R.string.adhan_channel_desc)
            ch.enableVibration(true)
            ch.setSound(null, null)
            nm.createNotificationChannel(ch)
        }
    }
}
