package com.hoteldelvalle.kiosco;

public class OrderResponse {
    private final Order order;

    public OrderResponse(Order order) {
        this.order = order;
    }

    public Order getOrder() { return order; }
}
