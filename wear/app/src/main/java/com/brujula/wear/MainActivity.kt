package com.brujula.wear

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.PlatformTextStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.material3.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate

private const val BASE_URL = "https://brujula-app-personal.vercel.app"
private const val AUTO_REFRESH_INTERVAL_MS = 30_000L
data class Habit(val id: Long, val name: String, val kind: String, val status: String)
data class WeeklyGoal(val id: Long, val title: String, val status: String)
data class TodayData(val habits: List<Habit>, val goals: List<WeeklyGoal>, val dayScore: Double, val weekScore: Double)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(savedInstanceState); setContent { BrujulaApp(this) } }
}

@Composable
fun BrujulaApp(context: Context) {
    val prefs = remember { securePrefs(context) }
    var token by remember { mutableStateOf(prefs.getString("device_token", null)) }
    MaterialTheme { Box(Modifier.fillMaxSize().background(Color(0xFF061411))) {
        if (token == null) PairScreen { code -> Api.redeem(code).also { prefs.edit().putString("device_token", it).apply(); token = it } }
        else HabitsScreen(token!!)
    } }
}

@Composable
private fun PairScreen(onPair: suspend (String) -> Unit) {
    var code by remember { mutableStateOf("") }; var error by remember { mutableStateOf("") }; var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    ScalingLazyColumn(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        item { BrujulaMark() }
        item { Text("BRÚJULA", color = Color(0xFF65D9BA), fontWeight = FontWeight.Bold) }
        item { Text("Vincular reloj", fontSize = 20.sp, fontWeight = FontWeight.Bold) }
        item { Text("Genera un código en\nbrujula-app-personal.vercel.app/watch-connect", textAlign = TextAlign.Center, fontSize = 12.sp) }
        item { androidx.compose.material3.OutlinedTextField(value = code, onValueChange = { value -> code = value.filter(Char::isDigit).take(6) }, label = { androidx.compose.material3.Text("Código") }, keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.fillMaxWidth(.82f)) }
        if (error.isNotEmpty()) item { Text(error, color = Color(0xFFFF9F9F), textAlign = TextAlign.Center, fontSize = 12.sp) }
        item { Button(onClick = { scope.launch { busy = true; error = try { onPair(code); "" } catch (e: Exception) { e.message ?: "No se ha podido vincular" }; busy = false } }, enabled = code.length == 6 && !busy) { Text(if (busy) "Vinculando…" else "Vincular") } }
    }
}

