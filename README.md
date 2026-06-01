# D'Antojitos© — Plataforma Web de Dulcería Artesanal

> Aplicación web full-stack para la gestión integral de una tienda de postres artesanales colombiana. Cubre el ciclo completo de venta: catálogo, carrito, pedidos, facturación, mensajería privada y panel administrativo.

---

## Índice

1. [Descripción General](#descripción-general)
2. [Stack Tecnológico](#stack-tecnológico)
3. [Flujo Principal de la Aplicación](#flujo-principal-de-la-aplicación)
4. [Roles y Permisos](#roles-y-permisos)
5. [Módulos del Sistema](#módulos-del-sistema)
6. [Arquitectura del Proyecto](#arquitectura-del-proyecto)
7. [Base de Datos](#base-de-datos)
8. [Variables de Entorno](#variables-de-entorno)
9. [Instalación y Ejecución Local](#instalación-y-ejecución-local)
10. [Despliegue en Producción](#despliegue-en-producción)

---

## Descripción General

**D'Antojitos©** es una plataforma de comercio electrónico especializada en postres artesanales. Está construida con **Python/Flask** en el backend y **Jinja2 + Bootstrap** en el frontend, conectada a **Supabase (PostgreSQL)** como base de datos principal y a **Cloudinary** para el almacenamiento de imágenes.

La aplicación soporta tres perfiles de usuario con flujos completamente diferenciados: cliente, vendedor y administrador. Incluye sistema de internacionalización (ES/EN), modo oscuro, notificaciones en tiempo real, mensajería privada multicanal y generación de facturas en PDF.

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Backend** | Python 3.12 · Flask 3.0.3 · Flask-CORS |
| **Servidor (desarrollo)** | Waitress 3.0.0 |
| **Servidor (producción)** | Gunicorn 22.0.0 |
| **Base de datos** | Supabase (PostgreSQL) · supabase-py 2.10.0 |
| **Almacenamiento de imágenes** | Cloudinary 1.41.0 |
| **Autenticación** | Google OAuth2 · sesiones Flask (SHA-256 + salt) |
| **Frontend** | Jinja2 · Bootstrap 5.3.3 · Bootstrap Icons · Vanilla JS |
| **Email transaccional** | Resend 2.30.1 |
| **Despliegue** | Vercel (serverless) |

---

## Flujo Principal de la Aplicación

```
┌─────────────────────────────────────────────────────────────────┐
│                        USUARIO VISITANTE                        │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
         ┌───────────────────────┐
         │   /inicio  (Home)     │  Cinta publicitaria · Bienvenida ·
         │                       │  Catálogo en vista previa
         └───────────┬───────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
  ┌───────────────┐    ┌─────────────────────┐
  │  /catalogo    │    │  /login · /registro  │
  │  Ver productos│    │  Google OAuth2       │
  └───────┬───────┘    └──────────┬──────────┘
          │                       │
          │              ┌────────┴────────┐
          │              │  SESIÓN ACTIVA  │
          │              └────────┬────────┘
          │                       │
          ▼                       ▼
  ┌───────────────┐    ┌──────────────────────┐
  │  /carrito     │◄───│  Agregar al carrito   │
  │  Ver · Editar │    │  desde catálogo       │
  └───────┬───────┘    └──────────────────────┘
          │
          ▼
  ┌───────────────────────────────────────┐
  │           GENERACIÓN DE PEDIDO        │
  │  Confirmación → Pedido creado en      │
  │  Supabase con estado "Pendiente"      │
  └───────────────────┬───────────────────┘
                      │
          ┌───────────┴────────────┐
          │                        │
          ▼                        ▼
  ┌──────────────┐        ┌────────────────────┐
  │   CLIENTE    │        │  VENDEDOR / ADMIN  │
  │              │        │                    │
  │ · Ver estado │        │ · Módulo Pedidos   │
  │   pedido     │        │   (gestión CRUD)   │
  │ · Historial  │        │ · Cambiar estado   │
  │   facturas   │        │ · Emitir factura   │
  │ · Mensajes   │        │ · Módulo Productos │
  │   privados   │        │ · Mensajería staff │
  └──────────────┘        └────────────────────┘
                                    │
                                    ▼
                          ┌──────────────────────┐
                          │     ADMIN EXCLUSIVO  │
                          │                      │
                          │ · Módulo Publicidad  │
                          │ · Módulo Facturación │
                          │ · Gestión Usuarios   │
                          │ · Zona de Pagos      │
                          └──────────────────────┘
```

### Ciclo de vida de un pedido

```
Pendiente  ──►  Enviado  ──►  Entregado  ──►  [Factura PDF]
    │
    └──►  Cancelado / Anulado
```

El estado del pedido es actualizado por el vendedor o administrador desde el Módulo de Pedidos. Al marcar como **Emitida**, el sistema genera automáticamente una factura asociada visible para el cliente en su historial.

### Ciclo de pago

```
Pedido pendiente de pago
        │
        ▼
Cliente envía comprobante de pago
        │
        ▼
Vendedor/Admin revisa en Módulo Facturación
        │
        ├── Aprobado ──► Estado: Pagado ✓
        └── Rechazado ──► Notificación al cliente
```

---

## Roles y Permisos

| Módulo / Acción | Cliente | Vendedor | Admin |
|---|:---:|:---:|:---:|
| Ver catálogo | ✅ | ✅ | ✅ |
| Agregar al carrito | ✅ | ✅ | ✅ |
| Ver historial de facturas | ✅ (propias) | ✅ (todas) | ✅ |
| Muro de sugerencias | ✅ | ✅ | ✅ |
| Mensajes privados (clientes) | ✅ | ✅ | ✗ |
| Mensajes staff/equipo | ✗ | ✅ | ✅ |
| Gestión de pedidos | ✗ | ✅ | ✅ |
| Gestión de productos | ✗ | ✅ | ✅ |
| Módulo Publicidad | ✗ | ✗ | ✅ |
| Módulo Facturación | ✗ | ✗ | ✅ |
| Gestión de usuarios | ✗ | ✗ | ✅ |
| Ver manual del sistema | ✗ | ✅ | ✅ |

---

## Módulos del Sistema

### Módulos de Usuario (todos los roles)

- **Inicio (`/inicio`)** — Panel principal con cinta publicitaria dinámica, sección de bienvenida configurable y accesos rápidos. Los administradores pueden editar el contenido en modo visual (drag-and-drop).
- **Catálogo (`/catalogo_page`)** — Vitrina de productos con filtros, buscador y monitor de stock en tiempo real. Soporte multiidioma (ES/EN).
- **Carrito (`/carrito_page`)** — Gestión de ítems, cálculo de totales y generación del pedido.
- **Perfil (`/mi_perfil`)** — Edición de datos personales con cooldown de 30 días en campos sensibles (cédula, nombre, apellido, usuario), cambio de contraseña, y eliminación de cuenta.
- **Historial de Facturas (`/gestionar_facturas_page`)** — Listado de facturas con filtros, vista de detalle, modal de pago con QR, y archivado persistente.
- **Sugerencias y Mensajes (`/comentarios_page`)** — Muro público de sugerencias con likes, edición y respuesta por rol. Panel privado con mensajería cliente↔vendedor y staff↔staff.

### Módulos de Vendedor

- **Pedidos (`/pedidos_page`)** — Vista Kanban de todos los pedidos con gestión de estado, diferenciadores visuales por estado (activo/finalizado/anulado) y notificaciones en tiempo real.
- **Productos (`/gestionar_productos_page`)** — CRUD completo de productos con subida de imágenes a Cloudinary, control de stock y estados.

### Módulos Exclusivos de Administrador

- **Publicidad (`/publicidad_page`)** — Gestión de la cinta de inicio (Home Ticker) con control de velocidad y previsualización en vivo.
- **Facturación (`/facturacion_page`)** — Registro de pagos, validación de comprobantes, generación de facturas y reportes.
- **Gestión de Usuarios (`/gestion_usuarios_page`)** — Alta, edición y gestión de roles de usuarios.
- **Manual del Sistema (`/manual_page`)** — Documentación interna para vendedores y administradores.

---

## Arquitectura del Proyecto

```
D'Antojitos - Local/
│
├── app.py                          # Punto de entrada · registro de blueprints
├── requirements.txt
├── Dockerfile
│
├── controllers/                    # Blueprints Flask (un archivo por dominio)
│   ├── auth.py                     # Login · Registro · Google OAuth2 · Logout
│   ├── perfil.py                   # Perfil usuario · cooldowns · restricciones
│   ├── perfil_usuarios.py          # Gestión de usuarios (admin)
│   ├── gestion_productos.py        # CRUD productos + Cloudinary
│   ├── catalogo_productos.py       # Catálogo público
│   ├── carrito.py                  # Carrito de compras
│   ├── pedidos_usuarios.py         # Módulo de pedidos (vendedor/admin)
│   ├── historial_facturas.py       # Facturas · archivado · PDF
│   ├── publicidad.py               # Cinta publicitaria (admin)
│   ├── facturacion.py              # Facturación y pagos (admin)
│   ├── comentarios.py              # Muro público · mensajería privada
│   ├── inicio.py                   # Home · configuración de widgets
│   └── paginas_estaticas.py        # Políticas · condiciones · manual
│
├── helpers/
│   ├── models.py                   # Capa de acceso a datos (Supabase)
│   ├── auth.py                     # Decoradores: login_required · vendedor_required · admin_required
│   ├── validators.py               # Validaciones de campos (username, cédula, etc.)
│   ├── cloudinary.py               # Subida y compresión de imágenes
│   └── database.py                 # Cliente Supabase centralizado
│
├── templates/
│   ├── global_modules/             # navbar.html · footer.html · login · registro
│   ├── general_modules/            # inicio · catálogo · carrito · perfil · comentarios · facturas
│   └── admin_modules/              # pedidos · productos · publicidad · facturación · manual
│
└── static/
    ├── css/
    │   ├── global_modules/         # style_navbar · style_footer · style_utils · style_inicio
    │   ├── general_modules/        # style_perfil · style_comentarios · style_catalogo · etc.
    │   └── admin_modules/          # style_pedidos · style_productos · etc.
    ├── js/
    │   ├── global_js/              # utils.js · i18n.js · inicio.js · widget_system.js
    │   ├── general_js/             # perfil.js · comentarios.js · facturas.js · catalogo.js
    │   ├── admin_js/               # pedidos.js · gestion_productos.js · facturacion.js
    │   └── workers/                # Service Workers por módulo
    └── uploads/                    # Archivos estáticos locales (logo, íconos)
```

### Patrón de Capas

```
Solicitud HTTP
      │
      ▼
 Flask Blueprint (controllers/)
      │   Valida sesión · rol · datos de entrada
      ▼
 helpers/models.py
      │   Consultas Supabase (select · insert · update · delete)
      ▼
 Supabase (PostgreSQL)
      │
      ▼
 Respuesta JSON o render_template()
```

---

## Base de Datos

### Tablas principales

| Tabla | Descripción |
|---|---|
| `usuarios` | Datos del usuario, rol, imagen, cooldowns de campos |
| `roles` | Definición de roles: `cliente`, `vendedor`, `admin` |
| `gestion_productos` | Catálogo de productos con stock, precio e imagen |
| `carrito` | Ítems del carrito por usuario |
| `pedidos` | Cabecera del pedido con estado y datos de entrega |
| `pedido_detalle` | Líneas de detalle de cada pedido |
| `facturas` | Facturas generadas, estado de pago y campo `archivada` |
| `metodos_pago` | Métodos de pago habilitados con datos de cuenta y QR |
| `publicidad` | Ítems de la cinta publicitaria con estado activo/inactivo |
| `comentarios` | Muro público de sugerencias con likes |
| `mensajes_privados` | Mensajería privada con columnas `tipo` (cv/staff) y `cedula_dest` |

### Migraciones requeridas

```sql
-- Archivado persistente de facturas
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS archivada BOOLEAN DEFAULT FALSE;

-- Canal de mensajería multicanal
ALTER TABLE mensajes_privados ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'cv';
ALTER TABLE mensajes_privados ADD COLUMN IF NOT EXISTS cedula_dest TEXT;

-- Cooldowns de perfil (30 días por campo)
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS last_change_cedula    TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS last_change_username   TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS last_change_nombre     TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS last_change_apellido   TIMESTAMPTZ;

-- Rol vendedor
INSERT INTO roles (nombre_role) VALUES ('vendedor') ON CONFLICT DO NOTHING;
```

---

## Variables de Entorno

Crear un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# Supabase
SUPABASE_URL=https://<proyecto>.supabase.co
SUPABASE_SERVICE_KEY=<service_role_key>
SUPABASE_REST_URL=https://<proyecto>.supabase.co/rest/v1

# Cloudinary
CLOUDINARY_CLOUD_NAME=<cloud_name>
CLOUDINARY_API_KEY=<api_key>
CLOUDINARY_API_SECRET=<api_secret>

# Google OAuth2
GOOGLE_CLIENT_ID=<client_id>.apps.googleusercontent.com

# Flask
FLASK_SECRET_KEY=<clave_aleatoria_segura>
```

---

## Instalación y Ejecución Local

### Requisitos previos

- Python 3.12+
- Cuenta en [Supabase](https://supabase.com)
- Cuenta en [Cloudinary](https://cloudinary.com)
- Credenciales de [Google Cloud Console](https://console.cloud.google.com) para OAuth2

### Pasos

```bash
# 1. Clonar el repositorio
git clone <url-del-repositorio>
cd "D'Antojitos - Local"

# 2. Crear y activar entorno virtual
python -m venv venv

# Windows
venv\Scripts\activate

# Linux / macOS
source venv/bin/activate

# 3. Instalar dependencias
pip install -r requirements.txt

# 4. Configurar variables de entorno
cp .env.example .env
# Editar .env con las credenciales correspondientes

# 5. Ejecutar las migraciones SQL en Supabase
# (ver sección Base de Datos → Migraciones requeridas)

# 6. Iniciar el servidor de desarrollo
python app.py
```

El servidor estará disponible en:
- **Local:** `http://localhost:8000`
- **Red local:** `http://<IP-local>:8000`

---

## Despliegue en Producción

La aplicación está configurada para desplegarse en **Vercel** en modo serverless con **Gunicorn**.

### Archivos de configuración relevantes

- `Dockerfile` — imagen para contenedores
- `vercel.json` — configuración de rutas y runtime para Vercel

### Variables de entorno en Vercel

Configurar las mismas variables del archivo `.env` directamente en el panel de Vercel bajo **Settings → Environment Variables**.

### Consideraciones de producción

- El modo `debug=True` en `app.py` debe estar desactivado (`debug_mode = False`)
- Las sesiones están configuradas para una duración de **24 horas** (`permanent_session_lifetime`)
- El campo `MAX_CONTENT_LENGTH` admite hasta **50 MB** por subida (imágenes Cloudinary)
- CORS está habilitado globalmente con `flask-cors`

---

## Sistema de Internacionalización

La aplicación incluye soporte completo para **Español (ES)** e **Inglés (EN)**.

- Los textos HTML usan el atributo `data-i18n="clave"` para traducción automática
- En JavaScript se usa la función `t('clave')` definida en `static/js/global_js/i18n.js`
- El idioma se guarda en `localStorage` y se aplica en tiempo real sin recarga de página

---

## Características Adicionales

- **Modo oscuro** — Tema claro/oscuro persistido en `localStorage`
- **Monitor de stock en tiempo real** — Polling cada 8 segundos; notificaciones automáticas cuando un producto se agota o se repone
- **Notificaciones nativas del navegador** — Solicitud de permisos en primera visita
- **Cinta publicitaria dinámica** — Ticker configurable con control de velocidad (0.5×, 1×, 1.5×, 2×)
- **Cooldown de 30 días** en campos sensibles del perfil (cédula, usuario, nombre, apellido) con cuenta regresiva en tiempo real
- **Service Workers** por módulo para caché y experiencia offline básica
- **Scroll to top** y barra de progreso de lectura global

---

*D'Antojitos© — Hecho con amor desde casa.*
