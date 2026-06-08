package progresa.springboot_tfg.controller;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class UploadController {

    private static final byte[] RESTAURANT_PLACEHOLDER = """
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220" role="img" aria-label="Restaurante">
              <defs>
                <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stop-color="#fff3ec"/>
                  <stop offset="1" stop-color="#f6d6c8"/>
                </linearGradient>
              </defs>
              <rect width="320" height="220" rx="22" fill="url(#bg)"/>
              <circle cx="160" cy="92" r="42" fill="#fffaf7" opacity=".9"/>
              <path d="M141 65v56M132 65v24c0 10 18 10 18 0V65M181 65v56M170 65c20 15 16 39 2 45" fill="none" stroke="#f26d4b" stroke-width="8" stroke-linecap="round"/>
              <rect x="78" y="154" width="164" height="16" rx="8" fill="#f26d4b" opacity=".22"/>
              <rect x="105" y="176" width="110" height="10" rx="5" fill="#f26d4b" opacity=".28"/>
            </svg>
            """.getBytes(StandardCharsets.UTF_8);

    private static final byte[] PROFILE_PLACEHOLDER = """
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" role="img" aria-label="Perfil">
              <defs>
                <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0" stop-color="#fff7ed"/>
                  <stop offset="1" stop-color="#fed7aa"/>
                </linearGradient>
              </defs>
              <rect width="320" height="320" rx="160" fill="url(#bg)"/>
              <circle cx="160" cy="122" r="58" fill="#ffffff" opacity=".92"/>
              <path d="M72 274c16-58 56-88 88-88s72 30 88 88" fill="#ffffff" opacity=".92"/>
              <circle cx="160" cy="160" r="146" fill="none" stroke="#fb923c" stroke-width="10" opacity=".22"/>
            </svg>
            """.getBytes(StandardCharsets.UTF_8);

    @GetMapping("/uploads/**")
    public ResponseEntity<byte[]> getUpload(HttpServletRequest request) {
        String prefix = request.getContextPath() + "/uploads/";
        String requestUri = request.getRequestURI();
        if (!requestUri.startsWith(prefix)) {
            return placeholder("");
        }

        String filename = URLDecoder.decode(requestUri.substring(prefix.length()), StandardCharsets.UTF_8);
        Path uploadPath = Paths.get("uploads").toAbsolutePath().normalize();
        Path filePath = uploadPath.resolve(filename).normalize();

        if (!filePath.startsWith(uploadPath)) {
            return placeholder(filename);
        }

        try {
            if (Files.exists(filePath) && Files.isRegularFile(filePath) && Files.isReadable(filePath)) {
                byte[] body = Files.readAllBytes(filePath);
                return ResponseEntity.ok()
                        .cacheControl(CacheControl.noCache())
                        .header(HttpHeaders.CONTENT_TYPE, contentType(filename))
                        .body(body);
            }
        } catch (IOException | RuntimeException ignored) {
            return placeholder(filename);
        }

        return placeholder(filename);
    }

    private ResponseEntity<byte[]> placeholder(String filename) {
        boolean profileImage = filename != null && filename.startsWith("perfiles/");

        return ResponseEntity.ok()
                .cacheControl(CacheControl.noCache())
                .contentType(MediaType.valueOf("image/svg+xml"))
                .body(profileImage ? PROFILE_PLACEHOLDER : RESTAURANT_PLACEHOLDER);
    }

    private String contentType(String filename) {
        String normalized = filename.toLowerCase();
        if (normalized.endsWith(".png")) {
            return MediaType.IMAGE_PNG_VALUE;
        }
        if (normalized.endsWith(".jpg") || normalized.endsWith(".jpeg")) {
            return MediaType.IMAGE_JPEG_VALUE;
        }
        if (normalized.endsWith(".gif")) {
            return MediaType.IMAGE_GIF_VALUE;
        }
        if (normalized.endsWith(".svg")) {
            return "image/svg+xml";
        }
        if (normalized.endsWith(".webp")) {
            return "image/webp";
        }
        if (normalized.endsWith(".avif")) {
            return "image/avif";
        }
        return MediaType.APPLICATION_OCTET_STREAM_VALUE;
    }
}
