import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AlertController, IonicModule, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  addCircleOutline,
  alertCircleOutline,
  archiveOutline,
  closeCircleOutline,
  createOutline,
  eyeOutline,
  filterOutline,
  personCircleOutline,
  refreshOutline,
  removeCircleOutline,
  saveOutline,
  shieldCheckmarkOutline,
  statsChartOutline,
  timeOutline,
  walletOutline
} from 'ionicons/icons';
import { AdminService } from '../../../core/services/admin.service';

type ClientTab = 'summary' | 'edit' | 'points' | 'history' | 'activity' | 'security';
type PointMode = 'add' | 'subtract' | 'set';

@Component({
  selector: 'app-admin-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IonicModule],
  templateUrl: './admin-clients.component.html',
  styleUrls: ['./admin-clients.component.scss']
})
export class AdminClientsComponent implements OnInit {
  private adminService = inject(AdminService);
  private toastCtrl = inject(ToastController);
  private alertCtrl = inject(AlertController);
  private fb = inject(FormBuilder);

  clients: any[] = [];
  businesses: any[] = [];
  selected: any = null;
  activity: any = null;
  pointsHistory: any[] = [];
  loading = true;
  detailLoading = false;
  saving = false;
  activeTab: ClientTab = 'summary';
  pointMode: PointMode = 'add';

  query = '';
  statusFilter = 'all';
  pointsFilter = 'all';
  sort = 'nombre';
  historyType = '';
  historyRestaurant = '';
  private searchTimer?: ReturnType<typeof setTimeout>;

  totalClients = 0;
  activeClients = 0;
  inactiveClients = 0;
  clientsWithPoints = 0;

  editForm = this.fb.group({
    nombre: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    telefono: ['', [Validators.pattern(/^[0-9+()\s-]{6,20}$/)]],
    fotoPerfil: [''],
    active: [true]
  });

  pointsForm = this.fb.group({
    restaurantId: [''],
    amount: [1, [Validators.required, Validators.min(0)]],
    type: ['AJUSTE_ADMIN', [Validators.required]],
    reason: ['', [Validators.required, Validators.minLength(4)]],
    description: ['']
  });

  constructor() {
    addIcons({
      addCircleOutline,
      alertCircleOutline,
      archiveOutline,
      closeCircleOutline,
      createOutline,
      eyeOutline,
      filterOutline,
      personCircleOutline,
      refreshOutline,
      removeCircleOutline,
      saveOutline,
      shieldCheckmarkOutline,
      statsChartOutline,
      timeOutline,
      walletOutline
    });
  }

  ngOnInit(): void {
    this.loadBusinesses();
    this.load();
  }

  get hasSelection(): boolean {
    return !!this.selected;
  }

  get filteredHistory(): any[] {
    return this.pointsHistory.filter(item => {
      const matchesType = !this.historyType || item.tipo === this.historyType;
      const matchesRestaurant = !this.historyRestaurant || String(item.restauranteId || '') === this.historyRestaurant;
      return matchesType && matchesRestaurant;
    });
  }

  get tabs(): { id: ClientTab; label: string }[] {
    return [
      { id: 'summary', label: 'Resumen' },
      { id: 'edit', label: 'Editar' },
      { id: 'points', label: 'Puntos' },
      { id: 'history', label: 'Historial' },
      { id: 'activity', label: 'Actividad' },
      { id: 'security', label: 'Seguridad' }
    ];
  }

  load(): void {
    this.loading = true;
    this.adminService.searchClients({
      search: this.query || '',
      status: this.statusFilter,
      points: this.pointsFilter,
      sort: this.sort,
      page: 0,
      size: 250
    }).subscribe({
      next: (response) => {
        this.clients = response?.content || response?.items || response || [];
        this.totalClients = response?.totalClients ?? this.clients.length;
        this.activeClients = response?.activeClients ?? this.clients.filter(item => item.active).length;
        this.inactiveClients = response?.inactiveClients ?? this.clients.filter(item => !item.active).length;
        this.clientsWithPoints = response?.clientsWithPoints ?? this.clients.filter(item => Number(item.puntos) > 0).length;
        this.loading = false;
        if (this.selected) this.refreshSelectedFromList();
      },
      error: async (err) => {
        this.loading = false;
        await this.toast(err.error?.message || 'No se pudieron cargar los clientes.', 'danger');
      }
    });
  }

