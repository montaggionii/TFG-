import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { calendarOutline, refreshOutline } from 'ionicons/icons';
import { AdminService } from '../../../core/services/admin.service';

@Component({
  selector: 'app-admin-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './admin-reservations.component.html',
  styleUrls: ['./admin-reservations.component.scss']
})
export class AdminReservationsComponent implements OnInit {
  private adminService = inject(AdminService);

  reservations: any[] = [];
  query = '';
  status = '';
  business = '';
  date = '';
  loading = true;

  constructor() {
    addIcons({ calendarOutline, refreshOutline });
  }

  ngOnInit(): void {
    this.load();
  }

  get filtered(): any[] {
    const q = this.query.trim().toLowerCase();
    return this.reservations.filter(item => {
      const matchesQuery = !q || [item.clientName, item.clientEmail, item.clientPhone, item.businessName]
        .some(value => String(value || '').toLowerCase().includes(q));
      const matchesStatus = !this.status || item.status === this.status;
      const matchesBusiness = !this.business || String(item.businessId || '') === this.business;
      const matchesDate = !this.date || String(item.date || '').startsWith(this.date);
      return matchesQuery && matchesStatus && matchesBusiness && matchesDate;
    });
  }

  get businessOptions(): any[] {
    const map = new Map<string, string>();
    this.reservations.forEach(item => {
      if (item.businessId) map.set(String(item.businessId), item.businessName || `Negocio ${item.businessId}`);
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }

  load(): void {
    this.loading = true;
    this.adminService.getReservations().subscribe({
      next: (data) => {
        this.reservations = data || [];
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }
}
