package com.travelsplit.app.ui.expense

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.travelsplit.app.data.Expense
import com.travelsplit.app.data.Repository
import com.travelsplit.app.data.Trip
import com.travelsplit.app.util.Format
import com.travelsplit.core.EntryKind
import com.travelsplit.core.Money
import com.travelsplit.core.Participant
import com.travelsplit.core.SplitMode
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import java.math.BigDecimal

class ExpenseViewModel(private val repo: Repository, handle: SavedStateHandle) : ViewModel() {
    private val tripId: Long = checkNotNull(handle["tripId"])
    private val expenseId: Long = handle["expenseId"] ?: 0L
    val isNew = expenseId == 0L
    private var existing: Expense? = null

    var trip by mutableStateOf<Trip?>(null)
        private set

    var kind by mutableStateOf(EntryKind.EXPENSE)
    var title by mutableStateOf("")
    var amountText by mutableStateOf("")
        private set
    var currency by mutableStateOf("")
        private set
    var rateText by mutableStateOf("1")
    var paidBy by mutableStateOf(Participant.FIRST)
    var splitMode by mutableStateOf(SplitMode.EQUAL)
    var firstShareText by mutableStateOf("")
        private set
    var secondShareText by mutableStateOf("")
        private set
    var date by mutableStateOf(Format.todayUtcMillis())

    var fetchingRate by mutableStateOf(false)
        private set
    var rateMessage by mutableStateOf<String?>(null)
        private set
    private var rateJob: Job? = null

    val baseCurrency get() = trip?.baseCurrency ?: ""
    val needsRate get() = currency.isNotEmpty() && currency != baseCurrency
    val amount get() = Money.parse(amountText)
    val rate get() = if (needsRate) Money.parse(rateText) else BigDecimal.ONE

    /** Converted value in the base currency, for display. */
    val baseAmount: BigDecimal?
        get() {
            val a = amount ?: return null
            val r = rate ?: return null
            return Money.round(a * r, baseCurrency)
        }

    val error: String?
        get() {
            val a = amount
            return when {
                kind == EntryKind.EXPENSE && title.isBlank() -> "Enter a description"
                a == null || a.signum() <= 0 -> "Enter an amount"
                needsRate && (rate == null || rate!!.signum() <= 0) -> "Enter an exchange rate"
                kind == EntryKind.EXPENSE && splitMode == SplitMode.CUSTOM -> {
                    val f = Money.parse(firstShareText)
                    if (f == null || f.signum() < 0 || f > a) "Custom split must add up to the total" else null
                }
                else -> null
            }
        }

    init {
        viewModelScope.launch {
            val t = repo.getTrip(tripId) ?: return@launch
            val e = if (isNew) null else repo.getExpense(expenseId)
            if (e != null) {
                existing = e
                kind = e.kind
                title = e.title
                amountText = Format.plain(e.amount)
                currency = e.currency
                rateText = Format.plain(e.rateToBase)
                paidBy = e.paidBy
                splitMode = e.splitMode
                date = e.date
                e.customFirstShare?.let {
                    firstShareText = Format.plain(it)
                    secondShareText = Format.plain(e.amount - it)
                }
                trip = t
            } else {
                trip = t
                selectCurrency(repo.lastCurrency(tripId) ?: t.baseCurrency)
            }
        }
    }

    fun updateAmount(text: String) {
        amountText = text
        // Keep the custom split consistent: preserve the first person's share, recompute the second.
        if (splitMode == SplitMode.CUSTOM) updateFirstShare(firstShareText)
    }

    fun updateFirstShare(text: String) {
        firstShareText = text
        val a = amount
        val f = Money.parse(text)
        secondShareText = if (a != null && f != null) Format.plain(a - f) else ""
    }

    fun updateSecondShare(text: String) {
        secondShareText = text
        val a = amount
        val s = Money.parse(text)
        firstShareText = if (a != null && s != null) Format.plain(a - s) else ""
    }

    fun updateSplitMode(mode: SplitMode) {
        splitMode = mode
        if (mode == SplitMode.CUSTOM && firstShareText.isBlank()) {
            amount?.let { a ->
                val half = a.divide(BigDecimal(2), Money.fractionDigits(currency.ifEmpty { "EUR" }), java.math.RoundingMode.HALF_UP)
                updateFirstShare(Format.plain(half))
            }
        }
    }

    /** Switches currency and pre-fills the rate: last rate used in this trip, otherwise fetched online. */
    fun selectCurrency(code: String) {
        currency = code
        rateMessage = null
        rateJob?.cancel()
        if (code == baseCurrency) {
            rateText = "1"
            return
        }
        rateJob = viewModelScope.launch {
            val last = repo.lastRate(tripId, code)
            if (last != null) {
                rateText = Format.plain(last)
                rateMessage = "Using the last rate from this trip"
            } else {
                rateText = ""
                fetchRateNow()
            }
        }
    }

    fun refreshRate() {
        rateJob?.cancel()
        rateJob = viewModelScope.launch { fetchRateNow() }
    }

    private suspend fun fetchRateNow() {
        fetchingRate = true
        rateMessage = null
        repo.rates.fetchRate(currency, baseCurrency)
            .onSuccess {
                rateText = Format.plain(it)
                rateMessage = "Latest ECB reference rate"
            }
            .onFailure { rateMessage = "Couldn't fetch the rate — enter it manually" }
        fetchingRate = false
    }

    fun save(onDone: () -> Unit) {
        if (error != null) return
        val t = trip ?: return
        val a = amount!!
        val isTransfer = kind == EntryKind.TRANSFER
        val expense = Expense(
            id = existing?.id ?: 0,
            tripId = t.id,
            title = title.trim().ifEmpty { "Money given" },
            amount = a,
            currency = currency,
            rateToBase = rate!!,
            paidBy = paidBy,
            splitMode = if (isTransfer) SplitMode.OTHER_ONLY else splitMode,
            customFirstShare = if (!isTransfer && splitMode == SplitMode.CUSTOM) Money.parse(firstShareText) else null,
            kind = kind,
            date = date,
            createdAt = existing?.createdAt ?: System.currentTimeMillis(),
        )
        viewModelScope.launch {
            repo.saveExpense(expense)
            onDone()
        }
    }

    fun delete(onDone: () -> Unit) {
        val e = existing ?: return
        viewModelScope.launch {
            repo.deleteExpense(e)
            onDone()
        }
    }
}
