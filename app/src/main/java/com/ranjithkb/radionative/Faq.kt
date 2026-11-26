package com.ranjithkb.radionative

import android.content.Intent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.LinkAnnotation
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextLinkStyles
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.withLink
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONObject

/** One question of the FAQ in the app's language (English when a translation is missing). */
data class FaqItem(val id: String, val section: String, val q: String, val a: String)

object Faq {
    /** Reads radio-faq.json: items in order, each in en / ml / hi. Pure, so it can be tested. */
    fun parse(json: String, lang: String): List<FaqItem> = runCatching {
        val o = JSONObject(json); val secs = o.optJSONObject("sections")
        val a = o.getJSONArray("items")
        List(a.length()) { i -> val it = a.getJSONObject(i)
            val t = it.optJSONObject(lang) ?: it.getJSONObject("en")
            val sec = it.getString("section")
            FaqItem(it.getString("id"), secs?.optJSONObject(lang)?.optString(sec)?.ifBlank { null } ?: sec, t.getString("q"), t.getString("a")) }
    }.getOrDefault(emptyList())

    /** Questions whose question or answer has every word of the search. */
    fun search(items: List<FaqItem>, q: String): List<FaqItem> {
        val words = q.trim().lowercase().split(Regex("\\s+")).filter { it.isNotBlank() }
        if (words.isEmpty()) return items
        return items.filter { f -> val hay = (f.q + " " + f.a + " " + f.section).lowercase(); words.all { it in hay } }
    }

    fun link(id: String) = "https://ranjithkb.com/radio.html#faq-$id"
}

/** You → Help and FAQ: search box, questions by section, each opens in place and has its own link to share. */
@Composable
fun FaqScreen(close: () -> Unit) {
    val ctx = LocalContext.current
    var items by remember { mutableStateOf<List<FaqItem>?>(null) }
    LaunchedEffect(Lang.code) { items = Repo.faq(ctx)?.let { Faq.parse(it, Lang.code) } ?: emptyList() }
    var q by remember { mutableStateOf("") }
    var open by remember { mutableStateOf<String?>(null) }
    SubPage(t("Help and FAQ"), close) {
        OutlinedTextField(q, { q = it }, Modifier.fillMaxWidth().padding(top = 8.dp), singleLine = true,
            leadingIcon = { Icon(Icons.Outlined.Search, null) }, placeholder = { Text(t("Search the questions")) })
        InfoText(t("Radio Velvet is one person's hobby, made in spare time, so a reply can take a few days. Every message is read."))
        val all = items
        when {
            all == null -> InfoText(t("Loading…"))
            all.isEmpty() -> InfoText(t("Couldn't load the questions. Check the connection and try again."))
            else -> {
                val shown = Faq.search(all, q)
                if (shown.isEmpty()) InfoText(t("No question matches. Try another word, or write to hello@ranjithkb.com."))
                shown.groupBy { it.section }.forEach { (sec, list) ->
                    Group(sec.uppercase()) {
                        list.forEachIndexed { i, f ->
                            if (i > 0) RowLine()
                            val isOpen = open == f.id || q.isNotBlank() && shown.size <= 3
                            Column(Modifier.fillMaxWidth().clickable(onClickLabel = f.q) { open = if (open == f.id) null else f.id }
                                .padding(horizontal = 16.dp, vertical = 14.dp)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(f.q, Modifier.weight(1f), fontSize = 16.sp, fontWeight = FontWeight.Medium, color = Title, lineHeight = 21.sp)
                                    Text(if (isOpen) "–" else "+", fontSize = 20.sp, color = Soft, modifier = Modifier.padding(start = 10.dp))
                                }
                                AnimatedVisibility(isOpen) {
                                    Column(Modifier.padding(top = 8.dp)) {
                                        FaqAnswer(f.a)
                                        TextButton({ ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain")
                                            .putExtra(Intent.EXTRA_TEXT, f.q + "\n" + Faq.link(f.id)), t("Share"))) },
                                            Modifier.heightIn(min = 44.dp)) {
                                            Icon(Icons.Outlined.Link, null, tint = AccentText, modifier = Modifier.size(18.dp))
                                            Spacer(Modifier.width(6.dp)); Text(t("Share this answer"), color = AccentText)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/** An answer: plain text, [words](link) as tappable links, lines starting "1. " as numbered steps. */
@Composable
private fun FaqAnswer(a: String) {
    var n = 0
    a.split('\n').forEach { line ->
        val step = line.startsWith("1. ")
        val body = if (step) line.removePrefix("1. ") else line
        val text = buildAnnotatedString {
            if (step) { n++; append("$n.  ") }
            var rest = body
            val rx = Regex("\\[([^\\]]+)]\\((https?://[^)]+)\\)")
            while (true) {
                val m = rx.find(rest) ?: break
                append(rest.substring(0, m.range.first))
                withLink(LinkAnnotation.Url(m.groupValues[2], TextLinkStyles(SpanStyle(color = AccentText, textDecoration = TextDecoration.Underline)))) {
                    append(m.groupValues[1]) }
                rest = rest.substring(m.range.last + 1)
            }
            append(rest)
        }
        Text(text, fontSize = 15.sp, color = InkSoft, lineHeight = 22.sp, modifier = Modifier.padding(bottom = 6.dp, start = if (step) 4.dp else 0.dp))
    }
}
