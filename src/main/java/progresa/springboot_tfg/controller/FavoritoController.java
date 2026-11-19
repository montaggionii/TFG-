package progresa.springboot_tfg.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import progresa.springboot_tfg.dao.FavoritoDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.Favorito;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.ResourceNotFoundException;
import progresa.springboot_tfg.security.SecurityUtils;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/favoritos")
@CrossOrigin(origins = "*")
@Tag(name = "Favoritos", description = "Restaurantes favoritos del cliente (cambia el orden del mapa)")
public class FavoritoController {

    private final FavoritoDAO favoritoDAO;
    private final UsuarioDAO usuarioDAO;
    private final RestauranteDAO restauranteDAO;

    public FavoritoController(FavoritoDAO favoritoDAO, UsuarioDAO usuarioDAO, RestauranteDAO restauranteDAO) {
        this.favoritoDAO = favoritoDAO;
        this.usuarioDAO = usuarioDAO;
        this.restauranteDAO = restauranteDAO;
    }

    @Operation(summary = "Mis favoritos", description = "IDs de los restaurantes marcados como favoritos")
    @GetMapping
    public ResponseEntity<Map<String, Object>> mios(Authentication authentication) {
        Usuario usuario = usuarioDAO.findByEmail(SecurityUtils.email(authentication))
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
        List<Long> ids = favoritoDAO.findByUsuarioId(usuario.getId()).stream()
                .map(f -> f.getRestaurante().getId())
                .toList();
        return ResponseEntity.ok(Map.of("restaurantes", ids));
    }

    @Operation(summary = "Marcar / desmarcar favorito", description = "Alterna el favorito del cliente autenticado")
    @PostMapping("/{restauranteId}")
    public ResponseEntity<Map<String, Object>> alternar(@PathVariable Long restauranteId, Authentication authentication) {
        Usuario usuario = usuarioDAO.findByEmail(SecurityUtils.email(authentication))
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
        Restaurante restaurante = restauranteDAO.findById(restauranteId)
                .orElseThrow(() -> new ResourceNotFoundException("Restaurante no encontrado"));

        boolean yaEra = favoritoDAO.existsByUsuarioIdAndRestauranteId(usuario.getId(), restauranteId);
        if (yaEra) {
            favoritoDAO.deleteByUsuarioIdAndRestauranteId(usuario.getId(), restauranteId);
            return ResponseEntity.ok(Map.of("favorito", false));
        }
        Favorito favorito = new Favorito();
        favorito.setUsuario(usuario);
        favorito.setRestaurante(restaurante);
        favoritoDAO.save(favorito);
        return ResponseEntity.ok(Map.of("favorito", true));
    }
}
