package com.travelsplit.app.data

import java.math.BigDecimal

class Repository(db: AppDatabase, val rates: ExchangeRateService) {
    private val trips = db.tripDao()
    private val expenses = db.expenseDao()

    fun observeTrips() = trips.observeAll()
    fun observeTrip(id: Long) = trips.observe(id)
    suspend fun getTrip(id: Long) = trips.get(id)
    suspend fun saveTrip(trip: Trip): Long =
        if (trip.id == 0L) trips.insert(trip) else trip.id.also { trips.update(trip) }
    suspend fun deleteTrip(trip: Trip) = trips.delete(trip)

    fun observeExpenses(tripId: Long) = expenses.observeForTrip(tripId)
    suspend fun getExpense(id: Long) = expenses.get(id)
    suspend fun saveExpense(e: Expense) {
        if (e.id == 0L) expenses.insert(e) else expenses.update(e)
    }
    suspend fun deleteExpense(e: Expense) = expenses.delete(e)
    suspend fun lastRate(tripId: Long, currency: String): BigDecimal? =
        expenses.lastRate(tripId, currency)?.toBigDecimalOrNull()
    suspend fun lastCurrency(tripId: Long): String? = expenses.lastCurrency(tripId)
}
