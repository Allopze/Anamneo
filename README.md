# Fichas Clínicas

Sistema de gestión de fichas clínicas para atención médica.

## Requisitos

- Docker y Docker Compose
- Node.js 20+ (solo para desarrollo local)

## Inicio Rápido con Docker

1. **Clonar el repositorio y entrar al directorio:**

   ```bash
   cd pacientes
   ```

2. **Configurar variables de entorno:**

   ```bash
   cp .env.example .env
   ```

3. **Iniciar los servicios:**

   ```bash
   docker-compose up -d
   ```

4. **Ejecutar migraciones y seed (primera vez):**

   ```bash
   docker-compose exec backend npx prisma migrate deploy
   docker-compose exec backend npx prisma db seed
   ```

5. **Acceder a la aplicación:**
   - Frontend: http://localhost:5555
   - API: http://localhost:4444/api

## Desarrollo Local

### Backend

```bash
npm --prefix backend install
cp .env.example .env
# Editar .env con tu configuración de PostgreSQL
npm run db:migrate
npm run db:seed
npm run dev:backend
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
