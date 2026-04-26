package progresa.springboot_tfg.service;

import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class QrService {

    public String generarQrUnico(Long usuarioId) {
        return "USER_" + usuarioId + "_" + UUID.randomUUID().toString();
    }
}