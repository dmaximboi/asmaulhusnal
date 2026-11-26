package online.digital26.asmaclock

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Typeface
import kotlin.math.min

object NamesDialBitmap {
    fun draw(nowMs: Long = System.currentTimeMillis(), sizePx: Int = 900): Bitmap {
        val size = min(1200, sizePx.coerceAtLeast(400))
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        c.translate(size / 2f, size / 2f)
        c.scale(size / 500f, size / 500f)

        val fill = Paint(Paint.ANTI_ALIAS_FLAG)
        val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
        fill.color = 0xFF101010.toInt()
        c.drawCircle(0f, 0f, 249f, fill)
        fill.color = 0xFFF4F4F1.toInt()
        c.drawCircle(0f, 0f, 243f, fill)
        stroke.color = 0xFFE1E1DC.toInt()
        stroke.strokeWidth = 0.6f
        c.drawCircle(0f, 0f, 231f, stroke)

        stroke.strokeCap = Paint.Cap.BUTT
        for (i in 0 until 60) {
            val big = i % 5 == 0
            c.save()
            c.rotate(i * 6f)
            stroke.color = if (big) 0xFF222222.toInt() else 0xFF9A9A96.toInt()
            stroke.strokeWidth = if (big) 1.4f else 0.7f
            c.drawLine(0f, if (big) -232f else -236f, 0f, -241f, stroke)
            c.restore()
        }

        val now = java.util.Calendar.getInstance()
        now.timeInMillis = nowMs
        val sf = now.get(java.util.Calendar.SECOND) + now.get(java.util.Calendar.MILLISECOND) / 1000f
        val idx = min(98, (sf / 60f * 99f).toInt())

        val text = Paint(Paint.ANTI_ALIAS_FLAG)
        text.typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
        text.textSize = 6.3f
        NamesData.latin.forEachIndexed { i, name ->
            val a = (i + 0.5f) * 360f / 99f
            val flip = a > 180f
            val rot = if (flip) a + 90f else a - 90f
            val x = if (flip) -224f else 224f
            c.save()
            c.rotate(rot)
            if (i < idx) text.color = 0xFFA5A5A0.toInt() else text.color = 0xFF161616.toInt()
            text.textAlign = if (flip) Paint.Align.LEFT else Paint.Align.RIGHT
            c.drawText(name, x, 2.2f, text)
            c.restore()
        }

        val cur = NamesData.latin[idx]
        val a = (idx + 0.5f) * 360f / 99f
        val flip = a > 180f
        val rot = if (flip) a + 90f else a - 90f
        val x = if (flip) -224f else 224f
        c.save()
        c.rotate(rot)
        val hl = Paint(Paint.ANTI_ALIAS_FLAG)
        hl.typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
        hl.textSize = 6.3f
        hl.style = Paint.Style.STROKE
        hl.strokeWidth = 6f
        hl.color = 0xFFDDE59A.toInt()
        hl.strokeJoin = Paint.Join.ROUND
        hl.strokeCap = Paint.Cap.ROUND
        hl.textAlign = if (flip) Paint.Align.LEFT else Paint.Align.RIGHT
        c.drawText(cur, x, 2.2f, hl)
        hl.style = Paint.Style.FILL
        hl.color = 0xFF121212.toInt()
        c.drawText(cur, x, 2.2f, hl)
        c.restore()

        fill.color = 0xFFE8E8E4.toInt()
        c.drawCircle(0f, 0f, 66f, fill)
        stroke.color = 0xFFD4D4CF.toInt()
        stroke.strokeWidth = 1f
        c.drawCircle(0f, 0f, 66f, stroke)
        fill.color = 0xFFD3D3CD.toInt()
        fill.textAlign = Paint.Align.CENTER
        fill.textSize = 46f
        fill.typeface = Typeface.create(Typeface.SERIF, Typeface.NORMAL)
        c.drawText("الله", 0f, 16f, fill)

        val min = now.get(java.util.Calendar.MINUTE) + sf / 60f
        val hour = now.get(java.util.Calendar.HOUR) + now.get(java.util.Calendar.MINUTE) / 60f
        val hand = Paint(Paint.ANTI_ALIAS_FLAG)
        hand.color = 0xFF141414.toInt()
        hand.strokeCap = Paint.Cap.ROUND
        c.save()
        c.rotate(hour * 30f)
        hand.strokeWidth = 4f
        c.drawLine(0f, 8f, 0f, -34f, hand)
        c.restore()
        c.save()
        c.rotate(min * 6f)
        hand.strokeWidth = 2.8f
        c.drawLine(0f, 10f, 0f, -54f, hand)
        c.restore()
        fill.color = 0xFF141414.toInt()
        c.drawCircle(0f, 0f, 4f, fill)
        c.save()
        c.rotate(sf * 6f)
        stroke.color = 0xFF141414.toInt()
        stroke.strokeWidth = 1.2f
        fill.color = 0xFFFFFFFF.toInt()
        c.drawCircle(0f, -74f, 3.6f, fill)
        c.drawCircle(0f, -74f, 3.6f, stroke)
        hand.strokeWidth = 1.3f
        c.drawLine(0f, -77.6f, 0f, -186f, hand)
        val path = Path()
        path.moveTo(0f, -196f)
        path.lineTo(-3.4f, -184f)
        path.lineTo(3.4f, -184f)
        path.close()
        c.drawPath(path, fill.apply { color = 0xFF141414.toInt() })
        c.restore()
        return bmp
    }
}
