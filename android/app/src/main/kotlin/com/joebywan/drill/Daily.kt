package com.joebywan.drill

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.BitmapFactory
import android.graphics.Color
import android.util.Log
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONObject
import java.io.File
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.util.concurrent.TimeUnit

/**
 * The widget and the once-a-day note. The page's summary (src/widget.js `summary()`) carries a
 * schedule of looks, each with the time it starts; this side shows the one in force, and wakes at
 * the next one with an inexact alarm (exact alarms are reserved for alarm-clock apps). A 15-minute
 * WorkManager job is the safety net, and Ticker re-arms everything after a reboot or an update.
 */
object Daily {
    const val SUMMARY = "summary"
    const val REMIND_ON = "remindOn"
    private const val REMINDED_ON = "remindedOn"
    private const val CHANNEL = "daily"
    private const val TAG = "DrillDaily"
    val POSES = setOf("teach", "sleepy", "complete")

    fun prefs(ctx: Context): SharedPreferences = ctx.getSharedPreferences("drill", Context.MODE_PRIVATE)

    private fun summary(ctx: Context): JSONObject? =
        prefs(ctx).getString(SUMMARY, null)?.let { runCatching { JSONObject(it) }.getOrNull() }

    /** The look in force now: the last one whose start has passed (the first if the clock went back). */
    private fun lookNow(s: JSONObject, now: Long = System.currentTimeMillis()): JSONObject {
        val looks = s.getJSONArray("looks")
        var pick = looks.getJSONObject(0)
        for (i in 0 until looks.length()) looks.getJSONObject(i).let { if (it.getLong("at") <= now) pick = it }
        return pick
    }

    /** One line of a pool, steady for the look's lifetime rather than changing on every redraw. */
    private fun lineOf(pool: org.json.JSONArray, seed: Long) = pool.getString(Math.floorMod(seed / 3_600_000, pool.length().toLong()).toInt())

    /** Redraw every widget, re-arm the alarms and make sure the safety-net job is queued. */
    fun refresh(ctx: Context) {
        render(ctx)
        arm(ctx)
        WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
            "widget", ExistingPeriodicWorkPolicy.KEEP, PeriodicWorkRequestBuilder<Refresh>(15, TimeUnit.MINUTES).build()
        )
    }

    fun render(ctx: Context) {
        val manager = AppWidgetManager.getInstance(ctx)
        val ids = manager.getAppWidgetIds(ComponentName(ctx, Widget::class.java))
        if (ids.isEmpty()) return
        val s = summary(ctx) ?: return // never opened: the layout's own placeholder stands
        val look = lookNow(s)
        val ink = Color.parseColor(look.getString("ink"))
        val views = RemoteViews(ctx.packageName, R.layout.widget).apply {
            setInt(R.id.bg, "setColorFilter", Color.parseColor(look.getString("bg")))
            setInt(R.id.flame, "setColorFilter", Color.parseColor(look.getString("flame")))
            setTextViewText(R.id.streak, look.getInt("streak").toString())
            setTextColor(R.id.streak, ink)
            setTextViewText(R.id.line, lineOf(look.getJSONArray("lines"), look.getLong("at")))
            setTextColor(R.id.line, ink)
            File(ctx.filesDir, "lumi-${look.getString("pose")}.png").takeIf { it.exists() }
                ?.let { BitmapFactory.decodeFile(it.path) }?.let { setImageViewBitmap(R.id.lumi, it) }
            setOnClickPendingIntent(R.id.root, openApp(ctx))
        }
        manager.updateAppWidget(ids, views)
        Log.i(TAG, "widget: ${look.getString("light")} ${look.getInt("streak")} ${look.getString("pose")}")
    }

    private fun openApp(ctx: Context) = PendingIntent.getActivity(
        ctx, 0, Intent(ctx, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    private fun tick(ctx: Context, action: String) = PendingIntent.getBroadcast(
        ctx, action.hashCode(), Intent(ctx, Ticker::class.java).setAction(action),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
    )

    /** Inexact alarms only: one at the widget's next change, one at the note's hour if it is on. */
    private fun arm(ctx: Context) {
        val alarms = ctx.getSystemService(AlarmManager::class.java)
        val s = summary(ctx) ?: return
        val now = System.currentTimeMillis()
        val looks = s.getJSONArray("looks")
        (0 until looks.length()).map { looks.getJSONObject(it).getLong("at") }.firstOrNull { it > now }
            ?.let { alarms.set(AlarmManager.RTC, it, tick(ctx, Ticker.TICK)) }
        val note = tick(ctx, Ticker.REMIND)
        if (!prefs(ctx).getBoolean(REMIND_ON, false)) return alarms.cancel(note)
        var at = LocalDate.now().atTime(s.optInt("remindAt", 18), 0)
        if (!at.isAfter(LocalDateTime.now())) at = at.plusDays(1)
        alarms.set(AlarmManager.RTC_WAKEUP, at.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli(), note)
    }

    /**
     * The note checks before it speaks: nothing if it is off, if anything was done today, or if it
     * already spoke today. One quiet line, low importance (no sound, no pop-up), never repeated.
     * `force` (debug builds, from adb) skips only the once-a-day guard, for testing.
     */
    fun remind(ctx: Context, force: Boolean) {
        val p = prefs(ctx)
        val today = LocalDate.now().toString()
        val s = summary(ctx)
        val why = when {
            !p.getBoolean(REMIND_ON, false) -> "off"
            s == null -> "app never opened"
            s.optString("doneOn") == today -> "today is done"
            p.getString(REMINDED_ON, null) == today && !force -> "already sent today"
            !NotificationManagerCompat.from(ctx).areNotificationsEnabled() -> "notifications blocked"
            else -> null
        }
        if (why != null) {
            Log.i(TAG, "note: none ($why)")
            return
        }
        val manager = ctx.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL, ctx.getString(R.string.channel_name), NotificationManager.IMPORTANCE_LOW))
        val text = lineOf(s!!.getJSONArray("remind"), System.currentTimeMillis() / 86_400_000 * 3_600_000)
        val note = NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.flame)
            .setContentTitle(ctx.getString(R.string.app_name))
            .setContentText(text)
            .setContentIntent(openApp(ctx))
            .setAutoCancel(true)
            .build()
        try {
            NotificationManagerCompat.from(ctx).notify(1, note)
        } catch (e: SecurityException) { // permission withdrawn between the check and here
            Log.w(TAG, "note: $e")
            return
        }
        p.edit().putString(REMINDED_ON, today).apply()
        Log.i(TAG, "note: posted \"$text\"")
    }
}

class Widget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, manager: AppWidgetManager, ids: IntArray) = Daily.refresh(ctx)
}

/** Boundary and note alarms, plus re-arming after BOOT_COMPLETED and MY_PACKAGE_REPLACED. */
class Ticker : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        when (intent.action) {
            REMIND -> Daily.remind(ctx, BuildConfig.DEBUG && intent.getBooleanExtra("force", false))
            TICK, Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED -> {}
            else -> return
        }
        Daily.refresh(ctx)
    }

    companion object {
        const val TICK = "com.joebywan.drill.TICK"
        const val REMIND = "com.joebywan.drill.REMIND"
    }
}

class Refresh(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
    override fun doWork(): Result {
        Daily.render(applicationContext)
        return Result.success()
    }
}
