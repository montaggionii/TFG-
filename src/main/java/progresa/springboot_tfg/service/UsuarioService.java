package progresa.springboot_tfg.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.dto.*;
import progresa.springboot_tfg.entity.Role;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.exception.DuplicateResourceException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;
import progresa.springboot_tfg.security.JwtUtil;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class UsuarioService {
    private static final Logger log = LoggerFactory.getLogger(UsuarioService.class);

    private final UsuarioDAO usuarioDAO;
    private final BCryptPasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final QrService qrService;
    private final ObjectMapper objectMapper;
    private static final Pattern USER_QR_PATTERN = Pattern.compile("^USER_(\\d+)_.*$");

    public UsuarioService(
            UsuarioDAO usuarioDAO,
            BCryptPasswordEncoder passwordEncoder,
            JwtUtil jwtUtil,
            QrService qrService,
            ObjectMapper objectMapper
    ) {
        this.usuarioDAO = usuarioDAO;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.qrService = qrService;
        this.objectMapper = objectMapper;
    }

    public Usuario register(RegisterRequestDTO dto) {

        if (usuarioDAO.findByEmail(dto.getEmail()).isPresent()) {
            throw new DuplicateResourceException("El email ya está registrado");
        }

        Usuario usuario = new Usuario();
        usuario.setNombre(dto.getNombre());
        usuario.setEmail(dto.getEmail());
        usuario.setPassword(passwordEncoder.encode(dto.getPassword()));
        usuario.setPuntos(0);
        usuario.setRole(Role.ROLE_USER);
        usuario.setActive(true);

        // 🔥 1. Guardar para obtener ID
        Usuario usuarioGuardado = usuarioDAO.save(usuario);

        // 🔥 2. Generar QR
        String qr = qrService.generarQrUnico(usuarioGuardado.getId());
        usuarioGuardado.setQrCode(qr);

        // 🔥 3. Guardar definitivamente
        usuarioGuardado = usuarioDAO.save(usuarioGuardado);

        return usuarioGuardado;
    }

    public LoginResponseDTO login(LoginRequestDTO loginDTO) {

        Usuario usuario = usuarioDAO.findByEmail(loginDTO.getEmail())
                .orElseThrow(() ->
                        new ResourceNotFoundException("Email no registrado"));

        if (!passwordEncoder.matches(loginDTO.getPassword(), usuario.getPassword())) {
            throw new RuntimeException("Credenciales incorrectas");
        }

        if (!usuario.isActive()) {
            throw new BadRequestException("La cuenta está desactivada");
        }

        String token = jwtUtil.generateToken(
                usuario.getEmail(),
                usuario.getRole().name()
        );

        return new LoginResponseDTO(
                usuario.getId(),
                usuario.getNombre(),
                usuario.getEmail(),
                usuario.getPuntos(),
                token
        );
    }

    public LoginResponseDTO loginAdmin(LoginRequestDTO loginDTO) {
        String email = loginDTO.getEmail();
        log.info("[ADMIN LOGIN] Intento de acceso admin para email={}", email);

        Optional<Usuario> usuarioOpt = usuarioDAO.findByEmail(email);
        log.info("[ADMIN LOGIN] Usuario existe={}", usuarioOpt.isPresent());

        Usuario usuario = usuarioOpt.orElseThrow(() ->
                new ResourceNotFoundException("Administrador no encontrado: " + email));

        boolean roleMatches = Role.ROLE_ADMIN.equals(usuario.getRole());
        boolean passwordMatches = passwordEncoder.matches(loginDTO.getPassword(), usuario.getPassword());
        boolean active = usuario.isActive();

        log.info("[ADMIN LOGIN] id={} email={} role={} roleMatches={} passwordMatches={} active={}",
                usuario.getId(), usuario.getEmail(), usuario.getRole(), roleMatches, passwordMatches, active);

        if (!roleMatches) {
            throw new BadRequestException("El usuario existe pero no tiene ROLE_ADMIN");
        }

        if (!passwordMatches) {
            throw new SecurityException("Contraseña de administrador incorrecta");
        }

        if (!active) {
            throw new BadRequestException("La cuenta administradora está desactivada");
        }

        String token = jwtUtil.generateToken(usuario.getEmail(), usuario.getRole().name());

        return new LoginResponseDTO(
                usuario.getId(),
                usuario.getNombre(),
                usuario.getEmail(),
                usuario.getPuntos(),
                token
        );
    }

    private UsuarioDTO toDTO(Usuario usuario) {
        return new UsuarioDTO(
                usuario.getId(),
                usuario.getNombre(),
                usuario.getEmail(),
                usuario.getPuntos(),
                usuario.getQrCode(),
                usuario.getFotoPerfil(),
                usuario.getTelefono(),
                usuario.getRole() != null ? usuario.getRole().name() : null,
                usuario.isActive(),
                usuario.getCreatedAt(),
                usuario.getUpdatedAt()
        );
    }

    public List<UsuarioDTO> obtenerTodos() {
        return usuarioDAO.findAll().stream().map(this::toDTO).toList();
    }

    public UsuarioDTO obtenerPorId(Long id) {
        Usuario usuario = usuarioDAO.findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Usuario no encontrado"));
        return toDTO(usuario);
    }

    public UsuarioDTO identificarPorQr(String qrRaw) {
        String valor = normalizarQr(qrRaw);
        if (valor.isBlank()) {
            throw new BadRequestException("QR no válido");
        }

        Optional<Usuario> porQrCode = usuarioDAO.findByQrCode(valor);
        if (porQrCode.isPresent()) {
            return toDTO(porQrCode.get());
        }

        Optional<Long> idExtraido = extraerIdUsuario(valor);
        if (idExtraido.isPresent()) {
            Usuario usuario = usuarioDAO.findById(idExtraido.get())
                    .orElseThrow(() ->
                            new ResourceNotFoundException("Cliente no encontrado"));
            return toDTO(usuario);
        }

        throw new ResourceNotFoundException("QR no válido o cliente no encontrado");
    }

    public UsuarioDTO crear(Usuario usuario) {
        usuario.setPassword(passwordEncoder.encode(usuario.getPassword()));

        Usuario usuarioGuardado = usuarioDAO.save(usuario);

        // 🔥 generar QR
        String qr = qrService.generarQrUnico(usuarioGuardado.getId());
        usuarioGuardado.setQrCode(qr);

        usuarioGuardado = usuarioDAO.save(usuarioGuardado);

        return toDTO(usuarioGuardado);
    }

    public UsuarioDTO actualizar(Long id, Usuario actualizado) {
        Usuario usuario = usuarioDAO.findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Usuario no encontrado"));

        usuario.setNombre(actualizado.getNombre());
        usuario.setEmail(actualizado.getEmail());
        usuario.setTelefono(actualizado.getTelefono());

        if (actualizado.getPassword() != null) {
            usuario.setPassword(passwordEncoder.encode(actualizado.getPassword()));
        }

        usuario.setPuntos(actualizado.getPuntos());

        if (actualizado.getFotoPerfil() != null) {
            usuario.setFotoPerfil(actualizado.getFotoPerfil());
        }

        return toDTO(usuarioDAO.save(usuario));
    }

    public UsuarioDTO actualizarFotoPerfil(Long id, String fotoPerfil) {
        Usuario usuario = usuarioDAO.findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Usuario no encontrado"));

        usuario.setFotoPerfil(fotoPerfil);
        return toDTO(usuarioDAO.save(usuario));
    }

    public void cambiarPassword(Long id, String currentPassword, String newPassword) {
        Usuario usuario = usuarioDAO.findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Usuario no encontrado"));

        if (currentPassword == null || !passwordEncoder.matches(currentPassword, usuario.getPassword())) {
            throw new SecurityException("La contraseña actual no es correcta");
        }

        if (newPassword == null || newPassword.length() < 8) {
            throw new BadRequestException("La nueva contraseña debe tener al menos 8 caracteres");
        }

        usuario.setPassword(passwordEncoder.encode(newPassword));
        usuarioDAO.save(usuario);
    }

    public void eliminar(Long id) {
        usuarioDAO.deleteById(id);
    }

    private String normalizarQr(String qrRaw) {
        return URLDecoder.decode(String.valueOf(qrRaw == null ? "" : qrRaw), StandardCharsets.UTF_8).trim();
    }

    private Optional<Long> extraerIdUsuario(String valor) {
        Optional<Long> idDesdeJson = extraerIdDesdeJson(valor);
        if (idDesdeJson.isPresent()) return idDesdeJson;

        Optional<Long> idDesdeUrl = extraerIdDesdeUrl(valor);
        if (idDesdeUrl.isPresent()) return idDesdeUrl;

        if (valor.startsWith("FIDELITY_ID:")) {
            return parseLongSeguro(valor.substring("FIDELITY_ID:".length()).trim());
        }

        Matcher userMatcher = USER_QR_PATTERN.matcher(valor);
        if (userMatcher.matches()) {
            return parseLongSeguro(userMatcher.group(1));
        }

        return parseLongSeguro(valor);
    }

    private Optional<Long> extraerIdDesdeJson(String valor) {
        if (!valor.startsWith("{")) return Optional.empty();

        try {
            JsonNode root = objectMapper.readTree(valor);
            for (String field : List.of("idUsuario", "usuarioId", "userId", "clienteId", "id")) {
                JsonNode node = root.get(field);
                if (node != null) {
                    Optional<Long> parsed = parseLongSeguro(node.asText());
                    if (parsed.isPresent()) return parsed;
                }
            }
            for (String field : List.of("qrCode", "codigoQr", "qr", "userQr")) {
                JsonNode node = root.get(field);
                if (node != null) {
                    Optional<Long> parsed = extraerIdUsuario(node.asText());
                    if (parsed.isPresent()) return parsed;
                }
            }
        } catch (Exception ignored) {
            return Optional.empty();
        }

        return Optional.empty();
    }

    private Optional<Long> extraerIdDesdeUrl(String valor) {
        if (!valor.startsWith("http://") && !valor.startsWith("https://")) return Optional.empty();

        String query = "";
        int queryIndex = valor.indexOf('?');
        if (queryIndex >= 0 && queryIndex < valor.length() - 1) {
            query = valor.substring(queryIndex + 1);
        }

        for (String param : query.split("&")) {
            String[] parts = param.split("=", 2);
            if (parts.length == 2 && List.of("idUsuario", "usuarioId", "userId", "clienteId", "id").contains(parts[0])) {
                Optional<Long> parsed = parseLongSeguro(parts[1]);
                if (parsed.isPresent()) return parsed;
            }
        }

        String withoutQuery = queryIndex >= 0 ? valor.substring(0, queryIndex) : valor;
        int lastSlash = withoutQuery.lastIndexOf('/');
        if (lastSlash >= 0 && lastSlash < withoutQuery.length() - 1) {
            return extraerIdUsuario(withoutQuery.substring(lastSlash + 1));
        }

        return Optional.empty();
    }

    private Optional<Long> parseLongSeguro(String valor) {
        try {
            String clean = String.valueOf(valor == null ? "" : valor).trim();
            if (!clean.matches("\\d+")) return Optional.empty();
            return Optional.of(Long.parseLong(clean));
        } catch (NumberFormatException ex) {
            return Optional.empty();
        }
    }
}
