package progresa.springboot_tfg.service;

import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dto.*;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Role;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;
import progresa.springboot_tfg.security.JwtUtil;

import java.util.List;

@Service
public class RestauranteService {

    private final RestauranteDAO restauranteDAO;
    private final BCryptPasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public RestauranteService(
            RestauranteDAO restauranteDAO,
            BCryptPasswordEncoder passwordEncoder,
            JwtUtil jwtUtil
    ) {
        this.restauranteDAO = restauranteDAO;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
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
        restaurante.setActive(true);

        return restauranteDAO.save(restaurante);
    }



    public RestauranteLoginResponseDTO login(RestauranteLoginRequestDTO dto) {

        Restaurante restaurante = restauranteDAO.findByEmail(dto.getEmail())
                .orElseThrow(() ->
                        new ResourceNotFoundException("Email no registrado"));

        if (!passwordEncoder.matches(dto.getPassword(), restaurante.getPassword())) {
            throw new RuntimeException("Credenciales incorrectas");
        }

        if (!restaurante.isActive()) {
            throw new BadRequestException("La cuenta del negocio está desactivada");
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

    public RestauranteDTO actualizarImagen(Long id, String imagenUrl) {
        Restaurante restaurante = restauranteDAO.findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Restaurante no encontrado"));

        restaurante.setImagenUrl(imagenUrl);
        return toDTO(restauranteDAO.save(restaurante));
    }

    public void eliminar(Long id) {
        restauranteDAO.deleteById(id);
    }

    public Restaurante crear(Restaurante restaurante) {
        restaurante.setPassword(passwordEncoder.encode(restaurante.getPassword()));
        restaurante.setRole(Role.ROLE_RESTAURANT);
        return restauranteDAO.save(restaurante);
    }

    public Restaurante actualizar(Long id, Restaurante actualizado) {

        Restaurante restaurante = restauranteDAO.findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Restaurante no encontrado"));

        restaurante.setNombre(actualizado.getNombre());
        restaurante.setDireccion(actualizado.getDireccion());
        restaurante.setCiudad(actualizado.getCiudad());
        restaurante.setTelefono(actualizado.getTelefono());
        restaurante.setEmail(actualizado.getEmail());
        restaurante.setDescripcion(actualizado.getDescripcion());
        restaurante.setImagen(actualizado.getImagen());
        restaurante.setImagenUrl(actualizado.getImagenUrl());
        restaurante.setTipo(actualizado.getTipo());
        restaurante.setLatitud(actualizado.getLatitud());
        restaurante.setLongitud(actualizado.getLongitud());
        restaurante.setCodigoPostal(actualizado.getCodigoPostal());

        if (actualizado.getPassword() != null) {
            restaurante.setPassword(passwordEncoder.encode(actualizado.getPassword()));
        }

        return restauranteDAO.save(restaurante);
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
