import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
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
      { label: 'Negocios', value: this.dashboard?.totalBusinesses ?? 0, icon: 'business-outline' },
      { label: 'Clientes', value: this.dashboard?.totalClients ?? 0, icon: 'people-outline' },
      { label: 'Reservas', value: this.dashboard?.totalReservations ?? 0, icon: 'calendar-outline' },
      { label: 'Reservas hoy', value: this.dashboard?.reservationsToday ?? 0, icon: 'time-outline' },
      { label: 'Pendientes', value: this.dashboard?.pendingReservations ?? 0, icon: 'pulse-outline' },
      { label: 'Confirmadas', value: this.dashboard?.confirmedReservations ?? 0, icon: 'checkmark-circle-outline' },
      { label: 'Canceladas', value: this.dashboard?.cancelledReservations ?? 0, icon: 'close-circle-outline' },
      { label: 'Movimientos hoy', value: this.dashboard?.movementsToday ?? 0, icon: 'pulse-outline' }
    ];
  }
}
