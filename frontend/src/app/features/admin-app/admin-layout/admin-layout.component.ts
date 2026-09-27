import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  barChartOutline,
  businessOutline,
  calendarOutline,
  logOutOutline,
  peopleOutline,
  speedometerOutline
} from 'ionicons/icons';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.scss']
})
export class AdminLayoutComponent {
  private authService = inject(AuthService);

  navItems = [
    { label: 'Dashboard', path: '/admin/dashboard', icon: 'speedometer-outline' },
    { label: 'Negocios', path: '/admin/businesses', icon: 'business-outline' },
    { label: 'Clientes', path: '/admin/clients', icon: 'people-outline' },
    { label: 'Reservas', path: '/admin/reservations', icon: 'calendar-outline' },
    { label: 'Estadísticas', path: '/admin/stats', icon: 'bar-chart-outline' }
  ];

  constructor() {
    addIcons({
      barChartOutline,
      businessOutline,
      calendarOutline,
      logOutOutline,
      peopleOutline,
      speedometerOutline
    });
  }

  logout(): void {
    this.authService.logout();
  }
}
