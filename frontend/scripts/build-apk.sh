#!/bin/bash
# Compila el APK de release firmado, lo copia a public/apk/ versionado
# y actualiza el enlace de la página de descarga.
# Uso:  npm run apk
set -e
cd "$(dirname "$0")/.."

# Version leída del build.gradle de Android
VERSION=$(grep -o 'versionName "[^"]*"' android/app/build.gradle | sed 's/versionName "\(.*\)"/\1/')
echo "==> Version del APK: $VERSION"

# Build con JDK 21 (herramienta de capacitor requiere toolchain 21) y SDK de Android
export JAVA_HOME="${JAVA_HOME:-$HOME/Library/Java/JavaVirtualMachines/jdk-21.0.13+9/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
cd android && ./gradlew assembleRelease && cd ..

APK="android/app/build/outputs/apk/release/app-release.apk"
DEST="public/apk/fidelyfood-v$VERSION.apk"

# Elimina versiones anteriores y copia la nueva
rm -f public/apk/fidelyfood-v*.apk
cp "$APK" "$DEST"
echo "==> Copiado a $DEST ($(du -h "$DEST" | cut -f1 | sed 's/ //g'))"

# Actualiza el href de la página de descarga si cambió la versión
sed -i '' "s|/apk/fidelyfood-v[0-9.]*\\.apk|/apk/fidelyfood-v$VERSION.apk|g" \
  src/app/features/public/descargar/descargar.component.ts

# Muestra la firma para confirmar que es el APK correcto
$ANDROID_HOME/build-tools/36.0.0/apksigner verify --print-certs "$APK" | head -1
echo "==> Listo. Recuerda: git add public/apk y commit."
