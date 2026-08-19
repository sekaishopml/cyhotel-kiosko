package com.hoteldelvalle.kiosco;

import android.content.Context;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import org.json.JSONException;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.Response;

public class RoomFragment extends Fragment {

    public interface OnRoomListener {
        void onRoomContinue(String product, RoomType room, String extraKey, Integer days);
        void onRoomBack();
        String getBaseUrl();
        String getSelectedProduct();
    }

    private OnRoomListener listener;
    private RecyclerView roomGrid;
    private ProgressBar loadingShimmer;
    private LinearLayout errorOverlay;
    private LinearLayout chipsWrap;
    private TextView tvTotal;
    private Button btnBack;
    private Button btnContinue;
    private LinearLayout dock;

    private RoomAdapter roomAdapter;
    private ChipAdapter chipAdapter;
    private List<RoomType> rooms = new ArrayList<>();
    private RoomType selectedRoom;
    private String selectedExtraKey;
    private Integer selectedDays;

    @Override
    public void onAttach(@NonNull Context context) {
        super.onAttach(context);
        listener = (OnRoomListener) context;
    }

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_room, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        setupStepsBar(view, 1);

        roomGrid = view.findViewById(R.id.roomGrid);
        loadingShimmer = view.findViewById(R.id.loadingShimmer);
        errorOverlay = view.findViewById(R.id.errorOverlay);
        chipsWrap = view.findViewById(R.id.chipsWrap);
        tvTotal = view.findViewById(R.id.tvTotal);
        btnBack = view.findViewById(R.id.btnBack);
        btnContinue = view.findViewById(R.id.btnContinue);
        dock = view.findViewById(R.id.dock);

        roomGrid.setLayoutManager(new GridLayoutManager(getContext(), 3));
        roomAdapter = new RoomAdapter(rooms, (room, position) -> {
            selectedRoom = room;
            setupChipsForRoom(room);
            updateTotal();
            btnContinue.setEnabled(true);
            btnContinue.setAlpha(1f);
        }, listener.getBaseUrl());
        roomGrid.setAdapter(roomAdapter);

        btnBack.setOnClickListener(v -> listener.onRoomBack());
        btnContinue.setOnClickListener(v -> {
            if (selectedRoom != null) {
                listener.onRoomContinue(
                        listener.getSelectedProduct(),
                        selectedRoom,
                        selectedExtraKey,
                        selectedDays);
            }
        });

        btnContinue.setEnabled(false);
        btnContinue.setAlpha(0.5f);

        loadRooms();
    }

    private void loadRooms() {
        loadingShimmer.setVisibility(View.VISIBLE);
        roomGrid.setVisibility(View.GONE);
        errorOverlay.setVisibility(View.GONE);

        ApiClient.getTypes(listener.getBaseUrl(), listener.getSelectedProduct(), new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                if (getActivity() == null) return;
                getActivity().runOnUiThread(() -> showError());
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                if (getActivity() == null) return;
                try {
                    String body = response.body() != null ? response.body().string() : "";
                    if (!response.isSuccessful()) {
                        getActivity().runOnUiThread(() -> showError());
                        return;
                    }
                    TypesResponse typesResponse = ApiClient.parseTypesResponse(body);
                    rooms.clear();
                    rooms.addAll(typesResponse.getTypes());
                    getActivity().runOnUiThread(() -> {
                        loadingShimmer.setVisibility(View.GONE);
                        roomGrid.setVisibility(View.VISIBLE);
                        roomAdapter.notifyDataSetChanged();
                    });
                } catch (JSONException e) {
                    getActivity().runOnUiThread(() -> showError());
                }
            }
        });
    }

    private void showError() {
        loadingShimmer.setVisibility(View.GONE);
        roomGrid.setVisibility(View.GONE);
        errorOverlay.setVisibility(View.VISIBLE);

        Button btnRetry = errorOverlay.findViewById(R.id.btnRetry);
        if (btnRetry != null) {
            btnRetry.setOnClickListener(v -> loadRooms());
        }
    }

    private void setupChipsForRoom(RoomType room) {
        chipsWrap.removeAllViews();
        selectedExtraKey = null;
        selectedDays = null;

        if (room.getExtras() != null && !room.getExtras().isEmpty()) {
            chipsWrap.setVisibility(View.VISIBLE);
            RecyclerView chipRecycler = new RecyclerView(getContext());
            chipRecycler.setLayoutParams(new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT));
            chipRecycler.setLayoutManager(new LinearLayoutManager(getContext(),
                    LinearLayoutManager.HORIZONTAL, false));
            chipAdapter = new ChipAdapter(room.getExtras(), chipKey -> {
                selectedExtraKey = chipKey;
                updateTotal();
            });
            chipRecycler.setAdapter(chipAdapter);
            chipsWrap.addView(chipRecycler);
        } else {
            chipsWrap.setVisibility(View.GONE);
        }

        if ("hospedaje".equals(listener.getSelectedProduct())) {
            chipsWrap.setVisibility(View.VISIBLE);
            setupDaysSelector();
        }
    }

    private void setupDaysSelector() {
        if (selectedRoom == null || selectedRoom.getPrice() == null) return;

        LinearLayout daysRow = new LinearLayout(getContext());
        daysRow.setLayoutParams(new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
        daysRow.setOrientation(LinearLayout.HORIZONTAL);
        daysRow.setGravity(android.view.Gravity.CENTER);

        for (int i = 1; i <= 7; i++) {
            final int days = i;
            TextView chip = new TextView(getContext());
            chip.setText(i + " día" + (i > 1 ? "s" : ""));
            chip.setTextSize(14);
            chip.setPadding(dpToPx(20), dpToPx(12), dpToPx(20), dpToPx(12));
            chip.setBackgroundResource(R.drawable.bg_chip_inactive);
            chip.setTextColor(0xFF143A2A);

            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
            lp.setMarginEnd(dpToPx(8));
            chip.setLayoutParams(lp);

            chip.setOnClickListener(v -> {
                selectedDays = days;
                selectedExtraKey = null;
                for (int j = 0; j < daysRow.getChildCount(); j++) {
                    TextView c = (TextView) daysRow.getChildAt(j);
                    c.setBackgroundResource(R.drawable.bg_chip_inactive);
                    c.setTextColor(0xFF143A2A);
                }
                chip.setBackgroundResource(R.drawable.bg_chip_active);
                chip.setTextColor(0xFFFFFFFF);
                updateTotal();
            });

            daysRow.addView(chip);
        }

        chipsWrap.addView(daysRow);
    }

    private void updateTotal() {
        if (selectedRoom == null || selectedRoom.getPrice() == null) {
            tvTotal.setText("");
            return;
        }
        int total = selectedRoom.getPrice();
        if (selectedExtraKey != null && selectedRoom.getExtras() != null) {
            Extra extra = selectedRoom.getExtras().get(selectedExtraKey);
            if (extra != null) {
                total += extra.getPrice();
            }
        } else if (selectedDays != null) {
            total = selectedRoom.getPrice() * selectedDays;
        }
        tvTotal.setText("Total: $" + total);
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
