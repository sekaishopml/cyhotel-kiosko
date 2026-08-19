package com.hoteldelvalle.kiosco;

public class Extra {
    private final String label;
    private final int price;

    public Extra(String label, int price) {
        this.label = label;
        this.price = price;
    }

    public String getLabel() { return label; }
    public int getPrice() { return price; }
}
