package com.travelsplit.app.ui.trips

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.travelsplit.app.data.Repository
import com.travelsplit.app.data.Trip
import com.travelsplit.app.ui.CurrencyField
import com.travelsplit.app.ui.appViewModel
import com.travelsplit.app.util.Currencies
import kotlinx.coroutines.launch

class EditTripViewModel(private val repo: Repository, handle: SavedStateHandle) : ViewModel() {
    private val tripId: Long = handle["tripId"] ?: 0L
    val isNew = tripId == 0L
    private var existing: Trip? = null

    var name by mutableStateOf("")
    var firstPerson by mutableStateOf("")
    var secondPerson by mutableStateOf("")
    var baseCurrency by mutableStateOf(Currencies.defaultForLocale())
    var loaded by mutableStateOf(isNew)
        private set

    val canSave get() = name.isNotBlank() && firstPerson.isNotBlank() && secondPerson.isNotBlank()

    init {
        if (!isNew) viewModelScope.launch {
            repo.getTrip(tripId)?.let {
                existing = it
                name = it.name
                firstPerson = it.firstPerson
                secondPerson = it.secondPerson
                baseCurrency = it.baseCurrency
            }
            loaded = true
        }
    }

    fun save(onSaved: (Long) -> Unit) {
        if (!canSave) return
        viewModelScope.launch {
            val trip = (existing ?: Trip(name = "", firstPerson = "", secondPerson = "", baseCurrency = baseCurrency)).copy(
                name = name.trim(),
                firstPerson = firstPerson.trim(),
                secondPerson = secondPerson.trim(),
                baseCurrency = baseCurrency,
            )
            onSaved(repo.saveTrip(trip))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EditTripScreen(onBack: () -> Unit, onCreated: (Long) -> Unit) {
    val vm = appViewModel { repo, handle -> EditTripViewModel(repo, handle) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(if (vm.isNew) "New trip" else "Edit trip") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
                },
            )
        },
    ) { padding ->
        if (!vm.loaded) return@Scaffold
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            val caps = KeyboardOptions(capitalization = KeyboardCapitalization.Words)
            OutlinedTextField(vm.name, { vm.name = it }, label = { Text("Trip name") },
                singleLine = true, keyboardOptions = caps, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(vm.firstPerson, { vm.firstPerson = it }, label = { Text("First person") },
                singleLine = true, keyboardOptions = caps, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(vm.secondPerson, { vm.secondPerson = it }, label = { Text("Second person") },
                singleLine = true, keyboardOptions = caps, modifier = Modifier.fillMaxWidth())
            CurrencyField(
                code = vm.baseCurrency,
                onSelected = { vm.baseCurrency = it },
                label = "Main currency",
                enabled = vm.isNew,
                modifier = Modifier.fillMaxWidth(),
            )
            Text(
                if (vm.isNew) "Balances are calculated in the main currency. Expenses can be added in any currency."
                else "The main currency can't be changed after the trip is created.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Button(
                onClick = {
                    vm.save { id -> if (vm.isNew) onCreated(id) else onBack() }
                },
                enabled = vm.canSave,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            ) { Text(if (vm.isNew) "Create trip" else "Save") }
        }
    }
}
