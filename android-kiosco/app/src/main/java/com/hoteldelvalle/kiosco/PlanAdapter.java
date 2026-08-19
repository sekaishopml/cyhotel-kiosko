package com.hoteldelvalle.kiosco;

import android.graphics.Color;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

public class PlanAdapter extends RecyclerView.Adapter<PlanAdapter.ViewHolder> {

    public interface OnPlanClickListener {
        void onPlanClick(int position);
    }

    private final Plan[] plans;
    private final OnPlanClickListener listener;
    private int selectedPosition = -1;

    public PlanAdapter(Plan[] plans, OnPlanClickListener listener) {
        this.plans = plans;
        this.listener = listener;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_plan, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Plan plan = plans[position];

        holder.tvName.setText(plan.getName().toUpperCase());
        holder.tvSubtitle.setText(plan.getSubtitle());
        holder.tvIcon.setText(plan.getIcon());

        if (plan.getBadge() != null && !plan.getBadge().isEmpty()) {
            holder.tvBadge.setVisibility(View.VISIBLE);
            holder.tvBadge.setText(plan.getBadge());
        } else {
            holder.tvBadge.setVisibility(View.GONE);
        }

        boolean isSelected = position == selectedPosition;

        if (plan.isHero()) {
            holder.itemView.setBackgroundResource(R.drawable.bg_plan_hero);
            holder.tvName.setTextColor(Color.WHITE);
            holder.tvSubtitle.setTextColor(0xCCFFFFFF);
            holder.tvIcon.setBackgroundResource(R.drawable.bg_icon_hero);
            holder.tvIcon.setTextColor(Color.WHITE);
        } else if (isSelected) {
            holder.itemView.setBackgroundResource(R.drawable.bg_plan_selected);
            holder.tvName.setTextColor(Color.WHITE);
            holder.tvSubtitle.setTextColor(0xCCFFFFFF);
            holder.tvIcon.setBackgroundResource(R.drawable.bg_icon_selected);
            holder.tvIcon.setTextColor(Color.WHITE);
        } else {
            holder.itemView.setBackgroundResource(R.drawable.bg_plan_card);
            holder.tvName.setTextColor(0xFF143A2A);
            holder.tvSubtitle.setTextColor(0x99143A2A);
            holder.tvIcon.setBackgroundResource(R.drawable.bg_icon_default);
            holder.tvIcon.setTextColor(0xFF143A2A);
        }

        holder.itemView.setOnClickListener(v -> {
            int prev = selectedPosition;
            selectedPosition = holder.getAdapterPosition();
            if (prev >= 0) notifyItemChanged(prev);
            notifyItemChanged(selectedPosition);
            listener.onPlanClick(selectedPosition);
        });
    }

    @Override
    public int getItemCount() {
        return plans.length;
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        final TextView tvName;
        final TextView tvSubtitle;
        final TextView tvIcon;
        final TextView tvBadge;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvName = itemView.findViewById(R.id.tvName);
            tvSubtitle = itemView.findViewById(R.id.tvSubtitle);
            tvIcon = itemView.findViewById(R.id.ivIcon);
            tvBadge = itemView.findViewById(R.id.tvBadge);
        }
    }
}
