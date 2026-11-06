# Documentación Oficial Extraída — SICKW.COM API

Extraída directamente desde `https://sickw.com/?page=api` (sesión autenticada) y `https://sickw.com/sample.txt`.

---

## 1. Datos de la Cuenta y Endpoint Base

- **Endpoint Base (GET / POST):** `https://sickw.com/api.php`
- **API Key Configurada:** Configurada en `.env` (`SICKW_API_KEY`, 31 caracteres, formato `XXX-XXX-XXX-XXX-XXX-XXX-XXX-XXX`)
- **Seguridad IPv4 (IP Whitelist):** Soportada desde el panel (`Enabled` / `Disabled`). Permite restringir el uso de la API Key exclusivamente a la IP de tu VPS.
- **Integración DHRU Fusion:**
  - **API URL:** `https://sickw.com/`

---

## 2. Estructura de Petición (Web API GET)

```text
https://sickw.com/api.php?format={FORMAT}&key={API-KEY}&imei={IMEI-or-SERIAL}&service={SERVICE-ID}
```

### Parámetros Disponibles

| Parámetro | Valores / Descripción |
| :--- | :--- |
| `format` | • `json`: Resultado como texto HTML dentro de un objeto JSON.<br>• `beta`: Estructura JSON completa con campos clave-valor parseados dentro de `"result": { ... }`. *(Nota: en servicios complejos como GSX puede omitir subcampos; conviene combinar o respaldar con `json`).*<br>• `html`: Resultado en HTML plano.<br>• `notags`: Elimina etiquetas HTML (`<b>`, `<font>`) conservando saltos de línea.<br>• `instant`: Solo ejecuta si el servicio es instantáneo (de lo contrario devuelve `Error S03`). |
| `key` | Tu API Key (`SICKW_API_KEY` en `.env`). |
| `imei` | Número IMEI (15 dígitos), MEID o Número de Serie (11–15 caracteres alfanuméricos). Para `action=history`, acepta IMEI u Order ID. |
| `service` | ID numérico del servicio (ver catálogo en [`services-catalog.json`](./services-catalog.json)) o `demo` para prueba gratuita sin costo. |
| `action` | • `balance`: Devuelve el saldo disponible en texto plano (ej. `9.820`).<br>• `services`: Devuelve el listado completo de servicios y precios de tu grupo en JSON (`{"Service List": [...]}`).<br>• `history`: Busca órdenes previas por `imei` o `order ID`. |

---

## 3. Ejemplos de Respuestas

### A. `format=beta` (JSON estructurado)
**URL:**
`https://sickw.com/api.php?format=beta&key=API-KEY&imei=354442067957452&service=demo`

```json
{
  "result": {
    "IMEI": "354442067957xxx",
    "Manufacturer": "APPLE",
    "Model Code": "IPHONE 6 PLUS (A1524)",
    "Model Name": "IPHONE 6 PLUS"
  },
  "imei": "354442067957xxx",
  "balance": "878.75",
  "price": "0",
  "service": "203",
  "id": "76369088",
  "status": "success"
}
```

### B. `format=json` (JSON con `result` en líneas `<br>`)
**URL:**
`https://sickw.com/api.php?format=json&key=API-KEY&imei=354442067957452&service=demo`

```json
{
  "result": "IMEI: 354442067957xxx<br>Manufacturer: APPLE<br>Model Code: IPHONE 6 (A1524)<br>Model Name: IPHONE 6",
  "imei": "354442067957xxx",
  "balance": "878.75",
  "price": "0",
  "id": "76368764",
  "status": "success"
}
```

### C. Consulta de Saldo (`action=balance`)
**URL:**
`https://sickw.com/api.php?action=balance&key=API-KEY`
**Respuesta:**
```text
9.820
```

### D. Consulta de Historial (`action=history`)
**URL:**
`https://sickw.com/api.php?format=json&key=API-KEY&imei=IMEI-or-ORDERID&action=history`

---

## 4. Códigos de Error Oficiales

Los errores se devuelven dentro del campo `result` con `"status": "error"`:

