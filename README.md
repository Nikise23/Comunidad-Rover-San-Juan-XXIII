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

### Login (usuario inicial)

La primera vez que la base de datos está **vacía** al arrancar la API, se crea un administrador:

- **Usuario:** `rover_admin` (o el valor de `INITIAL_ADMIN_USERNAME` en `.env`)
- **Contraseña:** la de `INITIAL_ADMIN_PASSWORD` en `.env`, o si no está, `RoverSJ23!2026`

El nombre de usuario se guarda en **minúsculas**; podés escribir lo mismo en el login.

Si “no podés entrar” al desarrollar:

1. Que el backend esté en marcha (`npm run start:dev` en `backend`) y PostgreSQL accesible.
2. Que el front muestre un error claro: si dice que **no conecta al servidor**, revisá que la API responda en la misma URL que usa el front (por defecto `http://localhost:3000`; podés definir `VITE_API_URL` en `frontend/.env`).
3. **CORS:** en `.env` del backend, `FRONTEND_URL` debe coincidir con la URL **exacta** del navegador (mismo host, puerto y `http`/`https`). Por ejemplo `http://127.0.0.1:5173` ≠ `http://localhost:5173` para el navegador.
4. Si la base ya tenía usuarios, el usuario inicial solo se creó si la tabla estaba vacía; usá la cuenta que corresponda o reset de datos/BD de desarrollo.

### Sitio estático (Vite + React Router) en Render

Si al recargar una URL como `/beneficiaries` aparece **Not Found**, el CDN está buscando un archivo en esa ruta. Hay que **reescribir** todas las rutas a `index.html`:

1. En [Render Dashboard](https://dashboard.render.com) → tu **Static Site** → **Redirects/Rewrites** → **Add Rule**.
2. **Source:** `/*`
3. **Destination:** `/index.html`
4. **Action:** **Rewrite** (no Redirect)

Guardá y probá de nuevo. El archivo `frontend/public/_redirects` sirve en otros hosts (p. ej. Netlify); en Render la regla del panel es la que aplica.

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
