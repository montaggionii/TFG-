import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AlertController, IonicModule, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  archiveOutline,
  businessOutline,
  closeCircleOutline,
  createOutline,
  filterOutline,
  locationOutline,
  refreshOutline,
  saveOutline,
  shieldCheckmarkOutline,
  storefrontOutline,
  timeOutline
} from 'ionicons/icons';
import { AdminService } from '../../../core/services/admin.service';

type BusinessTab = 'summary' | 'edit' | 'activity' | 'security';

@Component({
  selector: 'app-admin-businesses',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IonicModule],
  templateUrl: './admin-businesses.component.html',
  styleUrls: ['./admin-businesses.component.scss']
})
export class AdminBusinessesComponent implements OnInit {
  private adminService = inject(AdminService);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private fb = inject(FormBuilder);

  businesses: any[] = [];
  selected: any = null;
  loading = true;
  detailLoading = false;
  saving = false;
  activeTab: BusinessTab = 'summary';

  query = '';
  statusFilter = 'all';
  cityFilter = 'all';
  sort = 'nombre';
  private searchTimer?: ReturnType<typeof setTimeout>;

  totalBusinesses = 0;
  activeBusinesses = 0;
  inactiveBusinesses = 0;
  businessesWithCity = 0;

  editForm = this.fb.group({
    nombre: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    telefono: ['', [Validators.pattern(/^[0-9+()\s-]{6,20}$/)]],
    ciudad: [''],
    direccion: [''],
    tipo: [''],
    descripcion: [''],
    foto: [''],
    active: [true]
  });

  constructor() {
    addIcons({
      archiveOutline,
      businessOutline,
      closeCircleOutline,
      createOutline,
      filterOutline,
      locationOutline,
      refreshOutline,
      saveOutline,
      shieldCheckmarkOutline,
      storefrontOutline,
      timeOutline
    });
  }

  ngOnInit(): void {
    this.load();
  }

  get tabs(): { id: BusinessTab; label: string }[] {
    return [
      { id: 'summary', label: 'Resumen' },
      { id: 'edit', label: 'Editar' },
      { id: 'activity', label: 'Actividad' },
      { id: 'security', label: 'Seguridad' }
    ];
  }

  get cityOptions(): string[] {
    return Array.from(new Set(this.businesses.map(item => item.ciudad).filter(Boolean)))
      .sort((a, b) => String(a).localeCompare(String(b)));
  }

  get visibleBusinesses(): any[] {
    const filtered = this.cityFilter === 'all'
      ? [...this.businesses]
      : this.businesses.filter(item => String(item.ciudad || '') === this.cityFilter);

    return filtered.sort((a, b) => {
      if (this.sort === 'estado') return Number(!!b.active) - Number(!!a.active);
      if (this.sort === 'ciudad') return String(a.ciudad || '').localeCompare(String(b.ciudad || ''));
      if (this.sort === 'createdAt') return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      return String(a.nombre || '').localeCompare(String(b.nombre || ''));
    });
  }

  load(): void {
    this.loading = true;
    this.adminService.searchBusinesses({
      search: this.query || '',
      status: this.statusFilter,
      city: this.cityFilter,
      sort: this.sort,
      page: 0,
      size: 250
    }).subscribe({
      next: (response) => {
        this.businesses = response?.content || response?.items || response || [];
        this.totalBusinesses = response?.totalBusinesses ?? this.businesses.length;
        this.activeBusinesses = response?.activeBusinesses ?? this.businesses.filter(item => item.active).length;
        this.inactiveBusinesses = response?.inactiveBusinesses ?? this.businesses.filter(item => !item.active).length;
        this.businessesWithCity = response?.withCity ?? this.businesses.filter(item => !!item.ciudad).length;
        this.loading = false;
        if (this.selected) this.refreshSelectedFromList();
      },
      error: async (err) => {
        this.loading = false;
        await this.toast(err.error?.message || 'No se pudieron cargar los negocios.', 'danger');
      }
    });
  }

