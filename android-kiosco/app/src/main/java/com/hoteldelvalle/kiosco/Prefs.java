package com.hoteldelvalle.kiosco;

import android.content.Context;
import android.content.SharedPreferences;

public final class Prefs {

    private static final String NAME = "prefs";
    private static final String KEY_URL = "url";
    private static final String KEY_PIN = "pin";

    private final Context context;
    private final SharedPreferences sp;

    public Prefs(Context context) {
        this.context = context.getApplicationContext();
        sp = this.context.getSharedPreferences(NAME, Context.MODE_PRIVATE);
    }

    public String getUrl() {
        return sp.getString(KEY_URL, context.getString(R.string.default_url));
    }

    public void setUrl(String url) {
        sp.edit().putString(KEY_URL, url == null ? "" : url.trim()).apply();
    }

    public String getPin() {
        return sp.getString(KEY_PIN, context.getString(R.string.default_pin));
    }

    public void setPin(String pin) {
        sp.edit().putString(KEY_PIN, pin == null ? "" : pin.trim()).apply();
    }

    public boolean isConfigured() {
        return !sp.getString(KEY_URL, "").isEmpty();
    }
}
