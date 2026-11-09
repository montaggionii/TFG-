import { TestBed } from '@angular/core/testing';
import { GeolocationService, GeoCoords } from './geolocation.service';

/**
 * @capacitor/geolocation expone `Geolocation` como un Proxy (ver
 * registerPlugin en @capacitor/core): su trap `get` siempre genera un
 * wrapper nuevo para cada propiedad, ignorando cualquier valor asignado
 * directamente (spyOn(Geolocation, 'watchPosition') no tiene ningún
 * efecto real). Por eso estos tests mockean un nivel más abajo, en
 * navigator.geolocation/navigator.permissions, que es lo que la
 * implementación web del plugin llama de verdad.
 */
describe('GeolocationService', () => {
  let service: GeolocationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GeolocationService);
  });

  function mockPermission(state: 'granted' | 'denied' | 'prompt'): jasmine.Spy {
    return spyOn(navigator.permissions, 'query').and.resolveTo({ state } as unknown as PermissionStatus);
  }

  describe('distanceKm (Haversine)', () => {
    it('devuelve 0 para el mismo punto', () => {
      const p: GeoCoords = { lat: 40.4168, lng: -3.7038 };
      expect(service.distanceKm(p, p)).toBeCloseTo(0, 6);
    });

    it('calcula ~111 km entre dos puntos separados 1 grado de latitud', () => {
      const a: GeoCoords = { lat: 0, lng: 0 };
      const b: GeoCoords = { lat: 1, lng: 0 };
      expect(service.distanceKm(a, b)).toBeCloseTo(111.19, 1);
    });

    it('es simétrica (distancia A→B igual que B→A)', () => {
      const a: GeoCoords = { lat: 40.4168, lng: -3.7038 };
      const b: GeoCoords = { lat: 41.3874, lng: 2.1686 };
      expect(service.distanceKm(a, b)).toBeCloseTo(service.distanceKm(b, a), 9);
    });

    it('calcula una distancia real conocida (Madrid-Barcelona, ~500 km)', () => {
      const madrid: GeoCoords = { lat: 40.4168, lng: -3.7038 };
      const barcelona: GeoCoords = { lat: 41.3874, lng: 2.1686 };
      const km = service.distanceKm(madrid, barcelona);
      expect(km).toBeGreaterThan(490);
      expect(km).toBeLessThan(510);
    });
  });

  describe('formatDistance', () => {
    it('por debajo de 1 km redondea a metros enteros', () => {
      expect(GeolocationService.formatDistance(0.85)).toBe('850 m');
      expect(GeolocationService.formatDistance(0.001)).toBe('1 m');
    });

    it('a partir de 1 km usa una cifra decimal con coma', () => {
      expect(GeolocationService.formatDistance(1.2345)).toBe('1,2 km');
      expect(GeolocationService.formatDistance(12)).toBe('12,0 km');
    });

    it('justo en 1 km ya usa el formato en km, no en metros', () => {
      expect(GeolocationService.formatDistance(1)).toBe('1,0 km');
    });
  });

  describe('startWatching / stopWatching', () => {
    it('con permiso concedido, llama al watch real del navegador', async () => {
      mockPermission('granted');
      const watchSpy = spyOn(navigator.geolocation, 'watchPosition').and.returnValue(1);

      await service.startWatching();

      expect(watchSpy).toHaveBeenCalledTimes(1);
    });

    it('con permiso denegado, nunca llama al watch real y el estado queda "denied"', async () => {
      mockPermission('denied');
      const watchSpy = spyOn(navigator.geolocation, 'watchPosition').and.returnValue(1);

      await service.startWatching();

      expect(watchSpy).not.toHaveBeenCalled();
      expect(service.status).toBe('denied');
    });

    it('si el permiso está en "prompt" (no soportado por requestPermissions en web), sigue adelante sin quedar en "denied"', async () => {
      mockPermission('prompt');
      const watchSpy = spyOn(navigator.geolocation, 'watchPosition').and.returnValue(1);

      await service.startWatching();

      expect(service.status).not.toBe('denied');
      expect(watchSpy).toHaveBeenCalledTimes(1);
    });

    it('con varias páginas observando a la vez, solo crea un watch real (recuento de referencias)', async () => {
      mockPermission('granted');
      const watchSpy = spyOn(navigator.geolocation, 'watchPosition').and.returnValue(1);

      await service.startWatching();
      await service.startWatching();
      await service.startWatching();

      expect(watchSpy).toHaveBeenCalledTimes(1);
    });

    it('solo destruye el watch nativo cuando la última página suscrita lo deja', async () => {
      mockPermission('granted');
      spyOn(navigator.geolocation, 'watchPosition').and.returnValue(7);
      const clearSpy = spyOn(navigator.geolocation, 'clearWatch');

      await service.startWatching();
      await service.startWatching();

      await service.stopWatching();
      expect(clearSpy).not.toHaveBeenCalled();

      await service.stopWatching();
      expect(clearSpy).toHaveBeenCalledTimes(1);
      expect(clearSpy).toHaveBeenCalledWith(7);
    });
  });

  describe('actualización de posición (handleUpdate)', () => {
    async function startWithCallbacks(): Promise<{
      success: (pos: GeolocationPosition) => void;
      error: (err: GeolocationPositionError) => void;
    }> {
      mockPermission('granted');
      let success!: (pos: GeolocationPosition) => void;
      let error!: (err: GeolocationPositionError) => void;
      spyOn(navigator.geolocation, 'watchPosition').and.callFake(
        (successCb: PositionCallback, errorCb?: PositionErrorCallback | null) => {
          success = successCb as (pos: GeolocationPosition) => void;
          error = (errorCb ?? (() => {})) as (err: GeolocationPositionError) => void;
          return 1;
        }
      );
      await service.startWatching();
      return { success, error };
    }

    function fakePosition(lat: number, lng: number): GeolocationPosition {
      return { coords: { latitude: lat, longitude: lng } } as unknown as GeolocationPosition;
    }

    it('emite la primera posición recibida', async () => {
      const { success } = await startWithCallbacks();
      success(fakePosition(40.0, -3.0));

      expect(service.currentLocation).toEqual({ lat: 40.0, lng: -3.0 });
      expect(service.status).toBe('active');
    });

    it('ignora una lectura cuyo desplazamiento es insignificante (ruido del GPS)', async () => {
      const { success } = await startWithCallbacks();
      success(fakePosition(40.0, -3.0));
      const firstLocation = service.currentLocation;

      // ~0.0001 grados de latitud son unos 11 metros — por debajo del umbral de 25 m
      success(fakePosition(40.0001, -3.0));

      expect(service.currentLocation).toEqual(firstLocation);
    });

    it('sí emite una lectura cuyo desplazamiento supera el umbral', async () => {
      const { success } = await startWithCallbacks();
      success(fakePosition(40.0, -3.0));

      // ~0.01 grados de latitud son más de 1 km — por encima del umbral de 25 m
      success(fakePosition(40.01, -3.0));

      expect(service.currentLocation).toEqual({ lat: 40.01, lng: -3.0 });
    });

    it('un error del watch pasa el estado a "denied" (código 1)', async () => {
      const { error } = await startWithCallbacks();
      error({ code: 1 } as GeolocationPositionError);
      expect(service.status).toBe('denied');
    });

    it('un error del watch pasa el estado a "timeout" (código 3)', async () => {
      const { error } = await startWithCallbacks();
      error({ code: 3 } as GeolocationPositionError);
      expect(service.status).toBe('timeout');
    });
  });

  describe('getCurrentLocation', () => {
    it('devuelve las coordenadas y actualiza location$/status$ cuando hay permiso', async () => {
      mockPermission('granted');
      spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake((success: PositionCallback) => {
        success({ coords: { latitude: 10, longitude: 20 } } as GeolocationPosition);
      });

      const coords = await service.getCurrentLocation();

      expect(coords).toEqual({ lat: 10, lng: 20 });
      expect(service.currentLocation).toEqual({ lat: 10, lng: 20 });
      expect(service.status).toBe('active');
    });

    it('rechaza sin llamar al watch real cuando el permiso está denegado', async () => {
      mockPermission('denied');
      const positionSpy = spyOn(navigator.geolocation, 'getCurrentPosition');

      await expectAsync(service.getCurrentLocation()).toBeRejected();
      expect(positionSpy).not.toHaveBeenCalled();
    });
  });

  describe('retry', () => {
    it('vuelve a "idle" y, si había subscriptores activos, reintenta el watch', async () => {
      const permSpy = mockPermission('denied');
      const watchSpy = spyOn(navigator.geolocation, 'watchPosition').and.returnValue(1);

      await service.startWatching();
      expect(service.status).toBe('denied');
      expect(watchSpy).not.toHaveBeenCalled();

      permSpy.and.resolveTo({ state: 'granted' } as unknown as PermissionStatus);
      await service.retry();

      expect(service.status).not.toBe('denied');
      expect(watchSpy).toHaveBeenCalledTimes(1);
    });
  });
});
