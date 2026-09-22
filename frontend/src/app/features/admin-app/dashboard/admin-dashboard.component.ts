import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { businessOutline, calendarOutline, checkmarkCircleOutline, closeCircleOutline, peopleOutline, pulseOutline, refreshOutline, timeOutline } from 'ionicons/icons';
import { AdminService } from '../../../core/services/admin.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  private adminService = inject(AdminService);
  private router = inject(Router);

  loading = true;
  dashboard: any;

  constructor() {
    addIcons({ businessOutline, calendarOutline, checkmarkCircleOutline, closeCircleOutline, peopleOutline, pulseOutline, refreshOutline, timeOutline });
  }

  ngOnInit(): void {
    this.load();
  }

  load(event?: any): void {
    this.loading = !event;
    this.adminService.getDashboard().subscribe({
      next: (data) => {
        this.dashboard = data;
        this.loading = false;
        event?.target?.complete();
      },
      error: () => {
        this.loading = false;
        event?.target?.complete();
      }
    });
  }

  get metrics() {
    return [
      { label: 'Negocios', value: this.dashboard?.totalBusinesses ?? 0, icon: 'business-outline', route: '/admin/businesses' },
      { label: 'Clientes', value: this.dashboard?.totalClients ?? 0, icon: 'people-outline', route: '/admin/clients' },
      { label: 'Reservas', value: this.dashboard?.totalReservations ?? 0, icon: 'calendar-outline', route: '/admin/reservations' },
      { label: 'Reservas hoy', value: this.dashboard?.reservationsToday ?? 0, icon: 'time-outline', route: '/admin/reservations' },
      { label: 'Pendientes', value: this.dashboard?.pendingReservations ?? 0, icon: 'pulse-outline', route: '/admin/reservations' },
      { label: 'Confirmadas', value: this.dashboard?.confirmedReservations ?? 0, icon: 'checkmark-circle-outline', route: '/admin/reservations' },
      { label: 'Canceladas', value: this.dashboard?.cancelledReservations ?? 0, icon: 'close-circle-outline', route: '/admin/reservations' },
      { label: 'Movimientos hoy', value: this.dashboard?.movementsToday ?? 0, icon: 'pulse-outline', route: '/admin/stats' }
    ];
  }

  go(route: string): void {
    this.router.navigateByUrl(route);
  }
}
