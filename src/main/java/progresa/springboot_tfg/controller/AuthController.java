package progresa.springboot_tfg.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import progresa.springboot_tfg.dto.*;
import progresa.springboot_tfg.entity.Usuario; // 🔥 NUEVO
import progresa.springboot_tfg.security.JwtUtil;
import progresa.springboot_tfg.service.OtpAuthService;
import progresa.springboot_tfg.service.RestauranteService;
import progresa.springboot_tfg.service.SocialAuthService;
import progresa.springboot_tfg.service.UsuarioService;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
@Tag(name = "Auth", description = "Operaciones de autenticación para usuarios y restaurantes")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final UsuarioService usuarioService;
    private final RestauranteService restauranteService;
    private final SocialAuthService socialAuthService;
    private final OtpAuthService otpAuthService;
    private final JwtUtil jwtUtil;
    private final String adminPassword;

    // Sin valor por defecto: si FIDELYFOOD_ADMIN_PASSWORD no esta definida no existe
    // cuenta admin utilizable (login-admin devuelve siempre 401).
    public AuthController(UsuarioService usuarioService,
                          RestauranteService restauranteService,
                          SocialAuthService socialAuthService,
                          OtpAuthService otpAuthService,
                          JwtUtil jwtUtil,
                          @Value("${fidelyfood.admin.password:}") String adminPassword) {
        this.usuarioService = usuarioService;
        this.restauranteService = restauranteService;
        this.socialAuthService = socialAuthService;
        this.otpAuthService = otpAuthService;
        this.jwtUtil = jwtUtil;
        this.adminPassword = adminPassword == null ? "" : adminPassword.trim();
        if (this.adminPassword.isEmpty()) {
            log.warn("FIDELYFOOD_ADMIN_PASSWORD no esta definida: el login de administrador queda deshabilitado.");
        }
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
        boolean validPassword = !adminPassword.isEmpty() && MessageDigest.isEqual(
                adminPassword.getBytes(StandardCharsets.UTF_8),
                password.getBytes(StandardCharsets.UTF_8));

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

    // "Continuar con Google": verifica el id_token y crea la sesión
    @Operation(summary = "Login con Google",
            description = "Verifica el id_token de Google Sign-In y devuelve el JWT de la sesión; si el cliente es nuevo se registra automáticamente")
    @PostMapping("/google")
    public ResponseEntity<LoginResponseDTO> loginGoogle(@RequestBody SocialLoginRequestDTO dto) {
        return ResponseEntity.ok(socialAuthService.loginGoogle(dto.getIdToken(), dto.getNombre()));
    }

    // "Continuar con Apple": verifica el id_token y crea la sesión
    @Operation(summary = "Login con Apple",
            description = "Verifica el id_token de Sign in with Apple y devuelve el JWT de la sesión; si el cliente es nuevo se registra automáticamente")
    @PostMapping("/apple")
    public ResponseEntity<LoginResponseDTO> loginApple(@RequestBody SocialLoginRequestDTO dto) {
        return ResponseEntity.ok(socialAuthService.loginApple(dto.getIdToken(), dto.getNombre()));
    }

    // "Entrar con mi móvil": envía un código de 6 dígitos por SMS
    @Operation(summary = "Enviar código OTP por SMS",
            description = "Genera y envía un código de 6 dígitos al teléfono indicado. En desarrollo (sin SMS configurado) el código vuelve en devCodigo; en producción solo viaja por SMS.")
    @PostMapping("/otp/send")
    public ResponseEntity<OtpSendResponseDTO> otpEnviar(@RequestBody OtpSendRequestDTO dto) {
        return ResponseEntity.ok(otpAuthService.enviarCodigo(dto.getTelefono()));
    }

    // Verifica el código SMS y crea la sesión (alta automática si es nuevo)
    @Operation(summary = "Verificar código OTP",
            description = "Comprueba el código recibido por SMS y devuelve el JWT de la sesión; si el teléfono es nuevo se registra automáticamente")
    @PostMapping("/otp/verify")
    public ResponseEntity<LoginResponseDTO> otpVerificar(@RequestBody OtpVerifyRequestDTO dto) {
        return ResponseEntity.ok(otpAuthService.verificarYEntrar(dto.getTelefono(), dto.getCodigo(), dto.getNombre()));
    }
}
