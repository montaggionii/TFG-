package progresa.springboot_tfg.service;

import org.springframework.stereotype.Service;
import progresa.springboot_tfg.dao.*;
import progresa.springboot_tfg.dto.RestauranteDTO;
import progresa.springboot_tfg.dto.UsuarioDTO;
import progresa.springboot_tfg.entity.*;
import progresa.springboot_tfg.exception.ResourceNotFoundException;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AdminService {

    private final UsuarioDAO usuarioDAO;
    private final RestauranteDAO restauranteDAO;
    private final MovimientoPuntosDAO movimientoPuntosDAO;
    private final CanjeDAO canjeDAO;
    private final PromocionDAO promocionDAO;
    private final AdminLogDAO adminLogDAO;

    public AdminService(
            UsuarioDAO usuarioDAO,
            RestauranteDAO restauranteDAO,
            MovimientoPuntosDAO movimientoPuntosDAO,
            CanjeDAO canjeDAO,
            PromocionDAO promocionDAO,
            AdminLogDAO adminLogDAO
    ) {
        this.usuarioDAO = usuarioDAO;
        this.restauranteDAO = restauranteDAO;
        this.movimientoPuntosDAO = movimientoPuntosDAO;
        this.canjeDAO = canjeDAO;
        this.promocionDAO = promocionDAO;
        this.adminLogDAO = adminLogDAO;
    }

    public Map<String, Object> dashboard() {
        LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        LocalDateTime tomorrowStart = todayStart.plusDays(1);

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("totalBusinesses", restauranteDAO.count());
        data.put("totalClients", usuarioDAO.countByRole(Role.ROLE_USER));
        data.put("totalReservations", 0);
        data.put("reservationsToday", 0);
        data.put("pendingReservations", 0);
        data.put("confirmedReservations", 0);
        data.put("cancelledReservations", 0);
        data.put("totalMovements", movimientoPuntosDAO.count());
        data.put("movementsToday", movimientoPuntosDAO.countByFechaBetween(todayStart, tomorrowStart));
        data.put("totalRewardsRedeemed", canjeDAO.count());
        data.put("totalPromotions", promocionDAO.count());
        data.put("recentBusinesses", restauranteDAO.findTop5ByOrderByCreatedAtDesc().stream().map(this::toRestauranteDTO).toList());
        data.put("recentClients", usuarioDAO.findTop5ByRoleOrderByCreatedAtDesc(Role.ROLE_USER).stream().map(this::toUsuarioDTO).toList());
        data.put("recentActivity", movimientoPuntosDAO.findTop10ByOrderByFechaDesc().stream().map(this::movementSummary).toList());
        data.put("recentLogs", adminLogDAO.findTop20ByOrderByCreatedAtDesc());
        return data;
    }

    public List<RestauranteDTO> businesses() {
        return restauranteDAO.findAll().stream().map(this::toRestauranteDTO).toList();
    }

    public RestauranteDTO business(Long id) {
        return toRestauranteDTO(getRestaurante(id));
    }

    public RestauranteDTO updateBusiness(Long id, Restaurante changes, String adminEmail) {
        Restaurante restaurante = getRestaurante(id);
        restaurante.setNombre(coalesce(changes.getNombre(), restaurante.getNombre()));
        restaurante.setEmail(coalesce(changes.getEmail(), restaurante.getEmail()));
        restaurante.setTelefono(coalesce(changes.getTelefono(), restaurante.getTelefono()));
        restaurante.setDireccion(coalesce(changes.getDireccion(), restaurante.getDireccion()));
        restaurante.setCiudad(coalesce(changes.getCiudad(), restaurante.getCiudad()));
        restaurante.setDescripcion(coalesce(changes.getDescripcion(), restaurante.getDescripcion()));
        restaurante.setTipo(coalesce(changes.getTipo(), restaurante.getTipo()));
        restaurante.setCodigoPostal(coalesce(changes.getCodigoPostal(), restaurante.getCodigoPostal()));
        saveLog("BUSINESS_UPDATED", "Restaurante", id, adminEmail, "Datos básicos del negocio actualizados");
        return toRestauranteDTO(restauranteDAO.save(restaurante));
    }

    public RestauranteDTO setBusinessActive(Long id, boolean active, String adminEmail) {
        Restaurante restaurante = getRestaurante(id);
        restaurante.setActive(active);
        saveLog(active ? "BUSINESS_ACTIVATED" : "BUSINESS_DEACTIVATED", "Restaurante", id, adminEmail,
                "Estado activo cambiado a " + active);
        return toRestauranteDTO(restauranteDAO.save(restaurante));
    }

    public List<UsuarioDTO> clients() {
        return usuarioDAO.findAll().stream()
                .filter(usuario -> Role.ROLE_USER.equals(usuario.getRole()))
                .map(this::toUsuarioDTO)
                .toList();
    }

    public UsuarioDTO client(Long id) {
        Usuario usuario = getUsuario(id);
        if (!Role.ROLE_USER.equals(usuario.getRole())) {
            throw new ResourceNotFoundException("Cliente no encontrado");
        }
        return toUsuarioDTO(usuario);
    }

    public UsuarioDTO updateClient(Long id, Usuario changes, String adminEmail) {
        Usuario usuario = getUsuario(id);
        if (!Role.ROLE_USER.equals(usuario.getRole())) {
            throw new ResourceNotFoundException("Cliente no encontrado");
        }
        usuario.setNombre(coalesce(changes.getNombre(), usuario.getNombre()));
        usuario.setEmail(coalesce(changes.getEmail(), usuario.getEmail()));
        usuario.setTelefono(coalesce(changes.getTelefono(), usuario.getTelefono()));
        usuario.setFotoPerfil(coalesce(changes.getFotoPerfil(), usuario.getFotoPerfil()));
        saveLog("CLIENT_UPDATED", "Usuario", id, adminEmail, "Datos básicos del cliente actualizados");
        return toUsuarioDTO(usuarioDAO.save(usuario));
    }

    public UsuarioDTO setClientActive(Long id, boolean active, String adminEmail) {
        Usuario usuario = getUsuario(id);
        if (!Role.ROLE_USER.equals(usuario.getRole())) {
            throw new ResourceNotFoundException("Cliente no encontrado");
        }
        usuario.setActive(active);
        saveLog(active ? "CLIENT_ACTIVATED" : "CLIENT_DEACTIVATED", "Usuario", id, adminEmail,
                "Estado activo cambiado a " + active);
        return toUsuarioDTO(usuarioDAO.save(usuario));
    }

    public List<Map<String, Object>> reservations() {
        return List.of();
    }

    public Map<String, Object> stats() {
        List<MovimientoPuntos> movements = movimientoPuntosDAO.findAll();

        Map<String, Long> movementsByDay = movements.stream()
                .filter(m -> m.getFecha() != null)
                .collect(Collectors.groupingBy(m -> m.getFecha().toLocalDate().toString(), TreeMap::new, Collectors.counting()));

        Map<String, Long> movementsByRestaurant = movements.stream()
                .filter(m -> m.getRestaurante() != null)
                .collect(Collectors.groupingBy(m -> m.getRestaurante().getNombre(), Collectors.counting()));

        Map<String, Long> clientsByDay = usuarioDAO.findAll().stream()
                .filter(u -> Role.ROLE_USER.equals(u.getRole()))
                .filter(u -> u.getCreatedAt() != null)
                .collect(Collectors.groupingBy(u -> u.getCreatedAt().toLocalDate().toString(), TreeMap::new, Collectors.counting()));

        Map<String, Long> businessesByDay = restauranteDAO.findAll().stream()
                .filter(r -> r.getCreatedAt() != null)
                .collect(Collectors.groupingBy(r -> r.getCreatedAt().toLocalDate().toString(), TreeMap::new, Collectors.counting()));

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("reservationsByDay", Map.of());
        data.put("reservationsByBusiness", Map.of());
        data.put("confirmedVsCancelled", Map.of("confirmed", 0, "cancelled", 0));
        data.put("businessesWithMostReservations", List.of());
        data.put("movementsByDay", movementsByDay);
        data.put("movementsByRestaurant", movementsByRestaurant);
        data.put("clientsByDay", clientsByDay);
        data.put("businessesByDay", businessesByDay);
        data.put("recentActivity", movimientoPuntosDAO.findTop10ByOrderByFechaDesc().stream().map(this::movementSummary).toList());
        return data;
    }

    public List<AdminLog> logs() {
        return adminLogDAO.findTop20ByOrderByCreatedAtDesc();
    }

    private Restaurante getRestaurante(Long id) {
        return restauranteDAO.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Restaurante no encontrado"));
    }

    private Usuario getUsuario(Long id) {
        return usuarioDAO.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Usuario no encontrado"));
    }

    private void saveLog(String action, String entityType, Long entityId, String adminEmail, String details) {
        adminLogDAO.save(new AdminLog(action, entityType, entityId, adminEmail, details));
    }

    private RestauranteDTO toRestauranteDTO(Restaurante r) {
        return new RestauranteDTO(
                r.getId(),
                r.getNombre(),
                r.getDireccion(),
                r.getCiudad(),
                r.getTelefono(),
                r.getEmail(),
                r.getDescripcion(),
                r.getImagen(),
                r.getImagenUrl(),
                r.getTipo(),
                r.getLatitud(),
                r.getLongitud(),
                r.getCodigoPostal(),
                r.isActive(),
                r.getCreatedAt(),
                r.getUpdatedAt()
        );
    }

    private UsuarioDTO toUsuarioDTO(Usuario usuario) {
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

    private Map<String, Object> movementSummary(MovimientoPuntos movimiento) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("id", movimiento.getId());
        data.put("tipo", movimiento.getTipo());
        data.put("descripcion", movimiento.getDescripcion());
        data.put("puntos", movimiento.getPuntos());
        data.put("monto", movimiento.getMonto());
        data.put("fecha", movimiento.getFecha());
        data.put("cliente", movimiento.getUsuario() != null ? movimiento.getUsuario().getNombre() : null);
        data.put("negocio", movimiento.getRestaurante() != null ? movimiento.getRestaurante().getNombre() : null);
        return data;
    }

    private String coalesce(String value, String fallback) {
        return value == null ? fallback : value;
    }
}
