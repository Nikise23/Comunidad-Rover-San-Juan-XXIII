# Rover - Gestión de Proyectos y Recaudación

Sistema web para la gestión de proyectos y recaudación de fondos de una comunidad Rover (Scouts): proyectos, beneficiarios, eventos de venta, ventas por beneficiario, rifas y dashboard con gráficos.

## Stack

- **Frontend:** React, TypeScript, Vite, Chart.js, React Router
- **Backend:** NestJS, TypeORM
- **Base de datos:** PostgreSQL

## Requisitos

- Node.js 18+
- PostgreSQL 14+

## Configuración

### Base de datos

Crear la base de datos en PostgreSQL:

```bash
createdb rover_fundraising
```

### Backend

```bash
cd backend
cp .env.example .env
# Editar .env con tu usuario/contraseña de PostgreSQL
npm install
npm run start:dev
```

API en `http://localhost:3000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App en `http://localhost:5173`. Asegúrate de que el backend esté corriendo; el frontend llama a `http://localhost:3000` por defecto.

## Estructura

- **backend/src**
  - **projects** – CRUD proyectos, presupuesto, fechas, estado, beneficiarios
  - **beneficiaries** – CRUD beneficiarios (nombre, DNI, contacto, rol, proyectos)
  - **events** – Eventos de recaudación (nombre, tipo, fecha, ingresos/gastos, productos)
  - **sales** – Ventas por beneficiario por evento/producto; ranking por evento
  - **raffles** – Rifas con números generados; estados disponible/asignado/vendido/no vendido
  - **reports** – Dashboard y resumen financiero por proyecto

- **frontend/src**
  - **pages** – Dashboard (Chart.js), Proyectos, Beneficiarios, Eventos, Detalle evento (ventas, productos), Rifas (números, asignación)
  - **api/client.ts** – Cliente axios y tipos

## Funcionalidades principales

1. **Proyectos:** nombre, descripción, presupuesto objetivo, fechas, estado (activo/finalizado). Barra de avance y eventos asociados.
2. **Beneficiarios:** alta con nombre, apellido, DNI, contacto, rol y asignación a proyectos.
3. **Eventos:** por proyecto; tipos (venta empanadas, pizzas, rifa, feria, etc.); ingresos/gastos; productos con unidad y precio.
4. **Ventas:** registro de cantidad vendida por beneficiario y producto; cálculo de monto y actualización de ingresos del evento; ranking por evento.
5. **Rifas:** creación con cantidad de números y precio; números generados automáticamente; asignación a beneficiarios; estados disponible/asignado/vendido/no vendido.
6. **Dashboard:** progreso por proyecto, evolución de recaudación, ranking de beneficiarios, últimos eventos (Chart.js).

## API REST (resumen)

- `GET/POST /projects` – Listar / crear proyecto
- `GET/PATCH/DELETE /projects/:id` – Ver / actualizar / eliminar
- `GET/POST /beneficiaries` – Listar / crear beneficiario
- `GET/PATCH/DELETE /beneficiaries/:id` – Ver / actualizar / eliminar
- `GET/POST /events` – Listar (opcional `?projectId=`) / crear evento
- `GET/PATCH/DELETE /events/:id` – Ver / actualizar / eliminar
- `POST /events/products` – Añadir producto a evento
- `GET/POST /sales` – Listar (opcional `eventId`, `beneficiaryId`) / crear venta
- `GET /sales/ranking/:eventId` – Ranking de ventas por evento
- `GET/POST /raffles` – Listar (opcional `?eventId=`) / crear rifa
- `GET /raffles/:id/summary` – Resumen rifa (totales y por beneficiario)
- `POST /raffles/:id/numbers/assign` – Asignar número a beneficiario
- `PATCH /raffles/:id/numbers/:number/status` – Cambiar estado del número
- `GET /reports/dashboard?projectId=` – Datos del dashboard
- `GET /reports/project/:id/financial` – Resumen financiero del proyecto

## Opcional (no implementado en esta base)

- Exportar reportes a PDF
- Exportar ventas a Excel
- Historial de eventos y estadísticas globales
