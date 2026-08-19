// Dep: kotlinx.serialization
package com.hoteldelvalle.kiosco.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class Order(
    val id: Int,
    @SerialName("room_number") val roomNumber: String? = null,
    val product: String? = null,
    @SerialName("room_type") val roomType: String? = null,
    @SerialName("guest_name") val guestName: String? = null,
    @SerialName("check_in") val checkIn: String? = null,
    @SerialName("check_out") val checkOut: String? = null,
    val status: String? = null,
    val amount: Double? = null
)

@Serializable
data class OrderRequest(
    val product: String,
    @SerialName("room_type") val roomType: String,
    @SerialName("guest_name") val guestName: String,
    @SerialName("id_document") val idDocument: String? = null,
    @SerialName("client_ref") val clientRef: String,
    val extra: String? = null,
    val days: Int? = null
)

@Serializable
data class OrderResponse(
    val order: Order? = null,
    val error: String? = null
)
