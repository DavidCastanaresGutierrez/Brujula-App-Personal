package com.brujula.wear

import android.content.Context
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.material3.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate

private const val BASE_URL = "https://brujula-app-personal.vercel.app"
data class Habit(val id: Long, val name: String, val completed: Boolean)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) { super.onCreate(savedInstanceState); setContent { BrujulaApp(this) } }
}

@Composable
fun BrujulaApp(context: Context) {
    val prefs = remember { securePrefs(context) }
    var token by remember { mutableStateOf(prefs.getString("device_token", null)) }
    MaterialTheme { Box(Modifier.fillMaxSize().background(Color(0xFF061411))) {
        if (token == null) PairScreen { code -> Api.redeem(code).also { prefs.edit().putString("device_token", it).apply(); token = it } }
        else HabitsScreen(token!!, onUnlink = { prefs.edit().clear().apply(); token = null })
    } }
}

@Composable
private fun PairScreen(onPair: suspend (String) -> Unit) {
    var code by remember { mutableStateOf("") }; var error by remember { mutableStateOf("") }; var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    ScalingLazyColumn(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        item { Text("BRÚJULA", color = Color(0xFF65D9BA), fontWeight = FontWeight.Bold) }
        item { Text("Vincular reloj", fontSize = 20.sp, fontWeight = FontWeight.Bold) }
        item { Text("Genera un código en\nbrujula-app-personal.vercel.app/watch-connect", textAlign = TextAlign.Center, fontSize = 12.sp) }
        item { androidx.compose.material3.OutlinedTextField(value = code, onValueChange = { value -> code = value.filter(Char::isDigit).take(6) }, label = { androidx.compose.material3.Text("Código") }, keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true, modifier = Modifier.fillMaxWidth(.82f)) }
        if (error.isNotEmpty()) item { Text(error, color = Color(0xFFFF9F9F), textAlign = TextAlign.Center, fontSize = 12.sp) }
        item { Button(onClick = { scope.launch { busy = true; error = try { onPair(code); "" } catch (e: Exception) { e.message ?: "No se ha podido vincular" }; busy = false } }, enabled = code.length == 6 && !busy) { Text(if (busy) "Vinculando…" else "Vincular") } }
    }
}

@Composable
private fun HabitsScreen(token: String, onUnlink: () -> Unit) {
    var habits by remember { mutableStateOf<List<Habit>>(emptyList()) }; var loading by remember { mutableStateOf(true) }; var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    suspend fun refresh() { loading = true; error = try { habits = Api.today(token); "" } catch (e: Exception) { e.message ?: "Sin conexión" }; loading = false }
    LaunchedEffect(token) { refresh() }
    ScalingLazyColumn(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally) {
        item { Text("HOY", color = Color(0xFF65D9BA), fontWeight = FontWeight.Bold) }
        if (loading) item { CircularProgressIndicator() }
        if (error.isNotEmpty()) item { Text(error, color = Color(0xFFFFC07A), textAlign = TextAlign.Center) }
        if (!loading && habits.isEmpty() && error.isEmpty()) item { Text("No tienes hábitos para hoy", textAlign = TextAlign.Center) }
        items(habits, key = { it.id }) { habit ->
            Button(onClick = { val next = !habit.completed; habits = habits.map { if (it.id == habit.id) it.copy(completed = next) else it }; scope.launch { try { Api.toggle(token, habit.id, next) } catch (e: Exception) { habits = habits.map { if (it.id == habit.id) it.copy(completed = !next) else it }; error = e.message ?: "No se ha podido guardar" } } }, colors = ButtonDefaults.buttonColors(containerColor = if (habit.completed) Color(0xFF266F5E) else Color(0xFF162823)), modifier = Modifier.fillMaxWidth(.9f)) {
                Text((if (habit.completed) "✓  " else "○  ") + habit.name, maxLines = 2)
            }
        }
        item { Button(onClick = { scope.launch { refresh() } }) { Text("Actualizar") } }
        item { TextButton(onClick = onUnlink) { Text("Desvincular", color = Color(0xFF9CB5AE), fontSize = 11.sp) } }
    }
}

private fun securePrefs(context: Context) = EncryptedSharedPreferences.create(context, "brujula_watch", MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(), EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV, EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM)

private object Api {
    suspend fun redeem(code: String) = withContext(Dispatchers.IO) { request("/api/watch/redeem", "POST", null, JSONObject().put("code", code).put("name", "Galaxy Watch 6").toString()).getString("token") }
    suspend fun today(token: String) = withContext(Dispatchers.IO) { val json = request("/api/watch/today?date=${LocalDate.now()}", "GET", token); val array = json.getJSONArray("habits"); (0 until array.length()).map { array.getJSONObject(it).let { row -> Habit(row.getLong("id"), row.getString("name"), row.getBoolean("completed")) } } }
    suspend fun toggle(token: String, id: Long, completed: Boolean) = withContext(Dispatchers.IO) { request("/api/watch/toggle", "POST", token, JSONObject().put("habitId", id).put("date", LocalDate.now().toString()).put("completed", completed).toString()) }
    private fun request(path: String, method: String, token: String?, body: String? = null): JSONObject {
        val connection = URL(BASE_URL + path).openConnection() as HttpURLConnection
        connection.requestMethod = method; connection.connectTimeout = 10_000; connection.readTimeout = 10_000; connection.setRequestProperty("Content-Type", "application/json")
        if (token != null) connection.setRequestProperty("Authorization", "Bearer $token")
        if (body != null) { connection.doOutput = true; connection.outputStream.use { it.write(body.toByteArray()) } }
        val status = connection.responseCode; val text = (if (status in 200..299) connection.inputStream else connection.errorStream).bufferedReader().use { it.readText() }; val json = JSONObject(text)
        if (status !in 200..299) throw IllegalStateException(json.optString("error", "Error de conexión")); return json
    }
}
