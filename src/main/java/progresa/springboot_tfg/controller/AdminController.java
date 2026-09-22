package progresa.springboot_tfg.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import progresa.springboot_tfg.dao.AdminLogDAO;
import progresa.springboot_tfg.dao.AdminReservationDAO;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.*;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.exception.DuplicateResourceException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(origins = "*")
public class AdminController {

    private static final Set<String> POINT_TYPES = Set.of(
            "AJUSTE_ADMIN",
            "BONIFICACION_ADMIN",
            "CORRECCION_ADMIN",
            "PENALIZACION_ADMIN"
    );

    private final UsuarioDAO usuarioDAO;
    private final RestauranteDAO restauranteDAO;
    private final MovimientoPuntosDAO movimientoPuntosDAO;
    private final AdminLogDAO adminLogDAO;
    private final AdminReservationDAO adminReservationDAO;

    public AdminController(
            UsuarioDAO usuarioDAO,
            RestauranteDAO restauranteDAO,
            MovimientoPuntosDAO movimientoPuntosDAO,
            AdminLogDAO adminLogDAO,
            AdminReservationDAO adminReservationDAO
    ) {
        this.usuarioDAO = usuarioDAO;
        this.restauranteDAO = restauranteDAO;
        this.movimientoPuntosDAO = movimientoPuntosDAO;
        this.adminLogDAO = adminLogDAO;
        this.adminReservationDAO = adminReservationDAO;
    }

