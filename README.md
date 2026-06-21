# FidelyFood Backend

## Descripción del Proyecto

FidelyFood es una aplicación de fidelización para restaurantes basada en puntos.

## Documentación del TFG

[📄 Ver memoria del TFG](docs/TFG_FidelyFood_Anthony_Montaggioni.pdf)

Este documento recoge la memoria oficial del Trabajo Final de Grado del proyecto FidelyFood, una plataforma orientada a la fidelización de clientes mediante QR, sistema de puntos, promociones, recompensas y geolocalización.

## Resumen del TFG

**Objetivo del proyecto.** FidelyFood digitaliza y optimiza los programas de fidelización tradicionales del sector gastronómico. Busca mejorar la retención de clientes, automatizar recompensas, sustituir tarjetas físicas y permitir un análisis básico del comportamiento de uso.

**Tecnologías utilizadas.** La memoria define un frontend con Ionic, Angular y Bootstrap; un backend en Java y Spring Boot; una base de datos MySQL; y comunicación mediante API REST, JWT y JSON. El desarrollo se apoya en Visual Studio Code, IntelliJ IDEA, GitHub y Postman.

**Arquitectura general.** El sistema sigue una arquitectura cliente-servidor formada por la aplicación de usuario, un panel para restaurantes y una API REST. El backend concentra la lógica de negocio, autenticación y persistencia; el frontend ofrece la experiencia móvil; y JWT protege la comunicación entre capas.

**Funcionalidades principales.** Incluye registro e inicio de sesión, gestión de perfil, identificación y canje mediante QR, acumulación de puntos por consumo, canje de recompensas, gestión de promociones y clientes para restaurantes, geolocalización y notificaciones.

**Valor aportado al usuario.** La plataforma ofrece una experiencia rápida y gamificada, con beneficios y recompensas para clientes, mientras reduce costes operativos y facilita a los restaurantes la gestión digital de sus programas de fidelización. Su enfoque multi-restaurante, QR sin hardware adicional y geolocalización favorece la adopción en negocios locales.

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


