// Solo para scripts/test-isolated.sh: apunta al backend de PRUEBAS (puerto 8181),
// nunca al de desarrollo. Se activa con `ng serve -c e2e` / `ng build -c e2e`.
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8181',
  googleMapsApiKey: '',
  googleGeolocationKey: '',
  googlePlacesKey: '',
  // Login social: Client IDs de Google ( gratuito) y Apple (Services ID + bundle ID, coma-separados)
  googleClientId: '',
  appleClientId: ''
};
