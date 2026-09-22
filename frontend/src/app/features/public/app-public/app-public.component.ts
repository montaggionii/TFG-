import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';

type PublicFeature = {
  title: string;
  text: string;
};

@Component({
  selector: 'app-public-app',
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule],
  templateUrl: './app-public.component.html',
  styleUrls: ['./app-public.component.scss']
})
export class AppPublicComponent {
  readonly features: PublicFeature[] = [
    {
      title: 'Puntos y recompensas',
      text: 'Los clientes acumulan puntos en restaurantes asociados y consultan recompensas desde su perfil.'
    },
    {
      title: 'Herramientas para negocios',
      text: 'Los restaurantes gestionan promociones, compras y actividad de fidelizacion desde un panel propio.'
    },
    {
      title: 'Control administrativo',
      text: 'El equipo de FidelyFood supervisa clientes, negocios, reservas y movimientos desde un area privada.'
    }
  ];

  readonly supportEmail = 'montaggioni29@gmail.com';
}
