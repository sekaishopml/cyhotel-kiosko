# App Android Kiosko — Hotel Del Valle

## Qué es

La app **Kiosko** es la aplicación Android del quiosco de autoservicio del Hotel Del Valle.
Permite que el huésped se registre, pida servicios o consulte información directamente
desde una tablet dispuesta en el lobby, conectándose al backend del hotel.

- **Package:** `com.hoteldelvalle.kiosco`
- **minSdk:** 26 (Android 8.0)
- **targetSdk:** 34 (Android 14)
- **APK firmado:** `/home/CyHotel/dist/HotelDelValle-Kiosko.apk` (~31 KB)

## Cómo instalar en la tablet

1. Habilitar **"Instalar apps de orígenes desconocidos"** en la tablet
   (Ajustes → Seguridad, o Ajustes → Apps → Acceso especial → Instalar apps desconocidas).
2. Abrir el navegador de la tablet e ir a:

   ```
   http://68.168.20.219:8000/kiosco.apk
   ```

3. Aceptar la descarga y confirmar la instalación cuando el sistema lo pida.

> Alternativa: copiar manualmente el APK desde
> `/home/CyHotel/dist/HotelDelValle-Kiosko.apk` a la tablet (USB o almacenamiento local)
> y abrirlo desde el gestor de archivos.

## Configuración inicial

Al primer arranque la app pide:

- **URL del servidor** — por defecto `http://68.168.20.219:8000/kiosco`
- **PIN de salida** — por defecto `12345`

## Cómo cambiar URL / PIN

- Tocar el botón flotante **"K"** (o dar **5 toques rápidos** sobre la pantalla).
- Ingresar el PIN.
- Elegir **"Configurar servidor"** y guardar los nuevos valores.

## Cómo salir del quiosco

- Tocar el botón **"K"** o dar **5 toques rápidos** sobre la pantalla.
- Ingresar el PIN.
- Elegir **"Salir del quiosco"**.

## Seguridad

- El **PIN por defecto es `12345`**: **debe cambiarse en producción** usando la
  pantalla "Configurar servidor" antes de dejar la tablet en el lobby.

## Quiosco real (opcional, tablet dedicada)

Para una tablet dedicada como quiosco se recomienda:

1. Conectarla por USB con depuración habilitada y ejecutar:

   ```
   adb shell settings put global policy_control immersive.full=*
   ```

   Esto activa el **modo inmersivo** (oculta las barras de sistema).

2. Para bloquear el botón Home (PIN del dueño):

   ```
   adb shell dpm set-device-owner com.hoteldelvalle.kiosco/.AdminReceiver
   ```

   **Nota:** esto requiere crear una clase `AdminReceiver` (Device Admin) en la app
   si se decide implementar. Por ahora el modo inmersivo ya oculta las barras.

## Notas

- La app se conecta al backend alojado en la VPS (`http://68.168.20.219:8000/kiosco`).
- Si cambia la IP del servidor, usar la pantalla de configuración de la app
  (botón "K" o 5 toques → PIN → "Configurar servidor").