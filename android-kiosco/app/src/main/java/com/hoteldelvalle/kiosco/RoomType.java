package com.hoteldelvalle.kiosco;

import java.util.Map;

public class RoomType {
    private final String key;
    private final String label;
    private final String desc;
    private final String photo;
    private final Integer price;
    private final int free;
    private final boolean eligible;
    private final String reason;
    private final Map<String, Extra> extras;

    public RoomType(String key, String label, String desc, String photo,
                    Integer price, int free, boolean eligible, String reason,
                    Map<String, Extra> extras) {
        this.key = key;
        this.label = label;
        this.desc = desc;
        this.photo = photo;
        this.price = price;
        this.free = free;
        this.eligible = eligible;
        this.reason = reason;
        this.extras = extras;
    }

    public String getKey() { return key; }
    public String getLabel() { return label; }
    public String getDesc() { return desc; }
    public String getPhoto() { return photo; }
    public Integer getPrice() { return price; }
    public int getFree() { return free; }
    public boolean isEligible() { return eligible; }
    public String getReason() { return reason; }
    public Map<String, Extra> getExtras() { return extras; }
}
