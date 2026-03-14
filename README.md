# Anamneo

Sistema de gestión de fichas clínicas para atención médica.

## Requisitos

- Node.js 20+ y npm (desarrollo local)
- Docker y Docker Compose (opcional)

## Inicio Rápido en Desarrollo

1. **Clonar el repositorio y entrar al directorio:**

   ```bash
   cd pacientes
   ```

2. **Instalar dependencias:**

   ```bash
   npm run install:all
   ```

3. **Configurar variables de entorno:**

   ```bash
   cp .env.example .env
   # Editar .env y reemplazar JWT_* por valores reales
   # DATABASE_URL ya viene configurado para SQLite (backend/prisma/dev.db)
   ```

4. **Inicializar base de datos (primera vez):**

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

5. **Iniciar en modo desarrollo:**

   ```bash
   npm run dev
   ```

6. **Acceder a la aplicación:**
   - Frontend: http://localhost:5555
   - API: http://localhost:4444/api

## Inicio Rápido con Docker (Opcional)

1. **Configurar variables de entorno:**

   ```bash
   cp .env.example .env
   # Editar .env y reemplazar JWT_* por valores reales
   ```

2. **Iniciar los servicios:**

   ```bash
   docker-compose up -d
   ```

3. **Ejecutar migraciones y seed (primera vez):**

   ```bash
   docker-compose exec backend npx prisma db push
   docker-compose exec backend npm run prisma:seed
   ```

4. **Acceder a la aplicación:**
   - Frontend: http://localhost:5555
   - API: http://localhost:4444/api

## Desarrollo Local

El comando `npm run dev` en la raíz levanta backend y frontend con un supervisor que escucha señales de cierre (`SIGINT`, `SIGTERM`, `SIGHUP`) para detener ambos procesos de forma automática al cerrar la terminal/IDE.

### Backend

```bash
npm --prefix backend install
cp .env.example .env
# Editar .env con tus secretos JWT y CORS reales
# DATABASE_URL debe usar formato file:... (SQLite)
npm --prefix backend run prisma:generate
npm --prefix backend exec prisma db push
npm --prefix backend run prisma:seed
npm --prefix backend run start:dev
```

### Frontend

```bash
npm --prefix frontend install
npm run dev:frontend
```

## Primeros Pasos

1. Acceder a http://localhost:5555/register
2. Crear la primera cuenta de médico
3. Iniciar sesión con la cuenta creada
4. Crear asistentes desde la administración una vez inicializado el sistema

## Estructura del Proyecto

```
pacientes/
├── backend/           # API NestJS
│   ├── src/
│   │   ├── auth/      # Autenticación JWT
│   │   ├── patients/  # Gestión de pacientes
│   │   ├── encounters/# Atenciones médicas
│   │   ├── conditions/# Catálogo con TF-IDF
│   │   └── ...
│   └── prisma/        # Schema y migraciones
├── frontend/          # Next.js 14
│   └── src/
│       ├── app/       # Pages (App Router)
│       ├── components/# Componentes React
│       └── lib/       # Utilidades
└── docker-compose.yml
```

## Funcionalidades Principales

- ✅ Gestión de pacientes con validación de RUT
- ✅ Wizard de 10 secciones para atenciones
- ✅ Autoguardado cada 10 segundos
- ✅ Sugerencias de afecciones con TF-IDF
- ✅ Vista de ficha clínica para impresión
- ✅ Control de acceso por roles
- ✅ Auditoría de cambios

## Licencia

Privado / Uso interno
