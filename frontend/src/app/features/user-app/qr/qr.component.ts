import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterLink } from '@angular/router';
import QRCode from 'qrcode';
import { GlobalStateService } from '../../../core/state/global-state.service';
import { CustomerTranslatePipe } from '../../../core/i18n/customer-translate.pipe';

/** Pantalla a pantalla completa del QR del cliente (atajo nativo fidelyfood://qr). */
@Component({
  selector: 'app-qr',
  standalone: true,
  imports: [IonicModule, CommonModule, RouterLink, CustomerTranslatePipe],
  template: `
    <ion-content [fullscreen]="true" class="ion-text-center qr-screen">
      <div class="qr-box" *ngIf="dataUrl">
        <h2>{{ (nombre || 'Mi tarjeta') }}</h2>
        <img [src]="dataUrl" alt="QR de fidelidad">
        <p>{{ 'qr.instrucciones' | ffTranslate }}</p>
      </div>
      <ion-spinner *ngIf="!dataUrl"></ion-spinner>
      <ion-button routerLink="/u/home" fill="clear" color="light">Cerrar</ion-button>
    </ion-content>
  `,
  styles: [`
    .qr-screen { display: flex; align-items: center; justify-content: center; background: linear-gradient(160deg, #1c1c1e, #3a2a1c); }
    .qr-box { margin: auto; padding: 28px; border-radius: 24px; background: #fff; max-width: 340px;
      h2 { margin: 0 0 8px; color: #1c1c1e; } p { color: #6B7280; font-size: 14px; } }
    img { width: 100%; }
  `]
})
export class QrComponent implements OnInit {
  private globalState = inject(GlobalStateService);
  nombre = '';
  dataUrl: string | null = null;

  async ngOnInit() {
    const user = this.globalState.getState();
    this.nombre = user?.nombre || '';
    if (user?.id) {
      this.dataUrl = await QRCode.toDataURL(`FIDELITY_ID:${user.id}`, { width: 560, margin: 2 });
    }
  }
}
