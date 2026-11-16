package com.travelsplit.app.data

import com.google.firebase.firestore.DocumentSnapshot
import com.travelsplit.core.Entry
import com.travelsplit.core.EntryKind
import com.travelsplit.core.Participant
import com.travelsplit.core.SplitMode
import java.math.BigDecimal

data class Trip(
    /** Firestore document ID. Also the invite code shared with the other person. */
    val id: String = "",
    val name: String,
    val firstPerson: String,
    val secondPerson: String,
    /** All balances are shown in this currency. */
    val baseCurrency: String,
    val createdAt: Long = System.currentTimeMillis(),
    /** Firebase user IDs of the devices that can see this trip. */
    val members: List<String> = emptyList(),
) {
    fun nameOf(p: Participant) = if (p == Participant.FIRST) firstPerson else secondPerson

    fun toMap(): Map<String, Any> = mapOf(
        "name" to name,
        "firstPerson" to firstPerson,
        "secondPerson" to secondPerson,
        "baseCurrency" to baseCurrency,
        "createdAt" to createdAt,
        "members" to members,
    )

    companion object {
        fun from(doc: DocumentSnapshot): Trip? = runCatching {
            if (!doc.exists()) return null
            Trip(
                id = doc.id,
                name = doc.getString("name")!!,
                firstPerson = doc.getString("firstPerson")!!,
                secondPerson = doc.getString("secondPerson")!!,
                baseCurrency = doc.getString("baseCurrency")!!,
                createdAt = doc.getLong("createdAt") ?: 0L,
                members = (doc.get("members") as? List<*>)?.filterIsInstance<String>().orEmpty(),
            )
        }.getOrNull()
    }
}

data class Expense(
    /** Firestore document ID; empty for an expense that hasn't been saved yet. */
    val id: String = "",
    val tripId: String,
    val title: String,
    val amount: BigDecimal,
    val currency: String,
    /** Units of the trip's base currency per one unit of [currency], frozen at entry time. */
    val rateToBase: BigDecimal,
    val paidBy: Participant,
    val splitMode: SplitMode,
    /** For [SplitMode.CUSTOM]: the first person's share, in [currency]. */
    val customFirstShare: BigDecimal? = null,
    val kind: EntryKind = EntryKind.EXPENSE,
    /** Date of the expense, epoch millis (UTC midnight of the chosen day). */
    val date: Long,
    val createdAt: Long = System.currentTimeMillis(),
) {
    fun toEntry() = Entry(amount, currency, rateToBase, paidBy, splitMode, customFirstShare, kind)

    /** Money is stored as exact decimal strings so no precision is lost. */
    fun toMap(): Map<String, Any?> = mapOf(
        "title" to title,
        "amount" to amount.toPlainString(),
        "currency" to currency,
        "rateToBase" to rateToBase.toPlainString(),
        "paidBy" to paidBy.name,
        "splitMode" to splitMode.name,
        "customFirstShare" to customFirstShare?.toPlainString(),
        "kind" to kind.name,
        "date" to date,
        "createdAt" to createdAt,
    )

    companion object {
        fun from(doc: DocumentSnapshot, tripId: String): Expense? = runCatching {
            if (!doc.exists()) return null
            Expense(
                id = doc.id,
                tripId = tripId,
                title = doc.getString("title").orEmpty(),
                amount = BigDecimal(doc.getString("amount")!!),
                currency = doc.getString("currency")!!,
                rateToBase = BigDecimal(doc.getString("rateToBase")!!),
                paidBy = Participant.valueOf(doc.getString("paidBy")!!),
                splitMode = SplitMode.valueOf(doc.getString("splitMode")!!),
                customFirstShare = doc.getString("customFirstShare")?.let(::BigDecimal),
                kind = EntryKind.valueOf(doc.getString("kind") ?: EntryKind.EXPENSE.name),
                date = doc.getLong("date") ?: 0L,
                createdAt = doc.getLong("createdAt") ?: 0L,
            )
        }.getOrNull()
    }
}
