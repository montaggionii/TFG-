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
  twoFactorEnabled = false;
  recoveryEmail = '';
  securityScore = 65;
  
  sessions: Array<{ id: string; device: string; location: string; active: boolean; ip: string; lastSeen: string; icon: any }> = [];

  activityLogs: Array<{ type: string; title: string; date: string; icon: any; color: string }> = [];

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
      timeOutline: icons.timeOutline,
      checkmarkCircleOutline: icons.checkmarkCircleOutline,
      settingsOutline: icons.settingsOutline,
      refreshOutline: icons.refreshOutline,
      trashOutline: icons.trashOutline
    });
  }

  ngOnInit() {
    console.log('[SECURITY OPEN]');
    this.authService.authState$.subscribe(state => {
      if (state.id) {
        this.usuarioService.getUsuarioById(state.id).subscribe(data => {
          this.user = data;
          this.initializeLocalSecurity();
          this.isLoading = false;
        }, () => {
          this.initializeLocalSecurity();
          this.isLoading = false;
        });
      } else {
        this.initializeLocalSecurity();
        this.isLoading = false;
      }
    });
  }

  private initializeLocalSecurity() {
    this.loadPreferences();
    this.registerCurrentSession();
    this.loadActivityLogs();
    this.updateSecurityScore();
  }

  private scopedKey(name: string): string {
    const id = this.user?.id || localStorage.getItem('userId') || 'guest';
    return `fidelyfood.security.${id}.${name}`;
  }

  private loadPreferences() {
    const rawAlerts = localStorage.getItem(this.scopedKey('alerts'));
    if (rawAlerts) {
      try {
        this.alertsConfig = { ...this.alertsConfig, ...JSON.parse(rawAlerts) };
      } catch {
        localStorage.removeItem(this.scopedKey('alerts'));
      }
    }

    this.twoFactorEnabled = localStorage.getItem(this.scopedKey('2fa')) === 'true';
    this.recoveryEmail = localStorage.getItem(this.scopedKey('recoveryEmail')) || '';
  }

  private registerCurrentSession() {
    const currentSessionKey = this.scopedKey('currentSessionId');
    let sessionId = localStorage.getItem(currentSessionKey);
    if (!sessionId) {
      sessionId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `session-${Date.now()}`;
      localStorage.setItem(currentSessionKey, sessionId);
    }

    const raw = localStorage.getItem(this.scopedKey('sessions'));
    let storedSessions: any[] = [];
    if (raw) {
      try {
        storedSessions = JSON.parse(raw);
      } catch {
        storedSessions = [];
      }
    }

    const current = {
      id: sessionId,
      device: this.detectDeviceName(),
      location: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Ubicación local',
      active: true,
      ip: 'Este dispositivo',
      lastSeen: new Date().toISOString()
    };

    const merged = [
      current,
      ...storedSessions
        .filter(session => session.id && session.id !== sessionId)
        .slice(0, 4)
        .map(session => ({ ...session, active: false }))
    ];

    localStorage.setItem(this.scopedKey('sessions'), JSON.stringify(merged));
    this.sessions = merged.map(session => ({
      ...session,
      icon: this.getSessionIcon(session.device)
    }));
  }

  private loadActivityLogs() {
    const raw = localStorage.getItem(this.scopedKey('activity'));
    if (raw) {
      try {
        this.activityLogs = JSON.parse(raw).map((log: any) => ({
          ...log,
          icon: this.getActivityIcon(log.type)
        }));
      } catch {
        this.activityLogs = [];
      }
    }

    if (this.activityLogs.length === 0) {
      this.addActivity('login', 'Inicio de sesión en este dispositivo', 'success', false);
    }
  }

  private addActivity(type: string, title: string, color = 'primary', showToast = false) {
    const next = [
      {
        type,
        title,
        date: this.formatDateTime(new Date().toISOString()),
        icon: this.getActivityIcon(type),
        color
      },
      ...this.activityLogs
    ].slice(0, 8);

    this.activityLogs = next;
    localStorage.setItem(this.scopedKey('activity'), JSON.stringify(next.map(log => ({
      type: log.type,
      title: log.title,
      date: log.date,
      color: log.color
    }))));

    if (showToast) {
      this.showToast(title, 'success');
    }
  }

  private updateSecurityScore() {
    let score = 65;
    if (this.twoFactorEnabled) score += 15;
    if (this.recoveryEmail) score += 10;
    if (this.alertsConfig.login && this.alertsConfig.suspicious) score += 10;
    this.securityScore = Math.min(score, 100);
  }

  private detectDeviceName(): string {
    const ua = navigator.userAgent;
    const browser = ua.includes('Chrome') ? 'Chrome' : ua.includes('Safari') ? 'Safari' : 'Navegador';
    if (/iPhone/i.test(ua)) return `iPhone · ${browser}`;
    if (/iPad/i.test(ua)) return `iPad · ${browser}`;
    if (/Android/i.test(ua)) return `Android · ${browser}`;
    if (/Mac/i.test(ua)) return `Mac · ${browser}`;
    if (/Windows/i.test(ua)) return `Windows · ${browser}`;
    return browser;
  }

  private getSessionIcon(device: string) {
    return /iPhone|iPad|Android/i.test(device) ? icons.phonePortraitOutline : icons.desktopOutline;
  }

  private getActivityIcon(type: string) {
    if (type === 'login') return icons.logInOutline;
    if (type === 'password') return icons.keyOutline;
    if (type === '2fa') return icons.fingerPrintOutline;
    if (type === 'recovery') return icons.mailOutline;
    if (type === 'session') return icons.powerOutline;
    return icons.shieldCheckmarkOutline;
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return 'No disponible';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
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
        this.addActivity('password', 'Contraseña actualizada', 'success');
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
    const otherSessions = this.sessions.filter(session => !session.active);
    if (otherSessions.length === 0) {
      this.showToast('No hay otras sesiones abiertas en este navegador.', 'medium');
      return;
    }

    const alert = await this.alertCtrl.create({
      header: this.i18n.instant('security.alert.closeSessions.title'),
      message: this.i18n.instant('security.alert.closeSessions.message'),
      buttons: [
        { text: this.i18n.instant('common.cancel'), role: 'cancel' },
        { 
          text: this.i18n.instant('security.alert.closeSessions.confirm'), 
          handler: () => {
            this.sessions = this.sessions.filter(session => session.active);
            localStorage.setItem(this.scopedKey('sessions'), JSON.stringify(this.sessions.map(({ icon, ...session }) => session)));
            this.addActivity('session', 'Otras sesiones cerradas', 'success');
            this.showToast(this.i18n.instant('security.toast.sessionsClosed'), 'success');
          }
        }
      ]
    });
    await alert.present();
  }

  terminateSession(sessionId: string) {
    const target = this.sessions.find(session => session.id === sessionId);
    if (!target || target.active) return;
    this.sessions = this.sessions.filter(session => session.id !== sessionId);
    localStorage.setItem(this.scopedKey('sessions'), JSON.stringify(this.sessions.map(({ icon, ...session }) => session)));
    this.addActivity('session', `Sesión eliminada: ${target.device}`, 'success');
    this.showToast('Sesión eliminada', 'success');
  }

  onAlertChange() {
    console.log('[SECURITY SETTINGS UPDATED]', this.alertsConfig);
    localStorage.setItem(this.scopedKey('alerts'), JSON.stringify(this.alertsConfig));
    this.addActivity('settings', 'Preferencias de alerta actualizadas', 'primary');
    this.updateSecurityScore();
    this.showToast(this.i18n.instant('security.toast.preferencesSaved'), 'success');
  }

  async manageTwoFactor() {
    const alert = await this.alertCtrl.create({
      header: this.twoFactorEnabled ? 'Desactivar 2FA' : 'Activar 2FA',
      message: this.twoFactorEnabled
        ? 'La verificación adicional dejará de figurar como activa en este dispositivo.'
        : 'Se registrará una capa adicional de verificación para esta cuenta en este dispositivo.',
      buttons: [
        { text: this.i18n.instant('common.cancel'), role: 'cancel' },
        {
          text: this.twoFactorEnabled ? 'Desactivar' : 'Activar',
          handler: () => {
            this.twoFactorEnabled = !this.twoFactorEnabled;
            localStorage.setItem(this.scopedKey('2fa'), String(this.twoFactorEnabled));
            this.updateSecurityScore();
            this.addActivity('2fa', this.twoFactorEnabled ? '2FA activado' : '2FA desactivado', this.twoFactorEnabled ? 'success' : 'primary');
            this.showToast(this.twoFactorEnabled ? '2FA activado' : '2FA desactivado', 'success');
          }
        }
      ]
    });
    await alert.present();
  }

  async configureRecovery() {
    const alert = await this.alertCtrl.create({
      header: 'Correo de recuperación',
      message: 'Guarda un correo alternativo para recuperación de cuenta.',
      inputs: [
        {
          name: 'email',
          type: 'email',
          placeholder: 'correo@ejemplo.com',
          value: this.recoveryEmail || ''
        }
      ],
      buttons: [
        { text: this.i18n.instant('common.cancel'), role: 'cancel' },
        {
          text: 'Guardar',
          handler: (data) => {
            const email = String(data.email || '').trim().toLowerCase();
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
              this.showToast('Introduce un correo válido', 'warning');
              return false;
            }
            this.recoveryEmail = email;
            localStorage.setItem(this.scopedKey('recoveryEmail'), email);
            this.updateSecurityScore();
            this.addActivity('recovery', 'Correo de recuperación actualizado', 'success');
            this.showToast('Correo de recuperación guardado', 'success');
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  async showDeviceDetails() {
    const sessionText = this.sessions
      .map(session => `${session.active ? 'Actual' : 'Otra'}: ${session.device} · ${session.location} · ${this.formatDateTime(session.lastSeen)}`)
      .join('<br><br>');

    const alert = await this.alertCtrl.create({
      header: 'Dispositivos conectados',
      message: sessionText || 'No hay sesiones registradas.',
      buttons: ['OK']
    });
    await alert.present();
  }

  refreshSecurityData() {
    this.registerCurrentSession();
    this.addActivity('session', 'Sesiones actualizadas', 'primary');
    this.showToast('Datos de seguridad actualizados', 'success');
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
