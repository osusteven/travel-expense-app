package com.travelsplit.app.data

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import com.travelsplit.core.Entry
import com.travelsplit.core.EntryKind
import com.travelsplit.core.Participant
import com.travelsplit.core.SplitMode
import java.math.BigDecimal

@Entity(tableName = "trips")
data class Trip(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
    val firstPerson: String,
    val secondPerson: String,
    /** All balances are shown in this currency. */
    val baseCurrency: String,
    val createdAt: Long = System.currentTimeMillis(),
) {
    fun nameOf(p: Participant) = if (p == Participant.FIRST) firstPerson else secondPerson
}

@Entity(
    tableName = "expenses",
    foreignKeys = [ForeignKey(
        entity = Trip::class,
        parentColumns = ["id"],
        childColumns = ["tripId"],
        onDelete = ForeignKey.CASCADE,
    )],
    indices = [Index("tripId")],
)
data class Expense(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val tripId: Long,
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
}
