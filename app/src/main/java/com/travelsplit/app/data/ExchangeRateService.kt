package com.travelsplit.app.data

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.math.BigDecimal
import java.net.HttpURLConnection
import java.net.URL

/**
 * Fetches the latest reference rate from the free Frankfurter API (European Central Bank data, no API key).
 * It covers ~30 major currencies; for anything else the user enters the rate manually.
 */
class ExchangeRateService {
    /** Returns how many units of [to] one unit of [from] is worth. */
    suspend fun fetchRate(from: String, to: String): Result<BigDecimal> = withContext(Dispatchers.IO) {
        runCatching {
            if (from == to) return@runCatching BigDecimal.ONE
            val url = URL("https://api.frankfurter.app/latest?from=$from&to=$to")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                connectTimeout = 10_000
                readTimeout = 10_000
            }
            try {
                val code = conn.responseCode
                if (code != 200) error("Rate not available for $from → $to")
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                BigDecimal(JSONObject(body).getJSONObject("rates").get(to).toString())
            } finally {
                conn.disconnect()
            }
        }
    }
}
