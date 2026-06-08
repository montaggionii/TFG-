import { Component, Input, inject, OnInit, OnChanges, SimpleChanges, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterLink } from '@angular/router';
import { addIcons } from 'ionicons';
import * as icons from 'ionicons/icons';
import * as QRCode from 'qrcode';
import { UsuarioService } from '../../../core/services/usuario.service';
import { CustomerTranslatePipe } from '../../../core/i18n/customer-translate.pipe';

@Component({
  selector: 'app-user-card',
  templateUrl: './user-card.component.html',
  styleUrls: ['./user-card.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterLink, CustomerTranslatePipe]
})
export class UserCardComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() user: any;
  @Input() showCta: boolean = true;
  @ViewChild('qrCanvas') qrCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('largeQrCanvas') largeQrCanvas!: ElementRef<HTMLCanvasElement>;
  
  isModalOpen = false;
  qrCodeGenerated = false;
  
  private router = inject(Router);
  private usuarioService = inject(UsuarioService);
  public icons = icons;

  constructor() {
    addIcons({
      walletOutline: icons.walletOutline,
      chevronForwardOutline: icons.chevronForwardOutline,
      giftOutline: icons.giftOutline,
      expandOutline: icons.expandOutline,
      closeOutline: icons.closeOutline,
      flashlightOutline: icons.flashlightOutline
    });
  }

  ngOnInit() {
    this.generateQRCode();
    this.fixUserPhoto();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['user'] && this.user) {
      this.generateQRCode();
      this.fixUserPhoto();
    }
  }

  fixUserPhoto() {
    if (this.user) {
      this.user.fotoPerfil = this.usuarioService.resolveProfileImage(this.user);
    }
  }

  onPhotoError(event: Event) {
    this.usuarioService.onProfileImageError(event);
    if (this.user) {
      this.user.fotoPerfil = this.usuarioService.profilePlaceholder;
    }
  }

  ngAfterViewInit() {
    this.generateQRCode();
  }

  abrirQR() {
    this.isModalOpen = true;
    // Dar tiempo al modal para renderizar el canvas
    setTimeout(() => this.generateLargeQRCode(), 200);
  }

  async generateQRCode() {
    if (!this.user || !this.qrCanvas) return;
    
    const userId = String(this.user.id || 'GUEST');
    const qrText = `FIDELITY_ID:${userId}`;
    
    try {
      await QRCode.toCanvas(this.qrCanvas.nativeElement, qrText, {
        margin: 2,
        width: 140,
        color: { dark: '#050505', light: '#ffffff' },
        errorCorrectionLevel: 'M'
      });
      this.qrCodeGenerated = true;
    } catch (err) {
      console.error('Error QR:', err);
    }
  }

  async generateLargeQRCode() {
    if (!this.user || !this.largeQrCanvas) return;
    
    const userId = String(this.user.id || 'GUEST');
    const qrText = `FIDELITY_ID:${userId}`;
    
    try {
      await QRCode.toCanvas(this.largeQrCanvas.nativeElement, qrText, {
        margin: 4,
        width: 280, // Tamaño considerable para escaneo fácil
        color: { dark: '#050505', light: '#ffffff' },
        errorCorrectionLevel: 'H' // Máxima precisión
      });
    } catch (err) {
      console.error('Error Large QR:', err);
    }
  }

  getInitials(): string {
    if (!this.user?.nombre) return 'C';
    const parts = this.user.nombre.split(' ').filter((p: string) => p.length > 0);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return this.user.nombre.substring(0, 2).toUpperCase();
  }

  goToRewards() {
    this.router.navigate(['/u/recompensas']);
  }
}
