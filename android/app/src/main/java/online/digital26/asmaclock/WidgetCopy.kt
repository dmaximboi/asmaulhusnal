package online.digital26.asmaclock

import java.util.Calendar

/** Gregorian weekday and month names copied from web/content.js DAYS.ar and MONTHS_G.ar. */
object WidgetCopy {
    private val daysAr = arrayOf(
        "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"
    )
    private val monthsAr = arrayOf(
        "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
        "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
    )
    private val digits = charArrayOf('٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩')

    fun arDigits(s: String): String {
        val b = StringBuilder(s.length)
        s.forEach { ch ->
            if (ch in '0'..'9') b.append(digits[ch - '0']) else b.append(ch)
        }
        return b.toString()
    }

    fun dateLine(now: Calendar): String {
        val day = daysAr[now.get(Calendar.DAY_OF_WEEK) - 1]
        val d = now.get(Calendar.DAY_OF_MONTH)
        val month = monthsAr[now.get(Calendar.MONTH)]
        return arDigits("$day $d $month")
    }

    fun timeLine(now: Calendar, h24: Boolean): String {
        var h = now.get(Calendar.HOUR_OF_DAY)
        val m = now.get(Calendar.MINUTE)
        val mm = if (m < 10) "0$m" else "$m"
        if (h24) {
            val hh = if (h < 10) "0$h" else "$h"
            return arDigits("$hh:$mm")
        }
        val p = if (h < 12) "ص" else "م"
        h = h % 12
        if (h == 0) h = 12
        return arDigits("$h:$mm $p")
    }
}
