package progresa.springboot_tfg.service;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.dao.PromocionDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dto.*;
import progresa.springboot_tfg.entity.MovimientoPuntos;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Role;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;
import progresa.springboot_tfg.security.JwtUtil;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

@Service
public class RestauranteService {

    private final RestauranteDAO restauranteDAO;
    private final BCryptPasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final MovimientoPuntosDAO movimientoPuntosDAO;
    private final PromocionDAO promocionDAO;

    public RestauranteService(
            RestauranteDAO restauranteDAO,
            BCryptPasswordEncoder passwordEncoder,
            JwtUtil jwtUtil,
            MovimientoPuntosDAO movimientoPuntosDAO,
            PromocionDAO promocionDAO
    ) {
        this.restauranteDAO = restauranteDAO;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.movimientoPuntosDAO = movimientoPuntosDAO;
        this.promocionDAO = promocionDAO;
    }



    public Restaurante register(RestauranteRegisterRequestDTO dto) {

        Restaurante restaurante = new Restaurante();
        restaurante.setNombre(dto.getNombre());
        restaurante.setEmail(dto.getEmail());
        restaurante.setPassword(passwordEncoder.encode(dto.getPassword()));
        restaurante.setDireccion(dto.getDireccion());
        restaurante.setCiudad(dto.getCiudad());
        restaurante.setTelefono(dto.getTelefono());
        restaurante.setRole(Role.ROLE_RESTAURANT);

        return restauranteDAO.save(restaurante);
    }



    public RestauranteLoginResponseDTO login(RestauranteLoginRequestDTO dto) {

        Restaurante restaurante = restauranteDAO.findByEmail(dto.getEmail())
                .orElseThrow(() ->
                        new ResourceNotFoundException("Email no registrado"));

        if (!passwordEncoder.matches(dto.getPassword(), restaurante.getPassword())) {
            throw new RuntimeException("Credenciales incorrectas");
        }

        String token = jwtUtil.generateToken(
                restaurante.getEmail(),
                restaurante.getRole().name()
        );

        return new RestauranteLoginResponseDTO(
                restaurante.getId(),
                restaurante.getNombre(),
                restaurante.getEmail(),
                token
        );
    }



    private RestauranteDTO toDTO(Restaurante r) {
        return new RestauranteDTO(
                r.getId(),
                r.getNombre(),
                r.getDireccion(),
                r.getCiudad(),
                r.getTelefono(),
                r.getEmail(),
                r.getTipo(),
                r.getDescripcion(),
                r.getFoto(),
                r.getLatitud(),
                r.getLongitud()
        );
    }

    public List<RestauranteDTO> obtenerTodosDTO() {
        return restauranteDAO.findAll().stream().map(this::toDTO).toList();
    }

    public List<RestauranteDTO> obtenerCercanosDTO(double lat, double lng, double radioKm) {
        return restauranteDAO.findAll().stream()
                .filter(r -> r.getLatitud() != null && r.getLongitud() != null)
                .filter(r -> distanciaKm(lat, lng, r.getLatitud(), r.getLongitud()) <= radioKm)
                .map(this::toDTO)
                .toList();
    }

    public RestauranteDTO obtenerPorIdDTO(Long id) {
        Restaurante r = restauranteDAO.findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Restaurante no encontrado"));
        return toDTO(r);
    }

