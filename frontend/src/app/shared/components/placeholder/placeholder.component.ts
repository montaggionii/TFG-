import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-placeholder',
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>Próximamente...</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding ion-text-center">
      <br><br><br>
      <ion-icon name="construct-outline" style="font-size: 64px; color: var(--ion-color-medium);"></ion-icon>
      <p style="color: var(--ion-color-medium);">Pantalla en construcción</p>
    </ion-content>
  `,
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class PlaceholderComponent {}
