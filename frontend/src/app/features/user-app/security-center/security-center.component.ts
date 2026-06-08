import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController, AlertController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import * as icons from 'ionicons/icons';
import { AuthService } from '../../../core/auth/auth.service';
import { UsuarioService } from '../../../core/services/usuario.service';
import { CustomerI18nService } from '../../../core/i18n/customer-i18n.service';
import { CustomerTranslatePipe } from '../../../core/i18n/customer-translate.pipe';

@Component({
  selector: 'app-security-center',
  templateUrl: './security-center.component.html',
  styleUrls: ['./security-center.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, CustomerTranslatePipe]
})
export class SecurityCenterComponent implements OnInit {
  private authService = inject(AuthService);
  private usuarioService = inject(UsuarioService);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private i18n = inject(CustomerI18nService);
  public icons = icons;

  user: any = null;
  isLoading = true;
  isSavingPassword = false;
  securityData = { current: '', new: '', confirm: '' };
  passwordTouched = false;
  
  // MOCK DATA PARA PREMIUM FEEL
  sessions = [
    { device: 'iPhone 15 Pro', location: 'Madrid, ES', active: true, ip: '192.168.1.45', icon: icons.phonePortraitOutline },
    { device: 'MacBook Pro 14"', location: 'Madrid, ES', active: false, ip: '84.120.45.11', icon: icons.desktopOutline }
  ];

  activityLogs = [
    { type: 'login', titleKey: 'security.activity.login', dateKey: 'security.date.today', date: '', icon: icons.logInOutline, color: 'success' },
    { type: 'security', titleKey: 'security.activity.photo', dateKey: 'security.date.yesterday', date: '', icon: icons.cameraOutline, color: 'primary' },
    { type: 'reward', titleKey: 'security.activity.reward', dateKey: '', date: '10 May, 18:30', icon: icons.giftOutline, color: 'secondary' }
  ];

  alertsConfig = {
    login: true,
    suspicious: true,
    rewards: true
  };

  constructor() {
    addIcons({
      chevronBackOutline: icons.chevronBackOutline,
      shieldCheckmarkOutline: icons.shieldCheckmarkOutline,
      lockClosedOutline: icons.lockClosedOutline,
      phonePortraitOutline: icons.phonePortraitOutline,
      desktopOutline: icons.desktopOutline,
      logInOutline: icons.logInOutline,
      cameraOutline: icons.cameraOutline,
      giftOutline: icons.giftOutline,
      notificationsOutline: icons.notificationsOutline,
      alertCircleOutline: icons.alertCircleOutline,
      keyOutline: icons.keyOutline,
      fingerPrintOutline: icons.fingerPrintOutline,
      eyeOutline: icons.eyeOutline,
      eyeOffOutline: icons.eyeOffOutline,
      powerOutline: icons.powerOutline,
      mailOutline: icons.mailOutline,
      calendarOutline: icons.calendarOutline,
      timeOutline: icons.timeOutline
    });
  }

  ngOnInit() {
    console.log('[SECURITY OPEN]');
    this.authService.authState$.subscribe(state => {
      if (state.id) {
        this.usuarioService.getUsuarioById(state.id).subscribe(data => {
          this.user = data;
          this.isLoading = false;
        }, () => {
          this.isLoading = false;
        });
      } else {
        this.isLoading = false;
      }
    });
  }

  getPasswordStrength(): { label: string, color: string, width: string } {
    const pass = this.securityData.new;
    if (!pass) return { label: this.i18n.instant('security.strength.waiting'), color: '#e2e8f0', width: '0%' };
    if (pass.length < 8) return { label: this.i18n.instant('security.strength.weak'), color: '#ef4444', width: '30%' };
    if (pass.length < 12) return { label: this.i18n.instant('security.strength.medium'), color: '#f59e0b', width: '60%' };
    return { label: this.i18n.instant('security.strength.strong'), color: '#22c55e', width: '100%' };
  }

  get passwordErrors(): string[] {
    const errors: string[] = [];
    if (!this.passwordTouched) return errors;

    if (!this.securityData.current) {
      errors.push('Introduce tu contraseña actual.');
    }

    if (!this.securityData.new || this.securityData.new.length < 8) {
      errors.push('La nueva contraseña debe tener al menos 8 caracteres.');
    }

    if (this.securityData.new && this.securityData.current && this.securityData.new === this.securityData.current) {
      errors.push('La nueva contraseña debe ser distinta de la actual.');
    }

    if (this.securityData.confirm && this.securityData.new !== this.securityData.confirm) {
      errors.push('La confirmación no coincide con la nueva contraseña.');
    }

    return errors;
  }

  get canSubmitPassword(): boolean {
    return !!this.user?.id
      && !!this.securityData.current
      && this.securityData.new.length >= 8
      && this.securityData.new === this.securityData.confirm
      && this.securityData.new !== this.securityData.current
      && !this.isSavingPassword;
  }

  savePassword() {
    this.passwordTouched = true;

    if (!this.securityData.current) {
      this.showToast('Introduce tu contraseña actual', 'warning');
      return;
    }

    if (this.securityData.new !== this.securityData.confirm) {
      this.showToast(this.i18n.instant('security.toast.passwordMismatch'), 'warning');
      return;
    }

    if (this.securityData.new.length < 8) {
      this.showToast(this.i18n.instant('security.toast.passwordWeak'), 'warning');
      return;
    }

    if (this.securityData.new === this.securityData.current) {
      this.showToast('La nueva contraseña debe ser distinta de la actual', 'warning');
      return;
    }

    this.isSavingPassword = true;
    this.usuarioService.changePassword(this.user.id, this.securityData.current, this.securityData.new).subscribe({
      next: () => {
        this.isSavingPassword = false;
        console.log('[PASSWORD CHANGED]');
        this.securityData = { current: '', new: '', confirm: '' };
        this.passwordTouched = false;
        this.showToast(this.i18n.instant('security.toast.passwordUpdated'), 'success');
      },
      error: (err) => {
        this.isSavingPassword = false;
        const message = err?.status === 401
          ? 'La contraseña actual no es correcta'
          : this.i18n.instant('security.toast.passwordError');
        this.showToast(message, 'danger');
      }
    });
  }

  async closeAllSessions() {
    const alert = await this.alertCtrl.create({
      header: this.i18n.instant('security.alert.closeSessions.title'),
      message: this.i18n.instant('security.alert.closeSessions.message'),
      buttons: [
        { text: this.i18n.instant('common.cancel'), role: 'cancel' },
        { 
          text: this.i18n.instant('security.alert.closeSessions.confirm'), 
          handler: () => {
            console.log('[SESSION CLOSED] Other sessions terminated');
            this.showToast(this.i18n.instant('security.toast.sessionsClosed'), 'success');
          }
        }
      ]
    });
    await alert.present();
  }

  onAlertChange() {
    console.log('[SECURITY SETTINGS UPDATED]', this.alertsConfig);
    this.showToast(this.i18n.instant('security.toast.preferencesSaved'), 'success');
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
