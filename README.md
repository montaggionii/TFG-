# FidelyFood Backend

## Descripción del Proyecto

FidelyFood es una aplicación de fidelización para restaurantes basada en puntos.

Este backend gestiona toda la lógica del sistema:
- Registro y autenticación de usuarios
- Gestión de restaurantes
- Sistema de puntos
- Promociones
- Recompensas
- Canje de puntos mediante QR

El objetivo es permitir que los clientes acumulen puntos en restaurantes y los utilicen para obtener beneficios.

---

##  Arquitectura

El backend está desarrollado con:

- Java
- Spring Boot
- Spring Security
- JPA / Hibernate
- Base de datos relacional
- API REST

Se utiliza arquitectura en capas:
- Controller
- Service
- Repository
- Entity

---

##  Roles del Sistema

### Usuario
- Se registra e inicia sesión
- Obtiene un QR permanente
- Acumula puntos
- Consulta promociones
- Canjea recompensas

### Restaurante
- Gestiona promociones
- Define recompensas
- Valida canjes
- Registra movimientos de puntos

---

##  Modelo de Datos Principal

Entidades creadas:

- Usuario
- Restaurante
- MovimientoPuntos
- Promoción
- Recompensa
- Canje

Los puntos no se almacenan directamente en el usuario, sino que se calculan a partir de los movimientos.

---

##  Funcionamiento del Sistema de Puntos

Los usuarios ganan puntos cuando:
- Se aplica una promoción
- Se registra una compra

Los usuarios pierden puntos cuando:
- Canjean una recompensa

Cada operación genera un movimiento en la tabla MovimientoPuntos.

---

##  Sistema QR

Existen dos tipos de QR:

- QR permanente del usuario (para identificarse)
- QR temporal de canje (para validar recompensas)

---

##  Seguridad

- Autenticación con JWT
- Autorización basada en roles (USER / RESTAURANT)
- Protección de endpoints

---

##  Estado Actual del Proyecto

Backend completamente funcional con:
- Endpoints REST operativos
- Modelo de datos definido
- Lógica de negocio implementada
- Seguridad configurada

Preparado para integración con el frontend (Ionic + Angular).

---


