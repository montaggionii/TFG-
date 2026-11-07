import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RestauranteService } from './restaurante.service';
import { environment } from '../../../environments/environment';

describe('RestauranteService', () => {
  let service: RestauranteService;
  let httpMock: HttpTestingController;
  const apiUrl = `${environment.apiUrl}/api/restaurantes`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(RestauranteService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getRestauranteById', () => {
    it('hace GET a /{id}', () => {
      service.getRestauranteById(5).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/5`);
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('getDashboardStats', () => {
    it('hace GET a /{id}/stats con un parámetro anticaché', () => {
      service.getDashboardStats(5).subscribe();

      const req = httpMock.expectOne(r => r.url.startsWith(`${apiUrl}/5/stats?t=`));
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('getAdvancedStats', () => {
    it('hace GET a /{id}/stats-avanzadas', () => {
      service.getAdvancedStats(5).subscribe();

      const req = httpMock.expectOne(r => r.url.startsWith(`${apiUrl}/5/stats-avanzadas?t=`));
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('getEstadisticasPeriodo', () => {
    it('hace GET a /{id}/estadisticas con periodo y comparar', () => {
      service.getEstadisticasPeriodo(5, 'MES', false).subscribe();

      const req = httpMock.expectOne(
        r => r.url.startsWith(`${apiUrl}/5/estadisticas?periodo=MES&comparar=false&t=`)
      );
      expect(req.request.method).toBe('GET');
      req.flush({});
    });

    it('por defecto pide comparar=true', () => {
      service.getEstadisticasPeriodo(5, 'SEMANA').subscribe();

      const req = httpMock.expectOne(r => r.url.startsWith(`${apiUrl}/5/estadisticas?periodo=SEMANA&comparar=true&t=`));
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('getRestaurantesCercanos', () => {
    it('hace GET a /cercanos con lat/lng', () => {
      service.getRestaurantesCercanos(40.4, -3.7).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/cercanos?lat=40.4&lng=-3.7`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('incluye radio solo si se indica', () => {
      service.getRestaurantesCercanos(40.4, -3.7, 10).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/cercanos?lat=40.4&lng=-3.7&radio=10`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('updateRestaurante', () => {
    it('hace PUT a /{id} con el cuerpo recibido, sin transformarlo', () => {
      const data = { nombre: 'Nuevo nombre' };
      service.updateRestaurante(5, data).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/5`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toBe(data);
      req.flush({});
    });
  });

  describe('subirImagen', () => {
    it('hace POST a /{id}/imagen con el FormData recibido', () => {
      const formData = new FormData();
      service.subirImagen(5, formData).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/5/imagen`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBe(formData);
      req.flush({});
    });
  });

  describe('resolverImagenUrl', () => {
    it('con null/undefined/cadena vacía devuelve el placeholder', () => {
      expect(service.resolverImagenUrl(null)).toBe(service.restaurantPlaceholder);
      expect(service.resolverImagenUrl(undefined)).toBe(service.restaurantPlaceholder);
      expect(service.resolverImagenUrl('')).toBe(service.restaurantPlaceholder);
      expect(service.resolverImagenUrl('   ')).toBe(service.restaurantPlaceholder);
    });

    it('con los literales "null"/"undefined" (strings) devuelve el placeholder, no una URL rota', () => {
      expect(service.resolverImagenUrl('null')).toBe(service.restaurantPlaceholder);
      expect(service.resolverImagenUrl('undefined')).toBe(service.restaurantPlaceholder);
    });

    it('con una imagen base64 la deja intacta', () => {
      const base64 = 'data:image/png;base64,iVBORw0KGgo=';
      expect(service.resolverImagenUrl(base64)).toBe(base64);
    });

    it('con una ruta que ya empieza por "assets/" la deja intacta', () => {
      expect(service.resolverImagenUrl('assets/img/restaurants/foo.jpg')).toBe('assets/img/restaurants/foo.jpg');
    });

    it('con una ruta que empieza por "/assets/" solo quita la barra inicial', () => {
      expect(service.resolverImagenUrl('/assets/img/restaurants/foo.jpg')).toBe('assets/img/restaurants/foo.jpg');
    });

    it('con una URL absoluta vieja que contiene /uploads/ la repara apuntando al apiUrl actual', () => {
      const vieja = 'http://192.168.1.50:8081/uploads/restaurantes/logo1.jpg';
      expect(service.resolverImagenUrl(vieja)).toBe(`${environment.apiUrl}/uploads/restaurantes/logo1.jpg`);
    });

    it('con una ruta relativa que ya contiene /uploads/ la reconstruye igual sobre el apiUrl actual', () => {
      expect(service.resolverImagenUrl('/uploads/restaurantes/logo1.jpg'))
        .toBe(`${environment.apiUrl}/uploads/restaurantes/logo1.jpg`);
    });

    it('con una URL externa real (sin /uploads/) la deja igual', () => {
      const externa = 'https://cdn.externo.com/logo.jpg';
      expect(service.resolverImagenUrl(externa)).toBe(externa);
    });

    it('con una ruta relativa pura sin /uploads/ le añade el prefijo /uploads', () => {
      expect(service.resolverImagenUrl('logo1.jpg')).toBe(`${environment.apiUrl}/uploads/logo1.jpg`);
    });

    it('con una ruta relativa pura que ya empieza por "/" no la duplica', () => {
      expect(service.resolverImagenUrl('/logo1.jpg')).toBe(`${environment.apiUrl}/uploads/logo1.jpg`);
    });
  });

  describe('getLocalRestaurantImage', () => {
    it('sin ningún campo identificador devuelve el placeholder', () => {
      expect(service.getLocalRestaurantImage({})).toBe(service.restaurantPlaceholder);
      expect(service.getLocalRestaurantImage(null)).toBe(service.restaurantPlaceholder);
    });

    it('es determinista: el mismo identificador siempre cae en la misma imagen local', () => {
      const a = service.getLocalRestaurantImage({ id: 42 });
      const b = service.getLocalRestaurantImage({ id: 42 });
      expect(a).toBe(b);
    });

    it('usa el id cuando está presente, con el hash esperado', () => {
      // '1'.charCodeAt(0) = 49 -> 49 % 4 = 1
      expect(service.getLocalRestaurantImage({ id: 1 })).toBe('assets/img/restaurants/restaurant-venezuelan.jpg');
    });

    it('cae en nombre cuando no hay ningún id', () => {
      // suma de códigos de 'Pizza' = 526 -> 526 % 4 = 2
      expect(service.getLocalRestaurantImage({ nombre: 'Pizza' })).toBe('assets/img/restaurants/restaurant-colombian.webp');
    });

    it('prioriza id sobre restauranteId/restaurantId/nombre/restaurantName', () => {
      const porId = service.getLocalRestaurantImage({ id: 1 });
      const conTodo = service.getLocalRestaurantImage({ id: 1, restauranteId: 999, nombre: 'Otro nombre' });
      expect(conTodo).toBe(porId);
    });
  });

  describe('resolveRestaurantImage', () => {
    it('con un string lo trata directamente como la URL de la imagen', () => {
      expect(service.resolveRestaurantImage('logo1.jpg')).toBe(`${environment.apiUrl}/uploads/logo1.jpg`);
    });

    it('con un objeto, usa el primer campo de imagen conocido que tenga valor', () => {
      const restaurante = { logoUrl: '', imagenUrl: 'logo1.jpg', foto: 'otra.jpg' };
      expect(service.resolveRestaurantImage(restaurante)).toBe(`${environment.apiUrl}/uploads/logo1.jpg`);
    });

    it('sin ningún campo de imagen, cae en la imagen local determinista por id/nombre', () => {
      const restaurante = { id: 1 };
      expect(service.resolveRestaurantImage(restaurante)).toBe(service.getLocalRestaurantImage(restaurante));
    });

    it('con null/undefined devuelve el placeholder', () => {
      expect(service.resolveRestaurantImage(null)).toBe(service.restaurantPlaceholder);
      expect(service.resolveRestaurantImage(undefined)).toBe(service.restaurantPlaceholder);
    });
  });

  describe('resolvePromotionImage', () => {
    it('usa la imagen propia de la promoción si existe', () => {
      const promocion = { imagenUrl: 'promo1.jpg', restaurante: { imagenUrl: 'logo1.jpg' } };
      expect(service.resolvePromotionImage(promocion)).toBe(`${environment.apiUrl}/uploads/promo1.jpg`);
    });

    it('sin imagen propia, usa la imagen del restaurante embebido en la promoción', () => {
      const promocion = { restaurante: { imagenUrl: 'logo1.jpg' } };
      expect(service.resolvePromotionImage(promocion)).toBe(`${environment.apiUrl}/uploads/logo1.jpg`);
    });

    it('sin restaurante embebido, usa el restaurantFallback recibido', () => {
      const promocion = { restauranteId: 9 };
      const fallback = { imagenUrl: 'logo-fallback.jpg' };
      expect(service.resolvePromotionImage(promocion, fallback)).toBe(`${environment.apiUrl}/uploads/logo-fallback.jpg`);
    });

    it('sin restaurante ni fallback, cae en la imagen local determinista construida con los campos de id/nombre de la promoción', () => {
      const promocion = { restauranteId: 1, nombreRestaurante: 'Otro' };
      expect(service.resolvePromotionImage(promocion)).toBe(service.getLocalRestaurantImage({ id: 1, nombre: 'Otro' }));
    });
  });

  describe('onImageError', () => {
    it('sustituye el src roto por el placeholder y marca la clase de fallback', () => {
      const img = document.createElement('img');
      img.src = 'http://localhost:8081/uploads/restaurantes/rota.jpg';
      const event = { target: img } as unknown as Event;

      service.onImageError(event);

      expect(img.src.endsWith(service.restaurantPlaceholder)).toBe(true);
      expect(img.classList.contains('ff-image-fallback')).toBe(true);
    });

    it('si el src ya es el placeholder, no vuelve a tocar la imagen (evita el bucle de error)', () => {
      const img = document.createElement('img');
      img.src = service.restaurantPlaceholder;
      const event = { target: img } as unknown as Event;

      service.onImageError(event);

      expect(img.classList.contains('ff-image-fallback')).toBe(false);
    });

    it('sin target en el evento, no lanza ningún error', () => {
      const event = { target: null } as unknown as Event;
      expect(() => service.onImageError(event)).not.toThrow();
    });
  });
});