| Código | Mensaje en `result` | Significado |
| :--- | :--- | :--- |
| **`E01`** | `IMEI is Wrong!` | El IMEI no superó la validación matemática del algoritmo de Luhn. |
| **`E02`** | `IMEI or SN is Wrong!` | Formato o longitud inválida de IMEI / Número de Serie (debe tener entre 11 y 15 caracteres alfanuméricos). |
| **`R01`** | `Not Found!` | El servicio está fuera de línea temporalmente o el IMEI/SN no arroja registros. |
| **`B01`** | `Low Balance!` | Saldo insuficiente en la cuenta para ejecutar ese servicio. |
| **`S01 / S02`** | `Service ID is Wrong!` | El ID de servicio no existe o está desactivado. |
| **`S03`** | `This service not instant!` | Se envió `format=instant` a un servicio que demora minutos/días (como desbloqueos de operador). |
| **`A01 / A02 / A03`** | `API KEY is Wrong!` | API Key inválida/deshabilitada, o la IP desde donde se llama no está en el **IP Whitelist**. |

---

## 5. Resumen de Categorías y Servicios Principales para Tiendas

El catálogo completo con los **94 servicios** y sus ejemplos de respuesta está guardado en [`services-catalog.json`](./services-catalog.json).

### Servicios Instantáneos Más Usados en Tiendas (Recepción / Compra / Venta)

| ID | Servicio | Precio (USD) | Qué devuelve |
| :--- | :--- | :---: | :--- |
| **`3`** | **iCLOUD ON/OFF** | `$0.02` | Estado de Find My iPhone (`ON` / `OFF`). |
| **`103`** | **iPHONE CARRIER** | `$0.06` | Modelo, serie, garantía, operador original y `Sim-Lock` (`Locked` / `Unlocked`). |
| **`78`** | **iPHONE CARRIER & FMI** | `$0.08` | Todo lo del `103` + estado de iCloud (`Find My iPhone: ON/OFF`). |
| **`61`** | **iPHONE CARRIER & FMI & BLACKLIST** | `$0.10` | **El más completo calidad/precio para recepción de iPhone:** Modelo, capacidad, color, IMEI/IMEI2/SN, iCloud ON/OFF, Blacklist GSMA (`Clean`/`Blacklisted`) y `Sim-Lock` (`Locked`/`Unlocked`). |
| **`72`** | **APPLE CARRIER + MDM & iCLOUD & GSX STATUS** | `$0.30` | Incluye detección de bloqueo corporativo **MDM (`ON`/`OFF`)**, iCloud (`Clean`/`Lost`), Carrier y Sim-Lock. |
| **`81`** | **APPLE MDM STATUS** | `$0.22` | Verifica si el dispositivo Apple tiene perfil empresarial MDM activo. |
| **`146`** | **APPLE GSX PREMIUM - PROMO** | `$0.60` | Reporte GSX completo con historial de casos, reemplazos y políticas de activación. |
| **`54`** | **WW BLACKLIST STATUS** | `$0.04` | Verifica reporte mundial de robo/extravío (todas las marcas). |
| **`80`** | **SAMSUNG INFO** | `$0.06` | Modelo exacto, operador, país, número de serie y garantía para Samsung. |
| **`1`** | **SAMSUNG INFO - PRO** | `$0.10` | Información extendida de Samsung (país, carrier, fecha de venta/garantía). |
| **`82`** | **SAMSUNG KNOX GUARD INFO** | `$0.30` | Verifica si un Samsung tiene bloqueo financiero/empresarial **Knox Guard (KG)**. |
| **`153`** | **XIAOMI / REDMI / POCO WARRANTY INFO** | `$0.10` | País de compra, modelo, garantía y estado para Xiaomi/Redmi/Poco. |
| **`206`** | **XIAOMI / REDMI / POCO MI LOCK ON/OFF** | `$0.10` | Verifica bloqueo de cuenta Mi Cloud (`ON`/`OFF`). |
| **`203`** | **BRAND & MODEL INFO** | `$0.02` | Identifica marca y modelo exacto de cualquier IMEI GSM. |
| **`demo`** | **DEMO TEST SERVICE** | `GRATIS` | Servicio de prueba gratuito para validar integración sin descontar saldo. |
