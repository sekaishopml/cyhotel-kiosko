package com.hoteldelvalle.kiosco;

import android.content.Context;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class ApiClient {

    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");

    private static final OkHttpClient client = new OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build();

    public static void getTypes(String baseUrl, String product, Callback callback) {
        String url = baseUrl + "/api/types?product=" + product;
        Request request = new Request.Builder().url(url).get().build();
        client.newCall(request).enqueue(callback);
    }

    public static void createOrder(String baseUrl, OrderRequest orderRequest, Callback callback) {
        try {
            String url = baseUrl + "/api/orders";
            RequestBody body = RequestBody.create(orderRequest.toJson().toString(), JSON);
            Request request = new Request.Builder()
                    .url(url)
                    .post(body)
                    .build();
            client.newCall(request).enqueue(callback);
        } catch (JSONException e) {
            callback.onFailure(null, new IOException("JSON error: " + e.getMessage(), e));
        }
    }

    public static TypesResponse parseTypesResponse(String responseBody) throws JSONException {
        JSONObject json = new JSONObject(responseBody);
        String product = json.getString("product");
        JSONArray typesArray = json.getJSONArray("types");
        List<RoomType> types = new ArrayList<>();

        for (int i = 0; i < typesArray.length(); i++) {
            JSONObject t = typesArray.getJSONObject(i);
            String key = t.getString("key");
            String label = t.getString("label");
            String desc = t.getString("desc");
            String photo = t.getString("photo");
            Integer price = t.isNull("price") ? null : t.getInt("price");
            int free = t.getInt("free");
            boolean eligible = t.getBoolean("eligible");
            String reason = t.isNull("reason") ? null : t.getString("reason");

            Map<String, Extra> extras = new HashMap<>();
            if (t.has("extras") && !t.isNull("extras")) {
                JSONObject extrasObj = t.getJSONObject("extras");
                Iterator<String> keys = extrasObj.keys();
                while (keys.hasNext()) {
                    String ek = keys.next();
                    JSONObject ev = extrasObj.getJSONObject(ek);
                    extras.put(ek, new Extra(ev.getString("label"), ev.getInt("price")));
                }
            }
            types.add(new RoomType(key, label, desc, photo, price, free, eligible, reason, extras));
        }
        return new TypesResponse(product, types);
    }

    public static OrderResponse parseOrderResponse(String responseBody) throws JSONException {
        JSONObject json = new JSONObject(responseBody);
        JSONObject orderObj = json.getJSONObject("order");
        Order order = new Order();
        order.setId(orderObj.getInt("id"));
        order.setRoomNumber(orderObj.getString("room_number"));
        order.setProduct(orderObj.getString("product"));
        order.setRoomType(orderObj.getString("room_type"));
        order.setGuestName(orderObj.getString("guest_name"));
        order.setCheckIn(orderObj.getString("check_in"));
        order.setCheckOut(orderObj.getString("check_out"));
        order.setAmount(orderObj.getDouble("amount"));
        order.setStatus(orderObj.getString("status"));
        return new OrderResponse(order);
    }

    public static ApiError parseError(String responseBody) {
        try {
            JSONObject json = new JSONObject(responseBody);
            return new ApiError(json.optString("error", "Error desconocido"));
        } catch (JSONException e) {
            return new ApiError("Error de respuesta del servidor");
        }
    }
}
