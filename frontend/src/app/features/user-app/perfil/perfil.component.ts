import { Component, OnInit, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { PuntosService } from '../../../core/services/puntos.service';
import { MovimientoService } from '../../../core/services/movimiento.service';
import { GlobalStateService } from '../../../core/auth/../state/global-state.service';
import { UserCardComponent } from '../../../shared/components/user-card/user-card.component';

import { SectionHeaderComponent } from '../../../shared/components/section-header/section-header.component';
import { AppCardComponent } from '../../../shared/components/app-card/app-card.component';
import { addIcons } from 'ionicons';
import * as icons from 'ionicons/icons';
import { CustomerI18nService, CustomerLanguage } from '../../../core/i18n/customer-i18n.service';
import { CustomerTranslatePipe } from '../../../core/i18n/customer-translate.pipe';
import { ThemePreference, ThemeService } from '../../../core/theme/theme.service';

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RouterModule, UserCardComponent, SectionHeaderComponent, CustomerTranslatePipe]
})
export class PerfilComponent implements OnInit {
  public icons = icons;
  public i18n = inject(CustomerI18nService);
  public languageOptions = this.i18n.languages;
  public themeService = inject(ThemeService);
  public themeOptions = this.themeService.options;
  user: any = null;
  isLoading = true;
  stats = {
    puntos: 0,
    premios: 0
  };

  private authService = inject(AuthService);
  private usuarioService = inject(UsuarioService);
  private puntosService = inject(PuntosService);
  private movimientoService = inject(MovimientoService);
  private toastCtrl = inject(ToastController);
  private globalState = inject(GlobalStateService);


  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  photoPreview: string | null = null;
  isUploading = false;

  // ESTADOS DE MODALES
  isEditProfileOpen = false;
  isNotificationsOpen = false;
  isSecurityOpen = false;
  isSupportOpen = false;
  isLanguageOpen = false;
  isAppearanceOpen = false;

  // FORMULARIOS
  editData = { nombre: '', email: '' };
  securityData = { current: '', new: '', confirm: '' };
  
  // PREFERENCIAS DE NOTIFICACIONES (Persistencia Local)
  notifPrefs = {
    push: true,
    promos: true,
    canjes: true,
    puntos: true,
    novedades: false
  };

  // FAQ DATA
  faqs = [
    { qKey: 'profile.faq.earn.q', aKey: 'profile.faq.earn.a', open: false },
    { qKey: 'profile.faq.expire.q', aKey: 'profile.faq.expire.a', open: false },
    { qKey: 'profile.faq.transfer.q', aKey: 'profile.faq.transfer.a', open: false }
  ];

  constructor() {
    addIcons({
      personCircleOutline: icons.personCircleOutline,
      shieldCheckmarkOutline: icons.shieldCheckmarkOutline,
      logOutOutline: icons.logOutOutline,
      chevronForwardOutline: icons.chevronForwardOutline,
      star: icons.star,
      gift: icons.gift,
      settingsOutline: icons.settingsOutline,
      notificationsOutline: icons.notificationsOutline,
      helpCircleOutline: icons.helpCircleOutline,
      cameraOutline: icons.cameraOutline,
      cloudUploadOutline: icons.cloudUploadOutline,
      languageOutline: icons.languageOutline,
      checkmarkCircleOutline: icons.checkmarkCircleOutline,
      moonOutline: icons.moonOutline,
      sunnyOutline: icons.sunnyOutline,
      contrastOutline: icons.contrastOutline
    });
  }

  get currentLanguage(): CustomerLanguage {
    return this.i18n.currentLanguage;
  }

  get currentLanguageLabel(): string {
    return this.i18n.currentLanguageLabel;
  }

  get currentThemeLabel(): string {
    return this.themeOptions.find(option => option.value === this.themeService.preference)?.label || 'Automático';
  }

  setLanguage(language: CustomerLanguage) {
    this.i18n.use(language);
    this.isLanguageOpen = false;
    this.showToast(this.i18n.instant('profile.language.saved'), 'success');
  }

  setThemePreference(value: string | number | undefined | null) {
    if (value === 'light' || value === 'dark' || value === 'auto') {
      this.themeService.setTheme(value);
    }
  }

  getThemeIcon(theme: ThemePreference) {
    if (theme === 'light') return icons.sunnyOutline;
    if (theme === 'dark') return icons.moonOutline;
    return icons.contrastOutline;
  }

  ngOnInit() {
    this.cargarDatos();
    this.loadNotifPrefs();
  }

  loadNotifPrefs() {
    const saved = localStorage.getItem('fidely_notif_prefs');
    if (saved) {
      this.notifPrefs = JSON.parse(saved);
    }
  }

  saveNotifPrefs() {
    localStorage.setItem('fidely_notif_prefs', JSON.stringify(this.notifPrefs));
    console.log('[NOTIFICATIONS UPDATED]', this.notifPrefs);
    this.showToast(this.i18n.instant('profile.toast.notificationsSaved'), 'success');
  }

