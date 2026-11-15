package com.travelsplit.core

import java.math.BigDecimal

/** The two people sharing a trip. */
enum class Participant {
    FIRST, SECOND;

    val other: Participant get() = if (this == FIRST) SECOND else FIRST
}

/** How an expense is shared between the two participants. */
enum class SplitMode {
    /** 50/50 between both people. */
    EQUAL,

    /** A specific amount (in the expense currency) is assigned to the first person; the rest to the second. */
    CUSTOM,

    /** Not split: the payer bought it for themselves. Tracked, but nobody owes anything. */
    PAYER_ONLY,

    /** Not split: the payer bought it entirely for the other person, who owes the full amount. */
    OTHER_ONLY,
}

/** Whether an entry is a real expense or a money transfer between the two people (settling up). */
enum class EntryKind { EXPENSE, TRANSFER }

/**
 * A single expense (or transfer) as the balance engine sees it.
 *
 * @param amount amount in [currency].
 * @param rateToBase how many units of the trip's base currency one unit of [currency] is worth.
 * @param customFirstShare for [SplitMode.CUSTOM], the first person's share in [currency].
 */
data class Entry(
    val amount: BigDecimal,
    val currency: String,
    val rateToBase: BigDecimal,
    val paidBy: Participant,
    val splitMode: SplitMode,
    val customFirstShare: BigDecimal? = null,
    val kind: EntryKind = EntryKind.EXPENSE,
) {
    companion object {
        /** A transfer of money from [from] to the other person (e.g. settling up). */
        fun transfer(amount: BigDecimal, currency: String, rateToBase: BigDecimal, from: Participant) =
            Entry(amount, currency, rateToBase, from, SplitMode.OTHER_ONLY, null, EntryKind.TRANSFER)
    }
}
