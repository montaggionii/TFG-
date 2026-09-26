import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { addIcons } from 'ionicons';
import { arrowUpOutline, arrowDownOutline, removeOutline, trendingUpOutline } from 'ionicons/icons';
import { RestauranteService } from '../../../core/services/restaurante.service';
import { GlobalStateService } from '../../../core/state/global-state.service';

type Periodo = 'SEMANA' | 'MES' | 'ANIO';

@Component({
  selector: 'app-analiticas',
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule],
  templateUrl: './analiticas.component.html',
  styleUrls: ['./analiticas.component.scss']
})
export class AnaliticasComponent implements OnInit {
  private restauranteService = inject(RestauranteService);
  private globalState = inject(GlobalStateService);

  periodo: Periodo = 'SEMANA';
  isLoading = true;
  error = false;

  data: any = null; // respuesta cruda del backend (actual/anterior/variaciones)
  barras: { fecha: string; monto: number; alturaPct: number; esMejorDia: boolean }[] = [];

  constructor() {
    addIcons({ arrowUpOutline, arrowDownOutline, removeOutline, trendingUpOutline });
  }

  ngOnInit() {
    this.cargar();
  }

  cambiarPeriodo(p: Periodo) {
    if (this.periodo === p) return;
    this.periodo = p;
    this.cargar();
  }

  cargar() {
    const business = this.globalState.getState();
    if (!business?.id) {
      this.error = true;
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.error = false;

    this.restauranteService.getEstadisticasPeriodo(business.id, this.periodo, true).subscribe({
      next: (resp) => {
        this.data = resp;
        this.construirBarras(resp?.actual);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('[ANALITICAS] Error cargando estadisticas:', err);
        this.error = true;
        this.isLoading = false;
      }
    });
  }

  private construirBarras(actual: any) {
    const dias = actual?.ventasPorDia || [];
    const maxMonto = Math.max(...dias.map((d: any) => d.monto), 1);
    this.barras = dias.map((d: any) => ({
      fecha: d.fecha,
      monto: d.monto,
      alturaPct: Math.max(4, Math.round((d.monto / maxMonto) * 100)),
      esMejorDia: d.monto === maxMonto && maxMonto > 0
    }));
  }

  formatFecha(fechaISO: string): string {
    const f = new Date(fechaISO + 'T00:00:00');
    return f.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  }

  formatRango(fechaISO: string): string {
    const f = new Date(fechaISO + 'T00:00:00');
    return f.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  variacionIcon(pct: number | null | undefined): string {
    if (pct == null || Math.abs(pct) < 0.5) return 'remove-outline';
    return pct > 0 ? 'arrow-up-outline' : 'arrow-down-outline';
  }

  variacionClase(pct: number | null | undefined): string {
    if (pct == null || Math.abs(pct) < 0.5) return 'neutral';
    return pct > 0 ? 'positivo' : 'negativo';
  }
}
