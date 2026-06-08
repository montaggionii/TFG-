import { Component, Input, OnChanges, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import * as QRCode from 'qrcode';

@Component({
  selector: 'app-qr-display',
  templateUrl: './qr-display.component.html',
  styleUrls: ['./qr-display.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class QrDisplayComponent implements OnChanges, AfterViewInit {

  @Input() qrData: string | null | undefined;
  @Input() title: string = 'Tu Código TPV';
  @Input() subtitle: string = 'Muéstralo al establecimiento';
  @ViewChild('qrCanvas') qrCanvas!: ElementRef<HTMLCanvasElement>;

  ngOnChanges() {
    this.renderQR();
  }

  ngAfterViewInit() {
    this.renderQR();
  }

  async renderQR() {
    if (this.qrData && this.qrCanvas) {
      try {
        await QRCode.toCanvas(this.qrCanvas.nativeElement, this.qrData, {
          width: 240,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });
      } catch (err) {
        console.error('Error rendering QR in QrDisplay:', err);
      }
    }
  }
}