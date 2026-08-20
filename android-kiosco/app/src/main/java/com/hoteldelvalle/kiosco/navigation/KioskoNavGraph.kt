package com.hoteldelvalle.kiosco.navigation

import androidx.compose.animation.core.tween
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.hoteldelvalle.kiosco.data.Prefs
import com.hoteldelvalle.kiosco.data.model.Order
import com.hoteldelvalle.kiosco.data.model.Plan
import com.hoteldelvalle.kiosco.data.model.RoomType
import com.hoteldelvalle.kiosco.ui.checkin.CheckinScreen
import com.hoteldelvalle.kiosco.ui.plan.PlanScreen
import com.hoteldelvalle.kiosco.ui.room.RoomScreen
import com.hoteldelvalle.kiosco.ui.settings.SettingsScreen

@Composable
fun KioskoNavGraph(
    navController: NavHostController,
    baseUrl: String,
    prefs: Prefs,
    modifier: Modifier = Modifier
) {
    var selectedPlan by remember { mutableStateOf<Plan?>(null) }
    var selectedRoom by remember { mutableStateOf<RoomType?>(null) }
    var selectedExtra by remember { mutableStateOf<String?>(null) }
    var selectedDays by remember { mutableIntStateOf(1) }

    NavHost(
        navController = navController,
        startDestination = "plan",
        modifier = modifier,
        enterTransition = {
            slideInHorizontally(tween(300)) { it }
        },
        exitTransition = {
            slideOutHorizontally(tween(300)) { -it / 3 }
        },
        popEnterTransition = {
            slideInHorizontally(tween(300)) { -it / 3 }
        },
        popExitTransition = {
            slideOutHorizontally(tween(300)) { it }
        }
    ) {
        composable("plan") {
            PlanScreen(
                selectedPlan = selectedPlan,
                onPlanSelected = { selectedPlan = it },
                onContinue = {
                    if (selectedPlan != null) {
                        navController.navigate("room")
                    }
                }
            )
        }

        composable("room") {
            val plan = selectedPlan ?: return@composable
            RoomScreen(
                plan = plan,
                baseUrl = baseUrl,
                onBack = { navController.popBackStack() },
                onContinue = {
                    if (selectedRoom != null) {
                        navController.navigate("checkin")
                    }
                },
                onRoomSelected = { selectedRoom = it },
                onExtraSelected = { selectedExtra = it },
                onDaysChanged = { selectedDays = it }
            )
        }

        composable("checkin") {
            val plan = selectedPlan ?: return@composable
            val room = selectedRoom ?: return@composable
            CheckinScreen(
                plan = plan,
                room = room,
                extra = selectedExtra,
                days = selectedDays,
                baseUrl = baseUrl,
                onBack = { navController.popBackStack() },
                onSuccess = { order ->
                    selectedPlan = null
                    selectedRoom = null
                    selectedExtra = null
                    selectedDays = 1
                    navController.navigate("plan") {
                        popUpTo("plan") { inclusive = true }
                    }
                }
            )
        }

        composable("settings") {
            SettingsScreen(
                prefs = prefs,
                onDismiss = { navController.popBackStack() }
            )
        }
    }
}
