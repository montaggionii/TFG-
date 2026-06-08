import { Component, EventEmitter, Output, OnDestroy, Input, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController } from '@ionic/angular';
import { Html5Qrcode } from 'html5-qrcode';
import { Capacitor } from '@capacitor/core';

type OptionalBarcodeScanner = {
  checkPermission(options: { force: boolean }): Promise<{ granted: boolean }>;
  hideBackground(): Promise<void>;
  startScan(): Promise<{ hasContent?: boolean; content?: string }>;
  showBackground(): Promise<void>;
  stopScan(): Promise<void>;
};

@Component({
  selector: 'app-qr-scanner-ui',
  template: `
    <div class="scanner-container" [class.native-scanning]="isNativeScanning">
      
      <!-- 1. VISOR DE CÁMARA (Modo Web) -->
      <div id="qr-reader" [hidden]="!isScanning || hasError || isNativeScanning"></div>
      
      <!-- 2. UI NATIVA (Overlay) -->
      <div class="native-overlay" *ngIf="isNativeScanning">
        <div class="scan-frame"></div>
        <p class="scan-tip">Encuadra el código QR del cliente</p>
      </div>

      <!-- 3. ESTADOS DE CARGA / ESPERA -->
      <div class="status-container" *ngIf="isScanning && !isCameraReady && !hasError && !isNativeScanning">
        <ion-spinner name="crescent" color="primary"></ion-spinner>
        <p>Iniciando cámara...</p>
      </div>

      <!-- 4. MANEJO DE ERRORES PROFESIONAL -->
      <div class="error-container animate__animated animate__fadeIn" *ngIf="hasError">
        <div class="error-card">
          <ion-icon [name]="errorIcon" color="danger"></ion-icon>
          <h3>{{ errorTitle }}</h3>
          <p>{{ errorMessage }}</p>
          
          <div class="advice-box" *ngIf="errorAdvice">
            <ion-icon name="bulb-outline"></ion-icon>
            <span>{{ errorAdvice }}</span>
          </div>

          <ion-button expand="block" color="primary" (click)="retry()">
            <ion-icon slot="start" name="refresh-outline"></ion-icon>
            Reintentar Acceso
          </ion-button>
        </div>
      </div>

      <!-- 5. CONTROLES DE USUARIO -->
      <div class="controls-container" *ngIf="!hasError">
        <ion-button expand="block" class="primary-action-btn" (click)="toggleScanner()">
          <ion-icon slot="start" [name]="isScanning ? 'close-circle-outline' : 'camera-outline'"></ion-icon>
          {{ isScanning ? 'Cerrar Escáner' : 'Abrir Escáner' }}
        </ion-button>
      </div>
    </div>
  `,
  styles: [`
    .scanner-container {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: clamp(12px, 4vw, 20px);
      overflow: hidden;
    }
    #qr-reader {
      width: 100%;
      max-width: 400px;
      border-radius: 24px;
      overflow: hidden;
      border: 3px solid rgba(255, 90, 60, 0.4);
      box-shadow: 0 16px 32px rgba(0,0,0,0.08);
      margin-bottom: 20px;
      background: #ffffff;
      // Forzar que el video ocupe el contenedor
      ::ng-deep video {
        width: 100% !important;
        height: auto !important;
        border-radius: 20px;
      }
    }
    .native-overlay {
      position: relative;
      width: 100%;
      min-height: min(350px, 72vw);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-radius: 24px;
      margin-bottom: 20px;
      border: 1px solid rgba(255,255,255,0.4);
      box-shadow: 0 8px 32px rgba(0,0,0,0.05);
    }
    .scan-frame {
      width: min(200px, 62vw);
      aspect-ratio: 1 / 1;
      border: 3px solid #FF5A3C;
      border-radius: 20px;
      box-shadow: 0 0 0 4000px rgba(0,0,0,0.2);
    }
    .scan-tip { color: #1F1F1F; margin-top: 15px; font-weight: 700; text-align: center; }
    
    .error-card {
      background: #FFFFFF;
      padding: 30px;
      border-radius: 24px;
      text-align: center;
      border: 1px solid rgba(239, 68, 68, 0.2);
      box-shadow: 0 16px 32px rgba(239, 68, 68, 0.1);
      max-width: 100%;
      
      ion-icon { font-size: 64px; margin-bottom: 15px; }
      h3 { margin: 0 0 10px; font-weight: 800; color: #1F1F1F; }
      p { color: #6B7280; margin-bottom: 20px; line-height: 1.5; font-weight: 500; }
    }
    
    .advice-box {
      background: #fff;
      padding: 15px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
      text-align: left;
      font-size: 0.9rem;
      color: var(--ion-color-primary);
      border-left: 4px solid var(--ion-color-primary);
      ion-icon { font-size: 20px; margin: 0; }
      span { min-width: 0; overflow-wrap: break-word; }
    }
    
    .status-container { text-align: center; margin-bottom: 20px; p { margin-top: 10px; color: #6B7280; font-weight: 600; } }
    .controls-container { width: 100%; max-width: 400px; }
    
    .primary-action-btn {
      --border-radius: 14px;
      --background: linear-gradient(135deg, #FF5A3C, #FF8A5B);
      --box-shadow: 0 8px 16px rgba(255, 90, 60, 0.2);
      height: 54px;
      font-weight: 800;
      text-transform: none;
      font-size: 1rem;
    }
  `],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class QrScannerUiComponent implements OnInit, OnDestroy {
  @Input() autoStart = false;
  @Output() qrScanned = new EventEmitter<string>();

  private html5QrCode: Html5Qrcode | null = null;
  private nativeScanner: OptionalBarcodeScanner | null = null;
  private nativeScannerLoadFailed = false;
  isScanning = false;
  isCameraReady = false;
  isNativeScanning = false;
  
  hasError = false;
  errorTitle = '';
  errorMessage = '';
  errorAdvice = '';
  errorIcon = 'alert-circle-outline';

  constructor(
    private toastCtrl: ToastController,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    if (this.autoStart) {
      setTimeout(() => this.startScanner(), 500); 
    }
  }

  ngOnDestroy() {
    this.stopScanner();
  }

  async retry() {
    await this.stopScanner();
    this.ngZone.run(() => {
      this.hasError = false;
      this.errorTitle = '';
      this.errorMessage = '';
      this.errorAdvice = '';
    });
    setTimeout(() => this.startScanner(), 300);
  }

  async toggleScanner() {
    if (this.isScanning) {
      await this.stopScanner();
    } else {
      await this.startScanner();
    }
  }

  async startScanner() {
    this.ngZone.run(() => {
      this.hasError = false;
      this.isScanning = true;
      this.isCameraReady = false;
    });
    
    if (Capacitor.isNativePlatform()) {
      return this.startNativeScan();
    }

    await this.startWebScan();
  }

  private async startWebScan() {
    const isSecure = window.location.protocol === 'https:' || 
                     window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';

    if (!isSecure && !navigator.mediaDevices) {
      this.handleError({ name: 'SecurityError' });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      stream.getTracks().forEach(track => track.stop());

      if (!this.html5QrCode) {
        this.html5QrCode = new Html5Qrcode("qr-reader", false);
      }
      
      await this.html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => this.onScanSuccess(decodedText),
        () => {} 
      );

      // ✅ Usar NgZone para asegurar que la UI se entere de que la cámara está lista
      this.ngZone.run(() => {
        this.isCameraReady = true;
      });

    } catch (err: any) {
      this.handleError(err);
    }
  }

  private async startNativeScan() {
    try {
      const scanner = await this.getNativeScanner();
      if (!scanner) {
        await this.startWebScan();
        return;
      }

      const status = await scanner.checkPermission({ force: true });

      if (status.granted) {
        this.ngZone.run(() => {
          this.isNativeScanning = true;
          this.isCameraReady = true;
        });
        document.body.classList.add('scanner-active');
        await scanner.hideBackground();

        const result = await scanner.startScan();

        if (result.hasContent && result.content) {
          this.onScanSuccess(result.content);
        }
      } else {
        this.handleError({ name: 'NotAllowedError' });
      }
    } catch (err: any) {
      this.handleError(err);
    } finally {
      this.stopNativeScan();
    }
  }

  private async getNativeScanner(): Promise<OptionalBarcodeScanner | null> {
    if (this.nativeScanner || this.nativeScannerLoadFailed) {
      return this.nativeScanner;
    }

    try {
      const packageName = '@capacitor-community/barcode-scanner';
      const scannerModule: any = await import(/* @vite-ignore */ packageName);
      this.nativeScanner = scannerModule.BarcodeScanner || scannerModule.default || null;
    } catch (err) {
      this.nativeScannerLoadFailed = true;
      console.warn('[Scanner] Plugin nativo de barcode no disponible. Usando scanner web.', err);
    }

    return this.nativeScanner;
  }

  private stopNativeScan() {
    this.ngZone.run(() => {
      this.isNativeScanning = false;
    });
    document.body.classList.remove('scanner-active');
    if (this.nativeScanner) {
      this.nativeScanner.showBackground().catch(() => {});
      this.nativeScanner.stopScan().catch(() => {});
    }
  }

  async stopScanner() {
    if (Capacitor.isNativePlatform()) {
      this.stopNativeScan();
    }

    if (this.html5QrCode && this.isScanning) {
      try {
        await this.html5QrCode.stop();
        this.html5QrCode.clear();
      } catch (err) {
        console.error("[Scanner] Error al detener web scanner", err);
      }
    }
    
    this.ngZone.run(() => {
      this.isScanning = false;
      this.isCameraReady = false;
    });
  }

  private handleError(err: any) {
    this.ngZone.run(() => {
      this.isScanning = false;
      this.isCameraReady = false;
      this.hasError = true;
      
      switch (err.name) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
          this.errorTitle = 'Acceso Denegado';
          this.errorMessage = 'Has bloqueado el acceso a la cámara.';
          this.errorAdvice = 'Permite el acceso a la cámara en los ajustes del sitio.';
          this.errorIcon = 'lock-closed-outline';
          break;
        case 'SecurityError':
          this.errorTitle = 'Conexión No Segura';
          this.errorMessage = 'El navegador bloquea la cámara por falta de HTTPS.';
          this.errorIcon = 'shield-half-outline';
          break;
        default:
          this.errorTitle = 'Error de Cámara';
          this.errorMessage = 'No se pudo iniciar la cámara.';
          this.errorIcon = 'alert-circle-outline';
      }
    });
  }

  private onScanSuccess(decodedText: string) {
    if (!decodedText) return;
    this.stopScanner();
    this.ngZone.run(() => {
      this.qrScanned.emit(decodedText);
    });
  }
}
