import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { barChartOutline, refreshOutline } from 'ionicons/icons';
import { AdminService } from '../../../core/services/admin.service';

@Component({
  selector: 'app-admin-stats',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './admin-stats.component.html',
  styleUrls: ['./admin-stats.component.scss']
})
export class AdminStatsComponent implements OnInit {
  private adminService = inject(AdminService);

  stats: any;
  loading = true;

  constructor() {
    addIcons({ barChartOutline, refreshOutline });
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.adminService.getStats().subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  entries(value: any): { key: string; value: any }[] {
    return Object.entries(value || {}).map(([key, itemValue]) => ({ key, value: itemValue }));
  }

  max(value: any): number {
    return Math.max(1, ...this.entries(value).map(item => Number(item.value) || 0));
  }
}
