package com.travelsplit.app.ui.trips

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.FlightTakeoff
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.GroupAdd
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.TextButton
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.launch
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import com.travelsplit.app.data.Repository
import com.travelsplit.app.data.Trip
import com.travelsplit.app.ui.appViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn

sealed interface TripsState {
    data object Loading : TripsState
    data class Loaded(val trips: List<Trip>) : TripsState
    data object Offline : TripsState
}

class TripsViewModel(private val repo: Repository) : ViewModel() {
    private val retry = MutableStateFlow(0)

    @OptIn(ExperimentalCoroutinesApi::class)
    val state: StateFlow<TripsState> = retry.flatMapLatest {
        repo.observeTrips()
            .map<List<Trip>, TripsState> { TripsState.Loaded(it) }
            .onStart { emit(TripsState.Loading) }
            // The first launch needs a connection to sign in; after that everything works offline.
            .catch { emit(TripsState.Offline) }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), TripsState.Loading)

    fun retry() { retry.value++ }

    var joining by mutableStateOf(false)
        private set
    var joinError by mutableStateOf<String?>(null)
        private set

    fun clearJoinError() { joinError = null }

    fun join(code: String, onJoined: (String) -> Unit) {
        viewModelScope.launch {
            joining = true
            joinError = null
            repo.joinTrip(code)
                .onSuccess { onJoined(it.id) }
                .onFailure { joinError = it.message ?: "Couldn't join the trip" }
            joining = false
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TripsScreen(onOpenTrip: (String) -> Unit, onNewTrip: () -> Unit) {
    val vm = appViewModel { repo, _ -> TripsViewModel(repo) }
    val state by vm.state.collectAsStateWithLifecycle()
    var showJoin by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("TravelSplit") },
                actions = {
                    TextButton(onClick = { vm.clearJoinError(); showJoin = true }) {
                        Icon(Icons.Default.GroupAdd, null, Modifier.size(18.dp))
                        Text("Join trip", Modifier.padding(start = 6.dp))
                    }
                },
            )
        },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = onNewTrip,
                icon = { Icon(Icons.Default.Add, null) },
                text = { Text("New trip") },
            )
        },
    ) { padding ->
        val list = (state as? TripsState.Loaded)?.trips
        when {
            state is TripsState.Offline -> Box(Modifier.fillMaxSize().padding(padding).padding(32.dp), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.CloudOff, null, Modifier.size(56.dp), tint = MaterialTheme.colorScheme.error)
                    Text("Can't connect", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 16.dp))
                    Text(
                        "TravelSplit needs an internet connection the first time it starts. After that it also works offline.",
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(vertical = 8.dp),
                    )
                    Button(onClick = vm::retry) { Text("Try again") }
                }
            }
            list == null -> Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            list.isEmpty() -> Box(Modifier.fillMaxSize().padding(padding).padding(32.dp), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.FlightTakeoff, null, Modifier.size(64.dp), tint = MaterialTheme.colorScheme.primary)
                    Text("No trips yet", style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 16.dp))
                    Text(
                        "Create a trip, then invite your travel partner from the trip's menu. " +
                            "Or tap \"Join trip\" if they already sent you a code.",
                        textAlign = TextAlign.Center,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }
            }
            else -> LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(16.dp, 8.dp, 16.dp, 96.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(list, key = { it.id }) { trip ->
                    Card(onClick = { onOpenTrip(trip.id) }, modifier = Modifier.fillMaxWidth()) {
                        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.FlightTakeoff, null, tint = MaterialTheme.colorScheme.primary)
                            Column(Modifier.padding(start = 16.dp).weight(1f)) {
                                Text(trip.name, style = MaterialTheme.typography.titleMedium)
                                Text(
                                    "${trip.firstPerson} & ${trip.secondPerson}",
                                    style = MaterialTheme.typography.bodyMedium,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            Text(trip.baseCurrency, style = MaterialTheme.typography.labelLarge)
                            Box(Modifier.width(4.dp))
                        }
                    }
                }
            }
        }
    }
    if (showJoin) {
        JoinTripDialog(
            joining = vm.joining,
            error = vm.joinError,
            onDismiss = { showJoin = false },
            onJoin = { code ->
                vm.join(code) { id ->
                    showJoin = false
                    onOpenTrip(id)
                }
            },
        )
    }
}

@Composable
private fun JoinTripDialog(
    joining: Boolean,
    error: String?,
    onDismiss: () -> Unit,
    onJoin: (String) -> Unit,
) {
    var code by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Join a trip") },
        text = {
            Column {
                Text("Paste the trip code your travel partner shared with you.")
                OutlinedTextField(
                    value = code,
                    onValueChange = { code = it.trim() },
                    label = { Text("Trip code") },
                    singleLine = true,
                    isError = error != null,
                    supportingText = error?.let { { Text(it) } },
                    modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { onJoin(code) }, enabled = code.isNotBlank() && !joining) {
                Text(if (joining) "Joining…" else "Join")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
