# 🃏 Proyecto TCG Web - Juego de Cartas Coleccionables Pokémon

Bienvenido al repositorio oficial del **Proyecto TCG Web**, un videojuego web de Cartas Coleccionables desarrollado con Angular 18, diseñado como entrega para evaluación departamental. 

En este juego tomas el papel de un Entrenador Pokémon para armar tu mazo, gestionar tu colección y combatir tanto de manera Local contra una IA inteligente, como en línea (Multijugador P2P) contra tus amigos alrededor del mundo.

## ✨ Características Principales
* **Modo Local (VS IA):** Combate 100% sin conexión contra un oponente simulado y guarda tus resultados en el historial de almacenamiento local (implementación de Base de Datos Local estilo SQLite).
* **Modo Online Multijugador:** Encuentra partidas a través del sistema de *Matchmaking* en tiempo real gestionado a través de Supabase y WebSockets.
* **Sistema de Colecciones:** Cada carta es consultada dinámicamente desde *PokeAPI*, y se asignan estadísticas y habilidades especiales automáticamente en base al tipo de cada Pokémon.
* **Constructor de Mazos:** Selecciona estratégicamente 6 cartas para tu mano inicial y guarda configuraciones que persisten en la nube.
* **Diseño e Interfaz Modernos:** Interfaz estéticamente pulida con el estilo *Glassmorphism*, paletas vibrantes, animaciones fluidas en el campo de batalla, y adaptabilidad (Responsive).
* **Motor de Reglas Riguroso:** Implementación estricta de las mecánicas TCG clásicas, gestionando Daño de Batalla, Fases de Robo, Posiciones de Ataque y Defensa, y Habilidades de supervivencia.

## 🛠️ Stack Tecnológico (Tecnologías Usadas)
- **Frontend:** Angular 18 (Standalone Components, RxJS, Signals)
- **Estilos:** SCSS (Sass) Nativo con animaciones CSS3
- **Base de Datos / Backend:** Supabase (PostgreSQL + Auth + Realtime Channels)
- **Base de Datos Local:** `sql.js` sobre LocalStorage (Simulando SQLite local)
- **APIs Externas:** PokeAPI para la ingesta de JSON de cartas y metadatos.

## 🚀 Despliegue en Desarrollo

Este proyecto fue generado con [Angular CLI](https://github.com/angular/angular-cli). Para ejecutar este proyecto localmente en tu computadora:

1. **Instala dependencias:**
   Ejecuta `npm install` en la raíz del proyecto.
   
2. **Levanta el servidor local:**
   Ejecuta `ng serve`. 
   
3. **Accede al juego:**
   Abre tu navegador y navega hacia `http://localhost:4200/`. La aplicación se recargará automáticamente si realizas cambios en los archivos fuente.

## 👥 Arquitectura y Mecánicas
Para conocer detalladamente la estructura y manual de usuario, revisa la [Documentación Completa](documentacion_proyecto.md) generada de este repositorio, donde se explican todas las tablas, mecánicas en línea, decisiones arquitectónicas, e inconvenientes superados.

---
*Desarrollado para la evaluación del Tercer Departamental.*
