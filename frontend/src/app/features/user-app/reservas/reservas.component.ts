import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { RouterLink, Router } from '@angular/router';
import { addIcons } from 'ionicons';
import { calendarOutline, peopleOutline, closeCircleOutline, checkmarkCircleOutline, timeOutline } from 'ionicons/icons';
import { ReservaService, Reserva } from '../../../core/services/reserva.service';
import { CustomerI18nService } from '../../../core/i18n/customer-i18n.service';
import { CustomerTranslatePipe } from '../../../core/i18n/customer-translate.pipe';

@Component({
  selector: 'app-reservas',
  standalone: true,
  imports: [IonicModule, CommonModule, RouterLink, CustomerTranslatePipe],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/u/home" text=""></ion-back-button>
        </ion-buttons>
        <ion-title>{{ 'reservas.title' | ffTranslate }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-spinner *ngIf="cargando" name="crescent" class="centered"></ion-spinner>

      <div *ngIf="!cargando && reservas.length === 0" class="empty">
        <ion-icon name="calendar-outline" color="medium"></ion-icon>
        <p>{{ 'reservas.empty' | ffTranslate }}</p>
        <ion-button routerLink="/u/mapa" fill="outline">{{ 'reservas.buscar' | ffTranslate }}</ion-button>
      </div>

      <ion-card *ngFor="let r of reservas" class="reserva-card" [class.cancelada]="r.estado === 'CANCELLED'">
        <div class="reserva-head">
          <ion-icon name="restaurant-outline" color="primary"></ion-icon>
          <strong>{{ r.restauranteNombre }}</strong>
          <ion-badge slot="end" [color]="badgeColor(r.estado)">{{ estado(r.estado) }}</ion-badge>
        </div>
        <p><ion-icon name="time-outline"></ion-icon> {{ r.fecha | date:'EEE d MMM, HH:mm' }}</p>
        <p><ion-icon name="people-outline"></ion-icon> {{ r.personas }} {{ 'reservas.personas' | ffTranslate }}</p>
        <p *ngIf="r.notas" class="notas">"{{ r.notas }}"</p>
        <div class="acciones-reserva">
          <ion-button *ngIf="r.estado === 'PENDING' || r.estado === 'CONFIRMED'"
                      size="small" fill="clear" color="danger" (click)="cancelar(r)">
            {{ 'reservas.cancelar' | ffTranslate }}
          </ion-button>
          <ion-button size="small" fill="outline" (click)="repetir(r)">
            {{ 'reservas.repetir' | ffTranslate }}
          </ion-button>
        </div>
      </ion-card>
    </ion-content>
  `,
  styles: [`
    .centered { display: block; margin: 40px auto; }
    .empty { text-align: center; padding: 60px 20px; ion-icon { font-size: 56px; } }
    .reserva-card { margin: 10px 0; padding: 12px 14px; border-radius: 14px;
      &.cancelada { opacity: .55; } }
    .reserva-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px;
      strong { flex: 1; font-size: 16px; } }
    p { margin: 2px 0; color: var(--ion-color-medium, gray); font-size: 14px;
      ion-icon { vertical-align: -2px; margin-right: 4px; } }
    .notas { font-style: italic; }
    .acciones-reserva { display: flex; gap: 6px; margin-top: 4px; }
  `]
})
export class ReservasComponent implements OnInit {
  private reservaService = inject(ReservaService);
  private router = inject(Router);
  private toastCtrl = inject(ToastController);
  private i18n = inject(CustomerI18nService);

  reservas: Reserva[] = [];
  cargando = true;

  constructor() {
    addIcons({ calendarOutline, peopleOutline, closeCircleOutline, checkmarkCircleOutline, timeOutline });
  }

  ngOnInit() { this.cargar(); }

  cargar() {
    this.cargando = true;
    this.reservaService.mias().subscribe({
      next: (data) => { this.reservas = data; this.cargando = false; },
      error: () => { this.cargando = false; }
    });
  }

  repetir(r: Reserva) {
    if (!r.restauranteId) return;
    this.router.navigate(['/u/restaurante', r.restauranteId], { queryParams: { reservar: r.personas } });
  }

  async cancelar(r: Reserva) {
    this.reservaService.cancelar(r.id).subscribe({
      next: () => {
        r.estado = 'CANCELLED';
        this.toastCtrl.create({ message: this.i18n.instant('reservas.cancelada'), duration: 2500, color: 'success', position: 'top' })
          .then(t => t.present());
      },
      error: (err) => {
        this.toastCtrl.create({ message: err.error?.message || 'Error', duration: 2500, color: 'danger', position: 'top' })
          .then(t => t.present());
      }
    });
  }

  estado(e: string) {
    return this.i18n.instant('reservas.estado.' + (e || 'PENDING').toLowerCase());
  }

  badgeColor(e: string) {
    return { CONFIRMED: 'success', PENDING: 'warning', CANCELLED: 'medium' }[e] || 'medium';
  }
}
