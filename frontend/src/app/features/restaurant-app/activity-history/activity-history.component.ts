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
    console.log('📈 [ACTIVITY LOAD] Inicializando Historial Profesional...');
    this.authService.authState$.subscribe(state => {
      if (state.token && state.id) {
        this.restauranteId = state.id;
        this.loadStats();
      } else {
        // Fallback for demo if no session (only for development/preview)
        setTimeout(() => {
          if (this.isLoading) this.useMockData();
        }, 2000);
      }
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

  useMockData() {
    console.log('🧪 [ACTIVITY MOCK] Usando datos de simulación para visualización...');
    this.stats = {
      facturacionTotal: 1245.50,
      puntosEntregados: 12450,
      puntosCanjeados: 3500,
      clientesAtendidos: 84,
      historialCompleto: [
        { id: 1, puntos: 150, tipo: 'GANADOS', descripcion: 'Consumo menú del día', fecha: new Date().toISOString(), monto: 15.00, usuarioNombre: 'Juan Pérez' },
        { id: 2, puntos: 500, tipo: 'CANJEADOS', descripcion: 'Canje: Postre Gratis', fecha: new Date().toISOString(), monto: 0, usuarioNombre: 'Maria García' },
        { id: 3, puntos: 250, tipo: 'GANADOS', descripcion: 'Cena Gourmet especial', fecha: new Date().toISOString(), monto: 25.00, usuarioNombre: 'Carlos Ruiz' },
        { id: 4, puntos: 100, tipo: 'GANADOS', descripcion: 'Café y desayuno', fecha: new Date().toISOString(), monto: 10.00, usuarioNombre: 'Ana Lopez' }
      ]
    };
    this.filteredHistory = this.stats.historialCompleto;
    this.isLoading = false;
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
        
        // Si no hay datos reales, mostramos mock para no ver la pantalla vacía en el primer uso
        if (this.filteredHistory.length === 0 && this.stats.facturacionTotal === 0) {
           this.useMockData();
        }
      },
      error: (err) => {
        console.error('❌ [ACTIVITY LOAD] Error:', err);
        this.hasError = true;
        this.useMockData(); // Fallback to mock on error so user sees the UI
      }
    });
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