@Composable
private fun HabitsScreen(token: String) {
    var data by remember { mutableStateOf(TodayData(emptyList(), emptyList(), 0.0, 0.0)) }; var loading by remember { mutableStateOf(true) }; var error by remember { mutableStateOf("") }
    var selectedTab by remember { mutableStateOf(WatchTab.Daily) }
    val scope = rememberCoroutineScope()
    val lifecycleOwner = LocalLifecycleOwner.current
    suspend fun refresh(showLoading: Boolean = true) { if (showLoading) loading = true; error = try { data = Api.today(token); "" } catch (e: Exception) { e.message ?: "Sin conexión" }; if (showLoading) loading = false }
    fun setHabitStatus(habit: Habit, status: String) { val previous = data; data = data.copy(habits = data.habits.map { if (it.id == habit.id) it.copy(status = status) else it }); scope.launch { try { Api.setHabitStatus(token, habit.id, status); refresh(showLoading = false) } catch (e: Exception) { data = previous; error = e.message ?: "No se ha podido guardar" } } }
    fun setGoalStatus(goal: WeeklyGoal, status: String) { val previous = data; data = data.copy(goals = data.goals.map { if (it.id == goal.id) it.copy(status = status) else it }); scope.launch { try { Api.setGoalStatus(token, goal.id, status); refresh(showLoading = false) } catch (e: Exception) { data = previous; error = e.message ?: "No se ha podido guardar" } } }
    LaunchedEffect(token, lifecycleOwner) {
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            refresh()
            while (isActive) {
                delay(AUTO_REFRESH_INTERVAL_MS)
                refresh(showLoading = false)
            }
        }
    }
    ScalingLazyColumn(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        item { Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) { BrujulaMark(28.dp); Text("HOY", color = Color(0xFF65D9BA), fontWeight = FontWeight.Bold) } }
        item { Row(Modifier.fillMaxWidth(.88f), horizontalArrangement = Arrangement.SpaceEvenly) { Score("DÍA", data.dayScore); Score("SEMANA", data.weekScore) } }
        if (loading) item { CircularProgressIndicator() }
        if (error.isNotEmpty()) item { Text(error, color = Color(0xFFFFC07A), textAlign = TextAlign.Center) }
        if (!loading && data.habits.isEmpty() && data.goals.isEmpty() && error.isEmpty()) item { Text("No tienes tareas para hoy", color = Color.White, textAlign = TextAlign.Center) }
        item { WatchTabs(selectedTab) { selectedTab = it } }
        val daily = pendingFirst(data.habits.filter { it.kind == "daily" })
        val weekly = pendingFirst(data.habits.filter { it.kind == "weekly" })
        val weeklyGoals = data.goals.sortedBy { if (it.status == "active") 0 else 1 }
        if (selectedTab == WatchTab.Daily) {
            if (daily.isEmpty() && !loading) item { EmptyTab("No hay hábitos diarios") }
            items(daily, key = { "daily-${it.id}" }) { habit -> HabitCard(habit) { setHabitStatus(habit, it) } }
        } else {
            if (weekly.isNotEmpty()) item { SectionTitle("HÁBITOS") }
            items(weekly, key = { "weekly-${it.id}" }) { habit -> HabitCard(habit) { setHabitStatus(habit, it) } }
            if (weeklyGoals.isNotEmpty()) item { SectionTitle("OBJETIVOS") }
            items(weeklyGoals, key = { "goal-${it.id}" }) { goal ->
                Column(Modifier.fillMaxWidth(.9f).background(Color(0xFF132520)).padding(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(goal.title, color = Color.White, textAlign = TextAlign.Center, fontWeight = FontWeight.SemiBold, maxLines = 2)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        StatusButton("✓", goal.status == "completed", Color(0xFF3CC9AB)) { setGoalStatus(goal, if (goal.status == "completed") "active" else "completed") }
                        StatusButton("✕", goal.status == "discarded", Color(0xFFEF4444)) { setGoalStatus(goal, if (goal.status == "discarded") "active" else "discarded") }
                    }
                }
            }
            if (weekly.isEmpty() && weeklyGoals.isEmpty() && !loading) item { EmptyTab("No hay tareas semanales") }
        }
        item { Text("Sincronización automática", color = Color(0xFF8FB9AE), fontSize = 10.sp) }
        item { TextButton(onClick = { scope.launch { refresh() } }) { Text("Actualizar ahora", fontSize = 11.sp) } }
    }
}

private enum class WatchTab { Daily, Weekly }

private fun pendingFirst(habits: List<Habit>) = habits.sortedBy { if (it.status == "pending") 0 else 1 }

@Composable
private fun WatchTabs(selected: WatchTab, onSelect: (WatchTab) -> Unit) {
    Row(Modifier.fillMaxWidth(.9f), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        WatchTabButton("Diarios", selected == WatchTab.Daily, Modifier.weight(1f)) { onSelect(WatchTab.Daily) }
        WatchTabButton("Semanales", selected == WatchTab.Weekly, Modifier.weight(1f)) { onSelect(WatchTab.Weekly) }
    }
}

@Composable
private fun WatchTabButton(label: String, selected: Boolean, modifier: Modifier, onClick: () -> Unit) {
    Box(
        modifier.height(34.dp).background(if (selected) Color(0xFF3CC9AB) else Color(0xFF18243C), RoundedCornerShape(9.dp)).clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) { Text(label, color = if (selected) Color(0xFF07131D) else Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold) }
}

@Composable private fun EmptyTab(message: String) { Text(message, color = Color(0xFF9CB5AE), fontSize = 12.sp, textAlign = TextAlign.Center) }

@Composable
private fun BrujulaMark(size: androidx.compose.ui.unit.Dp = 48.dp) {
    Image(
        painter = painterResource(com.brujula.wear.R.drawable.ic_brujula_app),
        contentDescription = "Brújula",
        modifier = Modifier.size(size)
    )
}

