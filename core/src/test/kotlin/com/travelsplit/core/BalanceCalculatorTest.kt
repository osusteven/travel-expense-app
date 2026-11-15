package com.travelsplit.core

import com.travelsplit.core.Participant.FIRST
import com.travelsplit.core.Participant.SECOND
import java.math.BigDecimal
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class BalanceCalculatorTest {
    private fun bd(s: String) = BigDecimal(s)
    private val one = BigDecimal.ONE

    @Test
    fun equalSplitMeansOtherOwesHalf() {
        val s = BalanceCalculator.summarize(listOf(Entry(bd("100"), "EUR", one, FIRST, SplitMode.EQUAL)), "EUR")
        assertEquals(bd("100.00"), s.totalSpent)
        assertEquals(bd("50.00"), s.balance[FIRST])
        assertEquals(bd("-50.00"), s.balance[SECOND])
        assertEquals(Settlement(SECOND, FIRST, bd("50.00")), s.settlement)
    }

    @Test
    fun oddCentsStillBalanceToZero() {
        val s = BalanceCalculator.summarize(listOf(Entry(bd("10.01"), "EUR", one, SECOND, SplitMode.EQUAL)), "EUR")
        assertEquals(bd("10.01"), s.consumed.getValue(FIRST) + s.consumed.getValue(SECOND))
        assertEquals(BigDecimal.ZERO.setScale(2), s.balance.getValue(FIRST) + s.balance.getValue(SECOND))
    }

    @Test
    fun payerOnlyCreatesNoDebt() {
        val s = BalanceCalculator.summarize(listOf(Entry(bd("40"), "EUR", one, FIRST, SplitMode.PAYER_ONLY)), "EUR")
        assertEquals(bd("40.00"), s.totalSpent)
        assertEquals(bd("40.00"), s.consumed[FIRST])
        assertNull(s.settlement)
    }

    @Test
    fun otherOnlyMeansOtherOwesEverything() {
        val s = BalanceCalculator.summarize(listOf(Entry(bd("30"), "EUR", one, SECOND, SplitMode.OTHER_ONLY)), "EUR")
        assertEquals(Settlement(FIRST, SECOND, bd("30.00")), s.settlement)
    }

    @Test
    fun customSplit() {
        val e = Entry(bd("100"), "EUR", one, FIRST, SplitMode.CUSTOM, customFirstShare = bd("70"))
        val s = BalanceCalculator.summarize(listOf(e), "EUR")
        assertEquals(bd("70.00"), s.consumed[FIRST])
        assertEquals(bd("30.00"), s.consumed[SECOND])
        assertEquals(Settlement(SECOND, FIRST, bd("30.00")), s.settlement)
    }

    @Test
    fun foreignCurrencyIsConvertedToBase() {
        // 10,000 JPY at 0.0062 EUR/JPY = 62.00 EUR, split equally.
        val e = Entry(bd("10000"), "JPY", bd("0.0062"), SECOND, SplitMode.EQUAL)
        val s = BalanceCalculator.summarize(listOf(e), "EUR")
        assertEquals(bd("62.00"), s.totalSpent)
        assertEquals(Settlement(FIRST, SECOND, bd("31.00")), s.settlement)
    }

    @Test
    fun transferSettlesDebtAndIsNotCountedAsSpending() {
        val entries = listOf(
            Entry(bd("100"), "EUR", one, FIRST, SplitMode.EQUAL),
            Entry.transfer(bd("50"), "EUR", one, from = SECOND),
        )
        val s = BalanceCalculator.summarize(entries, "EUR")
        assertEquals(bd("100.00"), s.totalSpent)
        assertEquals(bd("50.00"), s.paid[SECOND]!! + bd("50.00"))
        assertNull(s.settlement)
    }

    @Test
    fun mixedCurrenciesNet() {
        val entries = listOf(
            Entry(bd("200"), "USD", bd("0.90"), FIRST, SplitMode.EQUAL),   // 180 EUR, SECOND owes 90
            Entry(bd("50"), "EUR", one, SECOND, SplitMode.EQUAL),          // FIRST owes 25
            Entry(bd("20"), "GBP", bd("1.15"), SECOND, SplitMode.OTHER_ONLY), // 23 EUR, FIRST owes 23
        )
        val s = BalanceCalculator.summarize(entries, "EUR")
        assertEquals(Settlement(SECOND, FIRST, bd("42.00")), s.settlement)
        assertEquals(bd("253.00"), s.totalSpent)
    }

    @Test
    fun parsesUserInput() {
        assertEquals(bd("12.50"), Money.parse("12,50"))
        assertEquals(bd("1234.5"), Money.parse("1 234.5"))
        assertEquals(bd("1234.56"), Money.parse("1.234.56"))
        assertNull(Money.parse("abc"))
        assertNull(Money.parse(""))
    }
}
