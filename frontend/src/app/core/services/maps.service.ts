import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { firstValueFrom } from 'rxjs';

declare var google: any;

@Injectable({
  providedIn: 'root'
})
export class MapsService {
  private http = inject(HttpClient);
  private googleMapsLoaded = false;
  private markers: any[] = [];

  constructor() {}

  /**
   * Carga dinámica de la API de Google Maps
   */
  async loadMapApi(): Promise<void> {
    if (this.googleMapsLoaded) return;

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        this.googleMapsLoaded = true;
        resolve();
      };
      script.onerror = (error) => reject(error);
      document.head.appendChild(script);
    });
  }

  /**
   * Inicializa un mapa en un elemento del DOM
   */
  async createMap(element: HTMLElement, center: { lat: number, lng: number }, zoom: number = 15): Promise<any> {
    await this.loadMapApi();
    return new google.maps.Map(element, {
      center,
      zoom,
      disableDefaultUI: true,
      styles: this.getDarkTheme() // Opcional: tema oscuro SaaS
    });
  }

  /**
   * Obtiene la ubicación actual con fallback a Google Geolocation API
   */
  async getCurrentLocation(): Promise<{ lat: number, lng: number }> {
    return new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
          },
          async () => {
            // Fallback a API de Google
            try {
              const location = await this.getLocationFromGoogle();
              resolve(location);
            } catch (err) {
              reject('No se pudo obtener la ubicación');
            }
          },
          { timeout: 10000 }
        );
      } else {
        this.getLocationFromGoogle().then(resolve).catch(reject);
      }
    });
  }

  private async getLocationFromGoogle(): Promise<{ lat: number, lng: number }> {
    const url = `https://www.googleapis.com/geolocation/v1/geolocate?key=${environment.googleGeolocationKey}`;
    const res: any = await firstValueFrom(this.http.post(url, {}));
    return {
      lat: res.location.lat,
      lng: res.location.lng
    };
  }

  /**
   * Añadir marcador al mapa
   */
  addMarker(map: any, position: { lat: number, lng: number }, options: { title?: string, icon?: string, data?: any } = {}): any {
    const marker = new google.maps.Marker({
      position,
      map,
      title: options.title,
      icon: options.icon ? {
        url: options.icon,
        scaledSize: new google.maps.Size(40, 40)
      } : null,
      animation: google.maps.Animation.DROP
    });

    if (options.data) {
      marker.set('data', options.data);
    }

    this.markers.push(marker);
    return marker;
  }

  /**
   * Convierte una dirección de texto en coordenadas Lat/Lng
   */
  async geocodeAddress(address: string): Promise<{ lat: number, lng: number }> {
    await this.loadMapApi();
    const geocoder = new google.maps.Geocoder();
    
    return new Promise((resolve, reject) => {
      geocoder.geocode({ address }, (results: any, status: any) => {
        if (status === 'OK' && results[0]) {
          const location = results[0].geometry.location;
          resolve({
            lat: location.lat(),
            lng: location.lng()
          });
        } else {
          reject('No se pudo encontrar la dirección: ' + status);
        }
      });
    });
  }

  /**
   * Limpiar todos los marcadores
   */
  clearMarkers() {
    this.markers.forEach(m => m.setMap(null));
    this.markers = [];
  }

  private getDarkTheme() {
    return [
      { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
      { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
      {
        featureType: "administrative.locality",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
      },
      {
        featureType: "poi",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
      },
      {
        featureType: "poi.park",
        elementType: "geometry",
        stylers: [{ color: "#263c3f" }],
      },
      {
        featureType: "poi.park",
        elementType: "labels.text.fill",
        stylers: [{ color: "#6b9a76" }],
      },
      {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#38414e" }],
      },
      {
        featureType: "road",
        elementType: "geometry.stroke",
        stylers: [{ color: "#212a37" }],
      },
      {
        featureType: "road",
        elementType: "labels.text.fill",
        stylers: [{ color: "#9ca5b3" }],
      },
      {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [{ color: "#746855" }],
      },
      {
        featureType: "road.highway",
        elementType: "geometry.stroke",
        stylers: [{ color: "#1f2835" }],
      },
      {
        featureType: "road.highway",
        elementType: "labels.text.fill",
        stylers: [{ color: "#f3d19c" }],
      },
      {
        featureType: "transit",
        elementType: "geometry",
        stylers: [{ color: "#2f3948" }],
      },
      {
        featureType: "transit.station",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
      },
      {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#17263c" }],
      },
      {
        featureType: "water",
        elementType: "labels.text.fill",
        stylers: [{ color: "#515c6d" }],
      },
      {
        featureType: "water",
        elementType: "labels.text.stroke",
        stylers: [{ color: "#17263c" }],
      },
    ];
  }
}
