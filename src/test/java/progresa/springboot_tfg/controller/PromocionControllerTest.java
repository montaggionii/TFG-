package progresa.springboot_tfg.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import progresa.springboot_tfg.dto.AplicarPromocionDTO;
import progresa.springboot_tfg.entity.Promocion;
import progresa.springboot_tfg.service.PromocionService;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * AGT-022 — PromocionController no tenía ningún test propio. PromocionServiceTest
 * ya cubre a fondo la lógica de negocio del servicio, pero dos piezas viven
 * solo en el controlador y nunca se ejercitan desde ahí:
 *   1. toPromocion()/intValue()/dateValue() — el mapeo manual de un
 *      Map<String,Object> (JSON o multipart) a una entidad Promocion, con
 *      fallbacks silenciosos (puntosOtorgados <- puntosNecesarios, tipo <-
 *      "GANAR", activa <- true, fecha invalida <- null) que una regresion
 *      futura podria romper sin que ningun test lo note.
 *   2. obtenerPorRestaurante() — solo exige
 *      PromocionService.validarRestauranteAutenticado(...) cuando quien
 *      llama tiene ROLE_RESTAURANT; para un cliente (u otro rol) la
 *      comprobacion de propiedad se salta a proposito (un cliente puede ver
 *      las promociones de cualquier restaurante). Nada fijaba hasta ahora
 *      que esa condicion es la correcta ni que de verdad bloquea a un
 *      restaurante que intente leer las promociones de otro.
 */
@ExtendWith(MockitoExtension.class)
class PromocionControllerTest {

    @Mock
    private PromocionService promocionService;

    private PromocionController controller;

    @BeforeEach
    void setUp() {
        controller = new PromocionController(promocionService);
    }

    private Authentication authComo(String email, String role) {
        return new UsernamePasswordAuthenticationToken(email, "N/A", List.of(new SimpleGrantedAuthority(role)));
    }

    // ---- obtenerPorRestaurante: la comprobacion de propiedad solo aplica a ROLE_RESTAURANT ----

    @Test
    void obtenerPorRestauranteComoRestauranteAjenoPropagaAccessDeniedYNoListaNada() {
        Authentication authentication = authComo("otro@test.com", "ROLE_RESTAURANT");
        doThrow(new AccessDeniedException("No puedes consultar promociones de otro restaurante"))
                .when(promocionService).validarRestauranteAutenticado(5L, "otro@test.com");

        assertThrows(AccessDeniedException.class,
                () -> controller.obtenerPorRestaurante(5L, authentication));

        verify(promocionService, never()).obtenerPorRestaurante(any());
    }

    @Test
    void obtenerPorRestauranteComoDuenoRealValidaYLuegoLista() {
        Authentication authentication = authComo("dueno@test.com", "ROLE_RESTAURANT");
        Promocion promo = mock(Promocion.class);
        when(promocionService.obtenerPorRestaurante(5L)).thenReturn(List.of(promo));

        ResponseEntity<List<Promocion>> res = controller.obtenerPorRestaurante(5L, authentication);

        assertEquals(200, res.getStatusCode().value());
        assertEquals(List.of(promo), res.getBody());
        verify(promocionService).validarRestauranteAutenticado(eq(5L), eq("dueno@test.com"));
    }

    @Test
    void obtenerPorRestauranteComoClienteNuncaValidaPropiedadYListaIgual() {
        Authentication authentication = authComo("cliente@test.com", "ROLE_USER");
        Promocion promo = mock(Promocion.class);
        when(promocionService.obtenerPorRestaurante(5L)).thenReturn(List.of(promo));

        ResponseEntity<List<Promocion>> res = controller.obtenerPorRestaurante(5L, authentication);

        assertEquals(200, res.getStatusCode().value());
        assertEquals(List.of(promo), res.getBody());
        verify(promocionService, never()).validarRestauranteAutenticado(anyLong(), anyString());
    }

    // ---- crear()/toPromocion(): mapeo de Map<String,Object> a Promocion ----

