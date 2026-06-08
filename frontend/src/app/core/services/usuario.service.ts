import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/api/usuarios`;
  readonly profilePlaceholder = 'assets/img/profile-placeholder.svg';

  getUsuarioById(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  updateUsuario(id: number, data: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/${id}`, data);
  }

  uploadPhoto(id: number, file: File): Observable<string> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.apiUrl}/${id}/upload-photo`, formData, { responseType: 'text' });
  }

  changePassword(id: number, currentPassword: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${id}/change-password`, {
      currentPassword,
      newPassword
    });
  }

  /**
   * Resuelve una ruta de imagen (relativa o absoluta) a una URL válida y actual.
   * Si detecta una IP antigua o incorrecta, la repara automáticamente.
   */
  resolveImageUrl(path: string | null | undefined): string | null {
    const raw = String(path ?? '').trim();
    if (!raw || raw === 'null' || raw === 'undefined') return null;
    
    // 1. Si es base64, dejar como está
    if (raw.startsWith('data:')) return raw;

    if (raw.startsWith('assets/')) return raw;
    if (raw.startsWith('/assets/')) return raw.substring(1);
    
    // 2. Si es una de nuestras imágenes (/uploads/), extraer la parte relativa y reconstruir
    // Esto repara automáticamente URLs con IPs viejas guardadas en BD.
    const uploadsIdx = raw.indexOf('/uploads/');
    if (uploadsIdx >= 0) {
      const relativePath = raw.substring(uploadsIdx);
      const finalUrl = `${environment.apiUrl}${relativePath}`;
      console.log(`🔧 [IMAGE REPAIR] De: ${raw} -> A: ${finalUrl}`);
      return finalUrl;
    }

    // 3. Si es una URL externa real (no nuestra), dejarla igual
    if (raw.startsWith('http')) return raw;

    // 4. Si es una ruta relativa pura, asegurar prefijo /uploads/
    let cleanPath = raw.startsWith('/') ? raw : `/${raw}`;
    if (!cleanPath.startsWith('/uploads/')) {
      cleanPath = `/uploads/perfiles${cleanPath}`;
    }
    
    return `${environment.apiUrl}${cleanPath}`;
  }

  resolveProfileImage(source: any): string {
    const raw = this.getProfileImageCandidate(source);
    return this.resolveImageUrl(raw) || this.profilePlaceholder;
  }

  onProfileImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) return;
    if (img.src.includes(this.profilePlaceholder)) return;
    img.src = this.profilePlaceholder;
    img.classList.add('ff-profile-image-fallback');
  }

  private getProfileImageCandidate(source: any): string | null {
    if (!source) return null;
    if (typeof source === 'string') return source;

    const fields = [
      'fotoPerfil',
      'avatar',
      'imageUrl',
      'fotoUrl',
      'profileImage',
      'profilePicture',
      'foto'
    ];

    for (const field of fields) {
      const value = source?.[field];
      if (typeof value === 'string' && value.trim()) return value;
    }

    return null;
  }
}
