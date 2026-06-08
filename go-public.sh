#!/bin/bash

# =================================================================
# 🚀 FIDELYFOOD - PUBLIC DEPLOYER 
# =================================================================
# Este script automatiza la exposicion de la app a internet.
# =================================================================

echo "----------------------------------------------------"
echo "🌐 Iniciando preparacion para Acceso Publico..."
echo "----------------------------------------------------"

# 1. Solicitar la URL del Backend (NGROK o similar)
echo "👉 PASO 1: Inicia tu tunel de Backend (ej: ngrok http 8081)"
echo "Ingresa la URL publica generada (ej: https://xxxx.ngrok-free.app):"
read BACKEND_URL

if [ -z "$BACKEND_URL" ]; then
    echo "❌ Error: Debes ingresar una URL valida."
    exit 1
fi

# Eliminar barra final si existe
BACKEND_URL=$(echo $BACKEND_URL | sed 's/\/$//')

echo "✅ URL Backend configurada: $BACKEND_URL"

# 2. Actualizar application.properties
echo "📝 Actualizando application.properties..."
sed -i '' "s|app.base-url=.*|app.base-url=$BACKEND_URL|g" src/main/resources/application.properties

# 3. Actualizar environment.ts y environment.prod.ts
echo "📝 Actualizando archivos de entorno (Angular)..."
sed -i '' "s|apiUrl:.*|apiUrl: '$BACKEND_URL', // Actualizado por go-public.sh|g" frontend/src/environments/environment.ts
sed -i '' "s|apiUrl:.*|apiUrl: '$BACKEND_URL', // Actualizado por go-public.sh|g" frontend/src/environments/environment.prod.ts

# 4. Compilar Frontend
echo "🏗️  Compilando Frontend para Produccion (Ionic Build)..."
cd frontend
ionic build --prod

if [ $? -eq 0 ]; then
    echo "----------------------------------------------------"
    echo "✅ EXITO: Proyecto preparado para internet."
    echo "----------------------------------------------------"
    echo "📍 BACKEND: Ya deberia ser accesible en: $BACKEND_URL"
    echo "📍 FRONTEND: Los archivos estan en 'frontend/www' o 'frontend/browser'."
    echo "👉 RECOMENDACION: Sirve la carpeta 'www' con 'npx serve' o despliega a Vercel."
    echo "----------------------------------------------------"
else
    echo "❌ Error en el build del frontend."
    exit 1
fi
