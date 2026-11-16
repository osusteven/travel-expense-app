package com.travelsplit.app.data

import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentReference
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.Source
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.QuerySnapshot
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.tasks.await
import java.math.BigDecimal

/**
 * All data lives in Cloud Firestore so both phones see the same trip:
 *
 *   trips/{tripId}                      name, people, base currency, members (device user IDs)
 *   trips/{tripId}/expenses/{expenseId} one document per expense or transfer
 *
 * Firestore keeps a local cache, so the app works offline: writes are applied locally right away
 * and synced when the phone is back online. For that reason writes are not awaited.
 */
class Repository(
    private val db: FirebaseFirestore,
    private val auth: FirebaseAuth,
    val rates: ExchangeRateService,
) {
    private val trips = db.collection("trips")
    private fun expenses(tripId: String) = trips.document(tripId).collection("expenses")

    /** Each install signs in anonymously once; the ID is remembered across app restarts. */
    suspend fun userId(): String =
        auth.currentUser?.uid ?: auth.signInAnonymously().await().user!!.uid

    // ---- Trips ----

    @OptIn(ExperimentalCoroutinesApi::class)
    fun observeTrips(): Flow<List<Trip>> = flow { emit(userId()) }.flatMapLatest { uid ->
        trips.whereArrayContains("members", uid).snapshotFlow()
            .map { snap -> snap.documents.mapNotNull(Trip::from).sortedByDescending { it.createdAt } }
    }

    fun observeTrip(id: String): Flow<Trip?> = trips.document(id).snapshotFlow().map(Trip::from)

    suspend fun getTrip(id: String): Trip? = Trip.from(trips.document(id).get().await())

    /** Creates a trip owned by this device and returns its ID. */
    suspend fun createTrip(trip: Trip): String {
        val uid = userId()
        val ref = trips.document()
        ref.set(trip.copy(members = listOf(uid)).toMap()).logFailure("create trip")
        return ref.id
    }

    fun updateTrip(trip: Trip) {
        trips.document(trip.id).update(
            mapOf(
                "name" to trip.name,
                "firstPerson" to trip.firstPerson,
                "secondPerson" to trip.secondPerson,
            )
        ).logFailure("update trip")
    }

    /** Deletes the trip and all its expenses, for both people. */
    suspend fun deleteTrip(trip: Trip) {
        val ref = trips.document(trip.id)
        val expenseDocs = runCatching { expenses(trip.id).get().await().documents }.getOrDefault(emptyList())
        // Firestore batches are limited to 500 writes.
        expenseDocs.chunked(450).forEach { chunk ->
            val batch = db.batch()
            chunk.forEach { batch.delete(it.reference) }
            batch.commit().logFailure("delete expenses")
        }
        ref.delete().logFailure("delete trip")
    }

    /**
     * Adds this device to a trip someone shared with you. Needs a connection.
     * @return the trip, or a failure with a user-readable message.
     */
    suspend fun joinTrip(code: String): Result<Trip> = runCatching {
        val id = code.trim()
        require(id.matches(Regex("[A-Za-z0-9]{10,40}"))) { "That doesn't look like a trip code" }
        val uid = userId()
        val ref = trips.document(id)
        val trip = Trip.from(ref.get(Source.SERVER).await()) ?: throw IllegalArgumentException("No trip found with that code")
        if (uid !in trip.members) ref.update("members", FieldValue.arrayUnion(uid)).await()
        trip
    }.recoverCatching { e ->
        throw if (e is IllegalArgumentException) e
        else IllegalStateException("Couldn't join the trip. Check your connection and try again.", e)
    }

    // ---- Expenses ----

    fun observeExpenses(tripId: String): Flow<List<Expense>> = expenses(tripId).snapshotFlow().map { snap ->
        snap.documents.mapNotNull { Expense.from(it, tripId) }
            .sortedWith(compareByDescending<Expense> { it.date }.thenByDescending { it.createdAt })
    }

    suspend fun getExpense(tripId: String, id: String): Expense? =
        Expense.from(expenses(tripId).document(id).get().await(), tripId)

    /** All expenses, newest first (served from the local cache when offline). */
    private suspend fun getExpenses(tripId: String): List<Expense> = runCatching {
        expenses(tripId).get().await().documents.mapNotNull { Expense.from(it, tripId) }
            .sortedByDescending { it.createdAt }
    }.getOrDefault(emptyList())

    fun saveExpense(e: Expense) {
        val col = expenses(e.tripId)
        val ref = if (e.id.isEmpty()) col.document() else col.document(e.id)
        ref.set(e.toMap()).logFailure("save expense")
    }

    fun deleteExpense(e: Expense) {
        expenses(e.tripId).document(e.id).delete().logFailure("delete expense")
    }

    /** The most recent rate used for [currency] in a trip, used to pre-fill new expenses. */
    suspend fun lastRate(tripId: String, currency: String): BigDecimal? =
        getExpenses(tripId).firstOrNull { it.currency == currency }?.rateToBase

    /** The currency of the most recently added expense, used as the default for the next one. */
    suspend fun lastCurrency(tripId: String): String? =
        getExpenses(tripId).firstOrNull { it.kind == com.travelsplit.core.EntryKind.EXPENSE }?.currency

    // ---- Helpers ----

    private fun com.google.android.gms.tasks.Task<*>.logFailure(what: String) {
        addOnFailureListener { Log.w("TravelSplit", "Failed to $what", it) }
    }

    private fun DocumentReference.snapshotFlow(): Flow<DocumentSnapshot> = callbackFlow {
        val reg = addSnapshotListener { snap, err ->
            if (err != null) close(err) else if (snap != null) trySend(snap)
        }
        awaitClose { reg.remove() }
    }

    private fun Query.snapshotFlow(): Flow<QuerySnapshot> = callbackFlow {
        val reg = addSnapshotListener { snap, err ->
            if (err != null) close(err) else if (snap != null) trySend(snap)
        }
        awaitClose { reg.remove() }
    }
}
