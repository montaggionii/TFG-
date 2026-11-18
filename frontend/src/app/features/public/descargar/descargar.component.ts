import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CustomerTranslatePipe } from '../../../core/i18n/customer-translate.pipe';

@Component({
  selector: 'app-descargar',
  standalone: true,
  imports: [IonicModule, CommonModule, RouterLink, CustomerTranslatePipe],
  template: `
    <ion-content class="ion-padding descarga-page">
      <div class="descarga-card">
        <img src="assets/img/logo_fidelyfood.png" alt="FidelyFood" class="logo-descarga" />
        <h1>{{ 'descarga.titulo' | ffTranslate }}</h1>
        <p class="sub">{{ 'descarga.subtitulo' | ffTranslate }}</p>

        <a class="btn-apk" href="/apk/fidelyfood-v1.0.2.apk" download>
          <ion-icon name="download-outline"></ion-icon>
          {{ 'descarga.boton' | ffTranslate }}
        </a>
        <p class="nota">{{ 'descarga.version' | ffTranslate }}</p>

        <div class="pasos">
          <h2>{{ 'descarga.comoInstalar' | ffTranslate }}</h2>
          <ol>
            <li>{{ 'descarga.paso1' | ffTranslate }}</li>
            <li>{{ 'descarga.paso2' | ffTranslate }}</li>
            <li>{{ 'descarga.paso3' | ffTranslate }}</li>
          </ol>
        </div>

        <div class="aviso">
          <ion-icon name="shield-checkmark-outline"></ion-icon>
          <span>{{ 'descarga.aviso' | ffTranslate }}</span>
        </div>

        <div class="ios-nota">
          <strong>iPhone / iPad</strong>
          <p>{{ 'descarga.ios' | ffTranslate }}</p>
        </div>

        <ion-button expand="block" fill="outline" routerLink="/login">
          {{ 'descarga.volver' | ffTranslate }}
        </ion-button>
      </div>
    </ion-content>
  `,
  styles: [`
    .descarga-page { --background: var(--app-background, #121212); }
    .descarga-card {
      max-width: 460px; margin: 24px auto 0; padding: 28px 24px;
      border-radius: 20px; background: var(--app-card, rgba(255,255,255,.05));
      color: var(--app-text, #fff); text-align: center;
    }
    .logo-descarga { width: 84px; height: 84px; border-radius: 20px; margin-bottom: 12px; }
    h1 { font-size: 22px; margin: 0 0 4px; }
    .sub { opacity: .75; margin: 0 0 20px; font-size: 14px; }
    .btn-apk {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      padding: 16px; border-radius: 14px; font-weight: 700; font-size: 16px;
      background: var(--app-primary, #ff7a00); color: #fff; text-decoration: none;
    }
    .nota { font-size: 12px; opacity: .6; margin: 8px 0 18px; }
    .pasos { text-align: left; margin-bottom: 16px; }
    .pasos h2 { font-size: 15px; margin: 0 0 8px; }
    .pasos ol { margin: 0; padding-left: 20px; }
    .pasos li { margin-bottom: 6px; font-size: 14px; opacity: .85; }
    .aviso {
      display: flex; align-items: flex-start; gap: 8px; text-align: left;
      font-size: 12.5px; opacity: .8; margin-bottom: 16px;
      padding: 10px 12px; border-radius: 10px;
      background: rgba(255, 197, 51, .12);
    }
    .ios-nota { text-align: left; font-size: 13px; opacity: .85; margin-bottom: 20px; }
    .ios-nota p { margin: 4px 0 0; }
  `]
})
export class DescargarComponent {}
