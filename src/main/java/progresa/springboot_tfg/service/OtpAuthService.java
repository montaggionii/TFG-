package progresa.springboot_tfg.service;

import org.springframework.stereotype.Service;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.dto.LoginResponseDTO;
import progresa.springboot_tfg.dto.OtpSendResponseDTO;
import progresa.springboot_tfg.entity.Role;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.security.JwtUtil;
import progresa.springboot_tfg.service.QrService;

import java.security.SecureRandom;
import java.util.Base64;

/**
 * Orquesta el acceso con código SMS: pide el código, lo verifica y
 * devuelve la sesión del cliente (dándolo de alta si es la primera vez).
 *
 * Las cuentas creadas por SMS no tienen email real del usuario; se usa un
 * identificador interno determinista "sms.<teléfono>@fidelyfood.local"
 * para que la propiedad de los recursos (requireOwner) y el JWT sigan
 * funcionando con el modelo actual.
 */
@Service
public class OtpAuthService {

    private final OtpService otpService;
    private final UsuarioService usuarioService;
    private final UsuarioDAO usuarioDAO;
    private final JwtUtil jwtUtil;
    private final QrService qrService;

    public OtpAuthService(OtpService otpService, UsuarioService usuarioService,
                          UsuarioDAO usuarioDAO, JwtUtil jwtUtil, QrService qrService) {
        this.otpService = otpService;
        this.usuarioService = usuarioService;
        this.usuarioDAO = usuarioDAO;
        this.jwtUtil = jwtUtil;
        this.qrService = qrService;
    }

    public OtpSendResponseDTO enviarCodigo(String telefono) {
        String tel = UsuarioService.normalizarTelefono(telefono);
        if (tel == null || tel.replace("+", "").length() < 7) {
            throw new BadRequestException("Teléfono no válido");
        }
        String devCodigo = otpService.enviar(tel);
        return new OtpSendResponseDTO(true, devCodigo);
    }

    public LoginResponseDTO verificarYEntrar(String telefono, String codigo, String nombre) {
        String tel = UsuarioService.normalizarTelefono(telefono);
        if (tel == null || tel.replace("+", "").length() < 7) {
            throw new BadRequestException("Teléfono no válido");
        }
        if (!otpService.verificar(tel, codigo)) {
            throw new SecurityException("Código incorrecto");
        }

        Usuario usuario = usuarioDAO.findByTelefono(tel).orElseGet(() -> crearClientePorTelefono(tel, nombre));

        String token = jwtUtil.generateToken(usuario.getEmail(), usuario.getRole().name());
        return new LoginResponseDTO(
                usuario.getId(),
                usuario.getNombre(),
                usuario.getEmail(),
                usuario.getPuntos(),
                token
        );
    }

    private Usuario crearClientePorTelefono(String tel, String nombre) {
        Usuario nuevo = new Usuario();
        nuevo.setNombre(nombre != null && !nombre.isBlank() ? nombre.trim() : "Cliente " + tel.substring(tel.length() - 4));
        nuevo.setEmail(emailInternoPorTelefono(tel));
        // Sin contraseña local: hash aleatorio para que ningún login por
        // contraseña pueda entrar en esta cuenta.
        byte[] bytes = new byte[24];
        new SecureRandom().nextBytes(bytes);
        nuevo.setPassword(Base64.getEncoder().encodeToString(bytes));
        nuevo.setPuntos(0);
        nuevo.setRole(Role.ROLE_USER);
        nuevo.setTelefono(tel);

        Usuario guardado = usuarioDAO.save(nuevo);
        // Mismo patrón que register(): guardar, generar QR con el ID y volver a guardar
        guardado.setQrCode(qrService.generarQrUnico(guardado.getId()));
        guardado = usuarioDAO.save(guardado);
        return guardado;
    }

    private static String emailInternoPorTelefono(String tel) {
        String digitos = tel.replaceAll("[^0-9]", "");
        return "sms." + digitos + "@fidelyfood.local";
    }
}
