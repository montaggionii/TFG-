import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { addIcons } from 'ionicons';
import * as icons from 'ionicons/icons';

@Component({
  selector: 'app-terms',
  templateUrl: './terms.component.html',
  styleUrls: ['./terms.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, RouterModule]
})
export class TermsComponent implements OnInit {
  private toastCtrl = inject(ToastController);
  public icons = icons;

  accepted = false;
  lastUpdate = '12 de Mayo, 2026';

  sections = [
    { id: 'uso', title: 'Uso de la Plataforma', icon: icons.phonePortraitOutline },
    { id: 'registro', title: 'Registro de Cuenta', icon: icons.personCircleOutline },
    { id: 'puntos', title: 'Sistema de Puntos', icon: icons.starOutline },
    { id: 'canjes', title: 'Recompensas', icon: icons.giftOutline },
    { id: 'responsabilidad', title: 'Responsabilidad', icon: icons.alertCircleOutline },
    { id: 'conductas', title: 'Conductas Prohibidas', icon: icons.closeCircleOutline },
    { id: 'modificaciones', title: 'Cambios del Servicio', icon: icons.refreshCircleOutline }
  ];

  constructor() {
    addIcons({
      chevronBackOutline: icons.chevronBackOutline,
      documentTextOutline: icons.documentTextOutline,
      phonePortraitOutline: icons.phonePortraitOutline,
      starOutline: icons.starOutline,
      giftOutline: icons.giftOutline,
      lockClosedOutline: icons.lockClosedOutline,
      checkmarkCircleOutline: icons.checkmarkCircleOutline,
      chevronUpOutline: icons.chevronUpOutline,
      arrowForwardOutline: icons.arrowForwardOutline,
      personCircleOutline: icons.personCircleOutline,
      alertCircleOutline: icons.alertCircleOutline,
      closeCircleOutline: icons.closeCircleOutline,
      refreshCircleOutline: icons.refreshCircleOutline
    });
  }

  ngOnInit() {
    console.log('[TERMS OPEN]');
    this.loadState();
  }

  loadState() {
    this.accepted = localStorage.getItem('fidely_terms_accepted') === 'true';
  }

  onAcceptChange() {
    localStorage.setItem('fidely_terms_accepted', this.accepted.toString());
    if (this.accepted) {
      console.log('[TERMS ACCEPTED]');
      this.showToast('Términos aceptados correctamente', 'success');
    }
  }

  scrollTo(elementId: string) {
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
