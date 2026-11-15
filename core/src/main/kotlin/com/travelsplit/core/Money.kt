package com.travelsplit.core

import java.math.BigDecimal
import java.math.RoundingMode
import java.util.Currency

object Money {
    /** Number of decimal places used by [currencyCode] (e.g. 2 for EUR, 0 for JPY). */
    fun fractionDigits(currencyCode: String): Int =
        runCatching { Currency.getInstance(currencyCode).defaultFractionDigits }
            .getOrDefault(2)
            .let { if (it < 0) 2 else it }

    fun round(value: BigDecimal, currencyCode: String): BigDecimal =
        value.setScale(fractionDigits(currencyCode), RoundingMode.HALF_UP)

    /** Parses user input such as "12.50", "12,50" or "1 234.5". Returns null when not a valid number. */
    fun parse(input: String): BigDecimal? {
        val cleaned = input.trim().replace(" ", "").replace(" ", "").replace(',', '.')
        if (cleaned.isEmpty()) return null
        // If several dots remain (e.g. "1.234.56"), treat all but the last as thousands separators.
        val normalized = if (cleaned.count { it == '.' } > 1) {
            val last = cleaned.lastIndexOf('.')
            cleaned.substring(0, last).replace(".", "") + cleaned.substring(last)
        } else cleaned
        return normalized.toBigDecimalOrNull()
    }
}
