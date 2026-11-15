package com.travelsplit.core

import java.math.BigDecimal
import java.math.RoundingMode

/** One entry's effect, converted into the trip's base currency. */
data class EntryShares(
    val baseAmount: BigDecimal,
    val paidBy: Participant,
    val firstShare: BigDecimal,
    val secondShare: BigDecimal,
) {
    fun shareOf(p: Participant) = if (p == Participant.FIRST) firstShare else secondShare
}

/** A suggested payment that brings both balances to zero. */
data class Settlement(val from: Participant, val to: Participant, val amount: BigDecimal)

data class TripSummary(
    val baseCurrency: String,
    /** Total cost of the trip (expenses only, transfers excluded). */
    val totalSpent: BigDecimal,
    /** How much each person paid for expenses (transfers excluded). */
    val paid: Map<Participant, BigDecimal>,
    /** How much of the expenses was consumed by each person. */
    val consumed: Map<Participant, BigDecimal>,
    /**
     * Net balance per person: positive means the person is owed money, negative means they owe.
     * The two values always sum to zero.
     */
    val balance: Map<Participant, BigDecimal>,
    /** Payment needed to settle up, or null if already even. */
    val settlement: Settlement?,
)

object BalanceCalculator {

    fun shares(entry: Entry, baseCurrency: String): EntryShares {
        val base = toBase(entry.amount, entry.rateToBase, baseCurrency)
        val payer = entry.paidBy
        val first: BigDecimal = when (entry.splitMode) {
            SplitMode.EQUAL -> base.divide(BigDecimal(2), Money.fractionDigits(baseCurrency), RoundingMode.HALF_UP)
            SplitMode.CUSTOM -> {
                val custom = entry.customFirstShare ?: BigDecimal.ZERO
                toBase(custom, entry.rateToBase, baseCurrency).coerceIn(BigDecimal.ZERO.min(base), base.max(BigDecimal.ZERO))
            }
            SplitMode.PAYER_ONLY -> if (payer == Participant.FIRST) base else zero(baseCurrency)
            SplitMode.OTHER_ONLY -> if (payer == Participant.FIRST) zero(baseCurrency) else base
        }
        return EntryShares(base, payer, first, base - first)
    }

    fun summarize(entries: List<Entry>, baseCurrency: String): TripSummary {
        val z = zero(baseCurrency)
        val paid = mutableMapOf(Participant.FIRST to z, Participant.SECOND to z)
        val consumed = mutableMapOf(Participant.FIRST to z, Participant.SECOND to z)
        val balance = mutableMapOf(Participant.FIRST to z, Participant.SECOND to z)
        var total = z

        for (entry in entries) {
            val s = shares(entry, baseCurrency)
            // Balance: the payer is credited with the full amount, everyone is debited their share.
            balance[s.paidBy] = balance.getValue(s.paidBy) + s.baseAmount
            for (p in Participant.entries) balance[p] = balance.getValue(p) - s.shareOf(p)

            if (entry.kind == EntryKind.EXPENSE) {
                total += s.baseAmount
                paid[s.paidBy] = paid.getValue(s.paidBy) + s.baseAmount
                for (p in Participant.entries) consumed[p] = consumed.getValue(p) + s.shareOf(p)
            }
        }

        val firstBalance = balance.getValue(Participant.FIRST)
        val settlement = when {
            firstBalance.signum() > 0 -> Settlement(Participant.SECOND, Participant.FIRST, firstBalance)
            firstBalance.signum() < 0 -> Settlement(Participant.FIRST, Participant.SECOND, firstBalance.negate())
            else -> null
        }
        return TripSummary(baseCurrency, total, paid, consumed, balance, settlement)
    }

    private fun toBase(amount: BigDecimal, rate: BigDecimal, baseCurrency: String) =
        Money.round(amount.multiply(rate), baseCurrency)

    private fun zero(currency: String) = BigDecimal.ZERO.setScale(Money.fractionDigits(currency))
}
