import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { addIcons } from 'ionicons';
import * as icons from 'ionicons/icons';
import { CustomerTranslatePipe } from '../../core/i18n/customer-translate.pipe';

@Component({
  selector: 'app-user-layout',
  templateUrl: './user-layout.component.html',
  styleUrls: ['./user-layout.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, CustomerTranslatePipe]
})
export class UserLayoutComponent implements OnInit {
  public icons = icons;

  constructor() {
    addIcons({
      homeOutline: icons.homeOutline,
      timeOutline: icons.timeOutline,
      giftOutline: icons.giftOutline,
      personOutline: icons.personOutline,
      personCircleOutline: icons.personCircleOutline,
      statsChartOutline: icons.statsChartOutline,
      mapOutline: icons.mapOutline,
      locationOutline: icons.locationOutline
    });
  }

  ngOnInit() {
    console.log('🚀 [NAVBAR CLIENTE] Cargando modo Premium...');
    console.log('✨ [NAVBAR CLIENTE] Efecto FLOTANTE Activado');
    console.log('🌊 [NAVBAR CLIENTE] Blur: 15px | Transparencia: 0.9');
    console.log('📱 [NAVBAR CLIENTE] Safe Area Inset Bottom detectado');
  }
}