  onSearch(event: any): void {
    this.query = event?.detail?.value || '';
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 250);
  }

  applyFilters(): void {
    this.load();
  }

  select(item: any, tab: BusinessTab = 'summary'): void {
    this.activeTab = tab;
    this.detailLoading = true;
    this.adminService.getBusinessDetail(item.id).subscribe({
      next: (detail) => {
        this.selected = detail;
        this.patchForm(detail);
        this.detailLoading = false;
      },
      error: async (err) => {
        this.detailLoading = false;
        await this.toast(err.error?.message || 'No se pudo abrir el negocio.', 'danger');
      }
    });
  }

  setTab(value: any): void {
    this.activeTab = (value?.detail?.value || value || 'summary') as BusinessTab;
  }

  closeDetail(): void {
    this.selected = null;
  }

  async save(): Promise<void> {
    if (!this.selected || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    const confirmed = await this.confirm(
      'Guardar negocio',
      'Se actualizará la ficha del negocio y la acción quedará registrada en auditoría.'
    );
    if (!confirmed) return;

    this.saving = true;
    this.adminService.updateBusiness(this.selected.id, this.editForm.value).subscribe({
      next: async (updated) => {
        this.saving = false;
        this.selected = { ...this.selected, ...updated };
        this.patchForm(this.selected);
        this.replace(updated);
        await this.toast('Negocio actualizado');
      },
      error: async (err) => {
        this.saving = false;
        await this.toast(err.error?.message || 'No se pudo guardar el negocio.', 'danger');
      }
    });
  }

  async toggleActive(item = this.selected): Promise<void> {
    if (!item?.id) return;
    const next = !item.active;
    const confirmed = await this.confirm(
      next ? 'Activar negocio' : 'Desactivar negocio',
      next
        ? 'El negocio volverá a estar operativo para el panel administrativo.'
        : 'El negocio quedará inactivo, conservando su histórico y movimientos.'
    );
    if (!confirmed) return;

    this.adminService.setBusinessActive(item.id, next).subscribe({
      next: async (updated) => {
        this.replace(updated);
        if (this.selected?.id === updated.id) {
          this.selected = { ...this.selected, ...updated };
          this.patchForm(this.selected);
        }
        await this.toast(next ? 'Negocio activado' : 'Negocio desactivado');
      },
      error: async (err) => this.toast(err.error?.message || 'No se pudo cambiar el estado.', 'danger')
    });
  }

  async softDelete(): Promise<void> {
    if (!this.selected?.id) return;
    const first = await this.confirm(
      'Eliminar negocio',
      'Se realizará una eliminación lógica: el negocio quedará inactivo y oculto, pero se conservará el histórico.'
    );
    if (!first) return;
    const second = await this.confirm(
      'Confirmación final',
      'Esta acción puede afectar listados y estadísticas operativas. ¿Continuar?'
    );
    if (!second) return;

    this.adminService.softDeleteBusiness(this.selected.id).subscribe({
      next: async () => {
        await this.toast('Negocio eliminado de forma lógica');
        this.closeDetail();
        this.load();
      },
      error: async (err) => this.toast(err.error?.message || 'No se pudo eliminar el negocio.', 'danger')
    });
  }

  private patchForm(business: any): void {
    this.editForm.patchValue({
      nombre: business?.nombre || '',
      email: business?.email || '',
      telefono: business?.telefono || '',
      ciudad: business?.ciudad || '',
      direccion: business?.direccion || '',
      tipo: business?.tipo || '',
      descripcion: business?.descripcion || '',
      foto: business?.foto || '',
      active: !!business?.active
    });
  }

  private refreshSelectedFromList(): void {
    const next = this.businesses.find(item => item.id === this.selected?.id);
    if (next && this.selected) {
      this.selected = { ...this.selected, ...next };
      this.patchForm(this.selected);
    }
  }

  private replace(updated: any): void {
    this.businesses = this.businesses.map(item => item.id === updated.id ? { ...item, ...updated } : item);
    this.activeBusinesses = this.businesses.filter(item => item.active).length;
    this.inactiveBusinesses = this.businesses.filter(item => !item.active).length;
    this.businessesWithCity = this.businesses.filter(item => !!item.ciudad).length;
  }

  private async confirm(header: string, message: string): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertCtrl.create({
        header,
        message,
        buttons: [
          { text: 'Cancelar', role: 'cancel', handler: () => resolve(false) },
          { text: 'Confirmar', role: 'confirm', handler: () => resolve(true) }
        ]
      });
      await alert.present();
    });
  }

  private async toast(message: string, color: 'success' | 'danger' | 'warning' = 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2600, color, position: 'bottom' });
    await toast.present();
  }
}
