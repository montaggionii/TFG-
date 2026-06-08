import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonicModule, ToastController, LoadingController } from '@ionic/angular';
import { RestauranteService } from '../../../core/services/restaurante.service';
import { GlobalStateService } from '../../../core/state/global-state.service';
import { environment } from '../../../../environments/environment';
import { addIcons } from 'ionicons';
import { 
  mapOutline, 
  checkmarkCircleOutline,
  saveOutline,
  locateOutline,
  pinOutline,
  businessOutline,
  mailOutline,
  callOutline,
  searchOutline,
  cameraOutline,
  logOutOutline,
  moonOutline,
  sunnyOutline,
  contrastOutline
} from 'ionicons/icons';
import { MapComponent } from '../../../shared/components/map/map.component';
import { MapsService } from '../../../core/services/maps.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ThemePreference, ThemeService } from '../../../core/theme/theme.service';
import { SafeRestaurantImageDirective } from '../../../shared/directives/safe-restaurant-image.directive';

declare var google: any;

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule, SafeRestaurantImageDirective]
})
export class SettingsComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private restauranteService = inject(RestauranteService);
  private globalState = inject(GlobalStateService);
  private toastCtrl = inject(ToastController);
  private loadingCtrl = inject(LoadingController);
  private authService = inject(AuthService);
  public themeService = inject(ThemeService);
  public themeOptions = this.themeService.options;

  settingsForm: FormGroup;
  restaurantId: number | undefined;
  map: any;
  restaurantMarker: any; // Marcador específico para el negocio
  userMarker: any;       // Marcador específico para el GPS del usuario
  lat: number | null = null; 
  lng: number | null = null;
  isSaving = false;
  isSavingLocation = false;
  isUploadingImage = false;
  isLoaded = false;
  profileCompletion = 0;
  selectedFile: File | null = null;
  previewImage: string | null = null;
  profileImageSource: any = null;
  restaurante: any = {}; // Objeto maestro para persistencia
  apiUrl = environment.apiUrl;
  private mapsService = inject(MapsService);

  constructor() {
    addIcons({ 
      saveOutline, 
      locateOutline, 
      pinOutline, 
      businessOutline, 
      mailOutline, 
      callOutline, 
      mapOutline,
      checkmarkCircleOutline,
      searchOutline,
      cameraOutline,
      logOutOutline,
      moonOutline,
      sunnyOutline,
      contrastOutline
    });

    this.settingsForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      telefono: ['', [Validators.required, Validators.pattern('^[0-9+ ]{9,15}$')]],
      direccion: ['', [Validators.required]],
      ciudad: ['', [Validators.required]],
      codigoPostal: ['', [Validators.required, Validators.pattern('^[0-9]{5}$')]],
      tipo: ['Restaurante'],
      descripcion: [''],
      latitud: [null],
      longitud: [null],
      finalizado: [true]
    });
  }

  async ngOnInit() {
    this.initFromState();
  }

  setThemePreference(value: string | number | undefined | null) {
    if (value === 'light' || value === 'dark' || value === 'auto') {
      this.themeService.setTheme(value);
    }
  }

  getThemeIcon(theme: ThemePreference): string {
    if (theme === 'light') return 'sunny-outline';
    if (theme === 'dark') return 'moon-outline';
    return 'contrast-outline';
  }

  /**
   * Ciclo de vida de Ionic: Se ejecuta siempre que la vista entra en pantalla.
   * Esto soluciona el bug de persistencia tras cambiar de cuenta (Logout/Login).
   */
  async ionViewWillEnter() {
    console.log('🔄 [SETTINGS] Entrando en configuración. Refrescando datos...');
    this.isLoaded = false; // Forzar estado de carga visual
    this.initFromState();
  }

  private async initFromState() {
    const state = this.globalState.getState();
    if (state?.id) {
      this.restaurantId = state.id;
      await this.cargarDatos();
    } else {
      console.warn('⚠️ [SETTINGS] No hay ID de restaurante en el estado global');
    }
  }

  async cargarDatos() {
    if (!this.restaurantId) return;

    const loading = await this.loadingCtrl.create({
      message: 'Cargando configuración...',
      spinner: 'crescent',
      cssClass: 'glass-loading'
    });
    await loading.present();

    this.restauranteService.getRestauranteById(this.restaurantId).subscribe({
      next: (data) => {
        // PRIORIDAD ABSOLUTA: Datos del backend
        const backendLat = data.latitud || data.lat;
        const backendLng = data.longitud || data.lng;

        if (backendLat && backendLng) {
          console.log("✅ DATOS BACKEND CARGADOS:", backendLat, backendLng);
          this.lat = backendLat;
          this.lng = backendLng;
        } else {
          console.warn("⚠️ No hay coordenadas en backend, usando Valencia por defecto");
          this.lat = 39.4699;
          this.lng = -0.3763;
        }

          this.settingsForm.patchValue({
            nombre: data.nombre,
            email: data.email,
            telefono: data.telefono,
            direccion: data.direccion,
            ciudad: data.ciudad,
            codigoPostal: data.codigoPostal || '',
            tipo: data.tipo || 'Restaurante',
            descripcion: data.descripcion || '',
            latitud: this.lat,
            longitud: this.lng,
            finalizado: data.finalizado ?? true
          });

          this.restaurante = data;
          this.profileImageSource = data;
          console.log("📥 DATOS RECUPERADOS DEL BACKEND:", data);

          if (data.imagenUrl || data.imagen) {
            this.previewImage = this.restauranteService.resolveRestaurantImage(data);
            this.profileImageSource = this.previewImage;
            console.log("🖼️ [LOGO REFRESH OK] URL resuelta:", this.previewImage);
          }
          
          this.calculateCompletion();
        this.isLoaded = true; // AHORA se puede renderizar el mapa
        loading.dismiss();
      },
      error: (err) => {
        loading.dismiss();
        console.error('Error al cargar datos:', err);
        this.mostrarToast('No se pudieron cargar los datos del restaurante', 'danger');
        // Fallback seguro para que la app no rompa, pero marcamos como cargado
        this.lat = 39.4699;
        this.lng = -0.3763;
        this.isLoaded = true;
      }
    });
  }

  /**
   * Se ejecuta cuando el componente hijo app-map ha inicializado el mapa de Google
   */
  onMapReady(mapInstance: any) {
    this.map = mapInstance;
    this.initPickerMarker();
  }

  initPickerMarker() {
    if (!this.map || typeof google === 'undefined') return;

    // Crear marcador de selección del restaurante (📍 Rojo)
    this.restaurantMarker = new google.maps.Marker({
      position: { lat: this.lat, lng: this.lng },
      map: this.map,
      draggable: true,
      title: "Ubicación de tu restaurante",
      animation: google.maps.Animation.DROP,
      icon: "http://maps.google.com/mapfiles/ms/icons/red-dot.png"
    });

    this.restaurantMarker.addListener('dragend', () => {
      const pos = this.restaurantMarker.getPosition();
      console.log("Nueva ubicación ajustada manualmente:", pos.lat(), pos.lng());
      this.lat = pos.lat();
      this.lng = pos.lng();
      this.settingsForm.patchValue({
        latitud: this.lat,
        longitud: this.lng
      });
    });

    // Centrar mapa suavemente
    this.map.panTo({ lat: this.lat, lng: this.lng });
    this.map.setZoom(16);
  }

  async buscarDireccion() {
    const direccion = this.settingsForm.get('direccion')?.value;
    const cp = this.settingsForm.get('codigoPostal')?.value;
    const ciudad = this.settingsForm.get('ciudad')?.value;

    if (!direccion || !cp || !ciudad) {
      this.mostrarToast('Por favor, completa dirección, CP y ciudad', 'warning');
      return;
    }

    const fullSearch = `${direccion}, ${cp} ${ciudad}`;

    const loading = await this.loadingCtrl.create({
      message: 'Buscando ubicación...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const coords = await this.mapsService.geocodeAddress(fullSearch);
      console.log('Dirección encontrada:', fullSearch, coords);
      
      this.lat = coords.lat;
      this.lng = coords.lng;

      this.settingsForm.patchValue({
        latitud: this.lat,
        longitud: this.lng
      });

      if (this.map) {
        this.map.panTo(coords);
        this.map.setZoom(17);
      }
      
      if (this.restaurantMarker) {
        this.restaurantMarker.setPosition(coords);
      } else {
        this.initPickerMarker();
      }

      loading.dismiss();
      this.mostrarToast('Dirección encontrada en el mapa', 'success');
    } catch (err) {
      loading.dismiss();
      console.error('Error al geocodificar:', err);
      this.mostrarToast('No se pudo encontrar la dirección exacta', 'danger');
    }
  }

  private renderUserLocation(pos: any) {
    if (this.userMarker) {
      this.userMarker.setPosition(pos);
    } else {
      this.userMarker = new google.maps.Marker({
        position: pos,
        map: this.map,
        title: "Tu ubicación actual",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: '#3b82f6',
          fillOpacity: 1,
          scale: 8,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });
    }
  }

  async usarUbicacionActual() {
    if (!navigator.geolocation) {
      this.mostrarToast('Geolocalización no soportada', 'warning');
      return;
    }

    const loading = await this.loadingCtrl.create({ 
      message: 'Obteniendo ubicación...',
      spinner: 'crescent'
    });
    await loading.present();

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.lat = position.coords.latitude;
        this.lng = position.coords.longitude;
        
        const pos = { lat: this.lat, lng: this.lng };
        if (this.map) {
          this.map.panTo(pos);
          this.map.setZoom(17);
        }
        
        // El marcador del restaurante se mueve a la ubicación del GPS
        if (this.restaurantMarker) {
          this.restaurantMarker.setPosition(pos);
        }

        // Crear/Actualizar marcador azul de "Tú estás aquí"
        this.renderUserLocation(pos);
        
        this.settingsForm.patchValue({
          latitud: this.lat,
          longitud: this.lng
        });
        
        loading.dismiss();
        this.mostrarToast('Ubicación capturada correctamente', 'success');
      },
      (error) => {
        loading.dismiss();
        this.mostrarToast('No se pudo obtener la ubicación', 'danger');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

      if (!allowedTypes.includes(file.type)) {
        this.mostrarToast('Formato no permitido. Usa JPG, JPEG, PNG o WEBP', 'warning');
        event.target.value = '';
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        this.mostrarToast('Archivo demasiado grande. Máximo 5MB', 'warning');
        event.target.value = '';
        return;
      }
      
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        // SOLAMENTE PREVIEW LOCAL (Temporal)
        this.previewImage = reader.result as string; 
        this.profileImageSource = this.previewImage;
        console.log("📸 Preview local generada (Base64)");
        this.subirImagenDirecta();
      };
      reader.readAsDataURL(file);
    }
  }

  triggerFileSelect() {
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) fileInput.click();
  }

  async subirImagenDirecta() {
    if (!this.selectedFile || !this.restaurantId) return;
    
    this.isUploadingImage = true;
    const formData = new FormData();
    formData.append('file', this.selectedFile, this.selectedFile.name);

    console.log("📡 [NETWORK] Iniciando subida de imagen de restaurante...");
    this.restauranteService.subirImagen(this.restaurantId, formData).subscribe({
      next: (res) => {
        console.log("📡 [NETWORK] RESPUESTA EXITOSA:", res);
        this.isUploadingImage = false;

        const imagePath = res?.imagenUrl || res?.imagen || res?.url;
        if (!imagePath) {
          this.mostrarToast('No se pudo actualizar la imagen del restaurante', 'danger');
          this.profileImageSource = this.restaurante;
          return;
        }
        
        // PERSISTENCIA GARANTIZADA: Guardamos ruta relativa y resolvemos para preview
        this.restaurante = { ...this.restaurante, ...res, imagenUrl: imagePath };
        this.previewImage = this.restauranteService.resolverImagenUrl(imagePath); 
        this.profileImageSource = this.previewImage;
        
        console.log("🖼️ [UPLOAD RESTAURANTE OK] Ruta:", imagePath, "URL Final:", this.previewImage);
        
        // 🔥 ACTUALIZAR ESTADO GLOBAL INMEDIATAMENTE
        if (this.previewImage) {
          this.globalState.updatePhoto(this.previewImage);
        }

        this.mostrarToast('Imagen subida y persistida correctamente', 'success');
        this.calculateCompletion();
      },
      error: (err) => {
        console.error("📡 [NETWORK] ERROR EN LA SUBIDA:", err);
        const backendMessage = typeof err.error === 'string' ? err.error : err.error?.message;
        const errorMsg = err.status === 0 ? 'Error de conexión con el servidor' :
                         err.status === 400 ? (backendMessage || 'No se pudo subir la imagen') :
                         err.status === 413 ? (backendMessage || 'Archivo demasiado grande. Máximo 5MB') :
                         err.status === 403 ? 'No tienes permisos para subir la imagen' :
                         backendMessage || 'No se pudo subir la imagen';
        
        this.isUploadingImage = false;
        this.mostrarToast(errorMsg, 'danger');
        
        // IMPORTANTE: Si falla la subida, restauramos la imagen anterior 
        this.previewImage = this.restaurante.imagenUrl;
        this.profileImageSource = this.previewImage || this.restaurante;
      }
    });
  }

  calculateCompletion() {
    const v = this.settingsForm.value;
    let points = 0;
    if (v.nombre) points += 20;
    if (v.descripcion) points += 20;
    if (v.telefono) points += 20;
    if (v.direccion) points += 20;
    if (this.previewImage) points += 20;
    this.profileCompletion = points;
  }

  async saveAllChanges() {
    if (this.settingsForm.invalid || !this.restaurantId) {
      this.mostrarToast('Por favor, completa todos los campos correctamente', 'warning');
      return;
    }

    this.isSaving = true;
    const formValues = this.settingsForm.value;
    
    const payload = {
      id: this.restaurantId,
      ...formValues,
      latitud: this.lat,
      longitud: this.lng,
      imagenUrl: this.restaurante.imagenUrl,
      finalizado: true
    };

    console.log("🚀 GUARDANDO CONFIGURACIÓN INTEGRAL:", payload);

    this.restauranteService.updateRestaurante(this.restaurantId, payload).subscribe({
      next: (res) => {
        this.isSaving = false;
        this.restaurante = res;

        // 🔥 ACTUALIZAR ESTADO GLOBAL INMEDIATAMENTE
        const currentState = this.globalState.getState();
        if (currentState) {
          this.globalState.setState({
            ...currentState,
            nombre: res.nombre,
            fotoPerfil: this.previewImage || currentState.fotoPerfil
          });
        }

        this.mostrarToast('Ajustes actualizados correctamente', 'success');
        this.calculateCompletion();
      },
      error: () => {
        this.isSaving = false;
        this.mostrarToast('Error al guardar los cambios', 'danger');
      }
    });
  }

  ngOnDestroy() {
    if (this.restaurantMarker) {
      google.maps.event.clearInstanceListeners(this.restaurantMarker);
    }
    if (this.userMarker) {
      google.maps.event.clearInstanceListeners(this.userMarker);
    }
    if (this.map) {
      google.maps.event.clearInstanceListeners(this.map);
    }
  }

  async logout() {
    this.authService.logout();
  }

  private async mostrarToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      color,
      duration: 2000,
      position: 'top'
    });
    toast.present();
  }
}
