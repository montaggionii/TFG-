import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [IonicModule, CommonModule, RouterLink],
  template: `
    <div class="landing">

      <!-- NAV -->
      <nav class="nav">
        <div class="nav-inner">
          <img src="assets/img/logo_fidelyfood.png" alt="FidelyFood" class="nav-logo" />
          <span class="nav-marca">FidelyFood</span>
          <div class="nav-links">
            <a href="#como-funciona">Cómo funciona</a>
            <a href="#descargar">Descargar</a>
            <a routerLink="/login" class="nav-cta">Abrir la app</a>
          </div>
        </div>
      </nav>

      <!-- HERO -->
      <header class="hero">
        <div class="hero-texto">
          <h1>Tu café de siempre, <span class="naranja">con premio</span> cada vez que vas</h1>
          <p class="hero-sub">
            FidelyFood es la tarjeta de fidelidad digital para restaurantes de barrio.
            Pides, acumulas puntos automáticamente y los canjeas por lo que más te gusta.
            Sin tarjetas de papel: solo tu móvil.
          </p>
          <div class="hero-acciones">
            <a class="btn btn-primario" href="#descargar">📲 Descargar la app</a>
            <a class="btn btn-outline" routerLink="/login">Abrir sin instalar</a>
          </div>
          <p class="hero-mini">Gratis para clientes · Sin tarjeta de crédito · En español</p>
        </div>
        <div class="hero-visual" aria-hidden="true">
          <div class="mock-tarjeta">
            <div class="mock-cabecera">☕ La Prueba TFG</div>
            <div class="mock-puntos"><span>48</span> puntos</div>
            <div class="mock-progreso"><div class="mock-barra" style="width:78%"></div></div>
            <div class="mock-falta">Te faltan 2 pts para un café gratis 🎉</div>
          </div>
          <div class="mock-chips">
            <span class="chip">🔥 Racha: 3 semanas</span>
            <span class="chip">🌍 Pasaporte: 2/3</span>
            <span class="chip">🏆 Top fan #1</span>
          </div>
        </div>
      </header>

      <!-- CÓMO FUNCIONA -->
      <section id="como-funciona" class="seccion">
        <h2>Cómo funciona</h2>
        <div class="pasos-grid">
          <div class="paso">
            <div class="paso-num">1</div>
            <h3>Crea tu cuenta</h3>
            <p>Con tu email o solo con tu número de móvil. 30 segundos y ya puedes acumular.</p>
          </div>
          <div class="paso">
            <div class="paso-num">2</div>
            <h3>Muestra tu QR al pagar</h3>
            <p>El camarero lo escanea y tus puntos aparecen en tu móvil al instante, en vivo.</p>
          </div>
          <div class="paso">
            <div class="paso-num">3</div>
            <h3>Canjea tus premios</h3>
            <p>Cafés, menús, postres… elige la recompensa, muestra tu QR y disfruta.</p>
          </div>
        </div>
      </section>

      <!-- CARACTERÍSTICAS -->
      <section class="seccion seccion-alt">
        <h2>Todo lo que lleva dentro</h2>
        <div class="features-grid">
          <div class="feature"><span class="icono">🗺️</span><h3>Mapa de locales</h3><p>Encuentra los restaurantes adheridos cerca de ti, con sus promociones activas.</p></div>
          <div class="feature"><span class="icono">🎉</span><h3>Promociones</h3><p>Doble puntos, recompensas por nivel… cada local tiene sus ofertas.</p></div>
          <div class="feature"><span class="icono">📅</span><h3>Reservas</h3><p>Reserva mesa desde la app y repite tus reservas favoritas con un toque.</p></div>
          <div class="feature"><span class="icono">🎁</span><h3>Sorpresa del día</h3><p>Vuelve cada día y llévate un premio aleatorio de 5 a 25 puntos.</p></div>
          <div class="feature"><span class="icono">🌍</span><h3>Pasaporte de Sabor</h3><p>Visita 3 locales distintos y gana puntos extra. Descubre tu ciudad comiendo.</p></div>
          <div class="feature"><span class="icono">🏆</span><h3>Top Fans</h3><p>¿El cliente más fiel del local? Podría ser tú, y lo sabrás.</p></div>
        </div>
      </section>

      <!-- PARA RESTAURANTES -->
      <section class="seccion seccion-restaurante">
        <div class="rest-texto">
          <h2>¿Tienes un restaurante?</h2>
          <p>
            Fideliza a tus clientes sin sistemas caros: registra compras con un escaneo,
            crea tus promociones, mira tus insights (quiénes vuelven, quiénes se enfrían)
            y deja que los puntos hagan el marketing por ti.
          </p>
          <a class="btn btn-claro" routerLink="/login">Registrar mi negocio</a>
        </div>
        <div class="rest-stats">
          <div class="stat"><strong>Al instante</strong><span>puntos en el móvil al pagar</span></div>
          <div class="stat"><strong>0 €</strong><span>para empezar como cliente</span></div>
          <div class="stat"><strong>QR</strong><span>nada de hardware nuevo</span></div>
        </div>
      </section>

      <!-- DESCARGAR -->
      <section id="descargar" class="seccion seccion-descarga">
        <h2>Descarga FidelyFood</h2>
        <p class="descarga-sub">Elige tu plataforma:</p>
        <div class="descarga-grid">
          <div class="desc-card">
            <span class="so">🤖 Android</span>
            <h3>APK directo</h3>
            <p>Sin Play Store. Descarga el archivo firmado e instálalo en un minuto.</p>
            <a class="btn btn-primario" href="/apk/fidelyfood-v1.0.0.apk" download>Descargar APK</a>
            <a class="mini-link" routerLink="/descargar">Instrucciones de instalación →</a>
          </div>
          <div class="desc-card">
            <span class="so">🌐 Cualquier móvil</span>
            <h3>App web</h3>
            <p>Ábrela en el navegador sin instalar nada. Funciona en iPhone y Android.</p>
            <a class="btn btn-outline" routerLink="/login">Abrir la web app</a>
            <a class="mini-link">En iPhone: Compartir → Añadir a pantalla de inicio</a>
          </div>
        </div>
      </section>

      <!-- FOOTER -->
      <footer class="footer">
        <img src="assets/img/logo_fidelyfood.png" alt="" class="footer-logo" />
        <p class="footer-marca">FidelyFood · Fidelización para restaurantes</p>
        <div class="footer-links">
          <a routerLink="/privacy">Privacidad</a>
          <a routerLink="/terms">Términos</a>
          <a routerLink="/login">Acceder</a>
        </div>
        <p class="footer-copy">© 2026 FidelyFood · Trabajo de Fin de Grado</p>
      </footer>

    </div>
  `,
  styles: [`
    .landing { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #fffdf9; color: #241a10; }
    h2 { text-align: center; font-size: 30px; margin: 0 0 28px; }
    .naranja { color: var(--primary, #FF7A00); }
    .btn { display: inline-block; padding: 14px 24px; border-radius: 14px; font-weight: 700; text-decoration: none; font-size: 15px; }
    .btn-primario { background: var(--primary, #FF7A00); color: #fff; }
    .btn-outline { border: 2px solid var(--primary, #FF7A00); color: var(--primary, #FF7A00); }
    .btn-claro { background: #fff; color: var(--primary, #FF7A00); }

    .nav { position: sticky; top: 0; z-index: 10; background: rgba(255,255,255,.92); backdrop-filter: blur(10px); border-bottom: 1px solid #f0e6d8; }
    .nav-inner { max-width: 1000px; margin: 0 auto; padding: 12px 20px; display: flex; align-items: center; gap: 10px; }
    .nav-logo { width: 34px; height: 34px; border-radius: 9px; }
    .nav-marca { font-weight: 800; font-size: 18px; }
    .nav-links { margin-left: auto; display: flex; gap: 18px; align-items: center; }
    .nav-links a { color: #5a4a38; text-decoration: none; font-size: 14px; font-weight: 600; }
    .nav-cta { color: var(--primary, #FF7A00) !important; border: 2px solid var(--primary, #FF7A00); padding: 7px 16px; border-radius: 10px; }
    @media (max-width: 640px) { .nav-links a:not(.nav-cta) { display: none; } }

    .hero { max-width: 1000px; margin: 0 auto; padding: 70px 20px 50px; display: grid; grid-template-columns: 1.1fr 1fr; gap: 40px; align-items: center; }
    .hero h1 { font-size: 42px; line-height: 1.15; margin: 0 0 16px; }
    .hero-sub { font-size: 17px; line-height: 1.6; color: #6b5a45; margin: 0 0 26px; }
    .hero-acciones { display: flex; gap: 12px; flex-wrap: wrap; }
    .hero-mini { font-size: 13px; color: #9a8a75; margin-top: 14px; }
    @media (max-width: 800px) { .hero { grid-template-columns: 1fr; padding-top: 40px; } .hero h1 { font-size: 32px; } }

    .mock-tarjeta { background: linear-gradient(135deg, #FF7A00, #FFB84D); color: #fff; border-radius: 22px; padding: 22px; max-width: 320px; box-shadow: 0 20px 40px rgba(255,122,0,.25); }
    .mock-cabecera { font-weight: 700; opacity: .9; }
    .mock-puntos { font-size: 15px; margin: 14px 0 8px; } .mock-puntos span { font-size: 42px; font-weight: 800; margin-right: 6px; }
    .mock-progreso { height: 10px; background: rgba(255,255,255,.3); border-radius: 6px; overflow: hidden; }
    .mock-barra { height: 100%; background: #fff; border-radius: 6px; }
    .mock-falta { font-size: 13px; margin-top: 10px; opacity: .95; }
    .mock-chips { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; max-width: 320px; }
    .chip { background: #fff; border: 1px solid #f0e6d8; padding: 7px 12px; border-radius: 999px; font-size: 13px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,.05); }

    .seccion { max-width: 1000px; margin: 0 auto; padding: 60px 20px; }
    .seccion-alt { background: #faf4ea; max-width: none; }
    .seccion-alt > * { max-width: 1000px; margin-left: auto; margin-right: auto; }
    .pasos-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
    @media (max-width: 700px) { .pasos-grid { grid-template-columns: 1fr; } }
    .paso { background: #fff; border: 1px solid #f0e6d8; border-radius: 18px; padding: 26px 22px; text-align: center; }
    .paso-num { width: 44px; height: 44px; border-radius: 50%; background: var(--primary, #FF7A00); color: #fff; font-weight: 800; font-size: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
    .paso h3 { margin: 0 0 8px; } .paso p { margin: 0; color: #6b5a45; font-size: 14.5px; line-height: 1.55; }

    .features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
    @media (max-width: 800px) { .features-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 520px) { .features-grid { grid-template-columns: 1fr; } }
    .feature { background: #fff; border: 1px solid #f0e6d8; border-radius: 16px; padding: 22px 18px; }
    .feature .icono { font-size: 30px; }
    .feature h3 { margin: 10px 0 6px; font-size: 17px; }
    .feature p { margin: 0; color: #6b5a45; font-size: 14px; line-height: 1.5; }

    .seccion-restaurante { background: linear-gradient(135deg, #241a10, #3d2c1a); color: #fff; border-radius: 26px; max-width: 960px; display: grid; grid-template-columns: 1.2fr 1fr; gap: 30px; align-items: center; }
    .seccion-restaurante h2 { text-align: left; font-size: 26px; margin-bottom: 12px; }
    .seccion-restaurante p { color: #d8c9b5; line-height: 1.65; margin: 0 0 20px; }
    @media (max-width: 700px) { .seccion-restaurante { grid-template-columns: 1fr; } .seccion-restaurante h2 { text-align: center; } }
    .rest-stats { display: flex; flex-direction: column; gap: 14px; }
    .stat { background: rgba(255,255,255,.07); border-radius: 14px; padding: 14px 18px; }
    .stat strong { display: block; font-size: 22px; color: var(--primary, #FF7A00); }
    .stat span { font-size: 13px; color: #cbbba6; }

    .descarga-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 380px)); gap: 20px; justify-content: center; }
    @media (max-width: 700px) { .descarga-grid { grid-template-columns: 1fr; } }
    .desc-card { background: #fff; border: 1px solid #f0e6d8; border-radius: 20px; padding: 26px 22px; text-align: center; }
    .desc-card .so { font-size: 13px; font-weight: 700; color: #9a8a75; text-transform: uppercase; letter-spacing: .5px; }
    .desc-card h3 { margin: 8px 0 8px; font-size: 20px; }
    .desc-card p { color: #6b5a45; font-size: 14.5px; margin: 0 0 16px; }
    .mini-link { display: block; margin-top: 12px; font-size: 13px; color: #9a8a75; text-decoration: none; }

    .footer { text-align: center; padding: 46px 20px 60px; background: #241a10; color: #d8c9b5; }
    .footer-logo { width: 52px; height: 52px; border-radius: 13px; }
    .footer-marca { font-weight: 700; color: #fff; margin: 10px 0 6px; }
    .footer-links { display: flex; gap: 18px; justify-content: center; margin: 10px 0; }
    .footer-links a { color: #d8c9b5; text-decoration: none; font-size: 14px; }
    .footer-copy { font-size: 12.5px; opacity: .6; margin: 10px 0 0; }
  `]
})
export class LandingComponent {}