  loadBusinesses(): void {
    this.adminService.getBusinesses().subscribe({
      next: (data) => this.businesses = data || [],
      error: () => this.businesses = []
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

  select(item: any, tab: ClientTab = 'summary'): void {
    this.activeTab = tab;
    this.detailLoading = true;
    this.adminService.getClientDetail(item.id).subscribe({
      next: (detail) => {
        this.selected = detail;
        this.patchForms(detail);
        this.pointsHistory = detail?.recentMovements || [];
        this.activity = { adminLogs: detail?.adminLogs || [], movements: detail?.recentMovements || [] };
        this.detailLoading = false;
        this.loadPointsHistory();
        this.loadActivity();
      },
      error: async (err) => {
        this.detailLoading = false;
        await this.toast(err.error?.message || 'No se pudo abrir el cliente.', 'danger');
      }
    });
  }

  setTab(value: any): void {
    this.activeTab = (value?.detail?.value || value || 'summary') as ClientTab;
    if (this.activeTab === 'history') this.loadPointsHistory();
    if (this.activeTab === 'activity') this.loadActivity();
  }

  closeDetail(): void {
    this.selected = null;
    this.activity = null;
    this.pointsHistory = [];
  }

  async save(): Promise<void> {
    if (!this.selected || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    const confirmed = await this.confirm(
      'Guardar cambios',
      'Se actualizará la información básica del cliente y quedará registrado en auditoría.'
    );
    if (!confirmed) return;

    this.saving = true;
    this.adminService.updateClient(this.selected.id, this.editForm.value).subscribe({
      next: async (updated) => {
        this.saving = false;
        this.selected = updated;
        this.patchForms(updated);
        this.replace(updated);
        await this.toast('Cliente actualizado');
      },
      error: async (err) => {
        this.saving = false;
        await this.toast(err.error?.message || 'No se pudo guardar el cliente.', 'danger');
      }
    });
  }

  async toggleActive(item = this.selected): Promise<void> {
    if (!item?.id) return;
    const next = !item.active;
    const confirmed = await this.confirm(
      next ? 'Activar cliente' : 'Desactivar cliente',
      next
        ? 'El cliente volverá a estar operativo en la plataforma.'
        : 'El cliente quedará inactivo, pero su histórico se conservará.'
    );
    if (!confirmed) return;

    this.adminService.setClientActive(item.id, next).subscribe({
      next: async (updated) => {
        this.replace(updated);
        if (this.selected?.id === updated.id) {
          this.selected = updated;
          this.patchForms(updated);
        }
        await this.toast(next ? 'Cliente activado' : 'Cliente desactivado');
      },
      error: async (err) => this.toast(err.error?.message || 'No se pudo cambiar el estado.', 'danger')
    });
  }

  async applyPoints(mode: PointMode): Promise<void> {
    if (!this.selected) return;
    this.pointMode = mode;
    if (this.pointsForm.invalid) {
      this.pointsForm.markAllAsTouched();
      return;
    }

    const amount = Number(this.pointsForm.value.amount || 0);
    const label = mode === 'add' ? 'añadir' : mode === 'subtract' ? 'restar' : 'ajustar el saldo a';
    const confirmed = await this.confirm(
      'Confirmar gestión de puntos',
      `Se va a ${label} ${amount} puntos. Esta acción creará un movimiento y un log administrativo.`
    );
    if (!confirmed) return;

    const request = this.pointsRequest();
    const call = mode === 'add'
      ? this.adminService.addClientPoints(this.selected.id, request)
      : mode === 'subtract'
        ? this.adminService.subtractClientPoints(this.selected.id, request)
        : this.adminService.setClientPoints(this.selected.id, request);

    call.subscribe({
      next: async (updated) => {
        this.selected = updated;
        this.patchForms(updated);
        this.replace(updated);
        this.pointsForm.patchValue({ amount: 1, reason: '', description: '' });
        this.loadPointsHistory();
        this.loadActivity();
        await this.toast('Puntos actualizados');
      },
      error: async (err) => this.toast(err.error?.message || 'No se pudo aplicar el ajuste de puntos.', 'danger')
    });
  }

  loadPointsHistory(): void {
    if (!this.selected?.id) return;
    this.adminService.getClientPointsHistory(this.selected.id).subscribe({
      next: (data) => this.pointsHistory = data || [],
      error: () => this.pointsHistory = []
    });
  }

  loadActivity(): void {
    if (!this.selected?.id) return;
    this.adminService.getClientActivity(this.selected.id).subscribe({
      next: (data) => this.activity = data || { adminLogs: [], movements: [] },
      error: () => this.activity = { adminLogs: [], movements: [] }
    });
  }

  async softDelete(): Promise<void> {
    if (!this.selected?.id) return;
    const first = await this.confirm(
      'Eliminar cliente',
      'Se realizará una eliminación lógica: el cliente quedará inactivo y oculto, pero sus movimientos se conservarán.'
    );
    if (!first) return;
    const second = await this.confirm(
      'Confirmación final',
      'Esta acción afectará al acceso del cliente y quedará registrada en auditoría. ¿Continuar?'
    );
    if (!second) return;

    this.adminService.softDeleteClient(this.selected.id).subscribe({
      next: async () => {
        await this.toast('Cliente eliminado de forma lógica');
        this.closeDetail();
        this.load();
      },
      error: async (err) => this.toast(err.error?.message || 'No se pudo eliminar el cliente.', 'danger')
    });
  }

  private patchForms(client: any): void {
    this.editForm.patchValue({
      nombre: client?.nombre || '',
      email: client?.email || '',
      telefono: client?.telefono || '',
      fotoPerfil: client?.fotoPerfil || '',
      active: !!client?.active
    });
  }

  private pointsRequest(): any {
    const value = this.pointsForm.value;
    return {
      restaurantId: value.restaurantId || null,
      amount: Number(value.amount || 0),
      type: value.type,
      reason: value.reason,
      description: value.description
    };
  }

  private refreshSelectedFromList(): void {
    const next = this.clients.find(item => item.id === this.selected?.id);
    if (next && this.selected) {
      this.selected = { ...this.selected, ...next };
      this.patchForms(this.selected);
    }
  }

  private replace(updated: any): void {
    const summary = {
      id: updated.id,
      nombre: updated.nombre,
      email: updated.email,
      telefono: updated.telefono,
      fotoPerfil: updated.fotoPerfil,
      puntos: updated.puntos,
      qrCode: updated.qrCode,
      active: updated.active,
      deleted: updated.deleted,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt
    };
    this.clients = this.clients.map(item => item.id === updated.id ? summary : item);
    this.activeClients = this.clients.filter(item => item.active).length;
    this.inactiveClients = this.clients.filter(item => !item.active).length;
    this.clientsWithPoints = this.clients.filter(item => Number(item.puntos) > 0).length;
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
