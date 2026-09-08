package com.enigmaticphantasm.naturaltts.util

/**
 * Splits long text into TTS-friendly chunks at sentence boundaries when possible.
 */
object TextChunker {
    private val SENTENCE_END = Regex("""(?<=[.!?…])\s+""")

    fun chunk(text: String, maxChars: Int = 400): List<String> {
        val cleaned = text.replace("\r\n", "\n").trim()
        if (cleaned.isEmpty()) return emptyList()
        if (cleaned.length <= maxChars) return listOf(cleaned)

        val sentences = cleaned.split(SENTENCE_END).map { it.trim() }.filter { it.isNotEmpty() }
        val chunks = mutableListOf<String>()
        val current = StringBuilder()

        fun flush() {
            if (current.isNotEmpty()) {
                chunks += current.toString().trim()
                current.clear()
            }
        }

        for (sentence in sentences) {
            if (sentence.length > maxChars) {
                flush()
                // Hard-split oversized sentence on whitespace
                var i = 0
                while (i < sentence.length) {
                    val end = minOf(i + maxChars, sentence.length)
                    var cut = end
                    if (end < sentence.length) {
                        val space = sentence.lastIndexOf(' ', end - 1)
                        if (space > i + maxChars / 2) cut = space
                    }
                    chunks += sentence.substring(i, cut).trim()
                    i = cut
                    while (i < sentence.length && sentence[i].isWhitespace()) i++
                }
            } else if (current.length + sentence.length + 1 > maxChars) {
                flush()
                current.append(sentence)
            } else {
                if (current.isNotEmpty()) current.append(' ')
                current.append(sentence)
            }
        }
        flush()
        return chunks
    }
}
