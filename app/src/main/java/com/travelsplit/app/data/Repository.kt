package com.travelsplit.app.data

import kotlinx.coroutines.flow.Flow
import java.math.BigDecimal

/** Everything the UI needs from storage. The real app uses [FirestoreRepository]. */
interface Repository {
    fun observeTrips(): Flow<List<Trip>>
    fun observeTrip(id: String): Flow<Trip?>
    suspend fun getTrip(id: String): Trip?
    /** Creates a trip owned by this device and returns its ID. */
    suspend fun createTrip(trip: Trip): String
    fun updateTrip(trip: Trip)
    /** Deletes the trip and all its expenses, for both people. */
    suspend fun deleteTrip(trip: Trip)
    /** Adds this device to a trip someone shared; the failure message is user-readable. */
    suspend fun joinTrip(code: String): Result<Trip>

    fun observeExpenses(tripId: String): Flow<List<Expense>>
    suspend fun getExpense(tripId: String, id: String): Expense?
    fun saveExpense(e: Expense)
    fun deleteExpense(e: Expense)
    /** The most recent rate used for [currency] in a trip, used to pre-fill new expenses. */
    suspend fun lastRate(tripId: String, currency: String): BigDecimal?
    /** The currency of the most recently added expense, used as the default for the next one. */
    suspend fun lastCurrency(tripId: String): String?

    /** Latest exchange rate: units of [to] per one unit of [from]. */
    suspend fun fetchRate(from: String, to: String): Result<BigDecimal>
}
