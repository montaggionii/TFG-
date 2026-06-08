package progresa.springboot_tfg.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import progresa.springboot_tfg.dto.ChangePasswordRequestDTO;
import progresa.springboot_tfg.dto.UsuarioDTO;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.service.UsuarioService;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/usuarios")
@CrossOrigin(originPatterns = "*")
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
    public ResponseEntity<UsuarioDTO> obtenerPorId(@PathVariable Long id) {
        return ResponseEntity.ok(usuarioService.obtenerPorId(id));
    }

    @Operation(
            summary = "Identificar cliente por QR",
            description = "Valida el QR escaneado por un restaurante y devuelve los datos del cliente"
    )
    @PostMapping("/identificar-qr")
    public ResponseEntity<UsuarioDTO> identificarPorQr(@RequestBody Map<String, String> request) {
        String qr = request.getOrDefault("qr", request.getOrDefault("qrCode", request.getOrDefault("codigoQr", "")));
        return ResponseEntity.ok(usuarioService.identificarPorQr(qr));
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
            @RequestBody Usuario usuario) {
        return ResponseEntity.ok(usuarioService.actualizar(id, usuario));
    }

    @Operation(
            summary = "Subir foto de perfil",
            description = "Guarda una imagen de perfil para el usuario y devuelve la ruta pública de la imagen"
    )
    @PostMapping(value = "/{id}/upload-photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<String> subirFotoPerfil(
            @PathVariable Long id,
            @RequestParam("file") MultipartFile file) throws IOException {

        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body("");
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return ResponseEntity.badRequest().body("");
        }

        Path uploadDir = Paths.get("uploads", "perfiles").toAbsolutePath().normalize();
        Files.createDirectories(uploadDir);

        String extension = obtenerExtension(file.getOriginalFilename(), contentType);
        String filename = "user_" + id + "_" + UUID.randomUUID().toString().substring(0, 8) + extension;
        Path target = uploadDir.resolve(filename).normalize();

        if (!target.startsWith(uploadDir)) {
            return ResponseEntity.badRequest().body("");
        }

        file.transferTo(target);

        String publicPath = "/uploads/perfiles/" + filename;
        usuarioService.actualizarFotoPerfil(id, publicPath);

        return ResponseEntity.ok(publicPath);
    }

    @Operation(
            summary = "Cambiar contraseña",
            description = "Valida la contraseña actual y actualiza la contraseña de acceso del usuario"
    )
    @PostMapping("/{id}/change-password")
    public ResponseEntity<Void> cambiarPassword(
            @PathVariable Long id,
            @RequestBody ChangePasswordRequestDTO request) {
        usuarioService.cambiarPassword(id, request.getCurrentPassword(), request.getNewPassword());
        return ResponseEntity.noContent().build();
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
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        usuarioService.eliminar(id);
        return ResponseEntity.noContent().build();
    }

    private String obtenerExtension(String originalFilename, String contentType) {
        if (originalFilename != null) {
            String normalized = originalFilename.toLowerCase(Locale.ROOT);
            int dotIndex = normalized.lastIndexOf('.');
            if (dotIndex >= 0 && dotIndex < normalized.length() - 1) {
                String extension = normalized.substring(dotIndex);
                if (List.of(".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif").contains(extension)) {
                    return extension;
                }
            }
        }

        return switch (contentType) {
            case "image/png" -> ".png";
            case "image/webp" -> ".webp";
            case "image/gif" -> ".gif";
            case "image/avif" -> ".avif";
            default -> ".jpg";
        };
    }
}
