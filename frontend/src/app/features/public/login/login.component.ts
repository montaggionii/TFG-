import { Component, ElementRef, NgZone, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule, LoadingController, ToastController } from '@ionic/angular';
import { RouterModule, Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { environment } from '../../../../environments/environment';

/** Acepta un email o un número de teléfono (lo que use el cliente). */
function identificadorValidator(control: AbstractControl): ValidationErrors | null {
  const v = (control.value || '').trim();
  if (!v) return null;
  const esEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const esTelefono = /^\+?[\d\s().-]{7,20}$/.test(v);
  return esEmail || esTelefono ? null : { identificador: true };
}

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ["./login.component.scss"],
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule, FormsModule, RouterModule]
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private loadingCtrl = inject(LoadingController);
  private toastCtrl = inject(ToastController);
  private router = inject(Router);
  private zone = inject(NgZone);

  @ViewChild('googleBtnHost') googleBtnHost?: ElementRef<HTMLDivElement>;

  loginForm: FormGroup;
  isRestaurantMode = false;

  // Flujo "Entrar con mi móvil": código por SMS sin contraseña
  smsStep: 'form' | 'telefono' | 'codigo' = 'form';
  smsTelefono = '';
  smsCodigo = '';
  smsNombre = '';
  smsDevCodigo: string | null = null;
  smsEnviando = false;
  smsVerificando = false;
  smsReintentos = 0;

  // Los botones sociales solo se muestran cuando el backend tiene
  // configurado el Client ID del proveedor (nada de botones falsos).
  googleConfigured = !!environment.googleClientId;
  appleConfigured = !!environment.appleClientId;

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, identificadorValidator]],
      password: ['', [Validators.required, Validators.minLength(4)]]
    });
  }

  ngOnInit() {
    if (this.googleConfigured && !this.isRestaurantMode) {
      this.renderGoogleButton();
    }
  }

  toggleLoginType() {
    this.isRestaurantMode = !this.isRestaurantMode;
    console.log('[LoginComponent] Modo actual cambiado a ->', this.isRestaurantMode ? 'RESTAURANTE' : 'CLIENTE');
    this.loginForm.reset();
    if (!this.isRestaurantMode && this.googleConfigured) {
      this.renderGoogleButton();
    }
  }

  async doLogin() {
    if (this.loginForm.invalid) return;

    const loading = await this.loadingCtrl.create({
      message: 'Iniciando sesión...',
    });
    await loading.present();

    const credentials = this.loginForm.value;

    console.log(`[LoginComponent] Ejecutando login... Modo: ${this.isRestaurantMode ? 'RESTAURANTE' : 'CLIENTE'}`);

    const authCall = this.isRestaurantMode
      ? this.authService.loginRestaurante(credentials)
      : this.authService.loginUsuario(credentials);

    authCall.subscribe({
      next: () => {
        loading.dismiss();
        console.log('[LOGIN] Sesión iniciada correctamente');
      },
      error: async (err) => {
        loading.dismiss();
        await this.mostrarError(err);
      }
    });
  }

  /* ============ LOGIN POR SMS (sin contraseña) ============ */

  irASmsTelefono() {
    this.smsStep = 'telefono';
  }

  volverAlFormulario() {
    this.smsStep = 'form';
    this.smsDevCodigo = null;
    this.smsCodigo = '';
  }

  async enviarSms() {
    if (this.smsEnviando) return;
    this.smsEnviando = true;
    try {
      const res = await lastValueFrom(this.authService.otpEnviar(this.smsTelefono));
      this.smsDevCodigo = res?.devCodigo ?? null;
      this.smsStep = 'codigo';
    } catch (err: any) {
      await this.mostrarError(err);
    } finally {
      this.smsEnviando = false;
    }
  }

  async verificarSms() {
    if (this.smsVerificando || this.smsCodigo.length < 4) return;
    this.smsVerificando = true;
    const loading = await this.loadingCtrl.create({ message: 'Comprobando código...' });
    await loading.present();

    this.authService.otpVerificar(this.smsTelefono, this.smsCodigo, this.smsNombre || undefined).subscribe({
      next: () => {
        loading.dismiss();
        console.log('[LOGIN] Sesión iniciada correctamente con SMS');
      },
      error: async (err) => {
        loading.dismiss();
        this.smsCodigo = '';
        this.smsReintentos++;
        await this.mostrarError(err);
      }
    });
  }

  /* ============ LOGIN SOCIAL ============ */

  private async cargarScript(src: string, id: string): Promise<void> {
    if (document.getElementById(id)) return;
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.defer = true;
      script.id = id;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('No se pudo cargar el SDK de acceso'));
      document.body.appendChild(script);
    });
  }

  /** Botón oficial de Google (GIS): entrega un id_token verificado. */
  private renderGoogleButton() {
    this.cargarScript('https://accounts.google.com/gsi/client', 'google-gsi-client')
      .then(() => {
        this.zone.runOutsideAngular(() => {
          const google = (window as any).google;
          if (!google?.accounts?.id || !this.googleBtnHost?.nativeElement) return;
          google.accounts.id.initialize({
            client_id: environment.googleClientId,
            callback: (resp: any) => {
              this.zone.run(() => this.procesarSocial('google', resp.credential));
            }
          });
          google.accounts.id.renderButton(this.googleBtnHost.nativeElement, {
            theme: 'outline',
            size: 'large',
            shape: 'pill',
            text: 'continue_with',
            locale: 'es'
          });
        });
      })
      .catch(err => console.warn('[LOGIN SOCIAL] SDK de Google no disponible:', err.message));
  }

  /** Sign in with Apple (popup): entrega un id_token en la promesa. */
  async appleSignIn() {
    try {
      await this.cargarScript(
        'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js',
        'apple-auth-js'
      );
      const AppleID = (window as any).AppleID;
      AppleID.auth.init({
        clientId: environment.appleClientId,
        scope: 'name email',
        redirectURI: window.location.origin + '/auth/apple',
        state: crypto.randomUUID(),
        usePopup: true,
        responseMode: 'form_post'
      });
      const authorization = await AppleID.auth.signIn();
      const nombre = authorization?.user?.name
        ? `${authorization.user.name.firstName ?? ''} ${authorization.user.name.lastName ?? ''}`.trim()
        : undefined;
      await this.procesarSocial('apple', authorization.id_token, nombre);
    } catch (err: any) {
      console.warn('[LOGIN SOCIAL] Apple cancelado o fallido:', err?.message || err);
    }
  }

  private async procesarSocial(proveedor: 'google' | 'apple', idToken: string, nombre?: string) {
    const loading = await this.loadingCtrl.create({ message: 'Iniciando sesión...' });
    await loading.present();

    this.authService.loginSocial(proveedor, idToken, nombre).subscribe({
      next: () => {
        loading.dismiss();
        console.log(`[LOGIN] Sesión iniciada correctamente con ${proveedor}`);
      },
      error: async (err) => {
        loading.dismiss();
        await this.mostrarError(err);
      }
    });
  }

  private async mostrarError(err: any) {
    let errorMessage = 'Error inesperado. Inténtalo de nuevo.';

    if (err.status === 0) {
      // Render Free duerme el backend: suele ser el arranque en frío, no la red del usuario
      errorMessage = 'El servidor está despertando (primera conexión del día). Espera un minuto y vuelve a intentarlo.';
      console.error('[NETWORK ERROR] No se pudo alcanzar el backend:', err);
    } else if (err.status === 401 || err.status === 403) {
      errorMessage = '🔑 Credenciales incorrectas. Revisa tu email o teléfono y contraseña.';
      console.warn('[AUTH ERROR] Credenciales rechazadas');
    } else if (err.status === 503) {
      errorMessage = err.error?.message || 'Este método de acceso aún no está disponible.';
    } else if (err.status >= 500) {
      errorMessage = '🔥 Error interno del servidor. Por favor, contacta con soporte.';
    } else if (err.error?.message) {
      errorMessage = err.error.message;
    }

    const toast = await this.toastCtrl.create({
      message: errorMessage,
      duration: 4000,
      color: 'danger',
      position: 'bottom',
      buttons: [{ text: 'OK', role: 'cancel' }]
    });
    await toast.present();
  }
}
