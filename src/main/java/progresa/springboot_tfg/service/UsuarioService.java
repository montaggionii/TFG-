package progresa.springboot_tfg.service;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.dto.*;
import progresa.springboot_tfg.entity.Role;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.exception.DuplicateResourceException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;
import progresa.springboot_tfg.security.JwtUtil;

import java.util.List;

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
                usuario.getQrCode()
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

        if (actualizado.getPassword() != null) {
            usuario.setPassword(passwordEncoder.encode(actualizado.getPassword()));
        }

        usuario.setPuntos(actualizado.getPuntos());

        return toDTO(usuarioDAO.save(usuario));
    }

    public void eliminar(Long id) {
        usuarioDAO.deleteById(id);
    }
}