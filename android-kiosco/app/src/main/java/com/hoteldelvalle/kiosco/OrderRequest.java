package com.hoteldelvalle.kiosco;

import org.json.JSONException;
import org.json.JSONObject;

public class OrderRequest {
    private final String product;
    private final String roomType;
    private final String guestName;
    private final String idDocument;
    private final String clientRef;
    private final String extra;
    private final Integer days;

    public OrderRequest(String product, String roomType, String guestName,
                        String idDocument, String clientRef, String extra, Integer days) {
        this.product = product;
        this.roomType = roomType;
        this.guestName = guestName;
        this.idDocument = idDocument;
        this.clientRef = clientRef;
        this.extra = extra;
        this.days = days;
    }

    public String getProduct() { return product; }
    public String getRoomType() { return roomType; }
    public String getGuestName() { return guestName; }
    public String getIdDocument() { return idDocument; }
    public String getClientRef() { return clientRef; }
    public String getExtra() { return extra; }
    public Integer getDays() { return days; }

    public JSONObject toJson() throws JSONException {
        JSONObject obj = new JSONObject();
        obj.put("product", product);
        obj.put("room_type", roomType);
        obj.put("guest_name", guestName);
        obj.put("client_ref", clientRef);
        if (idDocument != null && !idDocument.isEmpty()) {
            obj.put("id_document", idDocument);
        }
        if (extra != null && !extra.isEmpty()) {
            obj.put("extra", extra);
        }
        if (days != null) {
            obj.put("days", days);
        }
        return obj;
    }
}
