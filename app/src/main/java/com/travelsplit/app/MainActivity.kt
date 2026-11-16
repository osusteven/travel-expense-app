package com.travelsplit.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.travelsplit.app.ui.expense.ExpenseScreen
import com.travelsplit.app.ui.theme.TravelSplitTheme
import com.travelsplit.app.ui.trip.TripScreen
import com.travelsplit.app.ui.trips.EditTripScreen
import com.travelsplit.app.ui.trips.TripsScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            TravelSplitTheme {
                val nav = rememberNavController()
                NavHost(navController = nav, startDestination = "trips") {
                    composable("trips") {
                        TripsScreen(
                            onOpenTrip = { nav.navigate("trip/$it") },
                            onNewTrip = { nav.navigate("editTrip/new") },
                        )
                    }
                    composable("editTrip/{tripId}") {
                        EditTripScreen(
                            onBack = { nav.popBackStack() },
                            onCreated = { id ->
                                nav.navigate("trip/$id") { popUpTo("trips") }
                            },
                        )
                    }
                    composable("trip/{tripId}") { entry ->
                        val tripId = entry.arguments?.getString("tripId").orEmpty()
                        TripScreen(
                            onBack = { nav.popBackStack() },
                            onEditTrip = { nav.navigate("editTrip/$tripId") },
                            onAddExpense = { nav.navigate("expense/$tripId/new") },
                            onOpenExpense = { nav.navigate("expense/$tripId/$it") },
                        )
                    }
                    composable("expense/{tripId}/{expenseId}") {
                        ExpenseScreen(onDone = { nav.popBackStack() })
                    }
                }
            }
        }
    }
}
