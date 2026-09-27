import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { RestauranteService } from '../../../core/services/restaurante.service';
import { AuthService } from '../../../core/auth/auth.service';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { 
  calendarOutline, cashOutline, starOutline, giftOutline, 
  peopleOutline, trendingUpOutline, downloadOutline, 
  funnelOutline, chevronForwardOutline, timeOutline,
  checkmarkCircleOutline, arrowUpOutline, arrowDownOutline,
  addOutline, alertCircleOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-activity-history',
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, FormsModule],
  templateUrl: './activity-history.component.html',
  styleUrls: ['./activity-history.component.scss']
})
export class ActivityHistoryComponent implements OnInit {
  private restauranteService = inject(RestauranteService);
  private authService = inject(AuthService);
  
  public stats: any = this.getEmptyStats();
  public filteredHistory: any[] = [];
  public isLoading = true;
  public selectedDate = new Date().toISOString();
  public restauranteId: number | null = null;
  public hasError = false;
  public rendimientoSemanal: { dia: string; monto: number; alturaPct: number }[] | null = null;

  constructor() {
    addIcons({ 
      calendarOutline, cashOutline, starOutline, giftOutline, 
      peopleOutline, trendingUpOutline, downloadOutline, 
      funnelOutline, chevronForwardOutline, timeOutline,
      checkmarkCircleOutline, arrowUpOutline, arrowDownOutline,
      addOutline, alertCircleOutline
    });
  }

  ngOnInit() {
    this.authService.authState$.subscribe(state => {
      if (state.token && state.id) {
        this.restauranteId = state.id;
        this.loadStats();
        this.cargarRendimientoSemanal();
      }
    });
  }

  cargarRendimientoSemanal() {
    if (!this.restauranteId) return;
    this.restauranteService.getEstadisticasPeriodo(this.restauranteId, 'SEMANA', false).subscribe({
      next: (resp) => {
        const actual = resp?.actual;
        if (!actual) return;

        const desde = new Date(actual.desde);
        const etiquetas = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
        const porFecha = new Map<string, number>(
          (actual.ventasPorDia || []).map((d: any) => [d.fecha, d.monto])
        );
        const montosPorDia = etiquetas.map((_, i) => {
          const fecha = new Date(desde);
          fecha.setDate(desde.getDate() + i);
          const key = fecha.toISOString().slice(0, 10);
          return porFecha.get(key) || 0;
        });
        const maxMonto = Math.max(...montosPorDia, 1);

        this.rendimientoSemanal = etiquetas.map((dia, i) => ({
          dia,
          monto: montosPorDia[i],
          alturaPct: Math.max(4, Math.round((montosPorDia[i] / maxMonto) * 100))
        }));
      },
      error: (err) => console.error('[ACTIVITY LOAD] Error cargando rendimiento semanal:', err)
    });
  }

  getEmptyStats() {
    return {
      facturacionTotal: 0,
      puntosEntregados: 0,
      puntosCanjeados: 0,
      clientesAtendidos: 0,
      historialCompleto: [],
      ingresosPorDia: {}
    };
  }

  loadStats() {
    if (!this.restauranteId) return;
    this.isLoading = true;
    this.hasError = false;

    this.restauranteService.getAdvancedStats(this.restauranteId).subscribe({
      next: (data) => {
        this.stats = data;
        this.filteredHistory = data.historialCompleto || [];
        this.isLoading = false;
      },
      error: (err) => {
        console.error('[ACTIVITY LOAD] Error:', err);
        this.stats = this.getEmptyStats();
        this.filteredHistory = [];
        this.hasError = true;
        this.isLoading = false;
      }
    });
  }

  todayIso(): string {
    return new Date().toISOString();
  }

  onDateChange(event: any) {
    this.selectedDate = event.detail.value;
    this.filterByDate();
  }

  filterByDate() {
    if (!this.stats) return;
    const dateStr = this.selectedDate.split('T')[0];
    this.filteredHistory = this.stats.historialCompleto.filter((m: any) => 
      m.fecha.startsWith(dateStr)
    );
  }

  getBadgeColor(tipo: string) {
    return tipo === 'GANADOS' ? 'success' : 'danger';
  }

  getTypeLabel(tipo: string) {
    return tipo === 'GANADOS' ? 'ABONO' : 'CANJE';
  }
}
