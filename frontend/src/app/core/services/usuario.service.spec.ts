import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UsuarioService } from './usuario.service';
import { environment } from '../../../environments/environment';

describe('UsuarioService', () => {
  let service: UsuarioService;
  let httpMock: HttpTestingController;
  const apiUrl = `${environment.apiUrl}/api/usuarios`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(UsuarioService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getUsuarioById', () => {
    it('hace GET a /{id}', () => {
      service.getUsuarioById(5).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/5`);
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('updateUsuario', () => {
    it('hace PUT a /{id} con el cuerpo recibido, sin transformarlo', () => {
      const data = { nombre: 'Nuevo nombre' };
      service.updateUsuario(5, data).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/5`);
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toBe(data);
      req.flush({});
    });
  });

  describe('uploadPhoto', () => {
    it('hace POST a /{id}/upload-photo con un FormData que lleva el fichero', () => {
      const file = new File(['contenido'], 'foto.png', { type: 'image/png' });
      service.uploadPhoto(5, file).subscribe();

      const req = httpMock.expectOne(`${apiUrl}/5/upload-photo`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body instanceof FormData).toBe(true);
      expect((req.request.body as FormData).get('file')).toBe(file);
      expect(req.request.responseType).toBe('text');
      req.flush('url-de-la-foto');
    });
  });

  describe('changePassword', () => {
    it('hace POST a /{id}/change-password con la contraseña actual y la nueva', () => {
      service.changePassword(5, 'actual123', 'nueva456').subscribe();

      const req = httpMock.expectOne(`${apiUrl}/5/change-password`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ currentPassword: 'actual123', newPassword: 'nueva456' });
      req.flush(null);
    });
  });

  describe('resolveImageUrl', () => {
    it('con null/undefined/cadena vacía devuelve null', () => {
      expect(service.resolveImageUrl(null)).toBeNull();
      expect(service.resolveImageUrl(undefined)).toBeNull();
      expect(service.resolveImageUrl('')).toBeNull();
      expect(service.resolveImageUrl('   ')).toBeNull();
    });

    it('con los literales "null"/"undefined" (strings) devuelve null, no una URL rota', () => {
      expect(service.resolveImageUrl('null')).toBeNull();
      expect(service.resolveImageUrl('undefined')).toBeNull();
    });

    it('con una imagen base64 la deja intacta', () => {
      const base64 = 'data:image/png;base64,iVBORw0KGgo=';
      expect(service.resolveImageUrl(base64)).toBe(base64);
    });

    it('con una ruta que ya empieza por "assets/" la deja intacta', () => {
      expect(service.resolveImageUrl('assets/img/logo.png')).toBe('assets/img/logo.png');
    });

    it('con una ruta que empieza por "/assets/" solo quita la barra inicial', () => {
      expect(service.resolveImageUrl('/assets/img/logo.png')).toBe('assets/img/logo.png');
    });

    it('con una URL absoluta vieja que contiene /uploads/ la repara apuntando al apiUrl actual', () => {
      const vieja = 'http://192.168.1.50:8081/uploads/perfiles/foto1.jpg';
      expect(service.resolveImageUrl(vieja)).toBe(`${environment.apiUrl}/uploads/perfiles/foto1.jpg`);
    });

    it('con una ruta relativa que ya contiene /uploads/ la reconstruye igual sobre el apiUrl actual', () => {
      expect(service.resolveImageUrl('/uploads/perfiles/foto1.jpg'))
        .toBe(`${environment.apiUrl}/uploads/perfiles/foto1.jpg`);
    });

    it('con una URL externa real (sin /uploads/) la deja igual', () => {
      const externa = 'https://cdn.externo.com/avatar.jpg';
      expect(service.resolveImageUrl(externa)).toBe(externa);
    });

    it('con una ruta relativa pura sin /uploads/ le añade el prefijo /uploads/perfiles', () => {
      expect(service.resolveImageUrl('foto1.jpg')).toBe(`${environment.apiUrl}/uploads/perfiles/foto1.jpg`);
    });

    it('con una ruta relativa pura que ya empieza por "/" no la duplica', () => {
      expect(service.resolveImageUrl('/foto1.jpg')).toBe(`${environment.apiUrl}/uploads/perfiles/foto1.jpg`);
    });
  });

  describe('resolveProfileImage', () => {
    it('con un string lo trata directamente como la ruta de la imagen', () => {
      expect(service.resolveProfileImage('foto1.jpg')).toBe(`${environment.apiUrl}/uploads/perfiles/foto1.jpg`);
    });

    it('con un objeto, usa el primer campo de imagen conocido que tenga valor', () => {
      const usuario = { avatar: '', fotoPerfil: 'foto1.jpg', imageUrl: 'otra.jpg' };
      expect(service.resolveProfileImage(usuario)).toBe(`${environment.apiUrl}/uploads/perfiles/foto1.jpg`);
    });

    it('sin ningún campo de imagen con valor, devuelve el placeholder', () => {
      expect(service.resolveProfileImage({ nombre: 'Sin foto' })).toBe(service.profilePlaceholder);
    });

    it('con null/undefined devuelve el placeholder', () => {
      expect(service.resolveProfileImage(null)).toBe(service.profilePlaceholder);
      expect(service.resolveProfileImage(undefined)).toBe(service.profilePlaceholder);
    });
  });

  describe('onProfileImageError', () => {
    it('sustituye el src roto por el placeholder y marca la clase de fallback', () => {
      const img = document.createElement('img');
      img.src = 'http://localhost:8081/uploads/perfiles/rota.jpg';
      const event = { target: img } as unknown as Event;

      service.onProfileImageError(event);

      expect(img.src.endsWith(service.profilePlaceholder)).toBe(true);
      expect(img.classList.contains('ff-profile-image-fallback')).toBe(true);
    });

    it('si el src ya es el placeholder, no vuelve a tocar la imagen (evita el bucle de error)', () => {
      const img = document.createElement('img');
      img.src = service.profilePlaceholder;
      const event = { target: img } as unknown as Event;

      service.onProfileImageError(event);

      expect(img.classList.contains('ff-profile-image-fallback')).toBe(false);
    });

    it('sin target en el evento, no lanza ningún error', () => {
      const event = { target: null } as unknown as Event;
      expect(() => service.onProfileImageError(event)).not.toThrow();
    });
  });
});
