// Dep: kotlinx.serialization
package com.hoteldelvalle.kiosco.data.model

import kotlinx.serialization.Serializable

@Serializable
data class RoomType(
    val key: String,
    val label: String,
    val desc: String,
    val photo: String? = null,
    val price: Int? = null,
    val free: Int = 0,
    val eligible: Boolean = true,
    val reason: String? = null,
    val extras: Map<String, Extra> = emptyMap()
)

@Serializable
data class Extra(
    val label: String,
    val price: Int
)

@Serializable
data class TypesResponse(
    val product: String,
    val types: List<RoomType>
)
