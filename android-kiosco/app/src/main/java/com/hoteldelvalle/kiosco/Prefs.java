package com.hoteldelvalle.kiosco;

import android.content.Context;
import android.content.SharedPreferences;

public class Prefs {
    private static final String NAME = "kiosko_prefs";
    private static final String KEY_BASE_URL = "base_url";
    private static final String KEY_PIN = "pin";
    private static final String DEFAULT_BASE_URL = "http://68.168.20.219:8000";
    private static final String DEFAULT_PIN = "12345";

    private final SharedPreferences prefs;

    public Prefs(Context context) {
        prefs = context.getSharedPreferences(NAME, Context.MODE_PRIVATE);
    }

    public String getBaseUrl() {
        return prefs.getString(KEY_BASE_URL, DEFAULT_BASE_URL);
    }

    public void setBaseUrl(String url) {
        prefs.edit().putString(KEY_BASE_URL, url).apply();
    }

    public String getPin() {
        return prefs.getString(KEY_PIN, DEFAULT_PIN);
    }

    public void setPin(String pin) {
        prefs.edit().putString(KEY_PIN, pin).apply();
    }

    public boolean isConfigured() {
        return prefs.contains(KEY_BASE_URL);
    }
}
