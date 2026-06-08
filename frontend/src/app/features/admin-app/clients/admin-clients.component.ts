import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { refreshOutline, saveOutline } from 'ionicons/icons';
import { AdminService } from '../../../core/services/admin.service';

@Component({
  selector: 'app-admin-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './admin-clients.component.html',
  styleUrls: ['./admin-clients.component.scss']
})
export class AdminClientsComponent implements OnInit {
  private adminService = inject(AdminService);
  private toastCtrl = inject(ToastController);

  clients: any[] = [];
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
    if (!q) return this.clients;
    return this.clients.filter(item =>
      [item.nombre, item.email, item.telefono]
        .some(value => String(value || '').toLowerCase().includes(q))
    );
  }

  load(): void {
    this.loading = true;
    this.adminService.getClients().subscribe({
      next: (data) => {
        this.clients = data || [];
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
    this.adminService.updateClient(this.selected.id, this.selected).subscribe({
      next: async (updated) => {
        this.replace(updated);
        this.selected = { ...updated };
        await this.toast('Cliente actualizado');
      }
    });
  }

  async toggleActive(item: any): Promise<void> {
    this.adminService.setClientActive(item.id, !item.active).subscribe({
      next: async (updated) => {
        this.replace(updated);
        if (this.selected?.id === updated.id) this.selected = { ...updated };
        await this.toast(updated.active ? 'Cliente activado' : 'Cliente desactivado');
      }
    });
  }

  private replace(updated: any): void {
    this.clients = this.clients.map(item => item.id === updated.id ? updated : item);
  }

  private async toast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2200, color: 'success', position: 'bottom' });
    await toast.present();
  }
}
