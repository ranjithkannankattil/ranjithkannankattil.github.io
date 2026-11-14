package com.ranjithkb.radionative

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import com.google.android.play.core.review.ReviewManagerFactory

/** Google Play's own in-app review sheet (Play version only). Google decides whether it actually appears. */
object Review {
    fun maybeAsk(ctx: Context) {
        val p = ctx.getSharedPreferences("review", Context.MODE_PRIVATE)
        val first = p.getLong("first", 0).let { if (it == 0L) System.currentTimeMillis().also { t -> p.edit().putLong("first", t).apply() } else it }
        val crashed = ctx.getSharedPreferences("crash", Context.MODE_PRIVATE).contains("error")
        if (!ReviewRule.ready(first, System.currentTimeMillis(), Listen.local(ctx).total, p.getLong("asked", 0), crashed)) return
        var c: Context = ctx
        while (c is ContextWrapper && c !is Activity) c = c.baseContext
        val act = c as? Activity ?: return
        try {
            val m = ReviewManagerFactory.create(act)
            m.requestReviewFlow().addOnCompleteListener { r ->
                if (r.isSuccessful) { p.edit().putLong("asked", System.currentTimeMillis()).apply(); m.launchReviewFlow(act, r.result) }
            }
        } catch (e: Exception) { }
    }
}
