# Publicación en Google Play y App Store — FidelyFood

Guía de lo que ya está hecho en el repositorio y de lo que queda solo para
la persona dueña de las cuentas de desarrollador. Última actualización: tras
la preparación de tiendas de nov. 2026.

## Qué ya está hecho (en el repo)

### App nativa (Capacitor 8)
- `appId` / `bundleId`: **`com.fidelyfood.app`** (Android `applicationId` y iOS `PRODUCT_BUNDLE_IDENTIFIER` coinciden — requisito para vincular Google/Apple OAuth y Wallet después).
- Android: `minSdk 24`, `targetSdk 36`, `versionCode 1`, `versionName 1.0.0`.
- **Permisos Android** con uso real justificado: `INTERNET`, `CAMERA` (escáner QR de compras/canjes), `ACCESS_COARSE_LOCATION` + `ACCESS_FINE_LOCATION` (radar de restaurantes). Cámara y GPS marcados `required="false"` para no excluir dispositivos.
- **`network_security_config.xml`**: HTTPS obligatorio en producción; HTTP solo para `localhost`/`10.0.2.2` (desarrollo).
- **`Info.plist` iOS**: `NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription`, `NSPhotoLibraryUsageDescription` con textos en español, `ITSAppUsesNonExemptEncryption=false` (salta la pregunta de exportación), región de desarrollo `es`.
- **Iconos y splashes de marca** generados desde `src/assets/img/logo_fidelyfood.png` (emblema del pin): `ic_launcher`, `ic_launcher_round`, adaptive foreground en las 5 densidades Android, `AppIcon-512@2x` iOS, favicon, y todos los splash de Android e iOS regenerados.

### Requisitos de política de las tiendas
- **Borrado de cuenta en la app** (obligatorio en Play y App Store): botón
  "Eliminar cuenta" en Perfil → `DELETE /api/usuarios/{id}` (ownership por
  JWT) → desactiva la cuenta y **anonimiza** nombre, email, teléfono, foto y
  QR (los movimientos históricos se conservan desvinculados de la persona,
  para las estadísticas del restaurante). Cuenta con tests
  (`eliminarPropioAnonimizaYDesactivaSinBorrarLaFila`,
  `loginConCuentaEliminadaRechazaAunqueElPasswordCoincida`).
- **Política de privacidad y términos** en la app: rutas públicas `/privacy` y `/terms` (desplegadas con el frontend en Vercel — esas URLs son las que se pegan en Play Console y App Store Connect).
- **Inicios de sesión de terceros**: el botón de Google/Apple solo aparece
  si `googleClientId`/`appleClientId` están configurados. Regla de App Store
  4.8: si publicas con login de Google configurado, **debes configurar
  también Sign in with Apple** (ver abajo).

### Firma Android
- `frontend/android/app/fidelyfood-upload.keystore` **generada y firmada localmente** (gitignoreada, no está en el repo).
- Credenciales en `frontend/android/app/key.properties` (gitignoreado). El `build.gradle` las lee automáticamente, o variables de entorno `FIDELYFOOD_UPLOAD_STORE_*`.
- Verificado: `./gradlew assembleRelease` produce `app-release.apk` **firmado (v2/v3)** con certificado `CN=FidelyFood`.
- ⚠️ **La keystore es LA identidad de la app en Google Play. Si se pierde no se puede recuperar el paquete.** Guárdala (fichero + contraseñas) en un gestor de contraseñas antes de publicar.

### Compilaciones verificadas
- Android: `assembleDebug` y `assembleRelease` → `BUILD SUCCESSFUL` (JDK 21 + SDK 36).
- iOS: el proyecto resuelve dependencias SPM y compila Swift; la compilación completa de simulador queda bloqueada en esta máquina porque **Xcode no tiene instalada la plataforma iOS** (ver prerrequisitos).

## Requisitos previos que dependen de ti (cuentas y dinero)

| Requisito | Dónde | Coste |
|---|---|---|
| Cuenta Google Play Developer | https://play.google.com/console | 25 $ una vez |
| Cuenta Apple Developer Program | https://developer.apple.com | 99 €/año |
| Platform iOS instalada en Xcode | Xcode → Settings → Components → iOS | gratis (necesita ~8-15 GB de disco) |
| Sign in with Apple (si ofreces login Google) | Apple Developer → Identifiers → Services ID | incluido en el programa |
| Google OAuth Client ID (login Google) | Google Cloud Console → Credentials | gratis |
| Twilio (SMS real en producción) | https://www.twilio.com | de pago, con prueba gratuita |

## Checklist Google Play

1. `cd frontend && npx ionic build && npx cap sync android`
2. `cd frontend/android && ./gradlew bundleRelease` (Play exige **AAB**, no APK; el build ya funciona, añade `bundle` con el mismo gradle).
3. Subir el AAB a Production/Internal testing.
4. Ficha de la tienda: título, descripciones (es), capturas (mín. 2 por tipo de dispositivo), icono 512×512 (ya generado: `src/assets/icon/favicon.png` ampliado o el del launch icon), gráfico de feature 1024×500.
5. **Declaración Data Safety**:
   - Datos recogidos: email/teléfono (identidad), foto de perfil, ubicación (precisa, no en segundo plano), contenido de compras (puntos/canjes).
   - Compartido: no se vende; los restaurantes ven el nombre y el saldo del cliente al escanear.
   - Borrado: existe en la app (Perfil → Eliminar cuenta) → decláralo.
6. **Permissions declaration**: cámara y ubicación con el uso descrito arriba.
7. Política de privacidad: URL pública `https://<tu-dominio-vercel>/privacy`.
8. Clasificación de contenido, público objetivo (13+), anuncios (no).

## Checklist App Store

1. Instalar plataforma iOS en Xcode y abrir `frontend/ios/App/App.xcodeproj`.
2. Signing & Capabilities: Team de Apple Developer, bundle `com.fidelyfood.app`,_capabilities que faltan si se usan: Push (más adelante).
3. `Product → Archive` → subir a App Store Connect.
4. Metadatos: nombre, subtítulo, descripción, palabras clave, capturas 6.7" y 5.5" (o las exigidas ahora), icono 1024 (ya generado).
5. **Privacy Nutrition Labels**: mismos datos que Data Safety de Google.
6. **URL de política de privacidad** obligatoria: `https://<tu-dominio-vercel>/privacy` (y soporte con email funcional).
7. **In-App account deletion**: ya implementado — indícalo en las notas de revisión.
8. **Revisión**: la app contra producción (Render) funciona sin cuentas de prueba; si pides credenciales de revisión, crea `revisor@fidelyfood.com` de prueba y anótalo en App Review Information.

## Vértigos funcionales a vigilar antes de subir

- `environment.prod.ts` apunta a `https://fidelyfood-backend.onrender.com` — el backend en Render debe estar desplegado y con **`APP_SMS_PROVIDER=twilio`** (si no, los códigos OTP volverían por la API en `devCodigo`: no subir así).
- Google Maps API key está en `environment.prod.ts` (pública, restringida por referrer/plataforma en Google Cloud).
- Sin credenciales configuradas, las funciones sociales/wallet devuelven 503 con mensaje claro (degradación correcta, no botones falsos): para la revisión de las tiendas mejor tener Google OAuth y Twilio activos.
