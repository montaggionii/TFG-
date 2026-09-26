package progresa.springboot_tfg.service;

import org.springframework.stereotype.Service;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.multipart.MultipartFile;
import progresa.springboot_tfg.dao.PromocionDAO;
import progresa.springboot_tfg.dao.RestauranteDAO;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.dao.MovimientoPuntosDAO;
import progresa.springboot_tfg.entity.Promocion;
import progresa.springboot_tfg.entity.Restaurante;
import progresa.springboot_tfg.entity.Usuario;
import progresa.springboot_tfg.entity.MovimientoPuntos;
import progresa.springboot_tfg.exception.BadRequestException;
import progresa.springboot_tfg.exception.ResourceNotFoundException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.UUID;

@Service
public class PromocionService {

    private final PromocionDAO promocionDAO;
    private final RestauranteDAO restauranteDAO;
    private final UsuarioDAO usuarioDAO;
    private final MovimientoPuntosDAO movimientoPuntosDAO;

    public PromocionService(
            PromocionDAO promocionDAO,
            RestauranteDAO restauranteDAO,
            UsuarioDAO usuarioDAO,
            MovimientoPuntosDAO movimientoPuntosDAO
    ) {
        this.promocionDAO = promocionDAO;
        this.restauranteDAO = restauranteDAO;
        this.usuarioDAO = usuarioDAO;
        this.movimientoPuntosDAO = movimientoPuntosDAO;
    }


    public Promocion crear(Promocion promocion, String emailRestaurante) {

        Restaurante restaurante = restauranteDAO.findByEmail(emailRestaurante)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Restaurante no encontrado"));

        promocion.setRestaurante(restaurante);

        return promocionDAO.save(promocion);
    }

    /**
     * Crea una promocion con imagen adjunta (multipart). El formulario "Crear
     * Promo" del frontend ya construye este FormData desde hace tiempo, pero
     * el endpoint JSON (crear/@RequestBody Map) no puede recibirlo -> la
     * imagen nunca llegaba a guardarse. Reutiliza la misma validacion y
     * carpeta de subida que RestauranteService.subirImagen.
     */
    public Promocion crearConImagen(Promocion promocion, MultipartFile imagen, String emailRestaurante) {
        Restaurante restaurante = restauranteDAO.findByEmail(emailRestaurante)
                .orElseThrow(() -> new ResourceNotFoundException("Restaurante no encontrado"));

        promocion.setRestaurante(restaurante);
        if (imagen != null && !imagen.isEmpty()) {
            promocion.setImagenUrl(guardarImagenPromocion(imagen));
        }
        return promocionDAO.save(promocion);
    }

    public Promocion actualizarConImagen(Long promocionId, Promocion actualizada, MultipartFile imagen, String emailRestaurante) {
        Promocion promocion = promocionDAO.findById(promocionId)
                .orElseThrow(() -> new ResourceNotFoundException("Promoción no encontrada"));
        requirePromotionOwner(promocion, emailRestaurante);

        promocion.setTitulo(actualizada.getTitulo());
        promocion.setDescripcion(actualizada.getDescripcion());
        promocion.setPuntosOtorgados(actualizada.getPuntosOtorgados());
        promocion.setTipo(actualizada.getTipo());
        promocion.setFechaInicio(actualizada.getFechaInicio());
        promocion.setFechaFin(actualizada.getFechaFin());
        promocion.setActiva(actualizada.isActiva());
        if (imagen != null && !imagen.isEmpty()) {
            promocion.setImagenUrl(guardarImagenPromocion(imagen));
        }

        return promocionDAO.save(promocion);
    }

