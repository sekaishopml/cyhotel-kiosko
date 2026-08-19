package com.hoteldelvalle.kiosco;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import java.util.List;

public class RoomAdapter extends RecyclerView.Adapter<RoomAdapter.ViewHolder> {

    public interface OnRoomClickListener {
        void onRoomClick(RoomType room, int position);
    }

    private final List<RoomType> rooms;
    private final OnRoomClickListener listener;
    private int selectedPosition = -1;
    private String baseUrl;

    public RoomAdapter(List<RoomType> rooms, OnRoomClickListener listener, String baseUrl) {
        this.rooms = rooms;
        this.listener = listener;
        this.baseUrl = baseUrl;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_room, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        RoomType room = rooms.get(position);
        holder.tvRoomName.setText(room.getLabel());
        holder.tvRoomPrice.setText(room.getPrice() != null ? "$" + room.getPrice() : "");
        holder.tvRoomFree.setText(room.getFree() + " libres");

        if (room.getPhoto() != null && !room.getPhoto().isEmpty()) {
            String fullUrl = baseUrl + room.getPhoto();
            com.bumptech.glide.Glide.with(holder.itemView.getContext())
                    .load(fullUrl)
                    .centerCrop()
                    .placeholder(R.drawable.placeholder_room)
                    .into(holder.roomPhoto);
        } else {
            holder.roomPhoto.setImageResource(R.drawable.placeholder_room);
        }

        boolean isSelected = position == selectedPosition;
        holder.itemView.setSelected(isSelected);

        if (isSelected) {
            holder.itemView.setBackgroundResource(R.drawable.bg_room_selected);
            holder.tvRoomName.setTextColor(0xFFFFFFFF);
            holder.tvRoomPrice.setTextColor(0xFFFFFFFF);
            holder.tvRoomFree.setTextColor(0xCCFFFFFF);
        } else {
            holder.itemView.setBackgroundResource(R.drawable.bg_room_card);
            holder.tvRoomName.setTextColor(0xFF10281D);
            holder.tvRoomPrice.setTextColor(0xFF143A2A);
            holder.tvRoomFree.setTextColor(0xFF143A2A);
        }

        holder.itemView.setOnClickListener(v -> {
            int prev = selectedPosition;
            selectedPosition = holder.getAdapterPosition();
            if (prev >= 0) notifyItemChanged(prev);
            notifyItemChanged(selectedPosition);
            listener.onRoomClick(room, selectedPosition);
        });
    }

    @Override
    public int getItemCount() {
        return rooms.size();
    }

    public int getSelectedPosition() {
        return selectedPosition;
    }

    public RoomType getSelectedRoom() {
        if (selectedPosition >= 0 && selectedPosition < rooms.size()) {
            return rooms.get(selectedPosition);
        }
        return null;
    }

    public void clearSelection() {
        int prev = selectedPosition;
        selectedPosition = -1;
        if (prev >= 0) notifyItemChanged(prev);
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        final android.widget.ImageView roomPhoto;
        final TextView tvRoomName;
        final TextView tvRoomPrice;
        final TextView tvRoomFree;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            roomPhoto = itemView.findViewById(R.id.roomPhoto);
            tvRoomName = itemView.findViewById(R.id.tvRoomName);
            tvRoomPrice = itemView.findViewById(R.id.tvRoomPrice);
            tvRoomFree = itemView.findViewById(R.id.tvRoomFree);
        }
    }
}
