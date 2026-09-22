package progresa.springboot_tfg.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import progresa.springboot_tfg.dto.UsuarioDTO;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.security.SecurityUtils;
import progresa.springboot_tfg.service.UsuarioService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/usuarios")
@CrossOrigin(origins = "*")
@Tag(name = "Usuarios", description = "Gestión y consulta de usuarios del sistema")
public class UsuarioController {

    private final UsuarioService usuarioService;

    public UsuarioController(UsuarioService usuarioService) {
        this.usuarioService = usuarioService;
    }

    @Operation(
            summary = "Obtener todos los usuarios",
            description = "Devuelve la lista de usuarios registrados en el sistema"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Usuarios obtenidos correctamente")
    })
    @GetMapping
    public ResponseEntity<List<UsuarioDTO>> obtenerTodos() {
        return ResponseEntity.ok(usuarioService.obtenerTodos());
    }

    @Operation(
            summary = "Obtener usuario por ID",
            description = "Devuelve la información completa de un usuario específico, incluyendo sus datos y puntos acumulados"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Usuario encontrado"),
            @ApiResponse(responseCode = "404", description = "Usuario no encontrado")
    })
    @GetMapping("/{id}")
    public ResponseEntity<UsuarioDTO> obtenerPorId(
            @PathVariable Long id,
            Authentication authentication) {
        return ResponseEntity.ok(usuarioService.obtenerPropio(id, SecurityUtils.email(authentication)));
    }

    /*
    @Operation(
        summary = "Crear usuario",
        description = "Crea un nuevo usuario en el sistema"
    )
    @PostMapping
    public ResponseEntity<UsuarioDTO> crear(@RequestBody Usuario usuario) {
        return new ResponseEntity<>(
                usuarioService.crear(usuario),
                HttpStatus.CREATED
        );
    }
    */

    @Operation(
            summary = "Actualizar usuario",
            description = "Actualiza los datos de un usuario existente"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Usuario actualizado correctamente"),
            @ApiResponse(responseCode = "404", description = "Usuario no encontrado")
    })
    @PutMapping("/{id}")
    public ResponseEntity<UsuarioDTO> actualizar(
            @PathVariable Long id,
            @RequestBody Usuario usuario,
            Authentication authentication) {
        return ResponseEntity.ok(usuarioService.actualizar(id, usuario, SecurityUtils.email(authentication)));
    }

    @Operation(
            summary = "Eliminar usuario",
            description = "Elimina un usuario del sistema"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "204", description = "Usuario eliminado correctamente"),
            @ApiResponse(responseCode = "404", description = "Usuario no encontrado")
    })
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(
            @PathVariable Long id,
            Authentication authentication) {
        usuarioService.eliminarPropio(id, SecurityUtils.email(authentication));
        return ResponseEntity.noContent().build();
    }

    @Operation(
            summary = "Cambiar contraseña",
            description = "Verifica la contraseña actual del usuario y guarda una nueva contraseña cifrada"
    )
    @PostMapping("/{id}/change-password")
    public ResponseEntity<Void> cambiarPassword(
            @PathVariable Long id,
            @RequestBody Map<String, String> data,
            Authentication authentication) {
        usuarioService.changePassword(
                id,
                data.get("currentPassword"),
                data.get("newPassword"),
                SecurityUtils.email(authentication)
        );
        return ResponseEntity.noContent().build();
    }

    @Operation(
            summary = "Subir foto de perfil",
            description = "Guarda la foto de perfil del usuario autenticado y devuelve la ruta pública generada"
    )
    @PostMapping(value = "/{id}/upload-photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<String> subirFoto(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file,
            Authentication authentication) {
        String publicPath = usuarioService.subirFoto(id, file, SecurityUtils.email(authentication));
        return ResponseEntity.ok(publicPath);
    }

    @PostMapping("/identificar-qr")
    public ResponseEntity<UsuarioDTO> identificarQr(
            @RequestBody Map<String, String> data,
            Authentication authentication) {
        SecurityUtils.requireRole(authentication, "ROLE_RESTAURANT");
        return ResponseEntity.ok(usuarioService.identificarPorQr(data.get("qr")));
    }
}
