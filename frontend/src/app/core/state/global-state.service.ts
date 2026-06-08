import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface UserState {
  id: number;       // siempre presente tras el login
  nombre?: string;
  email: string;
  rol: string;
  puntos?: number;
  qrCode?: string;
  token?: string;
  fotoPerfil?: string;
}


@Injectable({
  providedIn: 'root'
})
export class GlobalStateService {
  private userState = new BehaviorSubject<UserState | null>(this.loadInitialState());
  public userState$ = this.userState.asObservable();

  setState(state: UserState | null) {
    if (state) {
      localStorage.setItem('currentUser', JSON.stringify(state));
      console.log(`[STATE CHANGE] Nuevo estado completo:`, state);
    } else {
      localStorage.removeItem('currentUser');
      console.log(`[STATE CHANGE] Estado limpiado (logout)`);
    }
    this.userState.next(state);
  }

  getState(): UserState | null {
    return this.userState.getValue();
  }

  /**
   * Actualiza SOLO el campo puntos del estado global sin reemplazar el resto.
   * Esto evita que cualquier componente pise accidentalmente otros campos del estado.
   * Usar siempre este método tras un canje o suma de puntos.
   */
  updatePuntos(puntos: number) {
    const current = this.userState.getValue();
    if (!current) {
      console.warn('[PUNTOS GLOBAL] updatePuntos() llamado sin estado de usuario activo');
      return;
    }
    const puntosAnteriores = current.puntos ?? 0;
    const updatedState: UserState = { ...current, puntos };
    localStorage.setItem('currentUser', JSON.stringify(updatedState));
    console.log(`[PUNTOS GLOBAL] Actualización: ${puntosAnteriores} → ${puntos} pts`);
    console.log(`[ESTADO ACTUALIZADO] UsuarioID=${current.id} | Puntos=${puntos}`);
    this.userState.next(updatedState);
  }

  /**
   * Actualiza el campo fotoPerfil del estado global y localStorage.
   */
  updatePhoto(fotoPerfil: string) {
    const current = this.userState.getValue();
    if (!current) return;
    
    const updatedState: UserState = { ...current, fotoPerfil };
    localStorage.setItem('currentUser', JSON.stringify(updatedState));
    localStorage.setItem('userPhoto', fotoPerfil);
    this.userState.next(updatedState);
    console.log(`[STATE PHOTO] Foto actualizada en estado global: ${fotoPerfil}`);
  }


  private loadInitialState(): UserState | null {
    const saved = localStorage.getItem('currentUser');
    if (saved) return JSON.parse(saved);

    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');
    const role = localStorage.getItem('role');

    if (!token || !userId || !role) return null;

    return {
      id: Number(userId),
      nombre: localStorage.getItem('nombre') || undefined,
      email: '',
      rol: role,
      token,
      fotoPerfil: localStorage.getItem('userPhoto') || undefined
    };
  }
}
