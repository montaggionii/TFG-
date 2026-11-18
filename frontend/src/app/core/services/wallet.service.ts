import { Injectable, inject } from '@angular/core';
import { Browser } from '@capacitor/browser';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../../environments/environment';

/**
 * "Añadir a Wallet": abre el pase de Apple Wallet (.pkpass) generado por
 * el backend. Safari/Wallet lo ofrece automáticamente como
 * "Añadir a Apple Wallet"; el JWT viaja como ?token= porque el pase se
 * abre como enlace directo y no puede llevar cabeceras (el backend solo
 * lo acepta así para esta ruta).
 */
@Injectable({ providedIn: 'root' })
export class WalletService {

  private auth = inject(AuthService);

  async addToWallet(): Promise<void> {
    const token = localStorage.getItem('token');
    if (!token) return;

    const url = `${environment.apiUrl}/api/wallet/pass?token=${encodeURIComponent(token)}`;
    await Browser.open({ url });
  }
}
