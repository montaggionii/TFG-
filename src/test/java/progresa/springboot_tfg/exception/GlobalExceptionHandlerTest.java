package progresa.springboot_tfg.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void rutaSinRecursoDevuelve404YNo500() {
        NoResourceFoundException ex = new NoResourceFoundException(HttpMethod.GET, "/");

        ResponseEntity<Map<String, Object>> response = handler.manejarRecursoNoEncontrado(ex);

        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        assertEquals("Not Found", response.getBody().get("error"));
    }
}
