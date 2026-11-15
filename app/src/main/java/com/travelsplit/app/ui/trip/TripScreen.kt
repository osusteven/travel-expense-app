package com.travelsplit.app.ui.trip

import android.content.Intent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Receipt
import androidx.compose.material.icons.filled.Share
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.travelsplit.app.data.Expense
import com.travelsplit.app.data.Trip
import com.travelsplit.app.ui.appViewModel
import com.travelsplit.app.ui.theme.NegativeColor
import com.travelsplit.app.ui.theme.PositiveColor
import com.travelsplit.app.util.Format
import com.travelsplit.core.BalanceCalculator
import com.travelsplit.core.EntryKind
import com.travelsplit.core.Participant

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TripScreen(
    onBack: () -> Unit,
    onEditTrip: () -> Unit,
    onAddExpense: () -> Unit,
    onOpenExpense: (Long) -> Unit,
) {
    val vm = appViewModel { repo, handle -> TripViewModel(repo, handle) }
    val state by vm.state.collectAsStateWithLifecycle()
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var menuOpen by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    val context = LocalContext.current

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(state?.trip?.name ?: "") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
                },
                actions = {
                    IconButton(onClick = {
                        val send = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_SUBJECT, state?.trip?.name)
                            putExtra(Intent.EXTRA_TEXT, vm.summaryText())
                        }
                        context.startActivity(Intent.createChooser(send, "Share summary"))
                    }) { Icon(Icons.Default.Share, "Share summary") }
                    IconButton(onClick = { menuOpen = true }) { Icon(Icons.Default.MoreVert, "More") }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        DropdownMenuItem(
                            text = { Text("Edit trip") },
                            leadingIcon = { Icon(Icons.Default.Edit, null) },
                            onClick = { menuOpen = false; onEditTrip() },
                        )
                        DropdownMenuItem(
                            text = { Text("Delete trip") },
                            leadingIcon = { Icon(Icons.Default.Delete, null) },
                            onClick = { menuOpen = false; confirmDelete = true },
                        )
                    }
                },
            )
        },
        floatingActionButton = {
            if (tab == 0) FloatingActionButton(onClick = onAddExpense) { Icon(Icons.Default.Add, "Add expense") }
        },
    ) { padding ->
        val s = state ?: return@Scaffold
        Column(Modifier.fillMaxSize().padding(padding)) {
            TabRow(selectedTabIndex = tab) {
                Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text("Expenses") })
                Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text("Balance") })
            }
            when (tab) {
                0 -> ExpenseList(s.trip, s.expenses, onOpenExpense)
                else -> BalanceTab(s, onSettleUp = vm::settleUp)
            }
        }
    }

    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Delete trip?") },
            text = { Text("This permanently deletes the trip and all its expenses.") },
            confirmButton = {
                TextButton(onClick = { confirmDelete = false; vm.deleteTrip(onBack) }) { Text("Delete") }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun ExpenseList(trip: Trip, expenses: List<Expense>, onOpen: (Long) -> Unit) {
    if (expenses.isEmpty()) {
        Box(Modifier.fillMaxSize().padding(32.dp), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(Icons.Default.Receipt, null, Modifier.size(56.dp), tint = MaterialTheme.colorScheme.primary)
                Text("No expenses yet", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 12.dp))
                Text(
                    "Tap + to add the first one.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
            }
        }
        return
    }
    val grouped = expenses.groupBy { it.date }
    LazyColumn(contentPadding = PaddingValues(bottom = 96.dp)) {
        grouped.forEach { (date, items) ->
            item(key = "h$date") {
                Text(
                    Format.date(date),
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 4.dp),
                )
            }
            items(items, key = { it.id }) { e -> ExpenseRow(trip, e, onClick = { onOpen(e.id) }) }
        }
    }
}