    private String guardarImagenPromocion(MultipartFile imagen) {
        if (imagen.getSize() > 5 * 1024 * 1024) {
            throw new BadRequestException("Archivo demasiado grande. Máximo 5MB");
        }
        String contentType = imagen.getContentType();
        if (contentType == null || !List.of("image/jpeg", "image/png", "image/webp").contains(contentType)) {
            throw new BadRequestException("Formato no permitido. Usa JPG, JPEG, PNG o WEBP");
        }
        try {
            Path uploadDir = Paths.get("uploads", "promociones").toAbsolutePath().normalize();
            Files.createDirectories(uploadDir);

            String extension = switch (contentType) {
                case "image/png" -> ".png";
                case "image/webp" -> ".webp";
                default -> ".jpg";
            };
            String filename = "promo_" + UUID.randomUUID().toString().substring(0, 8) + extension;
            Path target = uploadDir.resolve(filename).normalize();
            if (!target.startsWith(uploadDir)) {
                throw new BadRequestException("Nombre de archivo no permitido");
            }
            imagen.transferTo(target);
            return "/uploads/promociones/" + filename;
        } catch (IOException e) {
            throw new RuntimeException("No se pudo guardar la imagen de la promoción", e);
        }
    }


    public List<Promocion> obtenerTodas() {
        return promocionDAO.findAll();
    }

    public List<Promocion> obtenerPorRestaurante(Long restauranteId) {
        return promocionDAO.findByRestauranteId(restauranteId);
    }

    public void validarRestauranteAutenticado(Long restauranteId, String emailRestaurante) {
        Restaurante restaurante = restauranteDAO.findById(restauranteId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Restaurante no encontrado"));
        if (emailRestaurante == null || !restaurante.getEmail().equalsIgnoreCase(emailRestaurante)) {
            throw new AccessDeniedException("No puedes consultar promociones de otro restaurante");
        }
    }

    public Promocion actualizar(Long promocionId, Promocion actualizada, String emailRestaurante) {
        Promocion promocion = promocionDAO.findById(promocionId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Promoción no encontrada"));
        requirePromotionOwner(promocion, emailRestaurante);

        promocion.setTitulo(actualizada.getTitulo());
        promocion.setDescripcion(actualizada.getDescripcion());
        promocion.setPuntosOtorgados(actualizada.getPuntosOtorgados());
        promocion.setTipo(actualizada.getTipo());
        promocion.setImagenUrl(actualizada.getImagenUrl());
        promocion.setFechaInicio(actualizada.getFechaInicio());
        promocion.setFechaFin(actualizada.getFechaFin());
        promocion.setActiva(actualizada.isActiva());

        return promocionDAO.save(promocion);
    }

    public void eliminar(Long promocionId, String emailRestaurante) {
        Promocion promocion = promocionDAO.findById(promocionId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Promoción no encontrada"));
        requirePromotionOwner(promocion, emailRestaurante);
        promocionDAO.delete(promocion);
    }

    public void aplicarPromocion(Long promocionId, Long usuarioId, String emailRestaurante) {

        Promocion promocion = promocionDAO.findById(promocionId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Promoción no encontrada"));
        requirePromotionOwner(promocion, emailRestaurante);

        Usuario usuario = usuarioDAO.findById(usuarioId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Usuario no encontrado"));

        // sumar puntos
        usuario.setPuntos(
                usuario.getPuntos() + promocion.getPuntosOtorgados()
        );
        usuarioDAO.save(usuario);

        // registrar movimiento
        MovimientoPuntos mov = new MovimientoPuntos();
        mov.setUsuario(usuario);
        mov.setRestaurante(promocion.getRestaurante());
        mov.setPuntos(promocion.getPuntosOtorgados());
        mov.setTipo("GANADOS");
        mov.setDescripcion("Promoción aplicada");

        movimientoPuntosDAO.save(mov);
    }

    private void requirePromotionOwner(Promocion promocion, String emailRestaurante) {
        if (promocion.getRestaurante() == null
                || emailRestaurante == null
                || !promocion.getRestaurante().getEmail().equalsIgnoreCase(emailRestaurante)) {
            throw new AccessDeniedException("No puedes operar sobre promociones de otro restaurante");
        }
    }
}
