// Dep: DataStore Preferences 1.1.1
package com.hoteldelvalle.kiosco.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "kiosko_prefs")

class Prefs(private val context: Context) {

    private val KEY_URL = stringPreferencesKey("server_url")
    private val KEY_PIN = stringPreferencesKey("pin")

    val serverUrl: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[KEY_URL] ?: DEFAULT_URL
    }

    val pin: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[KEY_PIN] ?: DEFAULT_PIN
    }

    suspend fun setUrl(url: String) {
        context.dataStore.edit { it[KEY_URL] = url }
    }

    suspend fun setPin(pin: String) {
        context.dataStore.edit { it[KEY_PIN] = pin }
    }

    companion object {
        const val DEFAULT_URL = "http://68.168.20.219:8000"
        const val DEFAULT_PIN = "12345"
    }
}