  cargarDatos() {
    this.authService.authState$.subscribe(state => {
      if (state.id) {
        // 1. Cargar datos básicos del usuario
        this.usuarioService.getUsuarioById(state.id).subscribe({
          next: (data) => {
            this.user = data;
            this.user.fotoPerfil = this.usuarioService.resolveProfileImage(data);
            this.isLoading = false;
            console.log("👤 [PROFILE LOADED] Usuario:", this.user.nombre, "Foto:", this.user.fotoPerfil);
          },
          error: () => {
            this.isLoading = false;
          }
        });

        // 2. Cargar puntos totales globales
        this.puntosService.getTotalPuntos(state.id).subscribe((res: any) => {
          this.stats.puntos = res.puntos || 0;
          // Actualizar puntos en el objeto user para el componente user-card
          if (this.user) this.user.puntos = this.stats.puntos;
        });

        // 3. Cargar historial para contar premios canjeados
        this.movimientoService.getHistorial().subscribe((movs: any[]) => {
          this.stats.premios = movs.filter((m: any) => 
            ['CANJE', 'CANJEADOS', 'CANJEAR'].includes(m.tipo?.toUpperCase())
          ).length;
        });
      }
    });
  }

  logout() {
    this.authService.logout();
  }

  triggerFileInput() {
    if (!this.user) {
      this.showToast(this.i18n.instant('profile.toast.waitProfile'), 'warning');
      return;
    }
    console.log("📸 Abriendo selector de archivos...");
    this.fileInput.nativeElement.click();
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    console.log("📁 Archivo seleccionado:", file);
    
    if (file) {
      // Validar tipo de archivo (solo imágenes)
      if (!file.type.startsWith('image/')) {
        this.showToast(this.i18n.instant('profile.toast.invalidImage'), 'warning');
        return;
      }

      console.log("✅ Imagen válida detectada:", file.type);
      // Preview instantánea
      const reader = new FileReader();
      reader.onload = () => {
        this.photoPreview = reader.result as string;
        console.log("✨ Preview generada, iniciando subida...");
        this.uploadPhoto(file);
      };
      reader.readAsDataURL(file);
    }
  }

  async uploadPhoto(file: File) {
    if (!this.user?.id) return;

    this.isUploading = true;
    this.usuarioService.uploadPhoto(this.user.id, file).subscribe({
      next: (newUrl) => {
        this.isUploading = false;
        console.log("🔗 [UPLOAD OK] Ruta recibida del backend:", newUrl);
        // ✅ Resolver inmediatamente para visualización correcta
        const resolvedUrl = this.usuarioService.resolveImageUrl(newUrl);
        if (resolvedUrl) {
          this.user.fotoPerfil = resolvedUrl;
          // 🔥 Actualizar GlobalState para que Header y Wallet se sincronicen
          this.globalState.updatePhoto(resolvedUrl);
        }
        this.photoPreview = null;
        this.showToast(this.i18n.instant('profile.toast.photoUpdated'), 'success');

      },
      error: (err) => {
        this.isUploading = false;
        this.photoPreview = null;
        console.error('Error subiendo foto:', err);
        this.showToast(this.i18n.instant('profile.toast.photoError'), 'danger');
      }
    });
  }

  onImageError() {
    console.warn("⚠️ [IMAGE ERROR] La URL no es accesible:", this.user?.fotoPerfil);
    if (this.user) {
      this.user.fotoPerfil = this.usuarioService.profilePlaceholder;
    }
  }

  // ============================================================
  // LÓGICA DE AJUSTES
  // ============================================================

  openEditProfile() {
    console.log('[EDIT PROFILE OPEN]');
    this.editData = { nombre: this.user.nombre, email: this.user.email };
    this.isEditProfileOpen = true;
  }

  saveProfile() {
    if (!this.editData.nombre || !this.editData.email) return;

    this.usuarioService.updateUsuario(this.user.id, {
      ...this.user,
      nombre: this.editData.nombre,
      email: this.editData.email
    }).subscribe({
      next: (updated) => {
        this.user = { ...this.user, ...updated };
        this.isEditProfileOpen = false;
        this.showToast(this.i18n.instant('profile.toast.profileUpdated'), 'success');
        console.log('[PROFILE UPDATED]', updated);
      },
      error: () => this.showToast(this.i18n.instant('profile.toast.profileError'), 'danger')
    });
  }

  openSecurity() {
    console.log('[SECURITY OPEN]');
    this.securityData = { current: '', new: '', confirm: '' };
    this.isSecurityOpen = true;
  }

  saveSecurity() {
    if (this.securityData.new !== this.securityData.confirm) {
      this.showToast('Las contraseñas no coinciden', 'warning');
      return;
    }

    if (this.securityData.new.length < 6) {
      this.showToast('La contraseña debe tener al menos 6 caracteres', 'warning');
      return;
    }

    this.usuarioService.updateUsuario(this.user.id, {
      ...this.user,
      password: this.securityData.new
    }).subscribe({
      next: () => {
        this.isSecurityOpen = false;
        this.showToast('Contraseña actualizada correctamente', 'success');
        console.log('[SECURITY ACTION] Password changed');
      },
      error: () => this.showToast('Error al cambiar la contraseña', 'danger')
    });
  }

  contactSupport(type: 'wa' | 'mail') {
    console.log('[SUPPORT OPENED]', type);
    if (type === 'wa') {
      window.open('https://wa.me/34677795073?text=Hola%20FidelyApp,%20necesito%20ayuda%20con%20mi%20cuenta', '_blank');
    } else {
      window.open('mailto:hola@fidelyapp.com?subject=Soporte%20FidelyApp&body=Hola%20equipo%20de%20FidelyApp,', '_blank');
    }
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color,
      position: 'bottom',
      cssClass: 'custom-toast'
    });
    toast.present();
  }
}
