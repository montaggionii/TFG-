import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AlertController, IonicModule, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  addCircleOutline,
  archiveOutline,
  calendarOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  createOutline,
  filterOutline,
  peopleOutline,
  refreshOutline,
  saveOutline,
  timeOutline
} from 'ionicons/icons';
import { AdminService } from '../../../core/services/admin.service';

type ReservationTab = 'summary' | 'edit' | 'security';

@Component({
  selector: 'app-admin-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IonicModule],
  templateUrl: './admin-reservations.component.html',
  styleUrls: ['./admin-reservations.component.scss']
})
export class AdminReservationsComponent implements OnInit {
  private adminService = inject(AdminService);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private fb = inject(FormBuilder);

  reservations: any[] = [];
  businesses: any[] = [];
  clients: any[] = [];
  selected: any = null;
  loading = true;
  saving = false;
  activeTab: ReservationTab = 'summary';

  query = '';
  statusFilter = '';
  businessFilter = '';
  dateFilter = '';
  private searchTimer?: ReturnType<typeof setTimeout>;

  reservationForm = this.fb.group({
    clientId: [''],
    businessId: ['', [Validators.required]],
    clientName: ['', [Validators.required]],
    clientEmail: ['', [Validators.email]],
    clientPhone: ['', [Validators.pattern(/^[0-9+()\s-]{6,20}$/)]],
    date: ['', [Validators.required]],
    people: [2, [Validators.required, Validators.min(1), Validators.max(50)]],
    status: ['PENDING', [Validators.required]],
    notes: ['']
  });

  constructor() {
    addIcons({
      addCircleOutline,
      archiveOutline,
      calendarOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      createOutline,
      filterOutline,
      peopleOutline,
      refreshOutline,
      saveOutline,
      timeOutline
    });
  }

  ngOnInit(): void {
    this.loadOptions();
    this.load();
  }

  get tabs(): { id: ReservationTab; label: string }[] {
    return [
      { id: 'summary', label: 'Resumen' },
      { id: 'edit', label: 'Editar' },
      { id: 'security', label: 'Seguridad' }
    ];
  }

  get pendingReservations(): number {
    return this.reservations.filter(item => item.status === 'PENDING').length;
  }

  get confirmedReservations(): number {
    return this.reservations.filter(item => item.status === 'CONFIRMED').length;
  }

  get cancelledReservations(): number {
    return this.reservations.filter(item => item.status === 'CANCELLED').length;
  }

  loadOptions(): void {
    this.adminService.getBusinesses().subscribe({
      next: (data) => this.businesses = data || [],
      error: () => this.businesses = []
    });
    this.adminService.searchClients({ status: 'active', page: 0, size: 250 }).subscribe({
      next: (response) => this.clients = response?.content || response?.items || response || [],
      error: () => this.clients = []
    });
  }

