package com.enigmaticphantasm.naturaltts.util

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import java.util.concurrent.TimeUnit
import java.util.regex.Pattern

object UrlTextExtractor {
    private val URL_PATTERN = Pattern.compile(
        """^https?://\S+$""",
        Pattern.CASE_INSENSITIVE
    )

    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    fun looksLikeUrl(input: String): Boolean {
        val t = input.trim()
        if (t.contains('\n') || t.contains(' ')) return false
        return URL_PATTERN.matcher(t).matches()
    }

    suspend fun fetchReadableText(url: String): String = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url(url.trim())
            .header("User-Agent", "NaturalReader/1.0 (Android; on-device TTS)")
            .get()
            .build()
        client.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) {
                throw IllegalStateException("Failed to fetch URL (HTTP ${resp.code})")
            }
            val html = resp.body?.string().orEmpty()
            extractFromHtml(html, url)
        }
    }

    fun extractFromHtml(html: String, baseUri: String = ""): String {
        val doc: Document = Jsoup.parse(html, baseUri)
        doc.select("script, style, noscript, nav, footer, header, aside, iframe, svg, form").remove()
        // Prefer article / main content
        val article = doc.selectFirst("article")
            ?: doc.selectFirst("main")
            ?: doc.selectFirst("[role=main]")
            ?: doc.body()
        val text = article?.text()?.trim().orEmpty()
        return text.replace(Regex("""\n{3,}"""), "\n\n")
    }
}
