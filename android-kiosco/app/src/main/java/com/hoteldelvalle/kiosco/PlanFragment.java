package com.hoteldelvalle.kiosco;

import android.content.Context;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

public class PlanFragment extends Fragment {

    public interface OnPlanSelectedListener {
        void onPlanSelected(Plan plan);
        void onContinueFromPlan();
    }

    private OnPlanSelectedListener listener;
    private RecyclerView planGrid;
    private Button btnContinue;
    private int selectedPosition = -1;

    public static final Plan[] PLANS = {
            new Plan("momento", "Momento", "3 horas", "M", 10, true, "El más pedido"),
            new Plan("amanecida", "Amanecida", "18:00 a 9:00", "A", 20, false, null),
            new Plan("hospedaje", "Hospedaje", "Múltiples días", "H", 30, false, null),
            new Plan("suite", "Suite Jacuzzi", "3 horas · Jacuzzi privado", "S", 20, false, null),
    };

    @Override
    public void onAttach(@NonNull Context context) {
        super.onAttach(context);
        listener = (OnPlanSelectedListener) context;
    }

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_plan, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        setupStepsBar(view, 0);

        planGrid = view.findViewById(R.id.planGrid);
        btnContinue = view.findViewById(R.id.btnContinue);
        TextView footer = view.findViewById(R.id.footer);

        planGrid.setLayoutManager(new GridLayoutManager(getContext(), 2));
        PlanAdapter adapter = new PlanAdapter(PLANS, position -> {
            selectedPosition = position;
            btnContinue.setEnabled(true);
            btnContinue.setAlpha(1f);
        });
        planGrid.setAdapter(adapter);

        btnContinue.setOnClickListener(v -> {
            if (selectedPosition >= 0) {
                listener.onPlanSelected(PLANS[selectedPosition]);
                listener.onContinueFromPlan();
            }
        });

        btnContinue.setEnabled(false);
        btnContinue.setAlpha(0.5f);
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
