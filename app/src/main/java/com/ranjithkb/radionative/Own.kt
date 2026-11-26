package com.ranjithkb.radionative

import android.content.Context
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL

/** Collection id of stations you add yourself. */
const val MINE = "mine"

/**
 * Your own stations (tester's idea, 24 Nov 2026): a name and a stream link, kept privately on this phone.
 * They're added to Favourites with a "Yours" mark and play like any station, in the car too.
 * They are never sent to the account or the website.
 */
object OwnStations {
    private fun p(ctx: Context) = ctx.getSharedPreferences("own", Context.MODE_PRIVATE)

    fun list(ctx: Context): List<Station> = runCatching {
        val a = JSONArray(p(ctx).getString("list", "[]")); List(a.length()) { Station.fromJson(a.getJSONObject(it), MINE) }
    }.getOrDefault(emptyList())

    private fun save(ctx: Context, l: List<Station>) = p(ctx).edit().putString("list", JSONArray(l.map { it.toJson() }).toString()).apply()

    fun add(ctx: Context, name: String, link: String): Station {
        val s = Station("u" + System.currentTimeMillis().toString(36), name.trim(), "", listOf(link.trim()), MINE)
        save(ctx, list(ctx) + s); return s
    }

    fun remove(ctx: Context, id: String) = save(ctx, list(ctx).filter { it.id != id })

    /** Checks a link looks like a stream: "ok", "maybe" (reachable but not clearly audio) or "no". */
    suspend fun check(link: String): String = withContext(Dispatchers.IO) {
        try {
            val c = URL(link.trim()).openConnection() as HttpURLConnection
            c.connectTimeout = 7000; c.readTimeout = 7000; c.instanceFollowRedirects = true
            c.setRequestProperty("Icy-MetaData", "1"); c.setRequestProperty("User-Agent", "RadioVelvet")
            val code = c.responseCode; val type = (c.contentType ?: "").lowercase()
            c.disconnect()
            when {
                code !in 200..399 -> "no"
                listOf("audio", "mpegurl", "ogg", "aac", "scpls", "octet-stream").any { it in type } -> "ok"
                else -> "maybe"
            }
        } catch (e: Exception) { "no" }
    }

    /** True for a link that could be a stream (http or https web address). */
    fun looksLikeLink(s: String) = Regex("^https?://[^\\s/]+\\.[^\\s]+$", RegexOption.IGNORE_CASE).matches(s.trim())
}

/** Settings → Favourites → Your own stations, and Favourites → + Add your own station. */
@Composable
fun OwnStationsScreen(close: () -> Unit, changed: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var list by remember { mutableStateOf(OwnStations.list(ctx)) }
    var name by remember { mutableStateOf("") }
    var link by remember { mutableStateOf("") }
    var suggest by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var msg by remember { mutableStateOf<String?>(null) }
    var askSave by remember { mutableStateOf(false) }
    val favs = remember { Favs(ctx) }

    fun save() {
        val s = OwnStations.add(ctx, name.ifBlank { link.substringAfter("://").substringBefore('/') }, link)
        favs.insert(s, 0)
        if (suggest) scope.launch { runCatching { Requests.send(ctx, s.name, "", link, "Added as their own station") } }
        list = OwnStations.list(ctx); name = ""; link = ""; suggest = false
        msg = t("Added to your favourites."); changed()
    }

    SubPage(t("Your own stations"), close) {
        InfoText(t("Add a station that isn't in the lists: its name and its stream link. It stays private on this phone and shows in Favourites marked Yours."))
        Group(modifier = Modifier.padding(top = 16.dp)) {
            Column(Modifier.padding(16.dp)) {
                OutlinedTextField(name, { name = it }, Modifier.fillMaxWidth(), label = { Text(t("Name")) }, singleLine = true)
                Spacer(Modifier.height(10.dp))
                OutlinedTextField(link, { link = it.trim(); msg = null }, Modifier.fillMaxWidth(), label = { Text(t("Stream link")) },
                    placeholder = { Text("https://…") }, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                    isError = link.isNotBlank() && !OwnStations.looksLikeLink(link))
            }
            RowLine()
            ToggleItem(t("Also suggest it for everyone"), suggest, sub = t("Ranjith may add it to the lists")) { suggest = it }
        }
        msg?.let { InfoText(it) }
        ActionButton(if (busy) t("Checking…") else t("Check and add"), Icons.Outlined.Add, Modifier.padding(top = 18.dp),
            enabled = !busy && OwnStations.looksLikeLink(link)) {
            busy = true
            scope.launch {
                when (OwnStations.check(link)) {
                    "ok" -> save()
                    else -> askSave = true
                }
                busy = false
            }
        }
        if (askSave) AlertDialog(onDismissRequest = { askSave = false },
            title = { Text(t("Couldn't check this link")) },
            text = { Text(t("It didn't answer like a radio stream from here. Some streams only play inside the app. Add it anyway?")) },
            confirmButton = { TextButton({ askSave = false; save() }) { Text(t("Add anyway")) } },
            dismissButton = { TextButton({ askSave = false }) { Text(t("Cancel")) } })

        if (list.isNotEmpty()) {
            Group(t("YOURS")) {
                list.forEachIndexed { i, s ->
                    if (i > 0) RowLine()
                    Row(Modifier.fillMaxWidth().padding(start = 16.dp, top = 6.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(s.name, fontSize = 16.sp, color = Title)
                            Text(s.streams.firstOrNull().orEmpty(), fontSize = 13.sp, color = Soft, maxLines = 1,
                                overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
                        }
                        IconButton({ OwnStations.remove(ctx, s.id); favs.remove(s.key); list = OwnStations.list(ctx); changed() },
                            Modifier.size(48.dp)) { Icon(Icons.Outlined.Delete, t("Remove") + " " + s.name, tint = InkSoft) }
                    }
                }
            }
        }
    }
}
