package com.travelsplit.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.lifecycle.createSavedStateHandle
import com.travelsplit.app.TravelSplitApp
import com.travelsplit.app.data.Repository
import com.travelsplit.app.util.Currencies
import java.util.Locale

/** Creates a ViewModel with access to the app repository and navigation arguments. */
@Composable
inline fun <reified VM : ViewModel> appViewModel(
    crossinline create: (Repository, SavedStateHandle) -> VM,
): VM {
    val app = LocalContext.current.applicationContext as TravelSplitApp
    return viewModel(factory = viewModelFactory {
        initializer { create(app.repository, createSavedStateHandle()) }
    })
}

/** A read-only field that opens a searchable currency list. */
@Composable
fun CurrencyField(
    code: String,
    onSelected: (String) -> Unit,
    modifier: Modifier = Modifier,
    label: String = "Currency",
    enabled: Boolean = true,
    compact: Boolean = false,
) {
    var open by remember { mutableStateOf(false) }
    Surface(
        modifier = modifier,
        onClick = { if (enabled) open = true },
        enabled = enabled,
        shape = MaterialTheme.shapes.extraSmall,
    ) {
        OutlinedTextField(
            value = if (compact) code else Currencies.label(code),
            onValueChange = {},
            readOnly = true,
            enabled = false, // let the Surface handle clicks
            label = { Text(label) },
            trailingIcon = { Icon(Icons.Default.ArrowDropDown, null) },
            singleLine = true,
            colors = androidx.compose.material3.OutlinedTextFieldDefaults.colors(
                disabledTextColor = MaterialTheme.colorScheme.onSurface.copy(alpha = if (enabled) 1f else 0.5f),
                disabledBorderColor = MaterialTheme.colorScheme.outline,
                disabledLabelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                disabledTrailingIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
            ),
            modifier = Modifier.fillMaxWidth(),
        )
    }
    if (open) {
        CurrencyPickerDialog(
            onDismiss = { open = false },
            onSelected = { onSelected(it); open = false },
        )
    }
}

@Composable
fun CurrencyPickerDialog(onDismiss: () -> Unit, onSelected: (String) -> Unit) {
    var query by remember { mutableStateOf("") }
    val locale = Locale.getDefault()
    val filtered = remember(query) {
        val q = query.trim().lowercase(locale)
        Currencies.all.filter {
            q.isEmpty() || it.currencyCode.lowercase(locale).contains(q) ||
                it.getDisplayName(locale).lowercase(locale).contains(q)
        }
    }
    Dialog(onDismissRequest = onDismiss) {
        Surface(shape = MaterialTheme.shapes.large, tonalElevation = 6.dp) {
            Column(Modifier.padding(16.dp)) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    placeholder = { Text("Search currency") },
                    leadingIcon = { Icon(Icons.Default.Search, null) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                LazyColumn(Modifier.heightIn(max = 420.dp).padding(top = 8.dp)) {
                    items(filtered, key = { it.currencyCode }) { c ->
                        Text(
                            "${c.currencyCode} – ${c.getDisplayName(locale)}",
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onSelected(c.currencyCode) }
                                .padding(vertical = 12.dp, horizontal = 4.dp),
                        )
                        HorizontalDivider()
                    }
                }
            }
        }
    }
}