@Composable
private fun ExpenseRow(trip: Trip, e: Expense, onClick: () -> Unit) {
    val isTransfer = e.kind == EntryKind.TRANSFER
    val base = trip.baseCurrency
    ListItem(
        modifier = Modifier.clickable(onClick = onClick),
        leadingContent = {
            Icon(if (isTransfer) Icons.Default.SwapHoriz else Icons.Default.Receipt, null,
                tint = MaterialTheme.colorScheme.onSurfaceVariant)
        },
        headlineContent = { Text(e.title) },
        supportingContent = {
            Text(
                if (isTransfer) "${trip.nameOf(e.paidBy)} → ${trip.nameOf(e.paidBy.other)}"
                else "Paid by ${trip.nameOf(e.paidBy)} · ${splitLabel(e, trip)}"
            )
        },
        trailingContent = {
            Column(horizontalAlignment = Alignment.End) {
                Text(Format.money(e.amount, e.currency), style = MaterialTheme.typography.titleSmall)
                if (e.currency != base) {
                    val shares = BalanceCalculator.shares(e.toEntry(), base)
                    Text(
                        "≈ " + Format.money(shares.baseAmount, base),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        },
    )
}

@Composable
private fun BalanceTab(s: TripUiState, onSettleUp: () -> Unit) {
    val trip = s.trip
    val base = trip.baseCurrency
    val summary = s.summary
    var confirmSettle by remember { mutableStateOf(false) }

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    val st = summary.settlement
                    if (st == null) {
                        Text("All settled up 🎉", style = MaterialTheme.typography.headlineSmall)
                    } else {
                        Text("${trip.nameOf(st.from)} owes ${trip.nameOf(st.to)}", style = MaterialTheme.typography.titleMedium)
                        Text(
                            Format.money(st.amount, base),
                            style = MaterialTheme.typography.displaySmall,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(vertical = 8.dp),
                        )
                        Button(onClick = { confirmSettle = true }) { Text("Record settlement") }
                    }
                }
            }
        }
        item {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp)) {
                    LabeledValue("Total trip cost", Format.money(summary.totalSpent, base), bold = true)
                }
            }
        }
        items(Participant.entries) { p ->
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(trip.nameOf(p), style = MaterialTheme.typography.titleMedium)
                    LabeledValue("Paid", Format.money(summary.paid.getValue(p), base))
                    LabeledValue("Their share", Format.money(summary.consumed.getValue(p), base))
                    HorizontalDivider(Modifier.padding(vertical = 4.dp))
                    val bal = summary.balance.getValue(p)
                    LabeledValue(
                        "Balance",
                        (if (bal.signum() > 0) "+" else "") + Format.money(bal, base),
                        bold = true,
                        color = when (bal.signum()) {
                            1 -> PositiveColor
                            -1 -> NegativeColor
                            else -> Color.Unspecified
                        },
                    )
                }
            }
        }
        if (s.spentByCurrency.size > 1 || s.spentByCurrency.keys.any { it != base }) {
            item {
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text("Spent by currency", style = MaterialTheme.typography.titleMedium)
                        s.spentByCurrency.toSortedMap().forEach { (cur, amt) ->
                            LabeledValue(cur, Format.money(amt, cur))
                        }
                    }
                }
            }
        }
        item { Spacer(Modifier.size(24.dp)) }
    }

    val st = summary.settlement
    if (confirmSettle && st != null) {
        AlertDialog(
            onDismissRequest = { confirmSettle = false },
            title = { Text("Record settlement?") },
            text = {
                Text("This adds a payment of ${Format.money(st.amount, base)} from " +
                    "${trip.nameOf(st.from)} to ${trip.nameOf(st.to)}, bringing the balance to zero.")
            },
            confirmButton = {
                TextButton(onClick = { confirmSettle = false; onSettleUp() }) { Text("Record") }
            },
            dismissButton = { TextButton(onClick = { confirmSettle = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun LabeledValue(label: String, value: String, bold: Boolean = false, color: Color = Color.Unspecified) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text(label, Modifier.weight(1f), color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontWeight = if (bold) FontWeight.SemiBold else null, color = color)
    }
}
