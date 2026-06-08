# Plan de Rediseño Visual - FidelyApp (Área Cliente)

Este plan detalla la transformación visual completa del área de cliente de la aplicación, siguiendo estrictamente las directrices de diseño "food-tech" premium (inspirado en Uber Eats, Starbucks Rewards, McDonalds App) sin modificar absolutamente nada de la lógica subyacente.

## Cambios Propuestos

### 1. Sistema de Diseño Global (`global.scss` & `variables.scss`)
- **Paleta de Colores**: 
  - Primario: Naranja cálido (`#FF7A00`)
  - Secundario: Rojo food-tech (`#FF5A5F`)
  - Acento/Recompensa: Amarillo (`#FFC83D`)
  - Fondos: Off-white cálido (`#FAFAFA`)
- **Tipografía y Estructura**: Tipografía sin remates moderna (Inter/Poppins). Radios de borde ampliados (20px-24px para tarjetas principales), sombras muy suaves (`0 8px 30px rgba(0,0,0,0.04)`) y espaciados generosos.
- **Microinteracciones**: Clases de utilidad para *hover-lift*, *tap-effect* suave y *skeleton loaders* elegantes.

### 2. Navegación Principal (`user-layout`)
- **Bottom Bar**: Transformación a un menú *floating* o *glassmorphism* muy sutil.
- **Estados activos**: Animaciones suaves al cambiar de pestaña (escala en el icono, pequeño indicador debajo de la pestaña activa).

### 3. Home / Dashboard Principal (`home.component`)
- **Header**: Saludo personalizado con avatar circular elegante.
- **Tarjeta de Puntos (Wallet)**: Diseño tipo "tarjeta de crédito/fidelidad digital" con gradientes suaves usando el color primario y de acento, tipografía grande para resaltar la cantidad de puntos totales.
- **Accesos Rápidos**: Botones limpios y amigables. Se enfatizará la acción de **"Mostrar mi QR"** eliminando por completo referencias a "escanear".
- **Restaurantes Cercanos**: Tarjetas con diseño *edge-to-edge* (imagen cubriendo la parte superior), bordes súper redondeados y tipografía limpia.

### 4. Perfil y Código QR (`perfil.component`)
- **El QR del Usuario**: Se rediseñará para parecer una tarjeta digital *premium* (como Apple Wallet). Con animaciones de brillo o profundidad que inviten a mostrarlo en el restaurante.
- **Estadísticas**: Gráficos o contadores amigables (ej. "Premios canjeados").
- **Ajustes**: Lista de configuración estilo iOS nativo (celdas blancas sobre fondo gris claro, iconos redondeados).

### 5. Historial (`historial.component`)
- **Timeline**: Transformación de la lista en una línea de tiempo (timeline) moderna.
- **Indicadores Visuales**: Uso de verde/naranja para puntos ganados (+) y gris/negro para puntos canjeados (-), logrando una lectura rápida y satisfactoria de la actividad.

### 6. Detalle del Restaurante (`restaurante-detalle-page.component`)
- **Hero Image**: Imagen a pantalla completa en la parte superior, haciendo *fade* hacia el contenido (muy apetecible).
- **Header Flotante**: Botón de volver transparente y contador de puntos en ese restaurante destacado en la esquina.
- **Promociones**: Tarjetas verticales o de gran tamaño. Las de "GANAR" tendrán un CTA vibrante, las de "CANJEAR" mostrarán un termómetro/barra de progreso de puntos si aún no se alcanzan.

### 7. Mapa (`mapa-page.component` / `mapa.component`)
- **Interfaz del Mapa**: Botones flotantes (FAB) limpios con desenfoque de fondo.
- **Bottom Sheet (Lista de Locales)**: Panel inferior arrastrable con las tarjetas de los restaurantes rediseñadas.

---

> [!IMPORTANT]
> **Ninguna lógica será tocada.** Las rutas, llamadas HTTP, lógica de cálculo de puntos, coordenadas GPS y validaciones de autenticación se mantendrán idénticas. Únicamente se tocarán archivos HTML, SCSS y se ajustarán las clases dentro del TS relacionadas con estilos visuales o presentación temporal (como Loaders).

## User Review Required

Por favor, revisa el plan propuesto. Si estás de acuerdo con la paleta de colores, la inspiración de diseño, y la estrategia componente por componente, procede a aprobar este plan para comenzar inmediatamente con la maquetación.
