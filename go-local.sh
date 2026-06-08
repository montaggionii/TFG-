#!/bin/bash

# =================================================================
# 🏠 FIDELYFOOD - LOCAL RESTORER
# =================================================================
# Este script revierte los cambios de go-public.sh y vuelve a localhost.
# =================================================================

echo "----------------------------------------------------"
echo "🏠 Restaurando configuración para Localhost..."
echo "----------------------------------------------------"

BACKEND_LOCAL="http://localhost:8081"

# 1. Actualizar application.properties
echo "📝 Configurando application.properties -> $BACKEND_LOCAL"
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|app.base-url=.*|app.base-url=$BACKEND_LOCAL|g" src/main/resources/application.properties
else
    sed -i "s|app.base-url=.*|app.base-url=$BACKEND_LOCAL|g" src/main/resources/application.properties
fi

# 2. Actualizar environment.ts y environment.prod.ts
echo "📝 Configurando archivos de entorno (Angular) -> $BACKEND_LOCAL"
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|apiUrl:.*|apiUrl: '$BACKEND_LOCAL',|g" frontend/src/environments/environment.ts
    sed -i '' "s|apiUrl:.*|apiUrl: '$BACKEND_LOCAL',|g" frontend/src/environments/environment.prod.ts
else
    sed -i "s|apiUrl:.*|apiUrl: '$BACKEND_LOCAL',|g" frontend/src/environments/environment.ts
    sed -i "s|apiUrl:.*|apiUrl: '$BACKEND_LOCAL',|g" frontend/src/environments/environment.prod.ts
fi

echo "----------------------------------------------------"
echo "✅ EXITO: Proyecto restaurado para localhost."
echo "----------------------------------------------------"
echo "📍 Ya puedes iniciar tus servidores normalmente:"
echo "👉 Backend: Ejecuta el proyecto Spring Boot (puerto 8081)"
echo "👉 Frontend: cd frontend && ionic serve"
echo "----------------------------------------------------"