    public RestauranteDTO subirImagen(Long id, MultipartFile file, String emailAutenticado) {
        Restaurante restaurante = restauranteDAO.findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Restaurante no encontrado"));
        requireOwner(restaurante, emailAutenticado);

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
            Path uploadDir = Paths.get("uploads", "restaurantes").toAbsolutePath().normalize();
            Files.createDirectories(uploadDir);

            String extension = switch (contentType) {
                case "image/png" -> ".png";
                case "image/webp" -> ".webp";
                default -> ".jpg";
            };
            String filename = "restaurant_" + id + "_" + UUID.randomUUID().toString().substring(0, 8) + extension;
            Path target = uploadDir.resolve(filename).normalize();
            if (!target.startsWith(uploadDir)) {
                throw new BadRequestException("Nombre de archivo no permitido");
            }

            file.transferTo(target);

            restaurante.setFoto("/uploads/restaurantes/" + filename);
            return toDTO(restauranteDAO.save(restaurante));
        } catch (IOException e) {
            throw new RuntimeException("No se pudo guardar la imagen", e);
        }
    }

    public DashboardStatsDTO obtenerStats(Long id) {
        restauranteDAO.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Restaurante no encontrado"));

        List<MovimientoPuntos> movimientos = movimientoPuntosDAO.findByRestauranteId(id);

        int puntosOtorgados = movimientos.stream()
                .filter(m -> m.getPuntos() > 0)
                .mapToInt(MovimientoPuntos::getPuntos)
                .sum();
        int puntosCanjeados = movimientos.stream()
                .filter(m -> m.getPuntos() < 0)
                .mapToInt(m -> -m.getPuntos())
                .sum();
        int clientesUnicos = (int) movimientos.stream()
                .map(m -> m.getUsuario().getId())
                .distinct()
                .count();
        int promocionesActivas = promocionDAO.findByRestauranteId(id).size();

        List<MovimientoPuntosDTO> actividadReciente = movimientos.stream()
                .sorted((a, b) -> b.getFecha().compareTo(a.getFecha()))
                .limit(10)
                .map(m -> new MovimientoPuntosDTO(m.getPuntos(), m.getTipo(), m.getDescripcion(), m.getFecha()))
                .toList();

        return new DashboardStatsDTO(clientesUnicos, puntosOtorgados, puntosCanjeados, promocionesActivas, actividadReciente);
    }

    public RestauranteAdvancedStatsDTO obtenerStatsAvanzadas(Long id) {
        restauranteDAO.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Restaurante no encontrado"));

        List<MovimientoPuntos> movimientos = movimientoPuntosDAO.findByRestauranteId(id);

        double facturacionTotal = movimientos.stream()
                .filter(m -> m.getMonto() != null)
                .mapToDouble(MovimientoPuntos::getMonto)
                .sum();
        int puntosEntregados = movimientos.stream()
                .filter(m -> m.getPuntos() > 0)
                .mapToInt(MovimientoPuntos::getPuntos)
                .sum();
        int puntosCanjeados = movimientos.stream()
                .filter(m -> m.getPuntos() < 0)
                .mapToInt(m -> -m.getPuntos())
                .sum();
        int clientesAtendidos = (int) movimientos.stream()
                .map(m -> m.getUsuario().getId())
                .distinct()
                .count();
        int totalOperaciones = movimientos.size();
        double ticketPromedio = totalOperaciones == 0 ? 0 : facturacionTotal / totalOperaciones;

        List<MovimientoPuntosDTO> historialCompleto = movimientos.stream()
                .sorted((a, b) -> b.getFecha().compareTo(a.getFecha()))
                .map(m -> new MovimientoPuntosDTO(m.getPuntos(), m.getTipo(), m.getDescripcion(), m.getFecha()))
                .toList();

        return new RestauranteAdvancedStatsDTO(
                facturacionTotal, puntosEntregados, puntosCanjeados,
                clientesAtendidos, totalOperaciones, ticketPromedio, historialCompleto
        );
    }

    public void eliminar(Long id) {
        restauranteDAO.deleteById(id);
    }

    public void eliminarPropio(Long id, String emailAutenticado) {
        Restaurante restaurante = restauranteDAO.findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Restaurante no encontrado"));
        requireOwner(restaurante, emailAutenticado);
        restauranteDAO.delete(restaurante);
    }

    public Restaurante crear(Restaurante restaurante) {
        restaurante.setPassword(passwordEncoder.encode(restaurante.getPassword()));
        restaurante.setRole(Role.ROLE_RESTAURANT);
        return restauranteDAO.save(restaurante);
    }

    public Restaurante actualizar(Long id, Restaurante actualizado) {
        return actualizar(id, actualizado, null);
    }

    public Restaurante actualizar(Long id, Restaurante actualizado, String emailAutenticado) {

        Restaurante restaurante = restauranteDAO.findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Restaurante no encontrado"));

        if (emailAutenticado != null) {
            requireOwner(restaurante, emailAutenticado);
        }

        restaurante.setNombre(actualizado.getNombre());
        restaurante.setDireccion(actualizado.getDireccion());
        restaurante.setCiudad(actualizado.getCiudad());
        restaurante.setTelefono(actualizado.getTelefono());
        restaurante.setEmail(actualizado.getEmail());
        restaurante.setTipo(actualizado.getTipo());
        restaurante.setDescripcion(actualizado.getDescripcion());
        if (actualizado.getLatitud() != null) {
            restaurante.setLatitud(actualizado.getLatitud());
        }
        if (actualizado.getLongitud() != null) {
            restaurante.setLongitud(actualizado.getLongitud());
        }

        if (actualizado.getPassword() != null) {
            restaurante.setPassword(passwordEncoder.encode(actualizado.getPassword()));
        }

        return restauranteDAO.save(restaurante);
    }

    public Restaurante obtenerEntidadPorEmail(String email) {
        return restauranteDAO.findByEmail(email)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Restaurante no encontrado"));
    }

    private void requireOwner(Restaurante restaurante, String emailAutenticado) {
        if (emailAutenticado == null || !restaurante.getEmail().equalsIgnoreCase(emailAutenticado)) {
            throw new AccessDeniedException("No puedes acceder a datos de otro restaurante");
        }
    }

    private double distanciaKm(double lat1, double lon1, double lat2, double lon2) {
        double radioTierraKm = 6371.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return radioTierraKm * c;
    }
}
