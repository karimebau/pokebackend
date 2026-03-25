# Backend BFF para Pokédex

Este proyecto es el backend (Backend For Frontend) para la aplicación Pokédex Full-Stack. Sirve como intermediario entre la [PokéAPI pública](https://pokeapi.co/) y el frontend en Vue 3.

## Funcionalidades Principales

- **Base de Datos Embebida (SQLite)**: Almacena usuarios, favoritos, equipos, lista de amigos y un log de batallas.
- **Autenticación (JWT + bcrypt)**: Registro e inicio de sesión seguro.
- **Proxy/BFF de PokéAPI**: Funciones que consumen, transforman y cachean en memoria las respuestas de la PokéAPI para mayor velocidad (filtro por tipo, generación, evolución, stats).
- **Sistema de Batallas (Battle Engine)**: Simulador de combate por turnos que toma en cuenta la efectividad de los tipos (STAB y tabla de tipos), estadística de ataque especial vs físico, y probabilidad de acierto.

## Requisitos
- Node.js (v18+)

## Instalación y Uso

1. Instala las dependencias:
   ```bash
   npm install
   ```

2. Configura el entorno: Copia el `.env.example` a `.env` (puerto por defecto: 3000, e incluye el JWT_SECRET).
   
3. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

## Estructura de la Base de Datos (`pokedex.db`)
El archivo se creará automáticamente en la raíz si no existe. Tiene las tablas: `users`, `favorites`, `teams`, `team_pokemon`, `friends`, `battles`.

## Principales Endpoints
  * **Auth**: `POST /api/auth/register`, `POST /api/auth/login`
  * **Pokemon**: `GET /api/pokemon` (paginación, filtros), `GET /api/pokemon/:id`
  * **Favoritos**: `GET / POST / DELETE /api/favorites`
  * **Equipos**: `GET / POST / PUT / DELETE /api/teams`, `POST / DELETE /api/teams/:id/pokemon`
  * **Amigos**: `GET / POST / DELETE /api/friends`
  * **Batallas**: `POST /api/battles` (retorna el ganador y el log de los turnos), `GET /api/battles`
