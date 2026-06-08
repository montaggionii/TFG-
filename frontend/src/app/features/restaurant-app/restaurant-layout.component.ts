import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  statsChartOutline, 
  megaphoneOutline, 
  scanOutline, 
  settingsOutline 
} from 'ionicons/icons';

@Component({
  selector: 'app-restaurant-layout',
  templateUrl: './restaurant-layout.component.html',
  styleUrls: ['./restaurant-layout.component.scss'],
  standalone: true,
  imports: [IonicModule]
})
export class RestaurantLayoutComponent implements OnInit {
  constructor() {
    addIcons({ 
      statsChartOutline, 
      megaphoneOutline, 
      scanOutline, 
      settingsOutline 
    });
  }

  ngOnInit() {
    console.log('🏢 [NAVBAR NEGOCIO] Modo Premium Activo');
    console.log('✨ [NAVBAR NEGOCIO] Efecto FLOTANTE Sincronizado');
    console.log('🌊 [NAVBAR NEGOCIO] Blur: 15px | Transparencia: 0.9');
  }
}
