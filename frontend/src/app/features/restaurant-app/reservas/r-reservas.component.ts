import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { RouterLink } from '@angular/router';
import { addIcons } from 'ionicons';
import { calendarOutline, peopleOutline, checkmarkOutline, closeOutline, restaurantOutline } from 'ionicons/icons';
import { ReservaService, Reserva } from '../../../core/services/reserva.service';

@Component({
  selector: 'app-r-reservas',
  standalone: true,
  imports: [IonicModule, CommonModule, RouterLink],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/r/dashboard" text=""></ion-back-button>
        </ion-buttons>
        <ion-title>Reservas</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-spinner *ngIf="cargando" name="crescent" style="display:block;margin:40px auto;"></ion-spinner>

      <div *ngIf="!cargando && reservas.length === 0" class="empty">
        <ion-icon name="calendar-outline" color="medium"></ion-icon>
        <p>Aún no hay reservas de clientes.</p>
      </div>

      <ion-card *ngFor="let r of reservas" class="reserva-card" [class.cancelada]="r.estado === 'CANCELLED'">
        <div class="head">
          <div class="cliente">
            <strong>{{ r.cliente }}</strong>
            <p>{{ r.clienteTelefono || r.clienteEmail }}</p>
          </div>
          <ion-badge [color]="badge(r.estado)">{{ estado(r.estado) }}</ion-badge>
        </div>
        <p class="detalle">
          <ion-icon name="time-outline"></ion-icon>
          {{ r.fecha | date:'EEE d MMM, HH:mm' }}
          &nbsp;·&nbsp;
          <ion-icon name="people-outline"></ion-icon>
          {{ r.personas }} personas
        </p>
        <p *ngIf="r.notas" class="notas">"{{ r.notas }}"</p>
        <div *ngIf="r.estado === 'PENDING'" class="acciones">
          <ion-button size="small" color="success" (click)="cambiarEstado(r, 'CONFIRMED')">
            <ion-icon slot="start" name="checkmark-outline"></ion-icon> Aceptar
          </ion-button>
          <ion-button size="small" color="medium" fill="outline" (click)="cambiarEstado(r, 'CANCELLED')">
            <ion-icon slot="start" name="close-outline"></ion-icon> Rechazar
          </ion-button>
          <a class="tel" *ngIf="r.clienteTelefono" [href]="'tel:' + r.clienteTelefono">Llamar</a>
        </div>
      </ion-card>
    </ion-content>
  `,
  styles: [`
    .empty { text-align: center; padding: 60px 20px; ion-icon { font-size: 56px; } }
    .reserva-card { margin: 10px 0; padding: 12px 14px; border-radius: 14px;
      &.cancelada { opacity: .5; } }
    .head { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 4px;
      .cliente { flex: 1; strong { font-size: 16px; } p { margin: 0; font-size: 13px; color: var(--ion-color-medium); } } }
    .detalle { color: var(--ion-color-medium, gray); font-size: 14px; ion-icon { vertical-align: -2px; } }
    .notas { font-style: italic; font-size: 13px; color: var(--ion-color-medium); }
    .acciones { display: flex; gap: 8px; align-items: center; margin-top: 6px;
      .tel { font-size: 13px; margin-left: auto; } }
  `]
})
export class RReservasComponent implements OnInit {
  private reservaService = inject(ReservaService);
  private toastCtrl = inject(ToastController);

  reservas: Reserva[] = [];
  cargando = true;

  constructor() {
    addIcons({ calendarOutline, peopleOutline, checkmarkOutline, closeOutline, restaurantOutline });
  }

  ngOnInit() { this.cargar(); }

  cargar() {
    this.cargando = true;
    this.reservaService.delRestaurante().subscribe({
      next: (data) => { this.reservas = data; this.cargando = false; },
      error: () => { this.cargando = false; }
    });
  }

  cambiarEstado(r: Reserva, estado: 'CONFIRMED' | 'CANCELLED') {
    this.reservaService.cambiarEstado(r.id, estado).subscribe({
      next: (actualizada) => {
        r.estado = actualizada.estado;
        this.toastCtrl.create({
          message: estado === 'CONFIRMED' ? 'Reserva confirmada' : 'Reserva rechazada',
          duration: 2500, color: estado === 'CONFIRMED' ? 'success' : 'medium', position: 'top'
        }).then(t => t.present());
      },
      error: (err) => {
        this.toastCtrl.create({ message: err.error?.message || 'Error', duration: 2500, color: 'danger', position: 'top' })
          .then(t => t.present());
      }
    });
  }

  estado(e: string) {
    return { CONFIRMED: 'Confirmada', PENDING: 'Pendiente', CANCELLED: 'Rechazada/Cancelada' }[e] || e;
  }

  badge(e: string) {
    return { CONFIRMED: 'success', PENDING: 'warning', CANCELLED: 'medium' }[e] || 'medium';
  }
}
