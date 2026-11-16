package com.travelsplit.app

import androidx.compose.ui.test.isDialog
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.github.takahirom.roborazzi.ExperimentalRoborazziApi
import com.github.takahirom.roborazzi.RobolectricDeviceQualifiers
import com.github.takahirom.roborazzi.captureRoboImage
import com.github.takahirom.roborazzi.captureScreenRoboImage
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Renders the real screens with sample data and saves PNGs to app/build/screenshots/
 * (CI copies them to docs/screenshots/).
 * Run with: ./gradlew :app:recordRoborazziDebug
 */
@OptIn(ExperimentalRoborazziApi::class)
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [30], qualifiers = RobolectricDeviceQualifiers.Pixel7, application = ScreenshotApp::class)
class ScreenshotTest {
    @get:Rule
    val compose = createAndroidComposeRule<MainActivity>()

    private fun capture(name: String) {
        compose.waitForIdle()
        captureScreenRoboImage("build/screenshots/$name.png")
    }

    private fun openJapanTrip() {
        compose.onNodeWithText("Japan & Korea").performClick()
        compose.waitForIdle()
    }

    @Test
    fun tripList() = capture("1_trips")

    @Test
    fun expenses() {
        openJapanTrip()
        capture("2_expenses")
    }

    @Test
    fun balance() {
        openJapanTrip()
        compose.onNodeWithText("Balance").performClick()
        capture("3_balance")
    }

    @Test
    fun editExpenseCustomSplit() {
        openJapanTrip()
        compose.onNodeWithText("Kimono rental").performClick()
        capture("4_edit_expense")
    }

    @Test
    fun newExpense() {
        openJapanTrip()
        compose.onNodeWithContentDescription("Add expense").performClick()
        capture("5_new_expense")
    }

    @Test
    fun inviteBanner() {
        compose.onNodeWithText("Lisbon weekend").performClick()
        capture("6_invite_banner")
    }

    @Test
    fun joinTrip() {
        waitForTrips()
        compose.onNodeWithText("Join trip").performClick()
        compose.waitForIdle()
        // A dialog is its own window; capture just the dialog.
        compose.onNode(isDialog()).captureRoboImage("build/screenshots/7_join_trip.png")
    }

    @Test
    fun newTrip() {
        waitForTrips()
        compose.onAllNodesWithText("New trip").onFirst().performClick()
        capture("8_new_trip")
    }

    private fun waitForTrips() {
        compose.waitUntil(5_000) { compose.onAllNodesWithText("Japan & Korea").fetchSemanticsNodes().isNotEmpty() }
    }
}
