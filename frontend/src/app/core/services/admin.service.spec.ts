import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminService } from './admin.service';
import { environment } from '../../../environments/environment';

describe('AdminService', () => {
  let service: AdminService;
  let httpMock: HttpTestingController;
  const apiUrl = `${environment.apiUrl}/api/admin`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(AdminService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getDashboard', () => {
    it('hace GET a /dashboard', () => {
      service.getDashboard().subscribe();

      const req = httpMock.expectOne(`${apiUrl}/dashboard`);
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('getBusinesses', () => {
    it('devuelve response.content cuando la respuesta viene paginada con esa forma', () => {
      let result: any[] | undefined;
      service.getBusinesses().subscribe(r => (result = r));

      const req = httpMock.expectOne(`${apiUrl}/businesses`);
      expect(req.request.method).toBe('GET');
      req.flush({ content: [{ id: 1 }, { id: 2 }], items: [{ id: 99 }] });

      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    });

    it('devuelve response.items cuando no hay content pero sí items', () => {
      let result: any[] | undefined;
      service.getBusinesses().subscribe(r => (result = r));

      const req = httpMock.expectOne(`${apiUrl}/businesses`);
      req.flush({ items: [{ id: 3 }] });

      expect(result).toEqual([{ id: 3 }]);
    });

    it('devuelve la respuesta tal cual cuando ya es un array plano', () => {
      let result: any[] | undefined;
      service.getBusinesses().subscribe(r => (result = r));

      const req = httpMock.expectOne(`${apiUrl}/businesses`);
      req.flush([{ id: 4 }, { id: 5 }]);

      expect(result).toEqual([{ id: 4 }, { id: 5 }]);
    });

    it('devuelve [] cuando la respuesta es null', () => {
      let result: any[] | undefined;
      service.getBusinesses().subscribe(r => (result = r));

      const req = httpMock.expectOne(`${apiUrl}/businesses`);
      req.flush(null);

      expect(result).toEqual([]);
    });
  });

  describe('searchBusinesses', () => {
    it('hace GET a /businesses con los params recibidos', () => {
      service.searchBusinesses({ q: 'pizza', page: 2 }).subscribe();

      const req = httpMock.expectOne(
        r => r.url === `${apiUrl}/businesses` && r.params.get('q') === 'pizza' && r.params.get('page') === '2'
      );
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('getBusinessDetail', () => {
    it('hace GET a /businesses/{id}', () => {
      service.getBusinessDetail(7).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/businesses/7`);
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('updateBusiness', () => {
    it('hace PUT a /businesses/{id} con el cuerpo recibido, sin transformarlo', () => {
      const data = { nombre: 'Nuevo nombre' };
      service.updateBusiness(7, data).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/businesses/7`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toBe(data);
      req.flush({});
    });
  });

  describe('setBusinessActive', () => {
    it('hace PATCH a /businesses/{id}/status con { active: true }', () => {
      service.setBusinessActive(7, true).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/businesses/7/status`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ active: true });
      req.flush({});
    });

    it('hace PATCH a /businesses/{id}/status con { active: false }', () => {
      service.setBusinessActive(7, false).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/businesses/7/status`);
      expect(req.request.body).toEqual({ active: false });
      req.flush({});
    });
  });

  describe('softDeleteBusiness', () => {
    it('hace DELETE a /businesses/{id}', () => {
      service.softDeleteBusiness(7).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/businesses/7`);
      expect(req.request.method).toBe('DELETE');
      req.flush({});
    });
  });

  describe('getClients', () => {
    it('hace GET a /clients', () => {
      service.getClients().subscribe();

      const req = httpMock.expectOne(`${apiUrl}/clients`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('searchClients', () => {
    it('hace GET a /clients con los params recibidos', () => {
      service.searchClients({ q: 'maria' }).subscribe();

      const req = httpMock.expectOne(
        r => r.url === `${apiUrl}/clients` && r.params.get('q') === 'maria'
      );
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('getClientDetail', () => {
    it('hace GET a /clients/{id}', () => {
      service.getClientDetail(3).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/clients/3`);
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('updateClient', () => {
    it('hace PUT a /clients/{id} con el cuerpo recibido, sin transformarlo', () => {
      const data = { nombre: 'Cliente' };
      service.updateClient(3, data).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/clients/3`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toBe(data);
      req.flush({});
    });
  });

  describe('setClientActive', () => {
    it('hace PATCH a /clients/{id}/status con { active }', () => {
      service.setClientActive(3, false).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/clients/3/status`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ active: false });
      req.flush({});
    });
  });

  describe('addClientPoints', () => {
    it('hace POST a /clients/{id}/points/add con el cuerpo recibido', () => {
      const data = { puntos: 10 };
      service.addClientPoints(3, data).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/clients/3/points/add`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBe(data);
      req.flush({});
    });
  });

  describe('subtractClientPoints', () => {
    it('hace POST a /clients/{id}/points/subtract con el cuerpo recibido', () => {
      const data = { puntos: 5 };
      service.subtractClientPoints(3, data).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/clients/3/points/subtract`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBe(data);
      req.flush({});
    });
  });

  describe('setClientPoints', () => {
    it('hace POST a /clients/{id}/points/set con el cuerpo recibido', () => {
      const data = { puntos: 100 };
      service.setClientPoints(3, data).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/clients/3/points/set`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBe(data);
      req.flush({});
    });
  });

  describe('getClientPointsHistory', () => {
    it('hace GET a /clients/{id}/points/history sin params si no se indican', () => {
      service.getClientPointsHistory(3).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/clients/3/points/history`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().length).toBe(0);
      req.flush([]);
    });

    it('hace GET a /clients/{id}/points/history con los params recibidos', () => {
      service.getClientPointsHistory(3, { desde: '2026-01-01' }).subscribe();

      const req = httpMock.expectOne(
        r => r.url === `${apiUrl}/clients/3/points/history` && r.params.get('desde') === '2026-01-01'
      );
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('getClientActivity', () => {
    it('hace GET a /clients/{id}/activity', () => {
      service.getClientActivity(3).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/clients/3/activity`);
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('softDeleteClient', () => {
    it('hace DELETE a /clients/{id}', () => {
      service.softDeleteClient(3).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/clients/3`);
      expect(req.request.method).toBe('DELETE');
      req.flush({});
    });
  });

  describe('getReservations', () => {
    it('hace GET a /reservations', () => {
      service.getReservations().subscribe();

      const req = httpMock.expectOne(`${apiUrl}/reservations`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('searchReservations', () => {
    it('hace GET a /reservations con los params recibidos', () => {
      service.searchReservations({ estado: 'PENDIENTE' }).subscribe();

      const req = httpMock.expectOne(
        r => r.url === `${apiUrl}/reservations` && r.params.get('estado') === 'PENDIENTE'
      );
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });

  describe('createReservation', () => {
    it('hace POST a /reservations con el cuerpo recibido', () => {
      const data = { mesa: 4 };
      service.createReservation(data).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/reservations`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBe(data);
      req.flush({});
    });
  });

  describe('updateReservation', () => {
    it('hace PUT a /reservations/{id} con el cuerpo recibido', () => {
      const data = { mesa: 4 };
      service.updateReservation(9, data).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/reservations/9`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toBe(data);
      req.flush({});
    });
  });

  describe('setReservationStatus', () => {
    it('hace PATCH a /reservations/{id}/status con { status }', () => {
      service.setReservationStatus(9, 'CONFIRMADA').subscribe();

      const req = httpMock.expectOne(`${apiUrl}/reservations/9/status`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ status: 'CONFIRMADA' });
      req.flush({});
    });
  });

  describe('softDeleteReservation', () => {
    it('hace DELETE a /reservations/{id}', () => {
      service.softDeleteReservation(9).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/reservations/9`);
      expect(req.request.method).toBe('DELETE');
      req.flush({});
    });
  });

  describe('getStats', () => {
    it('hace GET a /stats', () => {
      service.getStats().subscribe();

      const req = httpMock.expectOne(`${apiUrl}/stats`);
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('getLogs', () => {
    it('hace GET a /logs', () => {
      service.getLogs().subscribe();

      const req = httpMock.expectOne(`${apiUrl}/logs`);
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });
  });
});
