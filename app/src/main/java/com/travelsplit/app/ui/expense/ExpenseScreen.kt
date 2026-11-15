package com.travelsplit.app.ui.expense

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.travelsplit.app.ui.CurrencyField
import com.travelsplit.app.ui.appViewModel
import com.travelsplit.app.util.Format
import com.travelsplit.core.EntryKind
import com.travelsplit.core.Participant
import com.travelsplit.core.SplitMode

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExpenseScreen(onDone: () -> Unit) {
    val vm = appViewModel { repo, handle -> ExpenseViewModel(repo, handle) }
    val trip = vm.trip
    var showDatePicker by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var triedSave by remember { mutableStateOf(false) }
    val isTransfer = vm.kind == EntryKind.TRANSFER

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        when {
                            isTransfer && vm.isNew -> "New transfer"
                            isTransfer -> "Edit transfer"
                            vm.isNew -> "New expense"
                            else -> "Edit expense"
                        }
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onDone) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
                },
                actions = {
                    if (!vm.isNew) IconButton(onClick = { confirmDelete = true }) {
                        Icon(Icons.Default.Delete, "Delete")
                    }
                    TextButton(onClick = { triedSave = true; vm.save(onDone) }) { Text("Save") }
                },
            )
        },
    ) { padding ->
        if (trip == null) return@Scaffold
        val decimal = KeyboardOptions(keyboardType = KeyboardType.Decimal)

        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            // Expense vs. money given directly to the other person.
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                listOf(EntryKind.EXPENSE to "Expense", EntryKind.TRANSFER to "Money given").forEachIndexed { i, (k, label) ->
                    SegmentedButton(
                        selected = vm.kind == k,
                        onClick = { vm.kind = k },
                        shape = SegmentedButtonDefaults.itemShape(i, 2),
                    ) { Text(label) }
                }
            }

            OutlinedTextField(
                value = vm.title,
                onValueChange = { vm.title = it },
                label = { Text(if (isTransfer) "Note (optional)" else "Description") },
                placeholder = { Text(if (isTransfer) "e.g. Cash for taxi" else "e.g. Dinner, Hotel, Train") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                modifier = Modifier.fillMaxWidth(),
            )

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = vm.amountText,
                    onValueChange = vm::updateAmount,
                    label = { Text("Amount") },
                    singleLine = true,
                    keyboardOptions = decimal,
                    modifier = Modifier.weight(1f),
                )
                CurrencyField(
                    code = vm.currency,
                    onSelected = vm::selectCurrency,
                    compact = true,
                    modifier = Modifier.weight(0.6f),
                )
            }

            if (vm.needsRate) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        value = vm.rateText,
                        onValueChange = { vm.rateText = it },
                        label = { Text("1 ${vm.currency} = ? ${vm.baseCurrency}") },
                        singleLine = true,
                        keyboardOptions = decimal,
                        modifier = Modifier.weight(1f),
                    )
                    if (vm.fetchingRate) {
                        CircularProgressIndicator(Modifier.padding(12.dp).size(24.dp))
                    } else {
                        IconButton(onClick = vm::refreshRate) { Icon(Icons.Default.Refresh, "Fetch latest rate") }
                    }
                }
                val hint = buildList {
                    vm.baseAmount?.let { add("≈ ${Format.money(it, vm.baseCurrency)}") }
                    vm.rateMessage?.let { add(it) }
                }.joinToString(" · ")
                if (hint.isNotEmpty()) {
                    Text(hint, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            Text(if (isTransfer) "From" else "Paid by", style = MaterialTheme.typography.titleSmall)
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                Participant.entries.forEachIndexed { i, p ->
                    SegmentedButton(
                        selected = vm.paidBy == p,
                        onClick = { vm.paidBy = p },
                        shape = SegmentedButtonDefaults.itemShape(i, 2),
                    ) { Text(trip.nameOf(p)) }
                }
            }

            if (isTransfer) {
                Text(
                    "${trip.nameOf(vm.paidBy)} gives this money to ${trip.nameOf(vm.paidBy.other)}. " +
                        "Use this for paying someone back.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            } else {
                Text("Split", style = MaterialTheme.typography.titleSmall)
                val payer = trip.nameOf(vm.paidBy)
                val other = trip.nameOf(vm.paidBy.other)
                Column(Modifier.selectableGroup()) {
                    SplitOption("Split equally (50 / 50)", vm.splitMode == SplitMode.EQUAL) { vm.updateSplitMode(SplitMode.EQUAL) }
                    SplitOption("Split by custom amounts", vm.splitMode == SplitMode.CUSTOM) { vm.updateSplitMode(SplitMode.CUSTOM) }
                    SplitOption("No split — only for $payer", vm.splitMode == SplitMode.PAYER_ONLY) { vm.updateSplitMode(SplitMode.PAYER_ONLY) }
                    SplitOption("No split — only for $other ($other owes it all)", vm.splitMode == SplitMode.OTHER_ONLY) { vm.updateSplitMode(SplitMode.OTHER_ONLY) }
                }
                if (vm.splitMode == SplitMode.CUSTOM) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = vm.firstShareText,
                            onValueChange = vm::updateFirstShare,
                            label = { Text("${trip.firstPerson} (${vm.currency})") },
                            singleLine = true,
                            keyboardOptions = decimal,
                            modifier = Modifier.weight(1f),
                        )
                        OutlinedTextField(
                            value = vm.secondShareText,
                            onValueChange = vm::updateSecondShare,
                            label = { Text("${trip.secondPerson} (${vm.currency})") },
                            singleLine = true,
                            keyboardOptions = decimal,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }

            OutlinedButton(onClick = { showDatePicker = true }, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Default.CalendarToday, null, Modifier.size(18.dp))
                Text(Format.date(vm.date), Modifier.padding(start = 8.dp))
            }

            val error = vm.error
            if (triedSave && error != null) {
                Text(error, color = MaterialTheme.colorScheme.error)
            }

            Button(
                onClick = { triedSave = true; vm.save(onDone) },
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            ) { Text("Save") }
        }
    }

    if (showDatePicker) {
        val state = rememberDatePickerState(initialSelectedDateMillis = vm.date)
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { vm.date = it }
                    showDatePicker = false
                }) { Text("OK") }
            },
            dismissButton = { TextButton(onClick = { showDatePicker = false }) { Text("Cancel") } },
        ) { DatePicker(state = state) }
    }

    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Delete this entry?") },
            confirmButton = {
                TextButton(onClick = { confirmDelete = false; vm.delete(onDone) }) { Text("Delete") }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun SplitOption(label: String, selected: Boolean, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .selectable(selected = selected, onClick = onClick, role = Role.RadioButton)
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        RadioButton(selected = selected, onClick = null)
        Text(label, Modifier.padding(start = 8.dp))
    }
}
