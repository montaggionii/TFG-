package progresa.springboot_tfg.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import progresa.springboot_tfg.dao.FavoritoDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.Favorito;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.ResourceNotFoundException;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * AGT-059 — FavoritoController (GET/POST /api/favoritos) no tenía ningún test
 * propio. Al igual que CanjeController/PuntosController, identifica siempre
 * al usuario por el email del JWT (Authentication), nunca por un id del
 * body o la ruta; nada fijaba ese comportamiento salvo lectura manual del
 * código.
 */
@ExtendWith(MockitoExtension.class)
class FavoritoControllerTest {

    @Mock
    private FavoritoDAO favoritoDAO;

    @Mock
    private UsuarioDAO usuarioDAO;

    @Mock
    private RestauranteDAO restauranteDAO;

    private FavoritoController controller;

    @BeforeEach
    void setUp() {
        controller = new FavoritoController(favoritoDAO, usuarioDAO, restauranteDAO);
    }

    private Authentication authComo(String email) {
        Authentication authentication = mock(Authentication.class);
        when(authentication.getName()).thenReturn(email);
        return authentication;
    }

    private Usuario usuarioConId(Long id) {
        Usuario usuario = new Usuario();
        usuario.setId(id);
        return usuario;
    }

    private Restaurante restauranteConId(Long id) {
        Restaurante restaurante = new Restaurante();
        restaurante.setId(id);
        return restaurante;
    }

    private Favorito favoritoDe(Usuario usuario, Restaurante restaurante) {
        Favorito favorito = new Favorito();
        favorito.setUsuario(usuario);
        favorito.setRestaurante(restaurante);
        return favorito;
    }

    @Test
    void miosUsaSiempreElUsuarioDelJwtNuncaUnIdExterno() {
        Authentication authentication = authComo("cliente@test.com");
        Usuario usuario = usuarioConId(5L);
        when(usuarioDAO.findByEmail("cliente@test.com")).thenReturn(Optional.of(usuario));
        when(favoritoDAO.findByUsuarioId(5L)).thenReturn(List.of(
                favoritoDe(usuario, restauranteConId(10L)),
                favoritoDe(usuario, restauranteConId(20L))
        ));

        ResponseEntity<Map<String, Object>> res = controller.mios(authentication);

        assertEquals(200, res.getStatusCode().value());
        assertEquals(List.of(10L, 20L), res.getBody().get("restaurantes"));
    }

    @Test
    void miosPropagaNotFoundSiElUsuarioDelJwtNoExiste() {
        Authentication authentication = authComo("fantasma@test.com");
        when(usuarioDAO.findByEmail("fantasma@test.com")).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> controller.mios(authentication));
    }

    @Test
    void alternarMarcaFavoritoCuandoNoLoEraTodavia() {
        Authentication authentication = authComo("cliente@test.com");
        Usuario usuario = usuarioConId(5L);
        Restaurante restaurante = restauranteConId(10L);
        when(usuarioDAO.findByEmail("cliente@test.com")).thenReturn(Optional.of(usuario));
        when(restauranteDAO.findById(10L)).thenReturn(Optional.of(restaurante));
        when(favoritoDAO.existsByUsuarioIdAndRestauranteId(5L, 10L)).thenReturn(false);

        ResponseEntity<Map<String, Object>> res = controller.alternar(10L, authentication);

        assertEquals(200, res.getStatusCode().value());
        assertEquals(true, res.getBody().get("favorito"));
        ArgumentCaptor<Favorito> captor = ArgumentCaptor.forClass(Favorito.class);
        verify(favoritoDAO).save(captor.capture());
        assertEquals(usuario, captor.getValue().getUsuario());
        assertEquals(restaurante, captor.getValue().getRestaurante());
        verify(favoritoDAO, never()).deleteByUsuarioIdAndRestauranteId(eq(5L), eq(10L));
    }

    @Test
    void alternarDesmarcaFavoritoCuandoYaEra() {
        Authentication authentication = authComo("cliente@test.com");
        Usuario usuario = usuarioConId(5L);
        Restaurante restaurante = restauranteConId(10L);
        when(usuarioDAO.findByEmail("cliente@test.com")).thenReturn(Optional.of(usuario));
        when(restauranteDAO.findById(10L)).thenReturn(Optional.of(restaurante));
        when(favoritoDAO.existsByUsuarioIdAndRestauranteId(5L, 10L)).thenReturn(true);

        ResponseEntity<Map<String, Object>> res = controller.alternar(10L, authentication);

        assertEquals(200, res.getStatusCode().value());
        assertEquals(false, res.getBody().get("favorito"));
        verify(favoritoDAO).deleteByUsuarioIdAndRestauranteId(5L, 10L);
        verify(favoritoDAO, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void alternarUsaSiempreElUsuarioDelJwtAunqueOtroUsuarioTengaElMismoRestauranteFavorito() {
        Authentication authentication = authComo("otro@test.com");
        Usuario usuario = usuarioConId(99L);
        Restaurante restaurante = restauranteConId(10L);
        when(usuarioDAO.findByEmail("otro@test.com")).thenReturn(Optional.of(usuario));
        when(restauranteDAO.findById(10L)).thenReturn(Optional.of(restaurante));
        when(favoritoDAO.existsByUsuarioIdAndRestauranteId(99L, 10L)).thenReturn(false);

        controller.alternar(10L, authentication);

        verify(favoritoDAO).existsByUsuarioIdAndRestauranteId(99L, 10L);
        verify(favoritoDAO, never()).existsByUsuarioIdAndRestauranteId(eq(5L), org.mockito.ArgumentMatchers.anyLong());
    }

    @Test
    void alternarPropagaNotFoundSiElRestauranteNoExiste() {
        Authentication authentication = authComo("cliente@test.com");
        when(usuarioDAO.findByEmail("cliente@test.com")).thenReturn(Optional.of(usuarioConId(5L)));
        when(restauranteDAO.findById(404L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> controller.alternar(404L, authentication));
    }
}
