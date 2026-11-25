package progresa.springboot_tfg.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import progresa.springboot_tfg.dao.UsuarioDAO;
import progresa.springboot_tfg.entity.Usuario;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Stream SSE de puntos (sin tests hasta ahora, única pieza de código del
 * backend que gestiona reconexiones concurrentes sobre el mismo usuarioId).
 *
 * Hallazgo corregido aquí: {@code suscribir()} guardaba el emitter nuevo en
 * {@code emisores} indexado solo por usuarioId, pero el callback de
 * completion/timeout del emitter ANTERIOR seguía registrado y borraba esa
 * misma clave sin comprobar que todavía apuntara a él. Si un cliente
 * reconectaba (nueva pestaña, refresco de red) antes de que el servidor
 * notara la desconexión vieja, la notificación tardía de la conexión vieja
 * borraba silenciosamente el registro de la conexión nueva — el usuario
 * reconectado dejaba de recibir actualizaciones de puntos en tiempo real
 * hasta la siguiente reconexión, sin ningún error visible. `limpiar()`
 * ahora solo borra la entrada si el emitter que se completa sigue siendo el
 * que está realmente registrado (`Map.remove(key, value)`).
 */
@ExtendWith(MockitoExtension.class)
class PuntosStreamServiceTest {

    @Mock
    private UsuarioDAO usuarioDAO;

    private Deque<SseEmitter> emittersPendientes;
    private TestablePuntosStreamService service;

    @BeforeEach
    void setUp() {
        emittersPendientes = new ArrayDeque<>();
        service = new TestablePuntosStreamService(usuarioDAO);
    }

    private SseEmitter nuevoMockEmitter() {
        SseEmitter emitter = mock(SseEmitter.class);
        emittersPendientes.add(emitter);
        return emitter;
    }

    private class TestablePuntosStreamService extends PuntosStreamService {
        TestablePuntosStreamService(UsuarioDAO usuarioDAO) {
            super(usuarioDAO);
        }

        @Override
        protected SseEmitter crearEmitter() {
            return emittersPendientes.isEmpty() ? nuevoMockEmitter() : emittersPendientes.poll();
        }
    }

    private Usuario usuarioConPuntos(Long id, int puntos) {
        Usuario u = new Usuario();
        u.setId(id);
        u.setPuntos(puntos);
        return u;
    }

    @Test
    void barridoEnviaSoloCuandoElSaldoCambia() throws Exception {
        SseEmitter emitter = nuevoMockEmitter();
        service.suscribir(1L);
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuarioConPuntos(1L, 50)));

        service.barrido();
        service.barrido(); // mismo saldo: no debe reenviar

        verify(emitter, times(1)).send(any(SseEmitter.SseEventBuilder.class));
    }

    @Test
    void barridoReenviaCuandoElSaldoVuelveACambiar() throws Exception {
        SseEmitter emitter = nuevoMockEmitter();
        service.suscribir(1L);

        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuarioConPuntos(1L, 50)));
        service.barrido();
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuarioConPuntos(1L, 75)));
        service.barrido();

        verify(emitter, times(2)).send(any(SseEmitter.SseEventBuilder.class));
    }

    @Test
    void reconexionCierraElEmitterAnteriorEnVezDeDejarloHuerfano() {
        SseEmitter primero = nuevoMockEmitter();
        service.suscribir(1L);
        SseEmitter segundo = nuevoMockEmitter();
        service.suscribir(1L); // reconexión del mismo usuario

        verify(primero, times(1)).complete();
        verify(segundo, never()).complete(); // el segundo sigue abierto, solo se completa el primero
    }

    @Test
    void completionTardioDeLaConexionViejaNoBorraLaConexionNuevaTrasReconectar() throws Exception {
        SseEmitter primero = nuevoMockEmitter();
        ArgumentCaptor<Runnable> primeraCompletion = ArgumentCaptor.forClass(Runnable.class);
        service.suscribir(1L);
        verify(primero).onCompletion(primeraCompletion.capture());

        SseEmitter segundo = nuevoMockEmitter();
        service.suscribir(1L); // el cliente reconecta antes de que el servidor note la desconexión vieja

        // Llega tarde la notificación de desconexión de la conexión VIEJA.
        primeraCompletion.getValue().run();

        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuarioConPuntos(1L, 90)));
        service.barrido();

        // La conexión nueva debe seguir activa y recibir el evento real.
        verify(segundo, times(1)).send(any(SseEmitter.SseEventBuilder.class));
    }

    @Test
    void timeoutRealDesregistraYBarridoDejaDeConsultarEseUsuario() {
        SseEmitter emitter = nuevoMockEmitter();
        ArgumentCaptor<Runnable> onTimeout = ArgumentCaptor.forClass(Runnable.class);
        service.suscribir(1L);
        verify(emitter).onTimeout(onTimeout.capture());

        onTimeout.getValue().run();

        service.barrido();

        verifyNoInteractions(usuarioDAO);
    }

    @Test
    void errorAlEnviarDesregistraSoloSiElEmitterSigueSiendoElActual() throws Exception {
        SseEmitter emitter = nuevoMockEmitter();
        service.suscribir(1L);
        when(usuarioDAO.findById(1L)).thenReturn(Optional.of(usuarioConPuntos(1L, 10)));
        doThrow(new java.io.IOException("cliente desconectado"))
                .when(emitter).send(any(SseEmitter.SseEventBuilder.class));

        service.barrido();

        // Tras el fallo de envío, el usuario deja de estar suscrito: un barrido
        // posterior ya no debería tocar ese emitter otra vez.
        clearInvocations(emitter);
        service.barrido();
        verifyNoInteractions(emitter);
    }
}
