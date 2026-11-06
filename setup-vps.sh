#!/usr/bin/env bash
set -e

echo "===================================================="
echo "  Instalador Automático · IMEI Station en VPS"
echo "===================================================="

# 1. Crear archivo .env si se pasó la API Key por parámetro o si no existe
if [ -n "$1" ]; then
  cat > .env <<EOF
PORT=3000
SICKW_API_KEY=$1
SICKW_BASE_URL=https://sickw.com/api.php
EOF
  echo "-> Archivo .env configurado con tu API Key."
elif [ ! -f .env ]; then
  echo "ERROR: Falta tu API Key. Ejecuta: bash setup-vps.sh TU_API_KEY"
  exit 1
fi

# 2. Verificar e instalar Node.js si no existe
if ! command -v node >/dev/null 2>&1; then
  echo "-> Instalando Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# 3. Instalar PM2 para mantener la app encendida 24/7
if ! command -v pm2 >/dev/null 2>&1; then
  echo "-> Instalando PM2..."
  sudo npm install -g pm2
fi

# 4. Iniciar o reiniciar el servidor en el puerto 3000
echo "-> Arrancando servidor IMEI Station..."
pm2 delete imei-station >/dev/null 2>&1 || true
pm2 start server.js --name "imei-station"
pm2 save

# 5. Abrir puerto 3000 si UFW está activo
if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow 3000/tcp >/dev/null 2>&1 || true
fi

# 6. Obtener la IP pública del VPS
PUBLIC_IP=$(curl -4 -s ifconfig.me || curl -4 -s icanhazip.com || hostname -I | awk '{print $1}')

echo ""
echo "===================================================="
echo "  ¡LISTO! Tu app ya está encendida 24/7 en tu VPS"
echo "===================================================="
echo "1. Link directo para entrar:"
echo "   http://${PUBLIC_IP}:3000"
echo ""
echo "2. IMPORTANTE EN SICKW.COM:"
echo "   Entra a https://sickw.com/?page=api"
echo "   En 'IP whitelist', agrega esta IP de tu VPS y dale Save:"
echo "   ${PUBLIC_IP}"
echo "===================================================="
