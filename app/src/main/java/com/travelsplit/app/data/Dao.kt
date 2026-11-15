package com.travelsplit.app.data

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface TripDao {
    @Query("SELECT * FROM trips ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<Trip>>

    @Query("SELECT * FROM trips WHERE id = :id")
    fun observe(id: Long): Flow<Trip?>

    @Query("SELECT * FROM trips WHERE id = :id")
    suspend fun get(id: Long): Trip?

    @Insert suspend fun insert(trip: Trip): Long
    @Update suspend fun update(trip: Trip)
    @Delete suspend fun delete(trip: Trip)
}

@Dao
interface ExpenseDao {
    @Query("SELECT * FROM expenses WHERE tripId = :tripId ORDER BY date DESC, createdAt DESC")
    fun observeForTrip(tripId: Long): Flow<List<Expense>>

    @Query("SELECT * FROM expenses WHERE id = :id")
    suspend fun get(id: Long): Expense?

    /** The most recent rate used for [currency] in a trip, used to pre-fill new expenses. */
    @Query("SELECT rateToBase FROM expenses WHERE tripId = :tripId AND currency = :currency ORDER BY createdAt DESC LIMIT 1")
    suspend fun lastRate(tripId: Long, currency: String): String?

    /** The currency of the most recently added expense, used as the default for the next one. */
    @Query("SELECT currency FROM expenses WHERE tripId = :tripId AND kind = 'EXPENSE' ORDER BY createdAt DESC LIMIT 1")
    suspend fun lastCurrency(tripId: Long): String?

    @Insert suspend fun insert(expense: Expense): Long
    @Update suspend fun update(expense: Expense)
    @Delete suspend fun delete(expense: Expense)
}
