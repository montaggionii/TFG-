import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { MovimientoService } from '../../../core/services/movimiento.service';
import { GlobalStateService } from '../../../core/state/global-state.service';
import { PuntosService } from '../../../core/services/puntos.service';
import { CustomerTranslatePipe } from '../../../core/i18n/customer-translate.pipe';
import { addIcons } from 'ionicons';
import { 
  receiptOutline, 
  addCircleOutline, 
  removeCircleOutline,
  walletOutline, 
  trendingUpOutline, 
  trendingDownOutline, 
  timeOutline 
} from 'ionicons/icons';

export interface MovimientoPuntosDTO {
  id: number;
  puntos: number;
  tipo: string; // ACUMULACION o CANJE
  descripcion: string;
  fecha: string;
}

@Component({
  selector: 'app-historial',
  templateUrl: './historial.component.html',
  styleUrls: ['./historial.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule, CustomerTranslatePipe]
})
export class HistorialComponent implements OnInit {
  private movimientoService = inject(MovimientoService);
  private globalState = inject(GlobalStateService);
  private puntosService = inject(PuntosService);

  historial: MovimientoPuntosDTO[] = [];
  isLoading = true;
  filtroActivo: 'todos' | 'ganados' | 'canjeados' = 'todos';

  get historialFiltrado(): MovimientoPuntosDTO[] {
    if (this.filtroActivo === 'ganados') return this.historial.filter(m => this.esGanancia(m.tipo));
    if (this.filtroActivo === 'canjeados') return this.historial.filter(m => this.esCanje(m.tipo));
    return this.historial;
  }

  ganadosEstaSemana(): number {
    const hace = new Date(Date.now() - 7 * 86400_000);
    return this.historial
      .filter(m => this.esGanancia(m.tipo) && new Date(m.fecha) >= hace)
      .reduce((s, m) => s + m.puntos, 0);
  }

  balanceServidor: number | null = null;

  constructor() {
    addIcons({
      receiptOutline, 
      addCircleOutline, 
      removeCircleOutline,
      walletOutline, 
      trendingUpOutline, 
      trendingDownOutline, 
      timeOutline
    });
  }

  esGanancia(tipo: string): boolean {
    if (!tipo) return false;
    const t = tipo.toUpperCase();
    return ['ACUMULACION', 'GANADOS', 'GANAR', 'SUMA', 'SUMAR', 'ABONO'].includes(t);
  }

  esCanje(tipo: string): boolean {
    if (!tipo) return false;
    const t = tipo.toUpperCase();
    return ['CANJE', 'CANJEADOS', 'CANJEAR'].includes(t);
  }

  get totalGanado(): number {
    return this.historial
      .filter(m => this.esGanancia(m.tipo))
      .reduce((sum, m) => sum + m.puntos, 0);
  }

  get totalCanjeado(): number {
    return this.historial
      .filter(m => this.esCanje(m.tipo))
      .reduce((sum, m) => sum + m.puntos, 0);
  }

  get balance(): number {
    if (this.balanceServidor !== null) {
      return this.balanceServidor;
    }

    // La fuente de verdad del balance total viene del estado global del usuario (ej: 56 puntos)
    const globalState = this.globalState.getState();
    if (globalState && globalState.puntos !== undefined) {
      return globalState.puntos;
    }
    // Si no está disponible por alguna razón, usamos el cálculo local
    return this.totalGanado - this.totalCanjeado;
  }

  ngOnInit() {
    this.cargarHistorial();
  }

  cargarHistorial(event?: any) {
    if (!event) this.isLoading = true;
    
    this.movimientoService.getHistorial().subscribe({
      next: (data: any[]) => {
        this.historial = data;
        this.sincronizarBalance();
        this.isLoading = false;
        if (event) event.target.complete();
      },
      error: () => {
        this.isLoading = false;
        if (event) event.target.complete();
      }
    });
  }

  private sincronizarBalance() {
    const userId = this.globalState.getState()?.id;
    if (!userId) return;

    this.puntosService.getTotalPuntos(userId).subscribe({
      next: (res) => {
        this.balanceServidor = Number(res?.puntos ?? 0);
      }
    });
  }
}
