# SPEC — Kiosko Android Nativo v2.0.0

## Datos del proyecto
- **Package**: `com.hoteldelvalle.kiosco`
- **App name**: "Kiosko"
- **Icono**: monograma "KI" (K verde #143A2A, I negro #000000, fondo blanco) — mipmap PNGs ya generadas en `app/src/main/res/mipmap-*/`
- **MinSdk**: 26 | **TargetSdk**: 34 | **CompileSdk**: 34
- **Java 17** (sin dependencias externas salvo Glide, OkHttp, Material)
- **Firma**: release con `/home/CyHotel/keys/kiosko-release.jks` via keystore.properties
- **PIN**: 12345 (fijo en código; configurable en ajustes futuros)
- **URL backend**: configurable (SharedPreferences), default `http://68.168.20.219:8000`

## API del backend

### GET /api/types?product={momento|amanecida|hospedaje|suite}
```json
{
  "product": "momento",
  "types": [
    {
      "key": "estandar",
      "label": "Habitación Estándar",
      "desc": "A/C, TV Smart, WiFi, agua caliente, sillón, luces LED, bebidas y piqueos",
      "photo": "/img/habitacion.jpeg",
      "price": 10,
      "free": 11,
      "eligible": true,
      "reason": null,
      "extras": {
        "1h": { "label": "1 hora adicional", "price": 5 },
        "6h": { "label": "Doble tiempo (6 horas)", "price": 20 }
      }
    }
  ]
}
```
- `eligible=false` → tipo no disponible para este plan (ej. doble en momento cuando hay otros).
- `reason` → texto de por qué no está disponible.
- `free` → número de habitaciones libres.
- `extras` → objetos con label y price; claves: "1h" (4 horas), "6h" (6 horas), o vacío para amanecida/hospedaje.
- Para hospedaje: `days` se envía como parámetro; precio = price × days.

### POST /api/orders
Request:
```json
{
  "product": "momento",
  "room_type": "estandar",
  "guest_name": "Juan Pérez",
  "id_document": "1234567890",  // opcional
  "client_ref": "1234567890-abc123",  // generado en cliente
  "extra": "1h",  // solo momento/suite, opcional
  "days": 3       // solo hospedaje, opcional
}
```
Response 201:
```json
{
  "order": {
    "id": 123,
    "room_number": "5",
    "product": "momento",
    "room_type": "estandar",
    "guest_name": "Juan Pérez",
    "check_in": "2026-08-19T14:30:00",
    "check_out": "2026-08-19T17:30:00",
    "amount": 15.0,
    "status": "pending"
  }
}
```
Response error: `{ "error": "mensaje de error" }`

### GET /img/{filename} → imagen binaria (JPEG/PNG)

## Estados de la app (flujo lineal 3 pasos)
1. **PlanFragment** →网格 2 columnas de planes; tap selecciona → botón "Continuar" →
2. **RoomFragment** → grid 3 columnas de habitaciones con foto lateral, precio y libres; tap selecciona; chips de duración; botón "Atrás" + "Continuar" →
3. **CheckinFragment** → formulario nombre del huésped, documento; resumen del pedido; botón "Atrás" + "Confirmar" → Modal de confirmación.

## Diseño visual (blanco elegante + verde)
- **Fondo general**: blanco `#FFFFFF`
- **Cards de plan**: verde sólido `#143A2A`, texto blanco, borde 14px, sombra suave
- **Hero "Momento"**: degradado verde `#2C6B4A → #1B4A35`, full width, badge "El más pedido" verde con texto blanco
- **Suite**: negro `#0D0D0D` premium, texto blanco
- **Cards de habitación**: blanco con borde verde claro, foto lateral 116×116px, nombre + precio + libres
- **Room seleccionada**: borde verde `#17452F`, fondo verde `#17452F`, texto blanco
- **Chips de duración**: borde gris, fondo blanco, texto verde oscuro; chip activo fondo verde texto blanco
- **Botones**: fondo verde `#143A2A`, texto blanco, alto 52px, borde redondo 6px
- **Botón secundario**: fondo transparente, borde `rgba(18,40,29,.15)`, texto verde oscuro
- **Roadmap**: verde/crema; pasos completados verde relleno, actual verde relleno + escala, pendiente borde gris
- **Tipografía**: sans-serif (Manrope o fallback system) para todo; serif (serif) para nombres de plan/habitación

## Layout de cada pantalla

### PlanFragment
- Roadmap 3 pasos centrado arriba (max-width 520dp, dots 30dp)
- Grid 2 columnas: 4 cards plan (momento hero full width, amanecida, hospedaje, suite)
- Footer fijo abajo: "Recepción 24 h · WiFi gratuito · Bebidas y piqueos" con iconos
- Botón "Continuar" deshabilitado hasta que seleccione un plan

### RoomFragment
- Roadmap (mismo que arriba, paso 2 activo)
- Grid 3 columnas de room cards (foto lateral 116dp, nombre, precio, libres)
- Dock inferior fijo: chips de duración (si aplica), precio total, botones Atrás + Continuar
- Loading: 3 cards skeleton con shimmer
- Error: overlay con "Reintentar"

### CheckinFragment
- Roadmap (paso 3 activo)
- Resumen del pedido: plan, habitación, duración, total
- Formulario: EditText nombre (obligatorio), EditText documento (opcional)
- Botones: "Atrás" (ghost) + "Confirmar" (primary)
- Error: inline rojo debajo del formulario

### Modal (confirmación)
- Fondo oscuro semi-transparente
- Card centrada con icono check verde, "¡Reserva confirmada!", datos de la reserva (habitación, check-in/out, monto)
- Botón "Cerrar" que vuelve al inicio

## Modelo de datos Java (POJOs simples, sin Lombok)
```java
public class Plan { String key, name, subtitle, icon; int price; boolean isHero; String badge; }
public class RoomType { String key, label, desc, photo; Integer price; int free; boolean eligible; String reason; Map<String,Extra> extras; }
public class Extra { String label; int price; }
public class Order { int id; String roomNumber, product, roomType, guestName, checkIn, checkOut, status; double amount; }
public class ApiError { String error; }
public class TypesResponse { String product; List<RoomType> types; }
public class OrderRequest { String product, roomType, guestName, idDocument, clientRef, extra; Integer days; }
public class OrderResponse { Order order; }
```

## Arquitectura (sin frameworks, Java puro)
- **MainActivity** (Activity): contiene el contenedor FrameLayout `@+id/container` + botón flotante `@+id/btnAdmin` (PIN). Gestiona el flujo de fragments.
- **PlanFragment**, **RoomFragment**, **CheckinFragment**: fragments que cargan su layout y se comunican con MainActivity.
- **ApiClient**: clase estática con OkHttp que hace GET/POST. Lee la URL base de SharedPreferences. Devuelve JSON parseado manualmente (JSONObject/JSONArray).
- **Prefs**: helper de SharedPreferences (URL, PIN).
- **KioskManager**: inmersivo sticky (API 30+ WindowInsetsController, API 26-29 flags), keep screen on.
- **FlowManager** (dentro de MainActivity): orquesta la navegación, guarda el estado (plan seleccionado, room seleccionada, extra, days, nombre, doc).
- Sin inyección de dependencias. Sin ViewModels. Todo directo en fragments con callbacks.

## Flujo de datos
1. PlanFragment carga → usuario toca plan → MainActivity guarda `selectedPlan` → habilita "Continuar"
2. Usuario toca "Continuar" → RoomFragment hace `GET /api/types?product=X` → muestra rooms → usuario toca room → chips → usuario toca "Continuar"
3. CheckinFragment muestra resumen → usuario escribe nombre → "Confirmar" → `POST /api/orders` → modal → vuelve al inicio

## Notas de implementación
- Las imágenes se cargan con Glide (`Glide.with(context).load(url).into(imageView)`)
- Las imágenes del backend están en `/img/habitacion.jpeg` y `/img/suite.jpeg`
- El keystore y build.gradle ya existen y NO deben modificarse (solo app/build.gradle si se necesitan deps)
- Para OKHttp: `implementation 'com.squareup.okhttp3:okhttp:4.12.0'`
- Para Glide: `implementation 'com.github.bumptech.glide:glide:4.16.0'`
- Para Material: `implementation 'com.google.android.material:material:1.12.0'`
- Para RecyclerView (grid de rooms): `implementation 'androidx.recyclerview:recyclerview:1.3.2'`
- Para ConstraintLayout: `implementation 'androidx.constraintlayout:constraintlayout:2.1.4'`
- **NO usar** ViewModel, LiveData, Hilt, Coroutines. Todo síncrono con OkHttp en threads manuales + runOnUiThread.
