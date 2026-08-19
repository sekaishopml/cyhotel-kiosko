package com.hoteldelvalle.kiosco;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;

public class SettingsActivity extends Activity {

    private static final int TIMEOUT_MS = 8000;

    private EditText etUrl;
    private EditText etPin;
    private TextView tvStatus;
    private Prefs prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_settings);
        setTitle(R.string.settings_title);
        prefs = new Prefs(this);

        etUrl = findViewById(R.id.etUrl);
        etPin = findViewById(R.id.etPin);
        tvStatus = findViewById(R.id.tvStatus);
        Button btnTest = findViewById(R.id.btnTest);
        Button btnSave = findViewById(R.id.btnSave);

        etUrl.setText(prefs.getUrl());
        etPin.setHint(getString(R.string.hint_pin, prefs.getPin()));

        btnTest.setOnClickListener(v -> testConnection());
        btnSave.setOnClickListener(v -> saveSettings());
    }

    private void testConnection() {
        final String url = etUrl.getText().toString().trim();
        if (url.isEmpty()) {
            setStatus(getString(R.string.status_fail), true);
            return;
        }
        tvStatus.setText(R.string.status_testing);
        tvStatus.setTextColor(Color.GRAY);
        Thread thread = new Thread(() -> {
            TestResult result = test(url);
            runOnUiThread(() -> setStatus(result.message, result.error));
        });
        thread.setDaemon(true);
        thread.start();
    }

    private TestResult test(String url) {
        try {
            HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(TIMEOUT_MS);
            conn.setReadTimeout(TIMEOUT_MS);
            int code = conn.getResponseCode();
            conn.disconnect();
            if (code >= 200 && code < 400) {
                return new TestResult(getString(R.string.status_ok), false);
            }
            return new TestResult(getString(R.string.status_fail) + " HTTP " + code, true);
        } catch (IOException e) {
            return new TestResult(getString(R.string.status_fail) + ": " + e.getMessage(), true);
        }
    }

    private static final class TestResult {
        final String message;
        final boolean error;

        TestResult(String message, boolean error) {
            this.message = message;
            this.error = error;
        }
    }

    private void setStatus(String message, boolean error) {
        tvStatus.setText(message);
        tvStatus.setTextColor(error ? Color.RED : Color.GREEN);
    }

    private void saveSettings() {
        prefs.setUrl(etUrl.getText().toString().trim());
        prefs.setPin(etPin.getText().toString().trim());
        setStatus(getString(R.string.status_saved), false);
        finish();
    }
}
