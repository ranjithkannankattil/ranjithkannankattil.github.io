package com.ranjithkb.radionative

/** When to show Google Play's "rate us" sheet: once, after a few days and a few hours of happy listening. */
object ReviewRule {
    const val MIN_DAYS = 2
    const val MIN_LISTEN_MS = 2 * 3_600_000L
    fun ready(installedAt: Long, now: Long, listenedMs: Long, askedAt: Long, crashedRecently: Boolean): Boolean =
        askedAt == 0L && !crashedRecently && listenedMs >= MIN_LISTEN_MS && now - installedAt >= MIN_DAYS * 86_400_000L
}