    @GetMapping("/dashboard")
    public ResponseEntity<?> dashboard() {
        List<Usuario> clients = activeClients();
        List<Restaurante> businesses = activeBusinesses();
        List<AdminReservation> reservations = activeReservations();
        LocalDateTime startToday = LocalDateTime.now().toLocalDate().atStartOfDay();
        LocalDateTime endToday = startToday.plusDays(1);
        List<Map<String, Object>> recentActivity = adminLogDAO.findAll().stream()
                .sorted(Comparator.comparing(AdminLog::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(8)
                .map(this::adminLogDto)
                .toList();

        Map<String, Object> dashboard = new LinkedHashMap<>();
        dashboard.put("totalBusinesses", businesses.size());
        dashboard.put("totalClients", clients.size());
        dashboard.put("totalReservations", reservations.size());
        dashboard.put("reservationsToday", reservations.stream().filter(r -> r.getDate() != null && !r.getDate().isBefore(startToday) && r.getDate().isBefore(endToday)).count());
        dashboard.put("pendingReservations", reservations.stream().filter(r -> "PENDING".equals(r.getStatus())).count());
        dashboard.put("confirmedReservations", reservations.stream().filter(r -> "CONFIRMED".equals(r.getStatus())).count());
        dashboard.put("cancelledReservations", reservations.stream().filter(r -> "CANCELLED".equals(r.getStatus())).count());
        dashboard.put("movementsToday", movimientoPuntosDAO.findAll().stream().filter(m -> m.getFecha() != null && !m.getFecha().isBefore(startToday) && m.getFecha().isBefore(endToday)).count());
        dashboard.put("recentBusinesses", businesses.stream().limit(5).map(this::businessDto).toList());
        dashboard.put("recentClients", clients.stream().limit(5).map(this::clientDto).toList());
        dashboard.put("recentReservations", reservations.stream().limit(5).map(this::reservationDto).toList());
        dashboard.put("recentActivity", recentActivity);

        return ResponseEntity.ok(dashboard);
    }

    @GetMapping("/businesses")
    public ResponseEntity<?> businesses(
            @RequestParam(required = false) String search,
            @RequestParam(required = false, defaultValue = "all") String status,
            @RequestParam(required = false, defaultValue = "nombre") String sort
    ) {
        List<Restaurante> base = activeBusinesses();
        List<Map<String, Object>> content = base.stream()
                .filter(item -> matchesBusinessSearch(item, search))
                .filter(item -> matchesBusinessStatus(item, status))
                .sorted(businessComparator(sort))
                .map(this::businessDto)
                .toList();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("content", content);
        response.put("items", content);
        response.put("totalBusinesses", base.size());
        response.put("activeBusinesses", base.stream().filter(b -> Boolean.TRUE.equals(b.getActive())).count());
        response.put("inactiveBusinesses", base.stream().filter(b -> !Boolean.TRUE.equals(b.getActive())).count());
        response.put("withCity", base.stream().filter(b -> b.getCiudad() != null && !b.getCiudad().isBlank()).count());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/businesses/{id}")
    public ResponseEntity<?> businessDetail(@PathVariable Long id) {
        Restaurante business = requireBusiness(id);
        Map<String, Object> dto = businessDto(business);
        dto.put("movements", movimientoPuntosDAO.findAll().stream()
                .filter(m -> m.getRestaurante() != null && id.equals(m.getRestaurante().getId()))
                .sorted(Comparator.comparing(MovimientoPuntos::getFecha, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(20)
                .map(this::movementDto)
                .toList());
        dto.put("reservations", activeReservations().stream()
                .filter(r -> r.getRestaurante() != null && id.equals(r.getRestaurante().getId()))
                .map(this::reservationDto)
                .toList());
        dto.put("adminLogs", adminLogDAO.findByEntityTypeAndEntityIdOrderByCreatedAtDesc("BUSINESS", id).stream().map(this::adminLogDto).toList());
        return ResponseEntity.ok(dto);
    }

    @PutMapping("/businesses/{id}")
    public ResponseEntity<?> updateBusiness(@PathVariable Long id, @RequestBody Map<String, Object> data) {
        Restaurante item = requireBusiness(id);
        String oldData = compactBusiness(item);
        String email = value(data, "email", item.getEmail()).trim().toLowerCase();
        if (!email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) throw new BadRequestException("Email de negocio no válido.");
        if (restauranteDAO.existsByEmailAndIdNot(email, id)) throw new DuplicateResourceException("Ya existe otro negocio con ese email.");
        item.setNombre(value(data, "nombre", item.getNombre()).trim());
        if (item.getNombre().isBlank()) throw new BadRequestException("El nombre del negocio es obligatorio.");
        item.setEmail(email);
        item.setTelefono(blankToNull(nullableValue(data, "telefono")));
        item.setCiudad(blankToNull(nullableValue(data, "ciudad")));
        item.setDireccion(blankToNull(nullableValue(data, "direccion")));
        item.setTipo(blankToNull(nullableValue(data, "tipo")));
        item.setDescripcion(blankToNull(nullableValue(data, "descripcion")));
        item.setFoto(blankToNull(nullableValue(data, "foto")));
        if (data.containsKey("active")) item.setActive(bool(data.get("active")));
        Restaurante saved = restauranteDAO.save(item);
        logEntity("BUSINESS_UPDATED", "BUSINESS", id, "Negocio actualizado", oldData, compactBusiness(saved));
        return ResponseEntity.ok(businessDetail(id).getBody());
    }

    @PatchMapping("/businesses/{id}/active")
    public ResponseEntity<?> setBusinessActiveLegacy(@PathVariable Long id, @RequestBody(required = false) Map<String, Object> data) {
        return setBusinessStatus(id, data == null ? Map.of("active", true) : data);
    }

    @PatchMapping("/businesses/{id}/status")
    public ResponseEntity<?> setBusinessStatus(@PathVariable Long id, @RequestBody Map<String, Object> data) {
        Restaurante item = requireBusiness(id);
        String oldData = compactBusiness(item);
        boolean active = bool(data.get("active"));
        item.setActive(active);
        Restaurante saved = restauranteDAO.save(item);
        logEntity(active ? "BUSINESS_ACTIVATED" : "BUSINESS_DEACTIVATED", "BUSINESS", id,
                active ? "Negocio activado" : "Negocio desactivado", oldData, compactBusiness(saved));
        return ResponseEntity.ok(businessDto(saved));
    }

    @DeleteMapping("/businesses/{id}")
    public ResponseEntity<?> softDeleteBusiness(@PathVariable Long id) {
        Restaurante item = requireBusiness(id);
        String oldData = compactBusiness(item);
        item.setActive(false);
        item.setDeleted(true);
        item.setDeletedAt(LocalDateTime.now());
        item.setDeletedByAdminEmail(adminEmail());
        Restaurante saved = restauranteDAO.save(item);
        logEntity("BUSINESS_SOFT_DELETED", "BUSINESS", id, "Negocio eliminado de forma lógica", oldData, compactBusiness(saved));
        return ResponseEntity.ok(businessDto(saved));
    }

    @GetMapping("/clients")
    public ResponseEntity<?> clients(
            @RequestParam(required = false) String search,
            @RequestParam(required = false, defaultValue = "all") String status,
            @RequestParam(required = false, defaultValue = "all") String points,
            @RequestParam(required = false) Integer minPoints,
            @RequestParam(required = false) Integer maxPoints,
            @RequestParam(required = false, defaultValue = "nombre") String sort,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "250") int size
    ) {
        List<Usuario> base = activeAndDeletedVisibleClients();
        List<Usuario> filtered = base.stream()
                .filter(item -> matchesSearch(item, search))
                .filter(item -> matchesStatus(item, status))
                .filter(item -> matchesPoints(item, points, minPoints, maxPoints))
                .sorted(clientComparator(sort))
                .toList();

        int safeSize = Math.max(1, Math.min(size, 500));
        int from = Math.max(0, page) * safeSize;
        int to = Math.min(filtered.size(), from + safeSize);
        List<Map<String, Object>> content = from >= filtered.size()
                ? List.of()
                : filtered.subList(from, to).stream().map(this::clientDto).toList();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("content", content);
        response.put("items", content);
        response.put("total", filtered.size());
        response.put("totalClients", base.size());
        response.put("activeClients", base.stream().filter(u -> Boolean.TRUE.equals(u.getActive())).count());
        response.put("inactiveClients", base.stream().filter(u -> !Boolean.TRUE.equals(u.getActive())).count());
        response.put("clientsWithPoints", base.stream().filter(u -> u.getPuntos() > 0).count());
        response.put("page", page);
        response.put("size", safeSize);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/clients/{id}")
    public ResponseEntity<?> clientDetail(@PathVariable Long id) {
        Usuario client = requireClient(id);
        return ResponseEntity.ok(clientDetailDto(client));
    }

    @PutMapping("/clients/{id}")
    public ResponseEntity<?> updateClient(@PathVariable Long id, @RequestBody Map<String, Object> data) {
        Usuario client = requireClient(id);
        ensureEditableClient(client);

        String oldData = compactClient(client);
        String nombre = value(data, "nombre", client.getNombre()).trim();
        String email = value(data, "email", client.getEmail()).trim().toLowerCase();
        String telefono = nullableValue(data, "telefono");
        String fotoPerfil = nullableValue(data, "fotoPerfil");

        validateClientInput(nombre, email, telefono);
        if (usuarioDAO.existsByEmailAndIdNot(email, id)) {
            throw new DuplicateResourceException("Ya existe otro cliente con ese email.");
        }

        client.setNombre(nombre);
        client.setEmail(email);
        client.setTelefono(blankToNull(telefono));
        client.setFotoPerfil(blankToNull(fotoPerfil));
        if (data.containsKey("active")) {
            client.setActive(bool(data.get("active")));
        }

        Usuario saved = usuarioDAO.save(client);
        log("CLIENT_UPDATED", id, "Cliente actualizado", oldData, compactClient(saved));
        return ResponseEntity.ok(clientDetailDto(saved));
    }

    @PatchMapping("/clients/{id}/active")
    public ResponseEntity<?> setClientActiveLegacy(@PathVariable Long id, @RequestBody Map<String, Object> data) {
        return setClientStatus(id, data);
    }

    @PatchMapping("/clients/{id}/status")
    public ResponseEntity<?> setClientStatus(@PathVariable Long id, @RequestBody Map<String, Object> data) {
        Usuario client = requireClient(id);
        ensureEditableClient(client);
        String oldData = compactClient(client);
        boolean active = bool(data.get("active"));
        client.setActive(active);
        Usuario saved = usuarioDAO.save(client);
        log(active ? "CLIENT_ACTIVATED" : "CLIENT_DEACTIVATED", id,
                active ? "Cliente activado" : "Cliente desactivado", oldData, compactClient(saved));
        return ResponseEntity.ok(clientDetailDto(saved));
    }

    @PostMapping("/clients/{id}/points/add")
    public ResponseEntity<?> addPoints(@PathVariable Long id, @RequestBody Map<String, Object> data) {
        return applyPointChange(id, data, "add");
    }

    @PostMapping("/clients/{id}/points/subtract")
    public ResponseEntity<?> subtractPoints(@PathVariable Long id, @RequestBody Map<String, Object> data) {
        return applyPointChange(id, data, "subtract");
    }

    @PostMapping("/clients/{id}/points/set")
    public ResponseEntity<?> setPoints(@PathVariable Long id, @RequestBody Map<String, Object> data) {
        return applyPointChange(id, data, "set");
    }

    @GetMapping("/clients/{id}/points/history")
    public ResponseEntity<?> pointsHistory(
            @PathVariable Long id,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) Long restaurantId
    ) {
        Usuario client = requireClient(id);
        List<Map<String, Object>> movements = movimientoPuntosDAO.findByUsuarioOrderByFechaDesc(client).stream()
                .filter(m -> type == null || type.isBlank() || type.equalsIgnoreCase(m.getTipo()))
                .filter(m -> restaurantId == null || (m.getRestaurante() != null && restaurantId.equals(m.getRestaurante().getId())))
                .map(this::movementDto)
                .toList();
        return ResponseEntity.ok(movements);
    }

    @GetMapping("/clients/{id}/activity")
    public ResponseEntity<?> activity(@PathVariable Long id) {
        Usuario client = requireClient(id);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("movements", movimientoPuntosDAO.findByUsuarioOrderByFechaDesc(client).stream().limit(20).map(this::movementDto).toList());
        response.put("adminLogs", adminLogDAO.findByEntityTypeAndEntityIdOrderByCreatedAtDesc("CLIENT", id).stream().map(this::adminLogDto).toList());
        response.put("redemptions", List.of());
        response.put("promotions", List.of());
        response.put("restaurantsVisited", restaurantsVisited(client));
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/clients/{id}")
    public ResponseEntity<?> softDeleteClient(@PathVariable Long id) {
        Usuario client = requireClient(id);
        ensureEditableClient(client);
        String oldData = compactClient(client);
        client.setActive(false);
        client.setDeleted(true);
        client.setDeletedAt(LocalDateTime.now());
        client.setDeletedByAdminEmail(adminEmail());
        Usuario saved = usuarioDAO.save(client);
        log("CLIENT_SOFT_DELETED", id, "Cliente eliminado de forma lógica", oldData, compactClient(saved));
        return ResponseEntity.ok(clientDetailDto(saved));
    }

    @DeleteMapping("/clients/{id}/hard")
    public ResponseEntity<?> hardDeleteClient(@PathVariable Long id, @RequestParam(required = false) String confirm) {
        if (!"DELETE_PERMANENTLY".equals(confirm)) {
            throw new BadRequestException("Confirmación requerida: DELETE_PERMANENTLY.");
        }
        throw new BadRequestException("La eliminación definitiva está deshabilitada para proteger el histórico.");
    }

    @GetMapping("/reservations")
    public ResponseEntity<?> reservations(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long businessId
    ) {
        List<Map<String, Object>> content = activeReservations().stream()
                .filter(r -> search == null || search.isBlank()
                        || contains(r.getClientName(), search.toLowerCase())
                        || contains(r.getClientEmail(), search.toLowerCase())
                        || contains(r.getBusinessName(), search.toLowerCase()))
                .filter(r -> status == null || status.isBlank() || status.equals(r.getStatus()))
                .filter(r -> businessId == null || (r.getRestaurante() != null && businessId.equals(r.getRestaurante().getId())))
                .map(this::reservationDto)
                .toList();
        return ResponseEntity.ok(content);
    }

    @PostMapping("/reservations")
    public ResponseEntity<?> createReservation(@RequestBody Map<String, Object> data) {
        AdminReservation reservation = new AdminReservation();
        applyReservationData(reservation, data);
        AdminReservation saved = adminReservationDAO.save(reservation);
        logEntity("RESERVATION_CREATED", "RESERVATION", saved.getId(), "Reserva creada por administrador", null, compactReservation(saved));
        return ResponseEntity.ok(reservationDto(saved));
    }

    @PutMapping("/reservations/{id}")
    public ResponseEntity<?> updateReservation(@PathVariable Long id, @RequestBody Map<String, Object> data) {
        AdminReservation reservation = requireReservation(id);
        String oldData = compactReservation(reservation);
        applyReservationData(reservation, data);
        AdminReservation saved = adminReservationDAO.save(reservation);
        logEntity("RESERVATION_UPDATED", "RESERVATION", id, "Reserva actualizada", oldData, compactReservation(saved));
        return ResponseEntity.ok(reservationDto(saved));
    }

    @PatchMapping("/reservations/{id}/status")
    public ResponseEntity<?> updateReservationStatus(@PathVariable Long id, @RequestBody Map<String, Object> data) {
        AdminReservation reservation = requireReservation(id);
        String oldData = compactReservation(reservation);
        String status = value(data, "status", reservation.getStatus()).trim().toUpperCase();
        if (!Set.of("PENDING", "CONFIRMED", "CANCELLED").contains(status)) {
            throw new BadRequestException("Estado de reserva no válido.");
        }
        reservation.setStatus(status);
        AdminReservation saved = adminReservationDAO.save(reservation);
        logEntity("RESERVATION_STATUS_CHANGED", "RESERVATION", id, "Estado de reserva cambiado a " + status, oldData, compactReservation(saved));
        return ResponseEntity.ok(reservationDto(saved));
    }

    @DeleteMapping("/reservations/{id}")
    public ResponseEntity<?> deleteReservation(@PathVariable Long id) {
        AdminReservation reservation = requireReservation(id);
        String oldData = compactReservation(reservation);
        reservation.setDeleted(true);
        reservation.setDeletedAt(LocalDateTime.now());
        reservation.setDeletedByAdminEmail(adminEmail());
        AdminReservation saved = adminReservationDAO.save(reservation);
        logEntity("RESERVATION_SOFT_DELETED", "RESERVATION", id, "Reserva eliminada de forma lógica", oldData, compactReservation(saved));
        return ResponseEntity.ok(reservationDto(saved));
    }

    @GetMapping("/stats")
    public ResponseEntity<?> stats() {
        List<Usuario> clients = activeClients();
        List<Restaurante> businesses = activeBusinesses();
        List<MovimientoPuntos> movements = movimientoPuntosDAO.findAll();
        List<AdminReservation> reservations = activeReservations();
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalClients", clients.size());
        stats.put("totalBusinesses", businesses.size());
        stats.put("totalReservations", reservations.size());
        stats.put("totalPoints", clients.stream().mapToInt(Usuario::getPuntos).sum());
        stats.put("clientsByDay", countByDay(clients.stream().map(Usuario::getCreatedAt).toList()));
        stats.put("businessesByDay", countByDay(businesses.stream().map(Restaurante::getCreatedAt).toList()));
        stats.put("movementsByDay", countByDay(movements.stream().map(MovimientoPuntos::getFecha).toList()));
        stats.put("reservationsByStatus", countReservationsByStatus(reservations));
        stats.put("movementsByRestaurant", movementsByRestaurant(movements));
        stats.put("topClientsByPoints", clients.stream().sorted(Comparator.comparingInt(Usuario::getPuntos).reversed()).limit(6).map(this::clientDto).toList());
        stats.put("topBusinesses", businesses.stream().limit(6).map(this::businessDto).toList());
        stats.put("recentActivity", adminLogDAO.findAll().stream()
                .sorted(Comparator.comparing(AdminLog::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(12)
                .map(this::adminLogDto)
                .toList());
        return ResponseEntity.ok(stats);
    }

    @GetMapping("/logs")
    public ResponseEntity<?> logs() {
        return ResponseEntity.ok(adminLogDAO.findAll().stream().map(this::adminLogDto).toList());
    }

    private ResponseEntity<?> applyPointChange(Long id, Map<String, Object> data, String mode) {
        Usuario client = requireClient(id);
        ensureEditableClient(client);

        int amount = intValue(data.get("amount"));
        if (amount <= 0 && !"set".equals(mode)) {
            throw new BadRequestException("La cantidad de puntos debe ser mayor que cero.");
        }
        if ("set".equals(mode) && amount < 0) {
            throw new BadRequestException("El valor exacto de puntos no puede ser negativo.");
        }

        String type = value(data, "type", "AJUSTE_ADMIN").trim().toUpperCase();
        if (!POINT_TYPES.contains(type)) {
            throw new BadRequestException("Tipo de movimiento administrativo no válido.");
        }

        int previous = client.getPuntos();
        int delta = switch (mode) {
            case "add" -> amount;
            case "subtract" -> -amount;
            case "set" -> amount - previous;
            default -> throw new BadRequestException("Operación de puntos no válida.");
        };

        int next = previous + delta;
        if (next < 0) {
            throw new BadRequestException("El cliente no tiene saldo suficiente para esta operación.");
        }

        Restaurante restaurant = null;
        Long restaurantId = longValue(data.get("restaurantId"));
        if (restaurantId != null) {
            restaurant = restauranteDAO.findById(restaurantId)
                    .orElseThrow(() -> new ResourceNotFoundException("Restaurante no encontrado"));
        }

        client.setPuntos(next);
        Usuario saved = usuarioDAO.save(client);

        MovimientoPuntos movement = new MovimientoPuntos();
        movement.setUsuario(saved);
        movement.setRestaurante(restaurant);
        movement.setPuntos(delta);
        movement.setTipo(type);
        movement.setDescripcion(value(data, "description", defaultPointDescription(mode, delta)));
        movement.setMotivoInterno(value(data, "reason", ""));
        movement.setAdminEmail(adminEmail());
        movimientoPuntosDAO.save(movement);

        String action = switch (mode) {
            case "add" -> "CLIENT_POINTS_ADDED";
            case "subtract" -> "CLIENT_POINTS_SUBTRACTED";
            case "set" -> "CLIENT_POINTS_SET";
            default -> "CLIENT_POINTS_CHANGED";
        };
        log(action, id, "Cambio de puntos: " + previous + " -> " + next,
                "{\"puntos\":" + previous + "}",
                "{\"puntos\":" + next + ",\"delta\":" + delta + "}");

        return ResponseEntity.ok(clientDetailDto(saved));
    }

    private Usuario requireClient(Long id) {
        Usuario client = usuarioDAO.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente no encontrado"));
        if (client.getRole() != Role.ROLE_USER) {
            throw new BadRequestException("La cuenta indicada no es un cliente gestionable.");
        }
        return client;
    }

    private void ensureEditableClient(Usuario client) {
        if (client.getRole() == Role.ROLE_ADMIN) {
            throw new BadRequestException("No se permite modificar usuarios administradores desde clientes.");
        }
        if (Boolean.TRUE.equals(client.getDeleted())) {
            throw new BadRequestException("El cliente está eliminado de forma lógica.");
        }
    }

    private Restaurante requireBusiness(Long id) {
        Restaurante business = restauranteDAO.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Negocio no encontrado"));
        if (business.getRole() != Role.ROLE_RESTAURANT) {
            throw new BadRequestException("La cuenta indicada no es un negocio gestionable.");
        }
        if (Boolean.TRUE.equals(business.getDeleted())) {
            throw new BadRequestException("El negocio está eliminado de forma lógica.");
        }
        return business;
    }

    private AdminReservation requireReservation(Long id) {
        AdminReservation reservation = adminReservationDAO.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Reserva no encontrada"));
        if (Boolean.TRUE.equals(reservation.getDeleted())) {
            throw new BadRequestException("La reserva está eliminada de forma lógica.");
        }
        return reservation;
    }

    private List<Restaurante> activeBusinesses() {
        return restauranteDAO.findAll().stream()
                .filter(r -> r.getRole() == Role.ROLE_RESTAURANT)
                .filter(r -> !Boolean.TRUE.equals(r.getDeleted()))
                .toList();
    }

    private List<AdminReservation> activeReservations() {
        return adminReservationDAO.findByDeletedFalseOrderByDateDesc();
    }

    private List<Usuario> activeClients() {
        return usuarioDAO.findAll().stream()
                .filter(u -> u.getRole() == Role.ROLE_USER)
                .filter(u -> !Boolean.TRUE.equals(u.getDeleted()))
                .toList();
    }

    private List<Usuario> activeAndDeletedVisibleClients() {
        return activeClients();
    }

    private boolean matchesSearch(Usuario item, String search) {
        if (search == null || search.isBlank()) return true;
        String q = search.trim().toLowerCase();
        return contains(item.getNombre(), q)
                || contains(item.getEmail(), q)
                || contains(item.getTelefono(), q)
                || contains(item.getQrCode(), q);
    }

    private boolean matchesStatus(Usuario item, String status) {
        if (status == null || status.isBlank() || "all".equalsIgnoreCase(status)) return true;
        if ("active".equalsIgnoreCase(status)) return Boolean.TRUE.equals(item.getActive());
        if ("inactive".equalsIgnoreCase(status)) return !Boolean.TRUE.equals(item.getActive());
        return true;
    }

    private boolean matchesPoints(Usuario item, String points, Integer minPoints, Integer maxPoints) {
        if ("with".equalsIgnoreCase(points) && item.getPuntos() <= 0) return false;
        if ("without".equalsIgnoreCase(points) && item.getPuntos() > 0) return false;
        if (minPoints != null && item.getPuntos() < minPoints) return false;
        return maxPoints == null || item.getPuntos() <= maxPoints;
    }

    private Comparator<Usuario> clientComparator(String sort) {
        Comparator<Usuario> comparator = switch (sort == null ? "" : sort) {
            case "email" -> Comparator.comparing(u -> safe(u.getEmail()));
            case "puntos" -> Comparator.comparingInt(Usuario::getPuntos).reversed();
            case "createdAt" -> Comparator.comparing(u -> u.getCreatedAt() == null ? LocalDateTime.MIN : u.getCreatedAt(), Comparator.reverseOrder());
            default -> Comparator.comparing(u -> safe(u.getNombre()));
        };
        return comparator.thenComparing(Usuario::getId);
    }

    private boolean matchesBusinessSearch(Restaurante item, String search) {
        if (search == null || search.isBlank()) return true;
        String q = search.trim().toLowerCase();
        return contains(item.getNombre(), q)
                || contains(item.getEmail(), q)
                || contains(item.getTelefono(), q)
                || contains(item.getCiudad(), q)
                || contains(item.getDireccion(), q);
    }

    private boolean matchesBusinessStatus(Restaurante item, String status) {
        if (status == null || status.isBlank() || "all".equalsIgnoreCase(status)) return true;
        if ("active".equalsIgnoreCase(status)) return Boolean.TRUE.equals(item.getActive());
        if ("inactive".equalsIgnoreCase(status)) return !Boolean.TRUE.equals(item.getActive());
        return true;
    }

    private Comparator<Restaurante> businessComparator(String sort) {
        Comparator<Restaurante> comparator = switch (sort == null ? "" : sort) {
            case "email" -> Comparator.comparing(r -> safe(r.getEmail()));
            case "ciudad" -> Comparator.comparing(r -> safe(r.getCiudad()));
            case "createdAt" -> Comparator.comparing(r -> r.getCreatedAt() == null ? LocalDateTime.MIN : r.getCreatedAt(), Comparator.reverseOrder());
            default -> Comparator.comparing(r -> safe(r.getNombre()));
        };
        return comparator.thenComparing(Restaurante::getId);
    }

    private Map<String, Object> clientDetailDto(Usuario item) {
        Map<String, Object> dto = clientDto(item);
        List<MovimientoPuntos> movements = movimientoPuntosDAO.findByUsuarioOrderByFechaDesc(item);
        List<Map<String, Object>> logs = adminLogDAO.findByEntityTypeAndEntityIdOrderByCreatedAtDesc("CLIENT", item.getId()).stream()
                .map(this::adminLogDto)
                .toList();
        dto.put("movementsCount", movements.size());
        dto.put("restaurantsVisited", restaurantsVisited(item));
        dto.put("recentMovements", movements.stream().limit(8).map(this::movementDto).toList());
        dto.put("adminLogs", logs);
        dto.put("recentActions", logs.stream().limit(6).toList());
        return dto;
    }

    private Map<String, Object> clientDto(Usuario item) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", item.getId());
        dto.put("nombre", item.getNombre());
        dto.put("email", item.getEmail());
        dto.put("telefono", item.getTelefono());
        dto.put("fotoPerfil", item.getFotoPerfil());
        dto.put("puntos", item.getPuntos());
        dto.put("qrCode", item.getQrCode());
        dto.put("active", Boolean.TRUE.equals(item.getActive()));
        dto.put("deleted", Boolean.TRUE.equals(item.getDeleted()));
        dto.put("createdAt", item.getCreatedAt());
        dto.put("updatedAt", item.getUpdatedAt());
        return dto;
    }

    private Map<String, Object> movementDto(MovimientoPuntos item) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", item.getId());
        dto.put("fecha", item.getFecha());
        dto.put("tipo", item.getTipo());
        dto.put("descripcion", item.getDescripcion());
        dto.put("puntos", item.getPuntos());
        dto.put("monto", item.getMonto());
        dto.put("adminEmail", item.getAdminEmail());
        dto.put("motivoInterno", item.getMotivoInterno());
        dto.put("restauranteId", item.getRestaurante() == null ? null : item.getRestaurante().getId());
        dto.put("restaurante", item.getRestaurante() == null ? "Sin restaurante" : item.getRestaurante().getNombre());
        return dto;
    }

    private Map<String, Object> adminLogDto(AdminLog item) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", item.getId());
        dto.put("adminEmail", item.getAdminEmail());
        dto.put("action", item.getAction());
        dto.put("entityType", item.getEntityType());
        dto.put("entityId", item.getEntityId());
        dto.put("description", item.getDescription());
        dto.put("oldData", item.getOldData());
        dto.put("newData", item.getNewData());
        dto.put("createdAt", item.getCreatedAt());
        return dto;
    }

    private Map<String, Object> businessDto(Restaurante item) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", item.getId());
        dto.put("nombre", item.getNombre());
        dto.put("email", item.getEmail());
        dto.put("telefono", item.getTelefono());
        dto.put("ciudad", item.getCiudad());
        dto.put("direccion", item.getDireccion());
        dto.put("tipo", item.getTipo());
        dto.put("descripcion", item.getDescripcion());
        dto.put("foto", item.getFoto());
        dto.put("active", Boolean.TRUE.equals(item.getActive()));
        dto.put("deleted", Boolean.TRUE.equals(item.getDeleted()));
        dto.put("createdAt", item.getCreatedAt());
        dto.put("updatedAt", item.getUpdatedAt());
        return dto;
    }

    private Map<String, Object> reservationDto(AdminReservation item) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", item.getId());
        dto.put("clientId", item.getUsuario() == null ? null : item.getUsuario().getId());
        dto.put("clientName", item.getClientName());
        dto.put("clientEmail", item.getClientEmail());
        dto.put("clientPhone", item.getClientPhone());
        dto.put("businessId", item.getRestaurante() == null ? null : item.getRestaurante().getId());
        dto.put("businessName", item.getBusinessName());
        dto.put("date", item.getDate());
        dto.put("people", item.getPeople());
        dto.put("status", item.getStatus());
        dto.put("notes", item.getNotes());
        dto.put("createdAt", item.getCreatedAt());
        dto.put("updatedAt", item.getUpdatedAt());
        return dto;
    }

    private void applyReservationData(AdminReservation reservation, Map<String, Object> data) {
        Long clientId = longValue(data.get("clientId"));
        Usuario client = clientId == null ? null : requireClient(clientId);
        Long businessId = longValue(data.get("businessId"));
        Restaurante business = businessId == null ? null : requireBusiness(businessId);
        String status = value(data, "status", reservation.getStatus() == null ? "PENDING" : reservation.getStatus()).trim().toUpperCase();
        if (!Set.of("PENDING", "CONFIRMED", "CANCELLED").contains(status)) throw new BadRequestException("Estado de reserva no válido.");

        reservation.setUsuario(client);
        reservation.setRestaurante(business);
        reservation.setClientName(value(data, "clientName", client == null ? reservation.getClientName() : client.getNombre()).trim());
        reservation.setClientEmail(value(data, "clientEmail", client == null ? reservation.getClientEmail() : client.getEmail()).trim().toLowerCase());
        reservation.setClientPhone(blankToNull(value(data, "clientPhone", client == null ? reservation.getClientPhone() : client.getTelefono())));
        reservation.setBusinessName(value(data, "businessName", business == null ? reservation.getBusinessName() : business.getNombre()).trim());
        reservation.setPeople(Math.max(1, intValue(data.getOrDefault("people", reservation.getPeople() == null ? 1 : reservation.getPeople()))));
        reservation.setStatus(status);
        reservation.setNotes(blankToNull(nullableValue(data, "notes")));
        Object date = data.get("date");
        if (date != null && !String.valueOf(date).isBlank()) {
            reservation.setDate(LocalDateTime.parse(String.valueOf(date).replace("Z", "")));
        } else if (reservation.getDate() == null) {
            reservation.setDate(LocalDateTime.now().plusDays(1).withHour(20).withMinute(0).withSecond(0).withNano(0));
        }

        if (reservation.getClientName() == null || reservation.getClientName().isBlank()) throw new BadRequestException("El nombre del cliente es obligatorio.");
        if (reservation.getClientEmail() == null || !reservation.getClientEmail().matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) throw new BadRequestException("Email de cliente no válido.");
        if (reservation.getBusinessName() == null || reservation.getBusinessName().isBlank()) throw new BadRequestException("El negocio es obligatorio.");
    }

    private long restaurantsVisited(Usuario client) {
        return movimientoPuntosDAO.findByUsuario(client).stream()
                .map(MovimientoPuntos::getRestaurante)
                .filter(Objects::nonNull)
                .map(Restaurante::getId)
                .distinct()
                .count();
    }

    private void validateClientInput(String nombre, String email, String telefono) {
        if (nombre == null || nombre.isBlank()) {
            throw new BadRequestException("El nombre es obligatorio.");
        }
        if (email == null || !email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw new BadRequestException("El email no tiene un formato válido.");
        }
        if (telefono != null && !telefono.isBlank() && !telefono.matches("^[0-9+()\\s-]{6,20}$")) {
            throw new BadRequestException("El teléfono no tiene un formato válido.");
        }
    }

    private void log(String action, Long clientId, String description, String oldData, String newData) {
        logEntity(action, "CLIENT", clientId, description, oldData, newData);
    }

    private void logEntity(String action, String entityType, Long entityId, String description, String oldData, String newData) {
        AdminLog log = new AdminLog();
        log.setAdminEmail(adminEmail());
        log.setAction(action);
        log.setEntityType(entityType);
        log.setEntityId(entityId);
        log.setDescription(description);
        log.setOldData(oldData);
        log.setNewData(newData);
        adminLogDAO.save(log);
    }

    private String adminEmail() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth == null ? "admin@fidelyfood.local" : String.valueOf(auth.getPrincipal());
    }

    private String compactClient(Usuario client) {
        return "{"
                + "\"id\":" + client.getId()
                + ",\"nombre\":\"" + escape(client.getNombre()) + "\""
                + ",\"email\":\"" + escape(client.getEmail()) + "\""
                + ",\"telefono\":\"" + escape(client.getTelefono()) + "\""
                + ",\"puntos\":" + client.getPuntos()
                + ",\"active\":" + Boolean.TRUE.equals(client.getActive())
                + ",\"deleted\":" + Boolean.TRUE.equals(client.getDeleted())
                + "}";
    }

    private String compactBusiness(Restaurante business) {
        return "{"
                + "\"id\":" + business.getId()
                + ",\"nombre\":\"" + escape(business.getNombre()) + "\""
                + ",\"email\":\"" + escape(business.getEmail()) + "\""
                + ",\"telefono\":\"" + escape(business.getTelefono()) + "\""
                + ",\"ciudad\":\"" + escape(business.getCiudad()) + "\""
                + ",\"active\":" + Boolean.TRUE.equals(business.getActive())
                + ",\"deleted\":" + Boolean.TRUE.equals(business.getDeleted())
                + "}";
    }

    private String compactReservation(AdminReservation reservation) {
        return "{"
                + "\"id\":" + reservation.getId()
                + ",\"clientName\":\"" + escape(reservation.getClientName()) + "\""
                + ",\"businessName\":\"" + escape(reservation.getBusinessName()) + "\""
                + ",\"status\":\"" + escape(reservation.getStatus()) + "\""
                + ",\"date\":\"" + (reservation.getDate() == null ? "" : reservation.getDate()) + "\""
                + "}";
    }

    private Map<String, Long> countByDay(List<LocalDateTime> values) {
        Map<String, Long> result = new TreeMap<>();
        values.stream()
                .filter(Objects::nonNull)
                .map(value -> value.toLocalDate().toString())
                .forEach(day -> result.put(day, result.getOrDefault(day, 0L) + 1));
        return result;
    }

    private Map<String, Long> countReservationsByStatus(List<AdminReservation> reservations) {
        Map<String, Long> result = new LinkedHashMap<>();
        result.put("PENDING", reservations.stream().filter(r -> "PENDING".equals(r.getStatus())).count());
        result.put("CONFIRMED", reservations.stream().filter(r -> "CONFIRMED".equals(r.getStatus())).count());
        result.put("CANCELLED", reservations.stream().filter(r -> "CANCELLED".equals(r.getStatus())).count());
        return result;
    }

    private Map<String, Integer> movementsByRestaurant(List<MovimientoPuntos> movements) {
        Map<String, Integer> result = new LinkedHashMap<>();
        movements.stream()
                .filter(m -> m.getRestaurante() != null)
                .forEach(m -> {
                    String key = m.getRestaurante().getNombre();
                    result.put(key, result.getOrDefault(key, 0) + Math.abs(m.getPuntos()));
                });
        return result;
    }

    private String defaultPointDescription(String mode, int delta) {
        return switch (mode) {
            case "add" -> "Bonificación manual de administrador";
            case "subtract" -> "Corrección manual de administrador";
            case "set" -> "Ajuste exacto de saldo por administrador (" + delta + ")";
            default -> "Ajuste de puntos de administrador";
        };
    }

    private boolean contains(String value, String q) {
        return value != null && value.toLowerCase().contains(q);
    }

    private String value(Map<String, Object> data, String key, String fallback) {
        Object value = data.get(key);
        return value == null ? fallback : String.valueOf(value);
    }

    private String nullableValue(Map<String, Object> data, String key) {
        Object value = data.get(key);
        return value == null ? null : String.valueOf(value);
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String safe(String value) {
        return value == null ? "" : value.toLowerCase();
    }

    private String escape(String value) {
        return value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private boolean bool(Object value) {
        if (value instanceof Boolean booleanValue) return booleanValue;
        return Boolean.parseBoolean(String.valueOf(value));
    }

    private int intValue(Object value) {
        if (value instanceof Number number) return number.intValue();
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception e) {
            throw new BadRequestException("Cantidad de puntos inválida.");
        }
    }

    private Long longValue(Object value) {
        if (value == null || String.valueOf(value).isBlank()) return null;
        if (value instanceof Number number) return number.longValue();
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (Exception e) {
            throw new BadRequestException("Restaurante inválido.");
        }
    }
}
