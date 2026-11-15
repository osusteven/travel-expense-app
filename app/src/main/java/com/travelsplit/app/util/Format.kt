package com.travelsplit.app.util

import com.travelsplit.core.Money
import java.math.BigDecimal
import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Currency
import java.util.Locale

object Format {
    fun money(amount: BigDecimal, currencyCode: String): String {
        val nf = NumberFormat.getCurrencyInstance(Locale.getDefault())
        runCatching { nf.currency = Currency.getInstance(currencyCode) }
        val digits = Money.fractionDigits(currencyCode)
        nf.minimumFractionDigits = digits
        nf.maximumFractionDigits = digits
        return nf.format(amount)
    }

    /** Plain number for editing fields, e.g. "12.5". */
    fun plain(amount: BigDecimal): String = amount.stripTrailingZeros().toPlainString()

    fun rate(rate: BigDecimal): String {
        val nf = NumberFormat.getNumberInstance(Locale.getDefault())
        nf.maximumFractionDigits = 6
        nf.minimumFractionDigits = 2
        return nf.format(rate)
    }

    private val dateFormatter = DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)

    /** Dates are stored as UTC midnight of the chosen day (matches the Material date picker). */
    fun date(epochMillis: Long): String = localDate(epochMillis).format(dateFormatter)

    fun localDate(epochMillis: Long): LocalDate = Instant.ofEpochMilli(epochMillis).atZone(ZoneOffset.UTC).toLocalDate()

    fun todayUtcMillis(): Long = LocalDate.now().atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
}

object Currencies {
    private val popular = listOf(
        "EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "NZD", "SEK", "NOK", "DKK", "PLN", "CZK",
        "HUF", "TRY", "MXN", "BRL", "THB", "IDR", "VND", "SGD", "HKD", "CNY", "KRW", "INR", "ZAR", "MAD", "AED",
    )

    /** Popular currencies first, then every other ISO currency alphabetically. */
    val all: List<Currency> by lazy {
        val available = Currency.getAvailableCurrencies().associateBy { it.currencyCode }
        val top = popular.mapNotNull { available[it] }
        val rest = available.values.filter { it.currencyCode !in popular }.sortedBy { it.currencyCode }
        top + rest
    }

    fun label(code: String): String {
        val c = runCatching { Currency.getInstance(code) }.getOrNull() ?: return code
        return "$code – ${c.getDisplayName(Locale.getDefault())}"
    }

    fun defaultForLocale(): String =
        runCatching { Currency.getInstance(Locale.getDefault()).currencyCode }.getOrDefault("EUR")
}
