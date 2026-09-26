import { Component, ElementRef, EventEmitter, Input, Output, ViewChild, AfterViewInit, inject, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { MapsService } from '../../../core/services/maps.service';
import { RestauranteService } from '../../../core/services/restaurante.service';
import { addIcons } from 'ionicons';
import { locateOutline, alertCircleOutline } from 'ionicons/icons';

declare var google: any;

@Component({
  selector: 'app-map',
  template: `
    <div class="map-wrapper" [class.loading]="loading">
      <div #mapContainer class="map-container"></div>
      
      <!-- Overlay de Carga -->
      <div *ngIf="loading" class="overlay">
        <ion-spinner name="crescent" color="primary"></ion-spinner>
        <p>Sincronizando coordenadas...</p>
      </div>

      <!-- Overlay de Error -->
      <div *ngIf="error" class="overlay error">
        <ion-icon name="alert-circle-outline" color="danger"></ion-icon>
        <p>No se pudo cargar el mapa</p>
        <ion-button fill="clear" size="small" (click)="retry()">Reintentar</ion-button>
      </div>

      <!-- Botón Centrar Ubicación -->
      <div class="map-controls" *ngIf="!loading && !error">
        <button class="control-btn tap-effect" (click)="centerOnUser()">
          <ion-icon name="locate-outline"></ion-icon>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      min-height: 250px;
      overflow: hidden;
      border-radius: 24px;
    }
    .map-wrapper {
      width: 100%;
      height: 100%;
      position: relative;
      background: #F3F4F6;
    }
    .map-container {
      width: 100%;
      height: 100%;
    }
    .overlay {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(8px);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 10;
      gap: 12px;
      
      p { margin: 0; color: #6B7280; font-size: 0.9rem; font-weight: 700; }
    }
    .map-controls {
      position: absolute;
      bottom: 24px;
      right: 24px;
      z-index: 5;
      
      .control-btn {
        width: 56px;
        height: 56px;
        border-radius: 20px;
        background: rgba(30, 41, 59, 0.8);
        backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: #3b82f6;
        font-size: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        
        &:active { transform: scale(0.9); }
      }
    }
    .error { background: rgba(10, 14, 20, 0.95); }
    .loading { opacity: 0.7; }
  
  `],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class MapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapElement!: ElementRef;
  
  @Input() center: { lat: number, lng: number } = { lat: 39.4699, lng: -0.3763 };
  @Input() zoom: number = 14;
  @Input() radioKm: number = 5;
  @Input() set markers(val: any[]) {
    this._markers = val;
    this.updateMarkers();
  }

  @Output() onMarkerClick = new EventEmitter<any>();
  @Output() mapReady = new EventEmitter<any>();

  private mapsService = inject(MapsService);
  private restauranteService = inject(RestauranteService);
  private _markers: any[] = [];
  private mapMarkers: any[] = [];
  private accuracyCircle: any;
  private radiusCircleObj: any;
  private resizeObserver?: ResizeObserver;
  public map: any;
  public loading = true;
  public error = false;

  constructor() {
    addIcons({ locateOutline, alertCircleOutline });
  }

  async ngAfterViewInit() {
    await this.initMap();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['radioKm'] && this.map) {
      this.updateRadiusCircle();
    }
    if (changes['center'] && this.map) {
      this.updateRadiusCircle();
    }
  }

  async initMap() {
    this.loading = true;
    this.error = false;
    
    try {
      await new Promise(r => setTimeout(r, 300));
      this.map = await this.mapsService.createMap(this.mapElement.nativeElement, this.center, this.zoom);
      
      // Estilo de mapa CLEAN MINIMAL (Premium Light)
      const lightStyle = [
        { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#e9e9e9" }, { "lightness": 17 }] },
        { "featureType": "landscape", "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }, { "lightness": 20 }] },
        { "featureType": "road.highway", "elementType": "geometry.fill", "stylers": [{ "color": "#ffffff" }, { "lightness": 17 }] },
        { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }, { "lightness": 21 }] },
        { "elementType": "labels.text.stroke", "stylers": [{ "visibility": "on" }, { "color": "#ffffff" }, { "lightness": 16 }] },
        { "elementType": "labels.text.fill", "stylers": [{ "saturation": 36 }, { "color": "#333333" }, { "lightness": 40 }] },
        { "featureType": "transit", "stylers": [{ "visibility": "off" }] }
      ];

      this.map.setOptions({
        styles: lightStyle,
        gestureHandling: 'greedy',
        clickableIcons: false,
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
      });

      this.mapReady.emit(this.map);
      this.loading = false;
      this.updateMarkers();
      this.updateRadiusCircle();
      this.observeContainerResize();
    } catch (err) {
      console.error('MAP ERROR', err);
      this.loading = false;
      this.error = true;
    }
  }

  retry() {
    this.initMap();
  }

  /**
   * Google Maps calcula su tamaño una única vez, en el momento en que se
   * crea. Si el contenedor todavía no tenía su tamaño final en ese instante
   * (p.ej. porque la sección padre está en medio de una animación de
   * entrada, o el mapa se muestra dentro de un ion-tab/ion-modal que aún no
   * ha terminado su transición), Maps se queda con tiles sin cargar en la
   * zona que "ganó" tamaño después — la típica franja/zona blanca. Un
   * ResizeObserver detecta cualquier cambio real de tamaño del contenedor
   * (animación, resize de ventana, cambio de orientación, reentrar en la
   * pestaña) y le pide a Maps que recalcule.
   */
  private observeContainerResize() {
    if (typeof ResizeObserver === 'undefined' || !this.mapElement?.nativeElement) return;

    let lastWidth = 0;
    let lastHeight = 0;
    let debounceTimer: any;

    this.resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      if (width === lastWidth && height === lastHeight) return;
      lastWidth = width;
      lastHeight = height;

      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!this.map || typeof google === 'undefined' || width === 0 || height === 0) return;
        google.maps.event.trigger(this.map, 'resize');
        this.map.setCenter(this.center);
      }, 100);
    });

    this.resizeObserver.observe(this.mapElement.nativeElement);
  }

  centerOnUser() {
    if (this.center) {
      this.map.panTo(this.center);
      this.map.setZoom(16);
    }
  }

  private updateMarkers() {
    if (!this.map || typeof google === 'undefined') return;
    
    this.mapMarkers.forEach(m => m.setMap(null));
    this.mapMarkers = [];
    if (this.accuracyCircle) this.accuracyCircle.setMap(null);

    this._markers.forEach(m => {
      if (m.type === 'user') {
        this.renderUserMarker(m);
      } else {
        this.renderRestaurantMarker(m);
      }
    });
  }

  private renderUserMarker(m: any) {
    const lat = Number(m.lat);
    const lng = Number(m.lng);
    if (isNaN(lat) || isNaN(lng)) return;

    const marker = new google.maps.Marker({
      position: { lat, lng },
      map: this.map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: '#4285F4', // Azul Google / GPS
        fillOpacity: 1,
        scale: 8,
        strokeColor: '#ffffff',
        strokeWeight: 3
      },
      zIndex: 100
    });

    this.accuracyCircle = new google.maps.Circle({
      strokeColor: '#3b82f6',
      strokeOpacity: 0.4,
      strokeWeight: 1,
      fillColor: '#3b82f6',
      fillOpacity: 0.15,
      map: this.map,
      center: { lat, lng },
      radius: 150
    });

    this.mapMarkers.push(marker);
  }

  private updateRadiusCircle() {
    if (!this.map || !this.center || typeof google === 'undefined') return;

    if (this.radiusCircleObj) {
      this.radiusCircleObj.setMap(null);
    }

    this.radiusCircleObj = new google.maps.Circle({
      strokeColor: '#FF5A3C',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#FF5A3C',
      fillOpacity: 0.15,
      map: this.map,
      center: this.center,
      radius: (this.radioKm || 10) * 1000 // Km a metros
    });
  }

  private renderRestaurantMarker(m: any) {
    const lat = Number(m.lat);
    const lng = Number(m.lng);
    if (isNaN(lat) || isNaN(lng)) return;

    const markerColor = m.data?.especial ? '#FFC857' : '#FF5A3C';

    const marker = new google.maps.Marker({
      position: { lat, lng },
      map: this.map,
      title: m.nombre,
      zIndex: 50
    });

    marker.addListener('click', () => {
      this.onMarkerClick.emit(m.data || m);
      this.map.panTo(marker.getPosition());
    });

    this.mapMarkers.push(marker);

    const canvas = document.createElement('canvas');
    canvas.width = 60;
    canvas.height = 70;
    const ctx = canvas.getContext('2d')!;

    const drawMarker = (withImg: HTMLImageElement | null) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;

      ctx.fillStyle = markerColor;
      ctx.beginPath();
      ctx.arc(30, 30, 28, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.beginPath();
      ctx.moveTo(15, 45);
      ctx.lineTo(30, 65);
      ctx.lineTo(45, 45);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(30, 30, 25, 0, Math.PI * 2);
      ctx.stroke();

      if (withImg) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(30, 30, 23, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(withImg, 7, 7, 46, 46);
        ctx.restore();
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🍴', 30, 30);
      }

      marker.setIcon({
        url: canvas.toDataURL(),
        scaledSize: new google.maps.Size(40, 47),
        anchor: new google.maps.Point(20, 47)
      });
    };

    drawMarker(null);

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = this.restauranteService.resolveRestaurantImage(m.data);

    img.onload = () => drawMarker(img);
    img.onerror = () => drawMarker(null);
  }

  ngOnDestroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.mapMarkers) {
      this.mapMarkers.forEach(m => m && m.setMap && m.setMap(null));
    }
    if (this.accuracyCircle) this.accuracyCircle.setMap(null);
    if (this.radiusCircleObj) this.radiusCircleObj.setMap(null);
  }
}
