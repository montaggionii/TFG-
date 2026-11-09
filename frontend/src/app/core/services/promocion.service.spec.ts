import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PromocionService } from './promocion.service';
import { environment } from '../../../environments/environment';

describe('PromocionService', () => {
  let service: PromocionService;
  let httpMock: HttpTestingController;
  const apiUrl = `${environment.apiUrl}/api/promociones`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(PromocionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getPromociones', () => {
    it('añade puntosNecesarios cuando el backend solo manda puntosOtorgados', (done) => {
      service.getPromociones().subscribe((promos) => {
        expect(promos[0]['puntosNecesarios']).toBe(150);
        expect(promos[0]['puntosOtorgados']).toBe(150);
        done();
      });

      const req = httpMock.expectOne(apiUrl);
      expect(req.request.method).toBe('GET');
      req.flush([{ id: 1, puntosOtorgados: 150 }]);
    });

    it('respeta puntosNecesarios si el backend ya lo manda (no lo sobreescribe con puntosOtorgados)', (done) => {
      service.getPromociones().subscribe((promos) => {
        expect(promos[0]['puntosNecesarios']).toBe(50);
        done();
      });

      const req = httpMock.expectOne(apiUrl);
      req.flush([{ id: 1, puntosNecesarios: 50, puntosOtorgados: 150 }]);
    });

    it('con puntosNecesarios en 0 (valor real, no "ausente") no lo reemplaza por puntosOtorgados', (done) => {
      service.getPromociones().subscribe((promos) => {
        expect(promos[0]['puntosNecesarios']).toBe(0);
        done();
      });

      const req = httpMock.expectOne(apiUrl);
      req.flush([{ id: 1, puntosNecesarios: 0, puntosOtorgados: 150 }]);
    });

    it('mantiene el resto de campos de cada promoción sin tocar', (done) => {
      service.getPromociones().subscribe((promos) => {
        expect(promos[0]['nombre']).toBe('2x1 en postres');
        expect(promos[0]['activa']).toBe(true);
        done();
      });

      const req = httpMock.expectOne(apiUrl);
      req.flush([{ id: 1, nombre: '2x1 en postres', activa: true, puntosOtorgados: 150 }]);
    });
  });

  describe('getPromocionesByRestaurante', () => {
    it('pide el listado del restaurante y aplica el mismo fallback de puntos', (done) => {
      service.getPromocionesByRestaurante(42).subscribe((promos) => {
        expect(promos[0]['puntosNecesarios']).toBe(200);
        done();
      });

      const req = httpMock.expectOne(`${apiUrl}/restaurante/42`);
      expect(req.request.method).toBe('GET');
      req.flush([{ id: 2, puntosOtorgados: 200 }]);
    });
  });

  describe('crearPromocion', () => {
    it('hace POST al listado con el cuerpo recibido, sin transformarlo', () => {
      const data = { nombre: 'Nueva promo', puntosOtorgados: 100 };
      service.crearPromocion(data).subscribe();

      const req = httpMock.expectOne(apiUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBe(data);
      req.flush({});
    });
  });

  describe('updatePromocion', () => {
    it('con un objeto normal hace PUT a /{id}', () => {
      service.updatePromocion(7, { nombre: 'Editada' }).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/7`);
      expect(req.request.method).toBe('PUT');
      req.flush({});
    });

    it('con FormData (imagen incluida) hace POST a /{id}, no PUT', () => {
      const formData = new FormData();
      formData.append('nombre', 'Editada con imagen');
      service.updatePromocion(7, formData).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/7`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBe(formData);
      req.flush({});
    });
  });

  describe('deletePromocion', () => {
    it('hace DELETE a /{id}', () => {
      service.deletePromocion(9).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/9`);
      expect(req.request.method).toBe('DELETE');
      req.flush({});
    });
  });

  describe('aplicarPromocion', () => {
    it('hace POST a /{id}/aplicar con el usuarioId en el cuerpo', () => {
      service.aplicarPromocion(3, 10).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/3/aplicar`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ usuarioId: 10 });
      req.flush({});
    });
  });

  describe('canjearPromocion', () => {
    it('hace POST a /api/canjes (no a /api/promociones) con usuarioId y promocionId', () => {
      service.canjearPromocion(10, 3).subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/api/canjes`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ usuarioId: 10, promocionId: 3 });
      req.flush({});
    });
  });
});
