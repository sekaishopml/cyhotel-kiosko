package com.hoteldelvalle.kiosco;

import android.app.AlertDialog;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentTransaction;

import java.util.UUID;

public class MainActivity extends AppCompatActivity
        implements PlanFragment.OnPlanSelectedListener,
        RoomFragment.OnRoomListener,
        CheckinFragment.OnCheckinListener {

    private FrameLayout container;
    private TextView btnAdmin;
    private Prefs prefs;

    private Plan selectedPlan;
    private RoomType selectedRoom;
    private String selectedExtra;
    private Integer selectedDays;
    private int adminTapCount = 0;
    private long lastTapTime = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        KioskManager.enableKioskMode(this);

        container = findViewById(R.id.container);
        btnAdmin = findViewById(R.id.btnAdmin);
        prefs = new Prefs(this);

        btnAdmin.setOnClickListener(v -> handleAdminTap());

        if (!prefs.isConfigured()) {
            startActivity(new Intent(this, SettingsActivity.class));
        } else {
            loadFragment(new PlanFragment());
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        KioskManager.enableKioskMode(this);
    }

    private void handleAdminTap() {
        long now = System.currentTimeMillis();
        if (now - lastTapTime > 2000) {
            adminTapCount = 0;
        }
        lastTapTime = now;
        adminTapCount++;

        if (adminTapCount >= 5) {
            adminTapCount = 0;
            showPinDialog();
        }
    }

    private void showPinDialog() {
        EditText input = new EditText(this);
        input.setHint("PIN");
        input.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);

        new AlertDialog.Builder(this)
                .setTitle("Acceso admin")
                .setView(input)
                .setPositiveButton("OK", (dialog, which) -> {
                    String pin = input.getText().toString();
                    if (pin.equals(prefs.getPin())) {
                        showAdminOptions();
                    } else {
                        Toast.makeText(this, "PIN incorrecto", Toast.LENGTH_SHORT).show();
                    }
                })
                .setNegativeButton("Cancelar", null)
                .show();
    }

    private void showAdminOptions() {
        String[] options = {"Configurar servidor", "Salir del quiosco"};
        new AlertDialog.Builder(this)
                .setTitle("Admin")
                .setItems(options, (dialog, which) -> {
                    if (which == 0) {
                        startActivity(new Intent(this, SettingsActivity.class));
                    } else {
                        finish();
                    }
                })
                .show();
    }

    private void loadFragment(Fragment fragment) {
        FragmentTransaction ft = getSupportFragmentManager().beginTransaction();
        ft.replace(R.id.container, fragment);
        ft.commit();
    }

    @Override
    public void onPlanSelected(Plan plan) {
        selectedPlan = plan;
        selectedRoom = null;
        selectedExtra = null;
        selectedDays = null;
    }

    @Override
    public void onContinueFromPlan() {
        loadFragment(new RoomFragment());
    }

    @Override
    public void onRoomContinue(String product, RoomType room, String extraKey, Integer days) {
        selectedRoom = room;
        selectedExtra = extraKey;
        selectedDays = days;
        loadFragment(new CheckinFragment());
    }

    @Override
    public void onRoomBack() {
        loadFragment(new PlanFragment());
    }

    @Override
    public void onCheckinBack() {
        loadFragment(new RoomFragment());
    }

    @Override
    public void onCheckinConfirmed(String product, RoomType room, String extraKey,
                                   Integer days, String guestName, String idDocument) {
        showConfirmationModal();
    }

    @Override
    public String getBaseUrl() {
        return prefs.getBaseUrl();
    }

    @Override
    public String getSelectedProduct() {
        return selectedPlan != null ? selectedPlan.getKey() : null;
    }

    @Override
    public RoomType getSelectedRoom() {
        return selectedRoom;
    }

    @Override
    public String getSelectedExtra() {
        return selectedExtra;
    }

    @Override
    public Integer getSelectedDays() {
        return selectedDays;
    }

    private void showConfirmationModal() {
        View modalView = getLayoutInflater().inflate(R.layout.modal_confirmation, null);

        TextView tvModalRoom = modalView.findViewById(R.id.tvModalRoom);
        TextView tvModalCheckIn = modalView.findViewById(R.id.tvModalCheckIn);
        TextView tvModalCheckOut = modalView.findViewById(R.id.tvModalCheckOut);
        TextView tvModalAmount = modalView.findViewById(R.id.tvModalAmount);
        Button btnModalClose = modalView.findViewById(R.id.btnModalClose);
        View modalBg = modalView.findViewById(R.id.modalBg);

        if (selectedRoom != null) {
            tvModalRoom.setText("Habitación: " + selectedRoom.getLabel());
            int total = selectedRoom.getPrice() != null ? selectedRoom.getPrice() : 0;
            if (selectedExtra != null && selectedRoom.getExtras() != null) {
                Extra extra = selectedRoom.getExtras().get(selectedExtra);
                if (extra != null) total += extra.getPrice();
            }
            tvModalAmount.setText("Monto: $" + total);
        }

        tvModalCheckIn.setText("Check-in: Ahora");
        tvModalCheckOut.setText("Check-out: Pendiente");

        LinearLayout overlay = new LinearLayout(this);
        overlay.setLayoutParams(new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
        overlay.setGravity(android.view.Gravity.CENTER);
        overlay.addView(modalView);

        container.addView(overlay);

        btnModalClose.setOnClickListener(v -> {
            container.removeView(overlay);
            resetState();
            loadFragment(new PlanFragment());
        });

        modalBg.setOnClickListener(v -> {
            container.removeView(overlay);
            resetState();
            loadFragment(new PlanFragment());
        });
    }

    private void resetState() {
        selectedPlan = null;
        selectedRoom = null;
        selectedExtra = null;
        selectedDays = null;
    }
}
