import { Component, inject, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import * as icons from 'ionicons/icons';
import { QrDisplayComponent } from '../qr-display/qr-display.component';

@Component({
  selector: 'app-quick-actions',
  templateUrl: './quick-actions.component.html',
  styleUrls: ['./quick-actions.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class QuickActionsComponent {
  @Input() user: any;
  
  private router = inject(Router);
  private modalCtrl = inject(ModalController);
  public icons = icons;

  constructor() {
    addIcons({
      addCircleOutline: icons.addCircleOutline,
      giftOutline: icons.giftOutline,
      barcodeOutline: icons.barcodeOutline,
      qrCodeOutline: icons.qrCodeOutline,
      timeOutline: icons.timeOutline
    });
  }

  async openScanModal() {
    const userId = String(this.user?.id || 'GUEST');
    const modal = await this.modalCtrl.create({
      component: QrDisplayComponent,
      componentProps: {
        qrData: `FIDELITY_ID:${userId}`,
        title: 'Mi Código de Fidelización',
        subtitle: 'Muéstralo en el restaurante para sumar puntos'
      },
      breakpoints: [0, 0.5, 0.8],
      initialBreakpoint: 0.5,
      cssClass: 'premium-modal'
    });
    return await modal.present();
  }

  goTo(path: string) {
    this.router.navigate([path]);
  }
}
