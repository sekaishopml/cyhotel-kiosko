// Dep: modelo estático de planes (sin serialización)
package com.hoteldelvalle.kiosco.data.model

data class Plan(
    val key: String,
    val name: String,
    val subtitle: String,
    val icon: String,
    val price: Int,
    val isHero: Boolean,
    val badge: String?
) {
    companion object {
        val PLANS = listOf(
            Plan("momento", "Momento", "3 horas", "M", 10, true, "El más pedido"),
            Plan("amanecida", "Amanecida", "18:00 a 9:00", "A", 20, false, null),
            Plan("hospedaje", "Hospedaje", "Múltiples días", "H", 30, false, null),
            Plan("suite", "Suite Jacuzzi", "3 horas · Jacuzzi privado", "S", 20, false, null),
        )
    }
}
