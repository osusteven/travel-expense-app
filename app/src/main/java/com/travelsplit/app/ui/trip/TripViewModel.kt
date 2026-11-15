package com.travelsplit.app.ui.trip

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.travelsplit.app.data.Expense
import com.travelsplit.app.data.Repository
import com.travelsplit.app.data.Trip
import com.travelsplit.app.util.Format
import com.travelsplit.core.BalanceCalculator
import com.travelsplit.core.EntryKind
import com.travelsplit.core.Participant
import com.travelsplit.core.SplitMode
import com.travelsplit.core.TripSummary
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.math.BigDecimal

data class TripUiState(
    val trip: Trip,
    val expenses: List<Expense>,
    val summary: TripSummary,
    /** Total spent per original currency (expenses only). */
    val spentByCurrency: Map<String, BigDecimal>,
)

class TripViewModel(private val repo: Repository, handle: SavedStateHandle) : ViewModel() {
    private val tripId: Long = checkNotNull(handle["tripId"])

    /** null while loading, or after the trip was deleted. */
    val state: StateFlow<TripUiState?> = combine(repo.observeTrip(tripId), repo.observeExpenses(tripId)) { trip, expenses ->
        trip?.let {
            val summary = BalanceCalculator.summarize(expenses.map { e -> e.toEntry() }, it.baseCurrency)
            val byCurrency = expenses.filter { e -> e.kind == EntryKind.EXPENSE }
                .groupBy { e -> e.currency }
                .mapValues { (_, list) -> list.fold(BigDecimal.ZERO) { acc, e -> acc + e.amount } }
            TripUiState(it, expenses, summary, byCurrency)
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun deleteTrip(onDeleted: () -> Unit) {
        val trip = state.value?.trip ?: return
        viewModelScope.launch {
            repo.deleteTrip(trip)
            onDeleted()
        }
    }

    /** Records a transfer that brings the balance back to zero. */
    fun settleUp() {
        val s = state.value ?: return
        val settlement = s.summary.settlement ?: return
        viewModelScope.launch {
            repo.saveExpense(
                Expense(
                    tripId = s.trip.id,
                    title = "Settle up",
                    amount = settlement.amount,
                    currency = s.trip.baseCurrency,
                    rateToBase = BigDecimal.ONE,
                    paidBy = settlement.from,
                    splitMode = SplitMode.OTHER_ONLY,
                    kind = EntryKind.TRANSFER,
                    date = Format.todayUtcMillis(),
                )
            )
        }
    }

    /** Plain-text summary for sharing. */
    fun summaryText(): String {
        val s = state.value ?: return ""
        val t = s.trip
        val base = t.baseCurrency
        return buildString {
            appendLine("${t.name} — ${t.firstPerson} & ${t.secondPerson}")
            appendLine("Total spent: ${Format.money(s.summary.totalSpent, base)}")
            for (p in Participant.entries) {
                appendLine("${t.nameOf(p)}: paid ${Format.money(s.summary.paid.getValue(p), base)}, " +
                    "share ${Format.money(s.summary.consumed.getValue(p), base)}")
            }
            val st = s.summary.settlement
            appendLine(
                if (st == null) "All settled up ✔"
                else "${t.nameOf(st.from)} owes ${t.nameOf(st.to)} ${Format.money(st.amount, base)}"
            )
            appendLine()
            appendLine("Expenses:")
            for (e in s.expenses.sortedBy { it.date }) {
                val who = if (e.kind == EntryKind.TRANSFER) "${t.nameOf(e.paidBy)} → ${t.nameOf(e.paidBy.other)}"
                else "paid by ${t.nameOf(e.paidBy)}, ${splitLabel(e, t)}"
                appendLine("• ${Format.date(e.date)}  ${e.title}: ${Format.money(e.amount, e.currency)} ($who)")
            }
        }
    }
}

fun splitLabel(e: Expense, trip: Trip): String = when (e.splitMode) {
    SplitMode.EQUAL -> "split equally"
    SplitMode.CUSTOM -> "custom split"
    SplitMode.PAYER_ONLY -> "for ${trip.nameOf(e.paidBy)} only"
    SplitMode.OTHER_ONLY -> "for ${trip.nameOf(e.paidBy.other)} only"
}
