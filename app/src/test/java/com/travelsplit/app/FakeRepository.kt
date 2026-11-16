package com.travelsplit.app

import com.travelsplit.app.data.Expense
import com.travelsplit.app.data.Repository
import com.travelsplit.app.data.Trip
import com.travelsplit.core.EntryKind
import com.travelsplit.core.Participant.FIRST
import com.travelsplit.core.Participant.SECOND
import com.travelsplit.core.SplitMode
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import java.math.BigDecimal
import java.time.LocalDate
import java.time.ZoneOffset

/** In-memory repository with a realistic sample trip, used for screenshots. */
class FakeRepository : Repository {
    private val trips = MutableStateFlow(
        listOf(
            Trip("japan", "Japan & Korea", "Alex", "Sam", "USD", createdAt = 2, members = listOf("a", "b")),
            Trip("lisbon", "Lisbon weekend", "Alex", "Sam", "EUR", createdAt = 1, members = listOf("a")),
        )
    )
    private val expenses = MutableStateFlow(sampleExpenses())

    override fun observeTrips(): Flow<List<Trip>> = trips.map { it.sortedByDescending(Trip::createdAt) }
    override fun observeTrip(id: String) = trips.map { list -> list.find { it.id == id } }
    override suspend fun getTrip(id: String) = trips.value.find { it.id == id }
    override suspend fun createTrip(trip: Trip): String {
        val id = "trip${trips.value.size}"
        trips.value += trip.copy(id = id, members = listOf("a"))
        return id
    }
    override fun updateTrip(trip: Trip) { trips.value = trips.value.map { if (it.id == trip.id) trip else it } }
    override suspend fun deleteTrip(trip: Trip) { trips.value = trips.value.filter { it.id != trip.id } }
    override suspend fun joinTrip(code: String) = Result.failure<Trip>(IllegalArgumentException("No trip found with that code"))

    override fun observeExpenses(tripId: String) = expenses.map { list ->
        list.filter { it.tripId == tripId }
            .sortedWith(compareByDescending<Expense> { it.date }.thenByDescending { it.createdAt })
    }
    override suspend fun getExpense(tripId: String, id: String) = expenses.value.find { it.id == id }
    override fun saveExpense(e: Expense) {
        expenses.value = expenses.value.filter { it.id != e.id } + e.copy(id = e.id.ifEmpty { "e${expenses.value.size}" })
    }
    override fun deleteExpense(e: Expense) { expenses.value = expenses.value.filter { it.id != e.id } }
    override suspend fun lastRate(tripId: String, currency: String) =
        expenses.value.filter { it.tripId == tripId && it.currency == currency }.maxByOrNull { it.createdAt }?.rateToBase
    override suspend fun lastCurrency(tripId: String) =
        expenses.value.filter { it.tripId == tripId && it.kind == EntryKind.EXPENSE }.maxByOrNull { it.createdAt }?.currency
    override suspend fun fetchRate(from: String, to: String) = Result.success(BigDecimal("0.0067"))

    private fun sampleExpenses(): List<Expense> {
        var n = 0
        fun day(d: Int) = LocalDate.of(2026, 10, d).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
        fun e(
            day: Int, title: String, amount: String, cur: String, rate: String,
            paidBy: com.travelsplit.core.Participant, split: SplitMode,
            custom: String? = null, kind: EntryKind = EntryKind.EXPENSE,
        ) = Expense(
            id = "x${n++}", tripId = "japan", title = title, amount = BigDecimal(amount), currency = cur,
            rateToBase = BigDecimal(rate), paidBy = paidBy, splitMode = split,
            customFirstShare = custom?.let(::BigDecimal), kind = kind, date = day(day), createdAt = n.toLong(),
        )
        val jpy = "0.0067"
        val krw = "0.00073"
        return listOf(
            e(3, "Flights to Tokyo", "1240", "USD", "1", FIRST, SplitMode.EQUAL),
            e(4, "Hotel Shinjuku (3 nights)", "84000", "JPY", jpy, SECOND, SplitMode.EQUAL),
            e(4, "Ramen dinner", "3400", "JPY", jpy, FIRST, SplitMode.EQUAL),
            e(5, "Suica card top-up", "5000", "JPY", jpy, SECOND, SplitMode.PAYER_ONLY),
            e(5, "Kimono rental", "12000", "JPY", jpy, FIRST, SplitMode.CUSTOM, custom = "4000"),
            e(6, "Cash for taxis", "10000", "JPY", jpy, SECOND, SplitMode.OTHER_ONLY, kind = EntryKind.TRANSFER),
            e(7, "Seoul Airbnb", "450000", "KRW", krw, FIRST, SplitMode.EQUAL),
            e(8, "Korean BBQ", "68000", "KRW", krw, SECOND, SplitMode.EQUAL),
            e(8, "SIM card for Sam", "33000", "KRW", krw, FIRST, SplitMode.OTHER_ONLY),
        )
    }
}

class ScreenshotApp : TravelSplitApp() {
    override fun createRepository(): Repository = FakeRepository()
}
