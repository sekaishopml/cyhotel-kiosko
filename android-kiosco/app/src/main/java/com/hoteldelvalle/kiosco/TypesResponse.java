package com.hoteldelvalle.kiosco;

import java.util.List;

public class TypesResponse {
    private final String product;
    private final List<RoomType> types;

    public TypesResponse(String product, List<RoomType> types) {
        this.product = product;
        this.types = types;
    }

    public String getProduct() { return product; }
    public List<RoomType> getTypes() { return types; }
}
