import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, AlertController, ToastController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import * as icons from 'ionicons/icons';

@Component({
  selector: 'app-privacy',
  templateUrl: './privacy.component.html',
  styleUrls: ['./privacy.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class PrivacyComponent implements OnInit {
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  public icons = icons;

  lastUpdate = '12 de Mayo, 2026';
  version = 'v2.4.0-LEGAL';

  privacySections = [
    {
      icon: icons.eyeOutline,
      title: 'Información que recopilamos',
      text: 'Recopilamos los datos necesarios para operar tu cuenta FidelyFood: nombre, correo electrónico, identificador de usuario, foto de perfil si la subes, código QR, saldo de puntos, historial de movimientos, canjes y locales asociados a tu actividad.'
    },
    {
      icon: icons.documentTextOutline,
      title: 'Uso de los datos',
      text: 'Utilizamos la información para identificarte en restaurantes, mostrar tus puntos, registrar canjes, personalizar promociones, mejorar la experiencia de la app y prevenir usos indebidos del sistema de fidelización.'
    },
    {
      icon: icons.lockClosedOutline,
      title: 'Protección de datos',
      text: 'Protegemos el acceso mediante autenticación JWT, controles de autorización por rol y comunicación segura entre frontend y backend. Las contraseñas se almacenan cifradas y nunca se muestran en la aplicación.'
    },
    {
      icon: icons.serverOutline,
      title: 'Almacenamiento de información',
      text: 'Tus datos se almacenan en la base de datos de FidelyFood y los archivos que subes se guardan en almacenamiento controlado del servidor. Conservamos la información mientras mantengas tu cuenta activa o sea necesaria por motivos legales.'
    },
    {
      icon: icons.shareSocialOutline,
      title: 'Compartición de datos',
      text: 'Los restaurantes solo acceden a la información necesaria para validar puntos, canjes o promociones. No vendemos tus datos personales ni los compartimos con terceros para publicidad externa.'
    },
    {
      icon: icons.shieldCheckmarkOutline,
      title: 'Derechos del usuario',
      text: 'Puedes solicitar acceso, rectificación, portabilidad, limitación u oposición al tratamiento de tus datos. También puedes pedir la eliminación de tu cuenta y de la información asociada cuando corresponda.'
    },
    {
      icon: icons.mailOutline,
      title: 'Contacto para privacidad',
      text: 'Para cualquier consulta sobre privacidad o protección de datos puedes contactar con FidelyFood en privacidad@fidelyfood.app indicando el correo asociado a tu cuenta.'
    }
  ];

  privacySettings = {
    cookies: true,
    location: true,
    marketing: false,
    notifications: true,
    analytics: true
  };

  constructor() {
    addIcons({
      chevronBackOutline: icons.chevronBackOutline,
      shieldCheckmarkOutline: icons.shieldCheckmarkOutline,
      eyeOutline: icons.eyeOutline,
      lockClosedOutline: icons.lockClosedOutline,
      locationOutline: icons.locationOutline,
      cameraOutline: icons.cameraOutline,
      trashOutline: icons.trashOutline,
      mailOutline: icons.mailOutline,
      documentTextOutline: icons.documentTextOutline,
      shareSocialOutline: icons.shareSocialOutline,
      serverOutline: icons.serverOutline
    });
  }

  ngOnInit() {
    console.log('[PRIVACY OPEN]');
    this.loadSettings();
  }

  loadSettings() {
    const saved = localStorage.getItem('fidely_privacy_settings');
    if (saved) {
      this.privacySettings = JSON.parse(saved);
    }
  }

  saveSettings() {
    localStorage.setItem('fidely_privacy_settings', JSON.stringify(this.privacySettings));
    console.log('[PRIVACY SETTINGS UPDATED]', this.privacySettings);
    this.showToast('Configuración de privacidad guardada', 'success');
  }

  async confirmDeleteAccount() {
    const alert = await this.alertCtrl.create({
      header: '¿Eliminar tu cuenta?',
      subHeader: 'Esta acción es irreversible',
      message: 'Se borrarán permanentemente tus puntos, historial de canjes y datos personales de nuestros servidores.',
      cssClass: 'custom-alert-destructive',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { 
          text: 'Eliminar todo', 
          role: 'destructive',
          handler: () => {
            this.executeDelete();
          }
        }
      ]
    });
    await alert.present();
  }

  executeDelete() {
    console.log('[USER REQUEST] Account Deletion');
    this.showToast('Solicitud de eliminación enviada. Nos pondremos en contacto contigo.', 'warning');
  }

  downloadPDF() {
    this.showToast('Generando PDF de Política de Privacidad...', 'primary');
    setTimeout(() => {
      this.showToast('Descarga iniciada', 'success');
    }, 2000);
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