  load(): void {
    this.loading = true;
    this.adminService.searchReservations({
      search: this.query || '',
      status: this.statusFilter || '',
      businessId: this.businessFilter || ''
    }).subscribe({
      next: (data) => {
        const items = data || [];
        this.reservations = this.dateFilter
          ? items.filter(item => String(item.date || '').startsWith(this.dateFilter))
          : items;
        this.loading = false;
        if (this.selected) this.refreshSelectedFromList();
      },
      error: async (err) => {
        this.loading = false;
        await this.toast(err.error?.message || 'No se pudieron cargar las reservas.', 'danger');
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

  createNew(): void {
    this.selected = null;
    this.activeTab = 'edit';
    this.reservationForm.reset({
      clientId: '',
      businessId: '',
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      date: this.defaultDate(),
      people: 2,
      status: 'PENDING',
      notes: ''
    });
  }

  select(item: any, tab: ReservationTab = 'summary'): void {
    this.selected = item;
    this.activeTab = tab;
    this.patchForm(item);
  }

  setTab(value: any): void {
    this.activeTab = (value?.detail?.value || value || 'summary') as ReservationTab;
  }

  closeDetail(): void {
    this.selected = null;
    this.activeTab = 'summary';
  }

  onClientChange(clientId: any): void {
    const client = this.clients.find(item => String(item.id) === String(clientId));
    if (!client) return;
    this.reservationForm.patchValue({
      clientName: client.nombre || '',
      clientEmail: client.email || '',
      clientPhone: client.telefono || ''
    });
  }

  async save(): Promise<void> {
    if (this.reservationForm.invalid) {
      this.reservationForm.markAllAsTouched();
      return;
    }
    const confirmed = await this.confirm(
      this.selected?.id ? 'Guardar reserva' : 'Crear reserva',
      'La reserva quedará actualizada y se registrará la acción administrativa.'
    );
    if (!confirmed) return;

    this.saving = true;
    const payload = this.payload();
    const isEdit = !!this.selected?.id;
    const call = isEdit
      ? this.adminService.updateReservation(this.selected.id, payload)
      : this.adminService.createReservation(payload);
    call.subscribe({
      next: async (updated) => {
        this.saving = false;
        this.upsert(updated);
        this.selected = updated;
        this.patchForm(updated);
        this.activeTab = 'summary';
        await this.toast(isEdit ? 'Reserva guardada' : 'Reserva creada');
      },
      error: async (err) => {
        this.saving = false;
        await this.toast(err.error?.message || 'No se pudo guardar la reserva.', 'danger');
      }
    });
  }

  async setStatus(status: string): Promise<void> {
    if (!this.selected?.id) return;
    const confirmed = await this.confirm(
      'Cambiar estado',
      `La reserva pasará a estado ${this.statusLabel(status)} y quedará registrada en auditoría.`
    );
    if (!confirmed) return;
    this.adminService.setReservationStatus(this.selected.id, status).subscribe({
      next: async (updated) => {
        this.upsert(updated);
        this.selected = updated;
        this.patchForm(updated);
        await this.toast('Estado de reserva actualizado');
      },
      error: async (err) => this.toast(err.error?.message || 'No se pudo cambiar el estado.', 'danger')
    });
  }

  async softDelete(): Promise<void> {
    if (!this.selected?.id) return;
    const confirmed = await this.confirm(
      'Eliminar reserva',
      'Se realizará una eliminación lógica. La reserva no aparecerá en el listado operativo, pero quedará auditada.'
    );
    if (!confirmed) return;
    this.adminService.softDeleteReservation(this.selected.id).subscribe({
      next: async () => {
        this.reservations = this.reservations.filter(item => item.id !== this.selected.id);
        this.closeDetail();
        await this.toast('Reserva eliminada de forma lógica');
      },
      error: async (err) => this.toast(err.error?.message || 'No se pudo eliminar la reserva.', 'danger')
    });
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'Pendiente',
      CONFIRMED: 'Confirmada',
      CANCELLED: 'Cancelada',
      COMPLETED: 'Completada',
      ATTENDED: 'Asistió',
      NO_SHOW: 'No asistió'
    };
    return map[status] || status || 'Sin estado';
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'warning',
      CONFIRMED: '',
      COMPLETED: 'neutral',
      ATTENDED: '',
      CANCELLED: 'danger',
      NO_SHOW: 'danger'
    };
    return map[status] || 'neutral';
  }

  private patchForm(item: any): void {
    this.reservationForm.patchValue({
      clientId: item?.clientId || '',
      businessId: item?.businessId || '',
      clientName: item?.clientName || '',
      clientEmail: item?.clientEmail || '',
      clientPhone: item?.clientPhone || '',
      date: this.toDatetimeLocal(item?.date),
      people: item?.people || 2,
      status: item?.status || 'PENDING',
      notes: item?.notes || ''
    });
  }

  private payload(): any {
    const value = this.reservationForm.value;
    return {
      clientId: value.clientId || null,
      businessId: value.businessId,
      clientName: value.clientName,
      clientEmail: value.clientEmail,
      clientPhone: value.clientPhone,
      date: value.date,
      people: Number(value.people || 1),
      status: value.status,
      notes: value.notes
    };
  }

  private upsert(updated: any): void {
    const exists = this.reservations.some(item => item.id === updated.id);
    this.reservations = exists
      ? this.reservations.map(item => item.id === updated.id ? updated : item)
      : [updated, ...this.reservations];
  }

  private refreshSelectedFromList(): void {
    const next = this.reservations.find(item => item.id === this.selected?.id);
    if (next) {
      this.selected = next;
      this.patchForm(next);
    }
  }

  private defaultDate(): string {
    const date = new Date(Date.now() + 60 * 60 * 1000);
    date.setMinutes(0, 0, 0);
    return this.toDatetimeLocal(date.toISOString());
  }

  private toDatetimeLocal(value: any): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 16);
    const offset = date.getTimezoneOffset();
    const local = new Date(date.getTime() - offset * 60 * 1000);
    return local.toISOString().slice(0, 16);
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
