package progresa.springboot_tfg.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class FileController {
    
    @org.springframework.beans.factory.annotation.Value("${app.base-url}")
    private String baseUrl;

    @PostMapping("/upload")
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file) throws IOException {
        System.out.println("📥 RECIBIDA PETICIÓN DE SUBIDA: " + file.getOriginalFilename());
        String folder = "uploads/";
        File dir = new File(folder);
        if (!dir.exists()) dir.mkdirs();

        String fileName = System.currentTimeMillis() + "_" + file.getOriginalFilename();
        Path path = Paths.get(folder + fileName);
        Files.write(path, file.getBytes());

        String relativePath = "/uploads/" + fileName;
        System.out.println("📥 [STORAGE] Archivo guardado: " + fileName);
        System.out.println("🔗 [STORAGE] Ruta relativa generada: " + relativePath);

        return ResponseEntity.ok()
                .header("Content-Type", "application/json")
                .body(Map.of("url", relativePath));
    }
}
