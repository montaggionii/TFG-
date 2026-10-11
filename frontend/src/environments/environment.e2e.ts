// Solo para scripts/test-isolated.sh: apunta al backend de PRUEBAS (puerto 8181),
// nunca al de desarrollo. Se activa con `ng serve -c e2e` / `ng build -c e2e`.
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8181',
  googleMapsApiKey: '',
  googleGeolocationKey: '',
  googlePlacesKey: ''
};
