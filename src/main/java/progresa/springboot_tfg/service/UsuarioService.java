package progresa.springboot_tfg.service;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.dto.*;
import progresa.springboot_tfg.entity.Role;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.exception.DuplicateResourceException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;
import progresa.springboot_tfg.security.JwtUtil;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

@Service
public class UsuarioService {

    private final UsuarioDAO usuarioDAO;
    private final BCryptPasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final QrService qrService;

    public UsuarioService(
            UsuarioDAO usuarioDAO,
            BCryptPasswordEncoder passwordEncoder,
            JwtUtil jwtUtil,
            QrService qrService
    ) {
        this.usuarioDAO = usuarioDAO;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.qrService = qrService;
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

    private UsuarioDTO toDTO(Usuario usuario) {
        return new UsuarioDTO(
                usuario.getId(),
                usuario.getNombre(),
                usuario.getEmail(),
                usuario.getPuntos(),
                usuario.getQrCode(),
                usuario.getCreatedAt(),
                usuario.getUpdatedAt(),
                usuario.getFotoPerfil()
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

    public UsuarioDTO obtenerPropio(Long id, String emailAutenticado) {
        Usuario usuario = usuarioDAO.findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Usuario no encontrado"));
        requireOwner(usuario, emailAutenticado);
        return toDTO(usuario);
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
        return actualizar(id, actualizado, null);
    }

    public UsuarioDTO actualizar(Long id, Usuario actualizado, String emailAutenticado) {
        Usuario usuario = usuarioDAO.findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Usuario no encontrado"));

        if (emailAutenticado != null) {
            requireOwner(usuario, emailAutenticado);
        }

        usuario.setNombre(actualizado.getNombre());
        usuario.setEmail(actualizado.getEmail());

        if (actualizado.getPassword() != null) {
            usuario.setPassword(passwordEncoder.encode(actualizado.getPassword()));
        }

        usuario.setPuntos(actualizado.getPuntos());

        return toDTO(usuarioDAO.save(usuario));
    }

    public void eliminar(Long id) {
        usuarioDAO.deleteById(id);
    }

    public void eliminarPropio(Long id, String emailAutenticado) {
        Usuario usuario = usuarioDAO.findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Usuario no encontrado"));
        requireOwner(usuario, emailAutenticado);
        usuarioDAO.delete(usuario);
    }

    public void changePassword(Long id, String currentPassword, String newPassword) {
        changePassword(id, currentPassword, newPassword, null);
    }

    public void changePassword(Long id, String currentPassword, String newPassword, String emailAutenticado) {
        Usuario usuario = usuarioDAO.findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Usuario no encontrado"));

        if (emailAutenticado != null) {
            requireOwner(usuario, emailAutenticado);
        }

        if (currentPassword == null || !passwordEncoder.matches(currentPassword, usuario.getPassword())) {
            throw new SecurityException("La contraseña actual no es correcta");
        }

        if (newPassword == null || newPassword.trim().length() < 8) {
            throw new IllegalArgumentException("La nueva contraseña debe tener al menos 8 caracteres");
        }

        usuario.setPassword(passwordEncoder.encode(newPassword.trim()));
        usuarioDAO.save(usuario);
    }

    public UsuarioDTO identificarPorQr(String qr) {
        String cleanQr = qr == null ? "" : qr.trim();
        if (cleanQr.isEmpty() || cleanQr.length() > 180) {
            throw new ResourceNotFoundException("QR no válido");
        }

        Usuario usuario = usuarioDAO.findByQrCode(cleanQr)
                .orElseThrow(() ->
                        new ResourceNotFoundException("QR no válido o cliente no encontrado"));

        return toDTO(usuario);
    }

    public String subirFoto(Long id, MultipartFile file, String emailAutenticado) {
        Usuario usuario = usuarioDAO.findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Usuario no encontrado"));
        requireOwner(usuario, emailAutenticado);

        if (file == null || file.isEmpty()) {
            throw new BadRequestException("No se pudo subir la imagen");
        }
        if (file.getSize() > 5 * 1024 * 1024) {
            throw new BadRequestException("Archivo demasiado grande. Máximo 5MB");
        }
        String contentType = file.getContentType();
        if (contentType == null || !List.of("image/jpeg", "image/png", "image/webp").contains(contentType)) {
            throw new BadRequestException("Formato no permitido. Usa JPG, JPEG, PNG o WEBP");
        }

        try {
            Path uploadDir = Paths.get("uploads", "perfiles").toAbsolutePath().normalize();
            Files.createDirectories(uploadDir);

            String extension = switch (contentType) {
                case "image/png" -> ".png";
                case "image/webp" -> ".webp";
                default -> ".jpg";
            };
            String filename = "usuario_" + id + "_" + UUID.randomUUID().toString().substring(0, 8) + extension;
            Path target = uploadDir.resolve(filename).normalize();
            if (!target.startsWith(uploadDir)) {
                throw new BadRequestException("Nombre de archivo no permitido");
            }

            file.transferTo(target);

            String publicPath = "/uploads/perfiles/" + filename;
            usuario.setFotoPerfil(publicPath);
            usuarioDAO.save(usuario);
            return publicPath;
        } catch (IOException e) {
            throw new RuntimeException("No se pudo guardar la imagen", e);
        }
    }

    private void requireOwner(Usuario usuario, String emailAutenticado) {
        if (emailAutenticado == null || !usuario.getEmail().equalsIgnoreCase(emailAutenticado)) {
            throw new AccessDeniedException("No puedes acceder a datos de otro usuario");
        }
    }
}
