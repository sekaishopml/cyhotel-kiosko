package com.hoteldelvalle.kiosco;

public class Plan {
    private final String key;
    private final String name;
    private final String subtitle;
    private final String icon;
    private final int price;
    private final boolean hero;
    private final String badge;

    public Plan(String key, String name, String subtitle, String icon, int price, boolean hero, String badge) {
        this.key = key;
        this.name = name;
        this.subtitle = subtitle;
        this.icon = icon;
        this.price = price;
        this.hero = hero;
        this.badge = badge;
    }

    public String getKey() { return key; }
    public String getName() { return name; }
    public String getSubtitle() { return subtitle; }
    public String getIcon() { return icon; }
    public int getPrice() { return price; }
    public boolean isHero() { return hero; }
    public String getBadge() { return badge; }
}
