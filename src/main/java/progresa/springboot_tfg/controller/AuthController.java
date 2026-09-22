package progresa.springboot_tfg.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import progresa.springboot_tfg.dto.*;
import progresa.springboot_tfg.entity.Usuario; // 🔥 NUEVO
import progresa.springboot_tfg.security.JwtUtil;
import progresa.springboot_tfg.service.RestauranteService;
import progresa.springboot_tfg.service.UsuarioService;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
@Tag(name = "Auth", description = "Operaciones de autenticación para usuarios y restaurantes")
public class AuthController {

    private final UsuarioService usuarioService;
    private final RestauranteService restauranteService;
    private final JwtUtil jwtUtil;
    private final String adminPassword;

    public AuthController(UsuarioService usuarioService,
                          RestauranteService restauranteService,
                          JwtUtil jwtUtil,
                          @Value("${fidelyfood.admin.password:admin123}") String adminPassword) {
        this.usuarioService = usuarioService;
        this.restauranteService = restauranteService;
        this.jwtUtil = jwtUtil;
        this.adminPassword = adminPassword;
    }

    // Login del usuario
    @Operation(
            summary = "Login de usuario",
            description = "Autentica a un usuario mediante email y contraseña y devuelve un token JWT junto con sus datos básicos"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Login exitoso"),
            @ApiResponse(responseCode = "401", description = "Credenciales incorrectas")
    })
    @PostMapping("/login")
    public ResponseEntity<LoginResponseDTO> login(
            @RequestBody LoginRequestDTO loginDTO) {

        return ResponseEntity.ok(usuarioService.login(loginDTO));
    }

    // Login del restaurante
    @Operation(
            summary = "Login de restaurante",
            description = "Autentica a un restaurante mediante sus credenciales y devuelve un token JWT junto con su información"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Login exitoso"),
            @ApiResponse(responseCode = "401", description = "Credenciales incorrectas")
    })
    @PostMapping("/login-restaurante")
    public ResponseEntity<RestauranteLoginResponseDTO> loginRestaurante(
            @RequestBody RestauranteLoginRequestDTO loginDTO) {

        return ResponseEntity.ok(restauranteService.login(loginDTO));
    }

    @PostMapping("/login-admin")
    public ResponseEntity<?> loginAdmin(@RequestBody LoginRequestDTO loginDTO) {
        String email = loginDTO.getEmail() == null ? "" : loginDTO.getEmail().trim();
        String password = loginDTO.getPassword() == null ? "" : loginDTO.getPassword().trim();
        boolean validEmail = "admin@fidelyfood.local".equalsIgnoreCase(email)
                || "admin@fidelyfood.com".equalsIgnoreCase(email);
        boolean validPassword = adminPassword.equals(password);

        if (!validEmail || !validPassword) {
            return ResponseEntity.status(401).body(Map.of("message", "Credenciales de administrador no válidas."));
        }

        String token = jwtUtil.generateToken(email, "ROLE_ADMIN");
        return ResponseEntity.ok(Map.of(
                "id", 1,
                "nombre", "Administrador",
                "email", email,
                "role", "ROLE_ADMIN",
                "token", token
        ));
    }

    // 🔥 REGISTRO USUARIO CORREGIDO
    @Operation(
            summary = "Registro de usuario",
            description = "Registra un nuevo usuario en el sistema con sus datos básicos"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Usuario registrado correctamente"),
            @ApiResponse(responseCode = "400", description = "Datos inválidos o usuario ya existente")
    })
    @PostMapping("/register")
    public ResponseEntity<UsuarioDTO> register(
            @RequestBody RegisterRequestDTO dto) {

        Usuario usuario = usuarioService.register(dto);

        // 🔥 devolver DTO en lugar de entity
        UsuarioDTO response = new UsuarioDTO(
                usuario.getId(),
                usuario.getNombre(),
                usuario.getEmail(),
                usuario.getPuntos(),
                usuario.getQrCode()
        );

        return ResponseEntity.ok(response);
    }

    // Registro del restaurante
    @Operation(
            summary = "Registro de restaurante",
            description = "Registra un nuevo restaurante en el sistema con sus datos de negocio"
    )
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Restaurante registrado correctamente"),
            @ApiResponse(responseCode = "400", description = "Datos inválidos o restaurante ya existente")
    })
    @PostMapping("/register-restaurante")
    public ResponseEntity<?> registerRestaurante(
            @RequestBody RestauranteRegisterRequestDTO dto) {

        return ResponseEntity.ok(restauranteService.register(dto));
    }
}
