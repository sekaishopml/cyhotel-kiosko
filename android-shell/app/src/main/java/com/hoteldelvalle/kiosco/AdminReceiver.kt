package com.hoteldelvalle.kiosco

import android.app.admin.DeviceAdminReceiver

// Receptor para convertir el dispositivo en Device Owner (single-app kiosk).
// No requiere overrides: el sistema ya despacha los eventos de device-admin.
class AdminReceiver : DeviceAdminReceiver()
