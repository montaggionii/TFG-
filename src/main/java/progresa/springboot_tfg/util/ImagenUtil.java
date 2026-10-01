package progresa.springboot_tfg.util;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Base64;

/**
 * Codifica imagenes subidas como data URI (base64) para guardarlas en la
 * propia fila de la base de datos. El disco del contenedor de Render es
 * efimero: cualquier archivo escrito en uploads/ desaparece en el siguiente
 * despliegue, asi que las fotos no pueden depender del sistema de ficheros.
 */
public final class ImagenUtil {

    private ImagenUtil() {
    }

    public static String aDataUri(MultipartFile imagen) {
        try {
            String base64 = Base64.getEncoder().encodeToString(imagen.getBytes());
            return "data:" + imagen.getContentType() + ";base64," + base64;
        } catch (IOException e) {
            throw new RuntimeException("No se pudo leer la imagen subida", e);
        }
    }
}
