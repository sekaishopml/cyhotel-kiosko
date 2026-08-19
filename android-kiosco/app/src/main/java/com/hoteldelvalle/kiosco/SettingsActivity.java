package com.hoteldelvalle.kiosco;

import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

public class SettingsActivity extends AppCompatActivity {

    private EditText etUrl;
    private EditText etPin;
    private Prefs prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_settings);

        prefs = new Prefs(this);

        etUrl = findViewById(R.id.etUrl);
        etPin = findViewById(R.id.etPin);
        Button btnSave = findViewById(R.id.btnSave);
        Button btnCancel = findViewById(R.id.btnCancel);

        etUrl.setText(prefs.getBaseUrl());
        etPin.setText(prefs.getPin());

        btnSave.setOnClickListener(v -> {
            String url = etUrl.getText().toString().trim();
            String pin = etPin.getText().toString().trim();

            if (url.isEmpty()) {
                etUrl.setError("URL es obligatoria");
                return;
            }
            if (pin.isEmpty()) {
                etPin.setError("PIN es obligatorio");
                return;
            }

            prefs.setBaseUrl(url);
            prefs.setPin(pin);
            Toast.makeText(this, "Configuración guardada", Toast.LENGTH_SHORT).show();
            finish();
        });

        btnCancel.setOnClickListener(v -> finish());
    }
}
