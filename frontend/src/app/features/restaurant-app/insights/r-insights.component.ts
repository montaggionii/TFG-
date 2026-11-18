import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { analyticsOutline, personRemoveOutline, personAddOutline, repeatOutline, bulbOutline } from 'ionicons/icons';
import { RestauranteService } from '../../../core/services/restaurante.service';
import { GlobalStateService } from '../../../core/state/global-state.service';

interface Inactivo {
  id: number;
  nombre: string;
  puntos: number;
  diasSinVolver: number;
}

/**
 * Insights de fidelidad: quiénes no vuelven, quiénes son fieles y qué
 * promo conviene lanzar. Es la pieza que el Agent Layer consume para
 * proponer acciones automáticas al restaurante.
 */
@Component({
  selector: 'app-r-insights',
  standalone: true,
  imports: [IonicModule, CommonModule],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/r/dashboard" text=""></ion-back-button>
        </ion-buttons>
        <ion-title>Insights</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-spinner *ngIf="cargando" name="crescent" style="display:block;margin:40px auto;"></ion-spinner>

      <ng-container *ngIf="!cargando && data">
        <div class="sugerencia">
          <ion-icon name="bulb-outline"></ion-icon>
          <p>{{ data.sugerencia }}</p>
        </div>

        <div class="stats-grid">
          <div class="stat">
            <ion-icon name="analytics-outline"></ion-icon>
            <strong>{{ data.clientesTotales }}</strong>
            <span>clientes con visitas</span>
          </div>
          <div class="stat">
            <ion-icon name="repeat-outline"></ion-icon>
            <strong>{{ data.clientesRecurrentes }}</strong>
            <span>recurrentes (2+ visitas)</span>
          </div>
          <div class="stat">
            <ion-icon name="trending-up-outline"></ion-icon>
            <strong>+{{ data.ganadosMes }}</strong>
            <span>puntos dados este mes</span>
          </div>
          <div class="stat">
            <ion-icon name="trending-down-outline"></ion-icon>
            <strong>{{ data.canjeadosMes }}</strong>
            <span>puntos canjeados este mes</span>
          </div>
        </div>

        <div class="promo-top" *ngIf="data.promoMasCanjeada">
          <h3>La más canjeada</h3>
          <p>{{ data.promoMasCanjeada.promocion }} — {{ data.promoMasCanjeada.canjes }} canjes</p>
        </div>

        <h3 class="list-title" *ngIf="(data.clientesInactivos || []).length > 0">
          Clientes que no vuelven (3+ semanas)
        </h3>
        <ion-card *ngFor="let c of data.clientesInactivos" class="inactivo">
          <div class="fila">
            <ion-icon name="person-remove-outline" color="danger"></ion-icon>
            <strong>{{ c.nombre }}</strong>
            <span class="dias">{{ c.diasSinVolver }} días sin volver</span>
          </div>
          <p class="puntos">Tiene {{ c.puntos }} puntos acumulados</p>
        </ion-card>

        <div *ngIf="data.clientesTotales === 0" class="empty">
          <ion-icon name="analytics-outline" color="medium"></ion-icon>
          <p>Registra tus primeras compras con el escáner para ver insights.</p>
        </div>
      </ng-container>
    </ion-content>
  `,
  styles: [`
    .sugerencia { display:flex; gap:10px; align-items:center; background: rgba(255,122,0,.10);
      border:1px solid rgba(255,122,0,.25); border-radius:14px; padding:12px 14px; margin-bottom:14px;
      ion-icon { font-size:24px; color: var(--ion-color-warning, #FF7A00); flex-shrink:0; }
      p { margin:0; font-size:14px; font-weight:600; } }
    .stats-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px;
      .stat { background: var(--ion-card-background, #fff); border-radius:14px; padding:12px;
        ion-icon { font-size:18px; opacity:.6; } strong { display:block; font-size:22px; }
        span { font-size:11px; color: var(--ion-color-medium); } } }
    .promo-top { background: var(--ion-card-background, #fff); border-radius:14px; padding:12px 14px; margin-bottom:14px;
      h3 { margin:0 0 2px; font-size:14px; } p { margin:0; font-size:15px; font-weight:700; } }
    .list-title { font-size:15px; margin: 6px 0; }
    .inactivo { margin: 8px 0; padding: 10px 14px; border-radius: 14px;
      .fila { display:flex; gap:8px; align-items:center;
        strong { flex:1; } .dias { font-size:12px; color: var(--ion-color-danger); font-weight:700; } }
      .puntos { margin:2px 0 0 30px; font-size:12px; color: var(--ion-color-medium); } }
    .empty { text-align:center; padding:50px 20px; ion-icon { font-size:52px; } }
  `]
})
export class RInsightsComponent implements OnInit {
  private restauranteService = inject(RestauranteService);
  private globalState = inject(GlobalStateService);

  data: any = null;
  cargando = true;

  constructor() {
    addIcons({ analyticsOutline, personRemoveOutline, personAddOutline, repeatOutline, bulbOutline });
  }

  ngOnInit() {
    const id = Number(localStorage.getItem('userId'));
    if (!id) { this.cargando = false; return; }
    this.restauranteService.getInsights(id).subscribe({
      next: (d) => { this.data = d; this.cargando = false; },
      error: () => { this.cargando = false; }
    });
  }
}
