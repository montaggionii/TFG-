export interface MovimientoPuntosDTO {
  id: number;
  puntos: number;
  tipo: string;
  descripcion: string;
  fecha: string;
  monto?: number;
  usuarioNombre?: string;
}
