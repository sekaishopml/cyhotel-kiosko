// Dep: modelo Extra de data.model
package com.hoteldelvalle.kiosco.util

import com.hoteldelvalle.kiosco.data.model.Extra

fun money(amount: Int): String = "$$amount"

fun money(amount: Double): String =
    if (amount % 1.0 == 0.0) "$${amount.toInt()}" else "$${"%.2f".format(amount)}"

fun durationText(product: String, extra: String?, days: Int): String = when {
    product == "momento" || product == "suite" -> when (extra) {
        "1h" -> "4 horas"
        "6h" -> "6 horas"
        else -> "3 horas"
    }
    product == "amanecida" -> "18:00 a 9:00"
    product == "hospedaje" -> "$days día${if (days > 1) "s" else ""}"
    else -> "Mínimo 1 hora"
}

fun totalOf(
    product: String,
    price: Int?,
    extra: String?,
    days: Int,
    extras: Map<String, Extra>
): Int? {
    if (price == null) return null
    return when {
        product == "hospedaje" -> price * days
        extra == "6h" && extras["6h"] != null -> extras["6h"]!!.price
        extra == "1h" && extras["1h"] != null -> price + extras["1h"]!!.price
        else -> price
    }
}