    @Test
    void crearMapeaTodosLosCamposCuandoEstanPresentes() {
        Authentication authentication = authComo("dueno@test.com", "ROLE_RESTAURANT");
        ArgumentCaptor<Promocion> captor = ArgumentCaptor.forClass(Promocion.class);
        when(promocionService.crear(captor.capture(), eq("dueno@test.com"))).thenReturn(mock(Promocion.class));

        Map<String, Object> data = Map.of(
                "titulo", "2x1 en postres",
                "descripcion", "Valido los fines de semana",
                "puntosOtorgados", 50,
                "tipo", "CANJEAR",
                "imagenUrl", "https://cdn/img.png",
                "fechaInicio", "2026-01-01T00:00:00",
                "fechaFin", "2026-12-31",
                "activa", "false"
        );

        controller.crear(data, authentication);

        Promocion mapeada = captor.getValue();
        assertEquals("2x1 en postres", mapeada.getTitulo());
        assertEquals("Valido los fines de semana", mapeada.getDescripcion());
        assertEquals(50, mapeada.getPuntosOtorgados());
        assertEquals("CANJEAR", mapeada.getTipo());
        assertEquals("https://cdn/img.png", mapeada.getImagenUrl());
        assertEquals(LocalDate.of(2026, 1, 1), mapeada.getFechaInicio());
        assertEquals(LocalDate.of(2026, 12, 31), mapeada.getFechaFin());
        assertFalse(mapeada.isActiva());
    }

    @Test
    void crearSinPuntosOtorgadosUsaPuntosNecesariosComoFallback() {
        Authentication authentication = authComo("dueno@test.com", "ROLE_RESTAURANT");
        ArgumentCaptor<Promocion> captor = ArgumentCaptor.forClass(Promocion.class);
        when(promocionService.crear(captor.capture(), anyString())).thenReturn(mock(Promocion.class));

        Map<String, Object> data = Map.of("titulo", "Promo", "puntosNecesarios", 30);

        controller.crear(data, authentication);

        assertEquals(30, captor.getValue().getPuntosOtorgados());
    }

    @Test
    void crearSinPuntosEnNingunCampoUsaCero() {
        Authentication authentication = authComo("dueno@test.com", "ROLE_RESTAURANT");
        ArgumentCaptor<Promocion> captor = ArgumentCaptor.forClass(Promocion.class);
        when(promocionService.crear(captor.capture(), anyString())).thenReturn(mock(Promocion.class));

        controller.crear(Map.of("titulo", "Promo sin puntos"), authentication);

        assertEquals(0, captor.getValue().getPuntosOtorgados());
    }

    @Test
    void crearSinTipoUsaGanarPorDefecto() {
        Authentication authentication = authComo("dueno@test.com", "ROLE_RESTAURANT");
        ArgumentCaptor<Promocion> captor = ArgumentCaptor.forClass(Promocion.class);
        when(promocionService.crear(captor.capture(), anyString())).thenReturn(mock(Promocion.class));

        controller.crear(Map.of("titulo", "Promo sin tipo"), authentication);

        assertEquals("GANAR", captor.getValue().getTipo());
    }

    @Test
    void crearSinActivaLaDejaActivaPorDefecto() {
        Authentication authentication = authComo("dueno@test.com", "ROLE_RESTAURANT");
        ArgumentCaptor<Promocion> captor = ArgumentCaptor.forClass(Promocion.class);
        when(promocionService.crear(captor.capture(), anyString())).thenReturn(mock(Promocion.class));

        controller.crear(Map.of("titulo", "Promo sin activa"), authentication);

        assertTrue(captor.getValue().isActiva());
    }

    @Test
    void crearConFechaInvalidaLaDejaNulaSinLanzarNada() {
        Authentication authentication = authComo("dueno@test.com", "ROLE_RESTAURANT");
        ArgumentCaptor<Promocion> captor = ArgumentCaptor.forClass(Promocion.class);
        when(promocionService.crear(captor.capture(), anyString())).thenReturn(mock(Promocion.class));

        Map<String, Object> data = Map.of("titulo", "Promo", "fechaInicio", "no-es-una-fecha");

        controller.crear(data, authentication);

        assertNull(captor.getValue().getFechaInicio());
    }

    // ---- aplicarPromocion(): delega en el servicio con el email del JWT ----

    @Test
    void aplicarPromocionDelegaEnElServicioConElEmailAutenticado() {
        Authentication authentication = authComo("dueno@test.com", "ROLE_RESTAURANT");
        AplicarPromocionDTO dto = new AplicarPromocionDTO();
        dto.setUsuarioId(9L);

        ResponseEntity<?> res = controller.aplicarPromocion(3L, dto, authentication);

        assertEquals(200, res.getStatusCode().value());
        verify(promocionService).aplicarPromocion(eq(3L), eq(9L), eq("dueno@test.com"));
    }
}
