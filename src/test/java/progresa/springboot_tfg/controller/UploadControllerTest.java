package progresa.springboot_tfg.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * AGT-xxx — UploadController nunca tenía ningún test propio a pesar de ser el
 * único endpoint público que lee archivos del disco por nombre tomado de la
 * URL (GET /uploads/**). Su protección anti path-traversal (normalize() +
 * startsWith()) es exactamente el tipo de lógica que una regresión futura
 * podría romper sin que ningún test lo detectara. Estos tests fijan ese
 * comportamiento: una ruta que intenta escapar de uploads/ nunca debe
 * devolver el contenido de un archivo fuera de ese directorio, un archivo
 * real dentro de uploads/ se sirve con el content-type correcto, y uno que
 * no existe cae siempre al placeholder (de perfil o de restaurante según el
 * prefijo), nunca a un error.
 */
class UploadControllerTest {

    private final UploadController controller = new UploadController();
    private final Path uploadsDir = Paths.get("uploads").toAbsolutePath().normalize();

    @AfterEach
    void limpiarArchivosDePrueba() throws IOException {
        deleteRecursively(uploadsDir);
    }

    private static void deleteRecursively(Path path) throws IOException {
        if (!Files.exists(path)) {
            return;
        }
        try (var stream = Files.walk(path)) {
            stream.sorted((a, b) -> b.getNameCount() - a.getNameCount())
                    .forEach(p -> {
                        try {
                            Files.deleteIfExists(p);
                        } catch (IOException ignored) {
                            // best-effort cleanup
                        }
                    });
        }
    }

    private HttpServletRequest requestFor(String requestUri) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getContextPath()).thenReturn("");
        when(request.getRequestURI()).thenReturn(requestUri);
        return request;
    }

    @Test
    void devuelveElArchivoReal_conElContentTypeCorrecto() throws IOException {
        Files.createDirectories(uploadsDir);
        byte[] contenido = "contenido-real-de-prueba".getBytes(StandardCharsets.UTF_8);
        Files.write(uploadsDir.resolve("foto.png"), contenido);

        ResponseEntity<byte[]> respuesta = controller.getUpload(requestFor("/uploads/foto.png"));

        assertEquals(200, respuesta.getStatusCode().value());
        assertArrayEquals(contenido, respuesta.getBody());
        assertEquals(MediaType.IMAGE_PNG_VALUE, respuesta.getHeaders().getFirst(HttpHeaders.CONTENT_TYPE));
    }

    @Test
    void devuelveElArchivoDentroDeUnSubdirectorio_conSuContentType() throws IOException {
        Files.createDirectories(uploadsDir.resolve("promociones"));
        byte[] contenido = "jpeg-de-prueba".getBytes(StandardCharsets.UTF_8);
        Files.write(uploadsDir.resolve("promociones/promo.jpg"), contenido);

        ResponseEntity<byte[]> respuesta = controller.getUpload(requestFor("/uploads/promociones/promo.jpg"));

        assertEquals(200, respuesta.getStatusCode().value());
        assertArrayEquals(contenido, respuesta.getBody());
        assertEquals(MediaType.IMAGE_JPEG_VALUE, respuesta.getHeaders().getFirst(HttpHeaders.CONTENT_TYPE));
    }

    @Test
    void devuelvePlaceholderDeRestaurante_siElArchivoNoExiste() {
        ResponseEntity<byte[]> respuesta = controller.getUpload(requestFor("/uploads/restaurantes/no-existe.png"));

        assertEquals(200, respuesta.getStatusCode().value());
        assertEquals("image/svg+xml", respuesta.getHeaders().getFirst(HttpHeaders.CONTENT_TYPE));
        assertTrue(new String(respuesta.getBody(), StandardCharsets.UTF_8).contains("aria-label=\"Restaurante\""));
    }

    @Test
    void devuelvePlaceholderDePerfil_siElArchivoDePerfilNoExiste() {
        ResponseEntity<byte[]> respuesta = controller.getUpload(requestFor("/uploads/perfiles/no-existe.png"));

        assertEquals(200, respuesta.getStatusCode().value());
        assertTrue(new String(respuesta.getBody(), StandardCharsets.UTF_8).contains("aria-label=\"Perfil\""));
    }

    @Test
    void bloqueaUnaRutaQueIntentaEscaparDeUploads_sinDevolverElArchivoReal() throws IOException {
        // Un archivo real fuera de uploads/, que nunca debería poder leerse desde este endpoint.
        Path secreto = uploadsDir.getParent().resolve("secreto-fuera-de-uploads.txt");
        Files.write(secreto, "no-deberia-verse-nunca".getBytes(StandardCharsets.UTF_8));
        try {
            ResponseEntity<byte[]> respuesta =
                    controller.getUpload(requestFor("/uploads/../secreto-fuera-de-uploads.txt"));

            assertEquals(200, respuesta.getStatusCode().value());
            assertEquals("image/svg+xml", respuesta.getHeaders().getFirst(HttpHeaders.CONTENT_TYPE));
            assertTrue(new String(respuesta.getBody(), StandardCharsets.UTF_8).contains("aria-label=\"Restaurante\""),
                    "una ruta de traversal nunca debe devolver el archivo real, solo el placeholder");
        } finally {
            Files.deleteIfExists(secreto);
        }
    }

    @Test
    void bloqueaUnaRutaDeTraversalCodificadaEnLaUrl_sinDevolverElArchivoReal() throws IOException {
        Path secreto = uploadsDir.getParent().resolve("secreto-codificado.txt");
        Files.write(secreto, "no-deberia-verse-nunca".getBytes(StandardCharsets.UTF_8));
        try {
            ResponseEntity<byte[]> respuesta =
                    controller.getUpload(requestFor("/uploads/%2e%2e%2fsecreto-codificado.txt"));

            assertEquals(200, respuesta.getStatusCode().value());
            assertEquals("image/svg+xml", respuesta.getHeaders().getFirst(HttpHeaders.CONTENT_TYPE));
        } finally {
            Files.deleteIfExists(secreto);
        }
    }

    @Test
    void devuelvePlaceholderDeRestaurante_siLaUriNoEmpiezaPorElPrefijoDeUploads() {
        ResponseEntity<byte[]> respuesta = controller.getUpload(requestFor("/otra-ruta/archivo.png"));

        assertEquals(200, respuesta.getStatusCode().value());
        assertTrue(new String(respuesta.getBody(), StandardCharsets.UTF_8).contains("aria-label=\"Restaurante\""));
    }
}
