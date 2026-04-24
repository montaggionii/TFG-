# Data Model

## Usuario
- id: Long
- nombre: String
- email: String
- puntos: int
- qrCode: String

## Restaurante
- id: Long
- nombre: String
- direccion: String
- ciudad: String

## MovimientoPuntos
- puntos: int
- tipo: ACUMULACION | CANJE
- descripcion: String
- fecha: LocalDateTime