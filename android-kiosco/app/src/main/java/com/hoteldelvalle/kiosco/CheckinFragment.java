package com.hoteldelvalle.kiosco;

import android.content.Context;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import org.json.JSONException;

import java.io.IOException;
import java.util.UUID;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.Response;

public class CheckinFragment extends Fragment {

    public interface OnCheckinListener {
        void onCheckinBack();
        void onCheckinConfirmed(String product, RoomType room, String extraKey,
                                Integer days, String guestName, String idDocument);
        String getBaseUrl();
        String getSelectedProduct();
        RoomType getSelectedRoom();
        String getSelectedExtra();
        Integer getSelectedDays();
    }

    private OnCheckinListener listener;
    private TextView sumPlan;
    private TextView sumRoom;
    private TextView sumDuration;
    private TextView sumTotal;
    private EditText etGuestName;
    private EditText etIdDocument;
    private TextView errorBox;
    private Button btnBack;
    private Button btnConfirm;

    @Override
    public void onAttach(@NonNull Context context) {
        super.onAttach(context);
        listener = (OnCheckinListener) context;
    }

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_checkin, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        setupStepsBar(view, 2);

        sumPlan = view.findViewById(R.id.sumPlan);
        sumRoom = view.findViewById(R.id.sumRoom);
        sumDuration = view.findViewById(R.id.sumDuration);
        sumTotal = view.findViewById(R.id.sumTotal);
        etGuestName = view.findViewById(R.id.etGuestName);
        etIdDocument = view.findViewById(R.id.etIdDocument);
        errorBox = view.findViewById(R.id.errorBox);
        btnBack = view.findViewById(R.id.btnBack);
        btnConfirm = view.findViewById(R.id.btnConfirm);

        populateSummary();

        btnBack.setOnClickListener(v -> listener.onCheckinBack());
        btnConfirm.setOnClickListener(v -> attemptConfirm());
    }

    private void populateSummary() {
        String product = listener.getSelectedProduct();
        RoomType room = listener.getSelectedRoom();
        if (room == null) return;

        // Find plan name
        String planName = product;
        for (Plan p : PlanFragment.PLANS) {
            if (p.getKey().equals(product)) {
                planName = p.getName();
                break;
            }
        }
        sumPlan.setText(planName);
        sumRoom.setText(room.getLabel());

        String duration = room.getLabel();
        if (listener.getSelectedExtra() != null && room.getExtras() != null) {
            Extra extra = room.getExtras().get(listener.getSelectedExtra());
            if (extra != null) {
                duration = extra.getLabel();
            }
        }
        sumDuration.setText(duration);

        int total = room.getPrice() != null ? room.getPrice() : 0;
        if (listener.getSelectedExtra() != null && room.getExtras() != null) {
            Extra extra = room.getExtras().get(listener.getSelectedExtra());
            if (extra != null) {
                total += extra.getPrice();
            }
        }
        sumTotal.setText("$" + total);
    }

    private void attemptConfirm() {
        String guestName = etGuestName.getText().toString().trim();
        if (guestName.isEmpty()) {
            errorBox.setVisibility(View.VISIBLE);
            errorBox.setText("El nombre del huésped es obligatorio");
            return;
        }

        errorBox.setVisibility(View.GONE);
        btnConfirm.setEnabled(false);

        String idDocument = etIdDocument.getText().toString().trim();
        String clientRef = System.currentTimeMillis() + "-" + UUID.randomUUID().toString().substring(0, 8);

        OrderRequest request = new OrderRequest(
                listener.getSelectedProduct(),
                listener.getSelectedRoom().getKey(),
                guestName,
                idDocument,
                clientRef,
                listener.getSelectedExtra(),
                listener.getSelectedDays());

        ApiClient.createOrder(listener.getBaseUrl(), request, new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                if (getActivity() == null) return;
                getActivity().runOnUiThread(() -> {
                    btnConfirm.setEnabled(true);
                    errorBox.setVisibility(View.VISIBLE);
                    errorBox.setText("Error de conexión: " + e.getMessage());
                });
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                if (getActivity() == null) return;
                try {
                    String body = response.body() != null ? response.body().string() : "";
                    if (!response.isSuccessful()) {
                        ApiError apiError = ApiClient.parseError(body);
                        getActivity().runOnUiThread(() -> {
                            btnConfirm.setEnabled(true);
                            errorBox.setVisibility(View.VISIBLE);
                            errorBox.setText(apiError.getError());
                        });
                        return;
                    }
                    OrderResponse orderResponse = ApiClient.parseOrderResponse(body);
                    Order order = orderResponse.getOrder();
                    getActivity().runOnUiThread(() ->
                            listener.onCheckinConfirmed(
                                    listener.getSelectedProduct(),
                                    listener.getSelectedRoom(),
                                    listener.getSelectedExtra(),
                                    listener.getSelectedDays(),
                                    guestName,
                                    idDocument));
                } catch (JSONException e) {
                    getActivity().runOnUiThread(() -> {
                        btnConfirm.setEnabled(true);
                        errorBox.setVisibility(View.VISIBLE);
                        errorBox.setText("Error al procesar la respuesta");
                    });
                }
            }
        });
    }

    private void setupStepsBar(View view, int activeStep) {
        LinearLayout stepsBar = view.findViewById(R.id.stepsBar);
        if (stepsBar == null) return;
        stepsBar.removeAllViews();

        String[] labels = {"Plan", "Habitación", "Check-in"};

        for (int i = 0; i < 3; i++) {
            View step = LayoutInflater.from(getContext())
                    .inflate(R.layout.step_item, stepsBar, false);

            View dot = step.findViewById(R.id.stepDot);
            TextView label = step.findViewById(R.id.stepLabel);
            label.setText(labels[i]);

            if (i < activeStep) {
                dot.setBackgroundResource(R.drawable.bg_step_completed);
                label.setTextColor(0xFF3E9A63);
            } else if (i == activeStep) {
                dot.setBackgroundResource(R.drawable.bg_step_active);
                label.setTextColor(0xFF143A2A);
            } else {
                dot.setBackgroundResource(R.drawable.bg_step_pending);
                label.setTextColor(0xFF999999);
            }

            stepsBar.addView(step);

            if (i < 2) {
                View line = new View(getContext());
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                        0, dpToPx(2), 1f);
                lp.setMargins(dpToPx(4), 0, dpToPx(4), 0);
                line.setLayoutParams(lp);
                line.setBackgroundColor(0x24143A2A);
                stepsBar.addView(line);
            }
        }
    }

    private int dpToPx(int dp) {
        return Math.round(dp * getResources().getDisplayMetrics().density);
    }

    @Override
    public void onDetach() {
        super.onDetach();
        listener = null;
    }
}
