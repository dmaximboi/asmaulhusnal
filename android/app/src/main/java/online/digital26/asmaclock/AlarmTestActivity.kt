package online.digital26.asmaclock

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import java.text.DateFormat
import java.util.Date

class AlarmTestActivity : AppCompatActivity() {
    private lateinit var status: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_alarm_test)
        status = findViewById(R.id.status)
        ExactAlarmReceiver.ensureChannel(this)
        findViewById<Button>(R.id.btnSchedule).setOnClickListener { trySchedule() }
        findViewById<Button>(R.id.btnOpenClock).setOnClickListener {
            startActivity(Intent(this, MainActivity::class.java))
        }
        findViewById<Button>(R.id.btnBattery).setOnClickListener { askIgnoreBattery() }
    }

    private fun askIgnoreBattery() {
        val pm = getSystemService(POWER_SERVICE) as PowerManager
        if (pm.isIgnoringBatteryOptimizations(packageName)) {
            status.setText(R.string.alarm_test_battery_ok)
            return
        }
        status.setText(R.string.alarm_test_battery_need)
        startActivity(
            Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).setData(
                Uri.parse("package:$packageName")
            )
        )
    }

    private fun trySchedule() {
        if (Build.VERSION.SDK_INT >= 33) {
            val granted = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
            if (!granted) {
                ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_NOTIF)
                status.setText(R.string.alarm_test_need_notif)
                return
            }
        }
        if (!ExactAlarmScheduler.canScheduleExact(this)) {
            status.setText(R.string.alarm_test_need_exact)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                startActivity(
                    Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).setData(
                        Uri.parse("package:$packageName")
                    )
                )
            }
            return
        }
        val whenAt = ExactAlarmScheduler.scheduleInOneMinute(this)
        val clock = DateFormat.getTimeInstance(DateFormat.SHORT).format(Date(whenAt))
        status.text = getString(R.string.alarm_test_status_set, clock)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQ_NOTIF && grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            trySchedule()
        }
    }

    companion object {
        private const val REQ_NOTIF = 33
    }
}
