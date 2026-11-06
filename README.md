# IMEI Station · Terminal de Diagnóstico para Tiendas (Sickw API)

Aplicación web minimalista de uso interno para consultar y diagnosticar teléfonos por **IMEI** o **Número de Serie** mediante la API de **SICKW.COM**.

---

## 1. Estructura del Proyecto

- [`server.js`](./server.js): Servidor Node.js sin dependencias pesadas. Protege tu `SICKW_API_KEY` en el backend, traduce las respuestas de Sickw a una **Tarjeta de Diagnóstico Visual (Semáforo)** y guarda el historial en [`data/history.json`](./data/history.json).
- [`public/index.html`](./public/index.html), [`public/styles.css`](./public/styles.css), [`public/app.js`](./public/app.js): Interfaz minimalista con validación matemática de IMEI (algoritmo Luhn en tiempo real), escáner de cámara (código de barras/QR), accesos directos a los servicios de tienda y catálogo completo de los 94 servicios.
- [`docs/SICKW_API_DOCUMENTATION.md`](./docs/SICKW_API_DOCUMENTATION.md): Documentación completa extraída de tu cuenta en Sickw.
- [`docs/services-catalog.json`](./docs/services-catalog.json): Catálogo estructurado con los 94 servicios, precios de tu cuenta y muestras reales de respuesta.

---

## 2. Ejecución Local (PC)

```bash
node server.js
```
Abre en el navegador: `http://localhost:3000`

---

## 3. Despliegue en tu VPS (Ubuntu / Debian)

### Paso 1: Subir la carpeta a tu VPS y arrancar con PM2
```bash
# En tu VPS (con Node.js 18+ instalado):
cd /var/www/imei-station
pm2 start server.js --name "imei-station"
pm2 save
pm2 startup
```

### Paso 2: Activar HTTPS automático (necesario para usar la cámara desde el celular)
Los navegadores móviles (Safari en iPhone y Chrome en Android) exigen **HTTPS** para abrir la cámara en dominios fuera de `localhost`. La forma más rápida en tu VPS es con **Caddy** (configura el certificado SSL gratis en 10 segundos):

```bash
sudo apt install -y caddy
```
Edita `/etc/caddy/Caddyfile`:
```text
tu-subdominio.tudominio.com {
    reverse_proxy 127.0.0.1:3000
}
```
Reinicia Caddy:
```bash
sudo systemctl reload caddy
```

### Paso 3: Blindar tu API Key en Sickw con la IP de tu VPS
1. Entra a `https://sickw.com/?page=api`.
2. En la tarjeta **IP whitelist**, deja `IPv4 security` en **Enabled**.
3. Pega la dirección IPv4 pública de tu VPS y pulsa **Save**.
   *(Así nadie podrá gastar tu saldo aunque llegara a conocer tu API Key).*
