package online.digital26.asmaclock

import android.content.Context

object AsmaStore {
    private const val PREFS = "asma_js"
    const val KEY = "asma.v1"

    fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun read(ctx: Context): String = prefs(ctx).getString(KEY, "") ?: ""

    fun write(ctx: Context, json: String) {
        prefs(ctx).edit().putString(KEY, json).apply()
        IslandOverlayService.pushStore(ctx, json)
    }
}
