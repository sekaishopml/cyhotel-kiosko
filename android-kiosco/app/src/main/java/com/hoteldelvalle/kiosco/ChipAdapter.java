package com.hoteldelvalle.kiosco;

import android.graphics.Color;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.util.List;
import java.util.Map;

public class ChipAdapter extends RecyclerView.Adapter<ChipAdapter.ViewHolder> {

    public interface OnChipClickListener {
        void onChipClick(String chipKey);
    }

    private final Map<String, Extra> extras;
    private final OnChipClickListener listener;
    private String selectedKey = null;

    public ChipAdapter(Map<String, Extra> extras, OnChipClickListener listener) {
        this.extras = extras;
        this.listener = listener;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_chip, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        String key = (String) extras.keySet().toArray()[position];
        Extra extra = extras.get(key);
        holder.tvChip.setText(extra.getLabel() + " (+$" + extra.getPrice() + ")");

        boolean isSelected = key.equals(selectedKey);
        if (isSelected) {
            holder.tvChip.setBackgroundResource(R.drawable.bg_chip_active);
            holder.tvChip.setTextColor(Color.WHITE);
        } else {
            holder.tvChip.setBackgroundResource(R.drawable.bg_chip_inactive);
            holder.tvChip.setTextColor(0xFF143A2A);
        }

        holder.tvChip.setOnClickListener(v -> {
            if (key.equals(selectedKey)) {
                selectedKey = null;
            } else {
                selectedKey = key;
            }
            notifyDataSetChanged();
            listener.onChipClick(selectedKey);
        });
    }

    @Override
    public int getItemCount() {
        return extras != null ? extras.size() : 0;
    }

    public String getSelectedKey() {
        return selectedKey;
    }

    public void clearSelection() {
        selectedKey = null;
        notifyDataSetChanged();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        final TextView tvChip;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvChip = itemView.findViewById(R.id.tvChip);
        }
    }
}
