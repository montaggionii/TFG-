import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { refreshOutline, saveOutline } from 'ionicons/icons';
import { AdminService } from '../../../core/services/admin.service';

@Component({
  selector: 'app-admin-businesses',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './admin-businesses.component.html',
  styleUrls: ['./admin-businesses.component.scss']
})
export class AdminBusinessesComponent implements OnInit {
  private adminService = inject(AdminService);
  private toastCtrl = inject(ToastController);

  businesses: any[] = [];
  selected: any = null;
  query = '';
  loading = true;

  constructor() {
    addIcons({ refreshOutline, saveOutline });
  }

  ngOnInit(): void {
    this.load();
  }

  get filtered(): any[] {
    const q = this.query.trim().toLowerCase();
    if (!q) return this.businesses;
    return this.businesses.filter(item =>
      [item.nombre, item.email, item.telefono, item.ciudad]
        .some(value => String(value || '').toLowerCase().includes(q))
    );
  }

  load(): void {
    this.loading = true;
    this.adminService.getBusinesses().subscribe({
      next: (data) => {
        this.businesses = data || [];
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  select(item: any): void {
    this.selected = { ...item };
  }

  async save(): Promise<void> {
    if (!this.selected?.id) return;
    this.adminService.updateBusiness(this.selected.id, this.selected).subscribe({
      next: async (updated) => {
        this.replace(updated);
        this.selected = { ...updated };
        await this.toast('Negocio actualizado');
      }
    });
  }

  async toggleActive(item: any): Promise<void> {
    this.adminService.setBusinessActive(item.id, !item.active).subscribe({
      next: async (updated) => {
        this.replace(updated);
        if (this.selected?.id === updated.id) this.selected = { ...updated };
        await this.toast(updated.active ? 'Negocio activado' : 'Negocio desactivado');
      }
    });
  }

  private replace(updated: any): void {
    this.businesses = this.businesses.map(item => item.id === updated.id ? updated : item);
  }

  private async toast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2200, color: 'success', position: 'bottom' });
    await toast.present();
  }
}
