package progresa.springboot_tfg.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.Usuario;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Stream de puntos en tiempo real (SSE). El cliente se suscribe a
 * /api/puntos/{id}/stream y recibe un evento "puntos" en el instante en
 * que su saldo cambia (compra registrada, canje, ajuste del admin…).
 *
 * Implementación: cada emisor recuerda el último saldo enviado; un
 * barrido periódico compara el saldo real con el último emitido y emite
 * solo cuando cambia. Así los productores de movimientos no necesitan
 * avisar a nadie: el stream es un observador.
 */
@Service
public class PuntosStreamService {

    private static final Logger log = LoggerFactory.getLogger(PuntosStreamService.class);
    private static final long TIMEOUT_MS = 30 * 60 * 1000L; // 30 min por conexión

    private final UsuarioDAO usuarioDAO;
    private final Map<Long, SseEmitter> emisores = new ConcurrentHashMap<>();
    private final Map<Long, Integer> ultimoEmitido = new ConcurrentHashMap<>();

    public PuntosStreamService(UsuarioDAO usuarioDAO) {
        this.usuarioDAO = usuarioDAO;
    }

    public SseEmitter suscribir(Long usuarioId) {
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        emisores.put(usuarioId, emitter);
        ultimoEmitido.remove(usuarioId); // sin saldo previo enviado

        emitter.onCompletion(() -> {
            emisores.remove(usuarioId);
            ultimoEmitido.remove(usuarioId);
        });
        emitter.onTimeout(() -> {
            emisores.remove(usuarioId);
            ultimoEmitido.remove(usuarioId);
        });

        // El saldo inicial lo manda el barrido (a más tardar 2s): enviar aquí,
        // antes de devolver el emitter, rompería la respuesta.
        return emitter;
    }

    @Scheduled(fixedRate = 2000)
    public void barrido() {
        for (Map.Entry<Long, SseEmitter> entry : emisores.entrySet()) {
            Long usuarioId = entry.getKey();
            usuarioDAO.findById(usuarioId).ifPresent(u -> {
                Integer anterior = ultimoEmitido.get(usuarioId);
                if (anterior == null || anterior != u.getPuntos()) {
                    enviar(entry.getValue(), usuarioId, u.getPuntos());
                }
            });
        }
    }

    private void enviar(SseEmitter emitter, Long usuarioId, int puntos) {
        try {
            emitter.send(SseEmitter.event().name("puntos").data(Map.of("puntos", puntos)));
            ultimoEmitido.put(usuarioId, puntos);
        } catch (IOException | IllegalStateException e) {
            emisores.remove(usuarioId);
            ultimoEmitido.remove(usuarioId);
            log.debug("Suscriptor de puntos desconectado: usuario {}", usuarioId);
        }
    }
}