@Composable private fun Score(label: String, value: Double) { Column(horizontalAlignment = Alignment.CenterHorizontally) { Text(label, color = Color(0xFF8FB9AE), fontSize = 10.sp); Text(String.format("%.1f", value), color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold) } }
@Composable private fun SectionTitle(value: String) { Text(value, color = Color(0xFF65D9BA), fontSize = 11.sp, fontWeight = FontWeight.Bold) }
@Composable private fun HabitCard(habit: Habit, onStatus: (String) -> Unit) {
    Column(Modifier.fillMaxWidth(.9f).background(Color(0xFF132520)).padding(10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(habit.name, color = Color.White, textAlign = TextAlign.Center, fontWeight = FontWeight.SemiBold, maxLines = 2)
        Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            StatusButton("✓", habit.status == "completed", Color(0xFF3CC9AB)) { onStatus(if (habit.status == "completed") "pending" else "completed") }
            StatusButton("✕", habit.status == "missed", Color(0xFFEF4444)) { onStatus(if (habit.status == "missed") "pending" else "missed") }
            StatusButton("—", habit.status == "skipped", Color(0xFF7F8BA3)) { onStatus(if (habit.status == "skipped") "pending" else "skipped") }
        }
    }
}
@Composable
private fun StatusButton(label: String, selected: Boolean, selectedColor: Color, onClick: () -> Unit) {
    val shape = RoundedCornerShape(8.dp)
    Box(
        Modifier.size(42.dp).background(if (selected) selectedColor else Color(0xFF18243C), shape)
            .border(1.dp, if (selected) selectedColor else Color(0xFF35435F), shape).clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            label,
            modifier = Modifier.fillMaxSize().wrapContentSize(Alignment.Center),
            color = if (selected) Color(0xFF07131D) else Color.Transparent,
            style = TextStyle(fontSize = 18.sp, lineHeight = 18.sp, fontWeight = FontWeight.Black, textAlign = TextAlign.Center, platformStyle = PlatformTextStyle(includeFontPadding = false))
        )
    }
}

private fun securePrefs(context: Context) = EncryptedSharedPreferences.create(context, "brujula_watch", MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(), EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV, EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM)

private object Api {
    suspend fun redeem(code: String) = withContext(Dispatchers.IO) { request("/api/watch/redeem", "POST", null, JSONObject().put("code", code).put("name", "Galaxy Watch 6").toString()).getString("token") }
    suspend fun today(token: String) = withContext(Dispatchers.IO) { val json = request("/api/watch/today?date=${LocalDate.now()}", "GET", token); val habitsJson = json.getJSONArray("habits"); val goalsJson = json.getJSONArray("goals"); val scores = json.getJSONObject("scores"); TodayData((0 until habitsJson.length()).map { habitsJson.getJSONObject(it).let { row -> Habit(row.getLong("id"), row.getString("name"), row.getString("kind"), row.getString("status")) } }, (0 until goalsJson.length()).map { goalsJson.getJSONObject(it).let { row -> WeeklyGoal(row.getLong("id"), row.getString("title"), row.getString("status")) } }, scores.getDouble("day"), scores.getDouble("week")) }
    suspend fun setHabitStatus(token: String, id: Long, status: String) = withContext(Dispatchers.IO) { request("/api/watch/toggle", "POST", token, JSONObject().put("habitId", id).put("date", LocalDate.now().toString()).put("status", status).toString()) }
    suspend fun setGoalStatus(token: String, id: Long, status: String) = withContext(Dispatchers.IO) { request("/api/watch/toggle", "POST", token, JSONObject().put("goalId", id).put("status", status).toString()) }
    private fun request(path: String, method: String, token: String?, body: String? = null): JSONObject {
        val connection = URL(BASE_URL + path).openConnection() as HttpURLConnection
        connection.requestMethod = method; connection.connectTimeout = 10_000; connection.readTimeout = 10_000; connection.setRequestProperty("Content-Type", "application/json")
        if (token != null) connection.setRequestProperty("Authorization", "Bearer $token")
        if (body != null) { connection.doOutput = true; connection.outputStream.use { it.write(body.toByteArray()) } }
        val status = connection.responseCode; val text = (if (status in 200..299) connection.inputStream else connection.errorStream).bufferedReader().use { it.readText() }; val json = JSONObject(text)
        if (status !in 200..299) throw IllegalStateException(json.optString("error", "Error de conexión")); return json
    }
}
