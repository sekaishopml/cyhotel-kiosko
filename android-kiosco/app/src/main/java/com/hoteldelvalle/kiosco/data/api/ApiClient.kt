// Dep: OkHttp 4.12, kotlinx.serialization, kotlinx.coroutines
package com.hoteldelvalle.kiosco.data.api

import com.hoteldelvalle.kiosco.data.model.OrderRequest
import com.hoteldelvalle.kiosco.data.model.OrderResponse
import com.hoteldelvalle.kiosco.data.model.TypesResponse
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class ApiException(message: String) : Exception(message)

@OptIn(ExperimentalSerializationApi::class)
object ApiClient {

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    private val json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
    }

    suspend fun getTypes(baseUrl: String, product: String): TypesResponse =
        withContext(Dispatchers.IO) {
            val url = "$baseUrl/api/types?product=$product"
            val request = Request.Builder().url(url).get().build()
            val response = client.newCall(request).execute()
            val body = response.body?.string() ?: throw ApiException("Respuesta vacía")

            if (response.code != 200) {
                val errorMsg = try {
                    json.parseToJsonElement(body).jsonObject["error"]?.jsonPrimitive?.content
                } catch (_: Exception) { null }
                throw ApiException(errorMsg ?: "Error HTTP ${response.code}")
            }

            json.decodeFromString<TypesResponse>(body)
        }

    suspend fun createOrder(baseUrl: String, request: OrderRequest): OrderResponse =
        withContext(Dispatchers.IO) {
            val url = "$baseUrl/api/orders"
            val jsonBody = json.encodeToString(OrderRequest.serializer(), request)
                .toRequestBody("application/json; charset=utf-8".toMediaType())
            val httpRequest = Request.Builder().url(url).post(jsonBody).build()
            val response = client.newCall(httpRequest).execute()
            val body = response.body?.string() ?: throw ApiException("Respuesta vacía")

            if (response.code != 200 && response.code != 201) {
                val errorMsg = try {
                    json.parseToJsonElement(body).jsonObject["error"]?.jsonPrimitive?.content
                } catch (_: Exception) { null }
                throw ApiException(errorMsg ?: "Error HTTP ${response.code}")
            }

            json.decodeFromString<OrderResponse>(body)
        }
}
