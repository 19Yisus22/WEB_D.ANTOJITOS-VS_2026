CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

DROP TABLE IF EXISTS inicio_config     CASCADE;
DROP TABLE IF EXISTS comentarios       CASCADE;
DROP TABLE IF EXISTS chats_privados    CASCADE;
DROP TABLE IF EXISTS carrito           CASCADE;
DROP TABLE IF EXISTS facturas          CASCADE;
DROP TABLE IF EXISTS pedido_detalle    CASCADE;
DROP TABLE IF EXISTS pedidos           CASCADE;
DROP TABLE IF EXISTS publicidad        CASCADE;
DROP TABLE IF EXISTS metodos_pago      CASCADE;
DROP TABLE IF EXISTS gestion_productos CASCADE;
DROP TABLE IF EXISTS usuarios          CASCADE;
DROP TABLE IF EXISTS roles             CASCADE;

DROP FUNCTION IF EXISTS fn_set_usuario_rol()       CASCADE;
DROP FUNCTION IF EXISTS fn_pedido_sync_total()     CASCADE;
DROP FUNCTION IF EXISTS fn_factura_autonumero()    CASCADE;

-- ================================================================
--  TABLAS
-- ================================================================

CREATE TABLE roles (
    id_role     uuid NOT NULL DEFAULT gen_random_uuid(),
    nombre_role text NOT NULL UNIQUE
        CHECK (nombre_role = ANY (ARRAY[
            'admin','vendedor','cliente','visitante'
        ])),
    descripcion text,
    CONSTRAINT roles_pkey PRIMARY KEY (id_role)
);

CREATE TABLE usuarios (
    cedula          text        NOT NULL,
    username        text        UNIQUE,
    imagen_url      text        DEFAULT 'static/uploads/default_icon_profile.png',
    nombre          text        NOT NULL,
    apellido        text        NOT NULL,
    telefono        text,
    correo          text        NOT NULL UNIQUE,
    contrasena      text,
    id_role         uuid,
    direccion       text,
    metodo_pago     text        DEFAULT 'Efectivo'
        CHECK (metodo_pago = ANY (ARRAY['Efectivo','Transferencia'])),
    fecha_creacion  timestamptz DEFAULT now(),
    ultima_conexion timestamptz,
    block_folder    jsonb       DEFAULT '[]'::jsonb,
    web_token       text,
    expires_at      timestamptz,
    CONSTRAINT usuarios_pkey         PRIMARY KEY (cedula),
    CONSTRAINT usuarios_id_role_fkey FOREIGN KEY (id_role)
        REFERENCES roles(id_role)
);

ALTER TABLE usuarios ADD COLUMN block_folder jsonb      DEFAULT '[]'::jsonb;
ALTER TABLE usuarios ADD COLUMN web_token    text;
ALTER TABLE usuarios ADD COLUMN expires_at   timestamptz;

CREATE TABLE gestion_productos (
    id_producto    uuid        NOT NULL DEFAULT gen_random_uuid(),
    nombre         text        NOT NULL,
    descripcion    text,
    precio         numeric     NOT NULL CHECK (precio >= 0),
    stock          integer     NOT NULL DEFAULT 0 CHECK (stock >= 0),
    imagen_url     text,
    categoria      text        DEFAULT 'Postre',
    fecha_creacion timestamptz DEFAULT now(),
    estado         boolean     DEFAULT true,
    CONSTRAINT gestion_productos_pkey PRIMARY KEY (id_producto)
);

CREATE TABLE metodos_pago (
    id_pago        uuid        NOT NULL DEFAULT gen_random_uuid(),
    entidad        text        NOT NULL
        CHECK (entidad = ANY (ARRAY[
            'Nequi','Daviplata','Bancolombia','NuBank'
        ])),
    tipo_cuenta    text        NOT NULL
        CHECK (tipo_cuenta = ANY (ARRAY[
            'Billetera Digital','Ahorros','Corriente'
        ])),
    numero         text        NOT NULL,
    titular        text        NOT NULL,
    qr_url         text,
    estado         boolean     DEFAULT true,
    fecha_creacion timestamptz DEFAULT now(),
    CONSTRAINT metodos_pago_pkey PRIMARY KEY (id_pago)
);

CREATE TABLE pedidos (
    id_pedido         uuid        NOT NULL DEFAULT gen_random_uuid(),
    cedula            text,
    direccion_entrega text        NOT NULL,
    metodo_pago       text
        CHECK (metodo_pago = ANY (ARRAY['Efectivo','Transferencia'])),
    estado            text        NOT NULL DEFAULT 'Pendiente'
        CHECK (estado = ANY (ARRAY[
            'Pendiente','Enviado','Entregado','Cancelado'
        ])),
    pagado            boolean     DEFAULT false,
    fecha_pedido      timestamptz DEFAULT now(),
    total             numeric     DEFAULT 0 CHECK (total >= 0),
    numero_factura    text        UNIQUE,
    CONSTRAINT pedidos_pkey        PRIMARY KEY (id_pedido),
    CONSTRAINT pedidos_cedula_fkey FOREIGN KEY (cedula)
        REFERENCES usuarios(cedula) ON DELETE SET NULL
);

CREATE TABLE pedido_detalle (
    id_detalle      uuid    NOT NULL DEFAULT gen_random_uuid(),
    id_pedido       uuid,
    id_producto     uuid,
    nombre_producto text    NOT NULL,
    cantidad        integer NOT NULL CHECK (cantidad > 0),
    precio_unitario numeric NOT NULL CHECK (precio_unitario >= 0),
    subtotal        numeric GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
    CONSTRAINT pedido_detalle_pkey             PRIMARY KEY (id_detalle),
    CONSTRAINT pedido_detalle_id_pedido_fkey   FOREIGN KEY (id_pedido)
        REFERENCES pedidos(id_pedido)           ON DELETE CASCADE,
    CONSTRAINT pedido_detalle_id_producto_fkey FOREIGN KEY (id_producto)
        REFERENCES gestion_productos(id_producto) ON DELETE SET NULL
);

CREATE TABLE facturas (
    id_factura     uuid        NOT NULL DEFAULT gen_random_uuid(),
    id_pedido      uuid,
    cedula         text,
    id_pago        uuid,
    numero_factura text        UNIQUE,
    fecha_emision  timestamptz DEFAULT now(),
    subtotal       numeric     NOT NULL CHECK (subtotal >= 0),
    total          numeric     NOT NULL CHECK (total >= 0),
    metodo_pago    text
        CHECK (metodo_pago = ANY (ARRAY['Efectivo','Transferencia'])),
    estado         text        DEFAULT 'Emitida'
        CHECK (estado = ANY (ARRAY['Emitida','Anulada','Pagada'])),
    CONSTRAINT facturas_pkey           PRIMARY KEY (id_factura),
    CONSTRAINT facturas_id_pedido_fkey FOREIGN KEY (id_pedido)
        REFERENCES pedidos(id_pedido)    ON DELETE SET NULL,
    CONSTRAINT facturas_cedula_fkey    FOREIGN KEY (cedula)
        REFERENCES usuarios(cedula)      ON DELETE SET NULL,
    CONSTRAINT facturas_id_pago_fkey   FOREIGN KEY (id_pago)
        REFERENCES metodos_pago(id_pago) ON DELETE SET NULL
);

CREATE TABLE carrito (
    id_carrito      uuid    NOT NULL DEFAULT gen_random_uuid(),
    cedula          text,
    id_producto     uuid,
    nombre_producto text,
    cantidad        integer NOT NULL CHECK (cantidad > 0),
    precio_unitario numeric NOT NULL CHECK (precio_unitario >= 0),
    total           numeric GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
    fecha_creacion  timestamptz DEFAULT now(),
    CONSTRAINT carrito_pkey             PRIMARY KEY (id_carrito),
    CONSTRAINT carrito_cedula_fkey      FOREIGN KEY (cedula)
        REFERENCES usuarios(cedula)     ON DELETE CASCADE,
    CONSTRAINT carrito_id_producto_fkey FOREIGN KEY (id_producto)
        REFERENCES gestion_productos(id_producto) ON DELETE CASCADE
);

CREATE TABLE comentarios (
    id             uuid        NOT NULL DEFAULT gen_random_uuid(),
    cedula         text,
    nombre_usuario text        NOT NULL,
    correo_usuario text        NOT NULL,
    foto_perfil    text,
    mensaje        text        NOT NULL,
    likes_usuarios jsonb       DEFAULT '[]'::jsonb,
    created_at     timestamptz DEFAULT now(),
    CONSTRAINT comentarios_pkey        PRIMARY KEY (id),
    CONSTRAINT comentarios_cedula_fkey FOREIGN KEY (cedula)
        REFERENCES usuarios(cedula)    ON DELETE SET NULL
);

CREATE TABLE chats_privados (
    id          uuid        NOT NULL DEFAULT gen_random_uuid(),
    cedula_de   text        NOT NULL,
    cedula_para text        NOT NULL,
    mensaje     text        NOT NULL,
    leido       boolean     DEFAULT false,
    created_at  timestamptz DEFAULT now(),
    CONSTRAINT chats_privados_pkey              PRIMARY KEY (id),
    CONSTRAINT chats_privados_cedula_de_fkey    FOREIGN KEY (cedula_de)
        REFERENCES usuarios(cedula)             ON DELETE CASCADE,
    CONSTRAINT chats_privados_cedula_para_fkey  FOREIGN KEY (cedula_para)
        REFERENCES usuarios(cedula)             ON DELETE CASCADE
);

CREATE TABLE publicidad (
    id_publicidad  uuid        NOT NULL DEFAULT gen_random_uuid(),
    tipo           text        NOT NULL
        CHECK (tipo = ANY (ARRAY[
            'carrusel','seccion','notificacion',
            'cinta','login_slide','inicio_cinta'
        ])),
    titulo         text,
    descripcion    text,
    imagen_url     text,
    estado         boolean     DEFAULT true,
    fecha_creacion timestamptz DEFAULT now(),
    CONSTRAINT publicidad_pkey PRIMARY KEY (id_publicidad)
);

CREATE TABLE inicio_config (
    clave text NOT NULL,
    valor text,
    CONSTRAINT inicio_config_pkey PRIMARY KEY (clave)
);

-- ================================================================
--  ÍNDICES
-- ================================================================

CREATE INDEX idx_usuarios_id_role        ON usuarios(id_role);
CREATE INDEX idx_usuarios_correo_lower   ON usuarios(lower(correo));
CREATE INDEX idx_usuarios_username_lower ON usuarios(lower(username))
    WHERE username IS NOT NULL;

CREATE INDEX idx_productos_estado        ON gestion_productos(estado);
CREATE INDEX idx_productos_estado_stock  ON gestion_productos(estado, stock);
CREATE INDEX idx_productos_nombre_trgm   ON gestion_productos
    USING gin(nombre gin_trgm_ops);
CREATE INDEX idx_productos_fecha         ON gestion_productos(fecha_creacion DESC);

CREATE INDEX idx_pedidos_cedula          ON pedidos(cedula);
CREATE INDEX idx_pedidos_estado          ON pedidos(estado);
CREATE INDEX idx_pedidos_fecha           ON pedidos(fecha_pedido DESC);

CREATE INDEX idx_detalle_id_pedido       ON pedido_detalle(id_pedido);
CREATE INDEX idx_detalle_id_producto     ON pedido_detalle(id_producto);

CREATE INDEX idx_facturas_cedula         ON facturas(cedula);
CREATE INDEX idx_facturas_fecha          ON facturas(fecha_emision DESC);
CREATE INDEX idx_facturas_id_pedido      ON facturas(id_pedido);

CREATE INDEX idx_carrito_cedula          ON carrito(cedula);
CREATE INDEX idx_carrito_cedula_prod     ON carrito(cedula, id_producto);

CREATE INDEX idx_comentarios_fecha       ON comentarios(created_at DESC);
CREATE INDEX idx_comentarios_cedula      ON comentarios(cedula);

CREATE INDEX idx_chats_cedula_de         ON chats_privados(cedula_de);
CREATE INDEX idx_chats_cedula_para       ON chats_privados(cedula_para);
CREATE INDEX idx_chats_conversacion      ON chats_privados(cedula_de, cedula_para, created_at DESC);
CREATE INDEX idx_chats_leido             ON chats_privados(cedula_para, leido) WHERE leido = false;
CREATE INDEX idx_chats_fecha             ON chats_privados(created_at DESC);

CREATE INDEX idx_publicidad_tipo_estado  ON publicidad(tipo, estado);
CREATE INDEX idx_publicidad_fecha        ON publicidad(fecha_creacion DESC);

-- ================================================================
--  FUNCIONES Y TRIGGERS
-- ================================================================

CREATE OR REPLACE FUNCTION fn_set_usuario_rol()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.id_role IS NULL THEN
        SELECT id_role INTO NEW.id_role
        FROM roles
        WHERE nombre_role = 'cliente'
        LIMIT 1;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_usuario_set_rol
    BEFORE INSERT ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_usuario_rol();

CREATE OR REPLACE FUNCTION fn_pedido_sync_total()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_pedido_id   uuid;
    v_nuevo_total numeric;
BEGIN
    v_pedido_id := COALESCE(NEW.id_pedido, OLD.id_pedido);

    SELECT COALESCE(SUM(cantidad * precio_unitario), 0)
    INTO   v_nuevo_total
    FROM   pedido_detalle
    WHERE  id_pedido = v_pedido_id;

    UPDATE pedidos
    SET    total = v_nuevo_total
    WHERE  id_pedido = v_pedido_id;

    RETURN NULL;
END;
$$;

CREATE TRIGGER trg_pedido_sync_total
    AFTER INSERT OR UPDATE OR DELETE ON pedido_detalle
    FOR EACH ROW
    EXECUTE FUNCTION fn_pedido_sync_total();

CREATE OR REPLACE FUNCTION fn_factura_autonumero()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_year text;
    v_seq  integer;
BEGIN
    IF NEW.numero_factura IS NOT NULL THEN
        RETURN NEW;
    END IF;

    v_year := to_char(now(), 'YYYY');

    SELECT COALESCE(
        MAX(CAST(split_part(numero_factura, '-', 3) AS integer)), 0
    ) + 1
    INTO v_seq
    FROM facturas
    WHERE numero_factura LIKE 'F-' || v_year || '-%';

    NEW.numero_factura := 'F-' || v_year || '-' || lpad(v_seq::text, 6, '0');
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_factura_autonumero
    BEFORE INSERT ON facturas
    FOR EACH ROW
    EXECUTE FUNCTION fn_factura_autonumero();

-- ================================================================
--  ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE roles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios          ENABLE ROW LEVEL SECURITY;
ALTER TABLE gestion_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE metodos_pago      ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_detalle    ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrito           ENABLE ROW LEVEL SECURITY;
ALTER TABLE comentarios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats_privados    ENABLE ROW LEVEL SECURITY;
ALTER TABLE publicidad        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inicio_config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS archivada BOOLEAN DEFAULT FALSE;
ALTER TABLE mensajes_privados ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'cv';
ALTER TABLE mensajes_privados ADD COLUMN IF NOT EXISTS cedula_dest TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS last_change_cedula TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS last_change_username TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS last_change_nombre TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS last_change_apellido TIMESTAMPTZ;
ALTER TABLE mensajes_privados ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'cv';
ALTER TABLE mensajes_privados ADD COLUMN IF NOT EXISTS cedula_dest TEXT;

-- ================================================================
--  POLÍTICAS PERMISIVAS PARA ANON KEY
--  El backend Flask usa la clave ANON; Flask es la capa de seguridad.
-- ================================================================

CREATE POLICY "roles_all_anon"
    ON roles FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "usuarios_all_anon"
    ON usuarios FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "productos_all_anon"
    ON gestion_productos FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "metodos_pago_all_anon"
    ON metodos_pago FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "pedidos_all_anon"
    ON pedidos FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "detalle_all_anon"
    ON pedido_detalle FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "facturas_all_anon"
    ON facturas FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "carrito_all_anon"
    ON carrito FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "comentarios_all_anon"
    ON comentarios FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "chats_privados_all_anon"
    ON chats_privados FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "publicidad_all_anon"
    ON publicidad FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "inicio_config_all_anon"
    ON inicio_config FOR ALL TO anon USING (true) WITH CHECK (true);

-- ================================================================
--  DATOS INICIALES
-- ================================================================

INSERT INTO roles (nombre_role, descripcion) VALUES
    ('admin',     'Administrador con acceso total'),
    ('vendedor',  'Acceso a pedidos, productos e historial'),
    ('cliente',   'Acceso a catálogo, carrito y facturas propias'),
    ('visitante', 'Sin cuenta registrada')
ON CONFLICT (nombre_role) DO NOTHING;

INSERT INTO inicio_config (clave, valor) VALUES
    ('bienvenida_mensaje', 'Endulza tu día con deliciosos postres caseros'),
    ('historia_titulo',    'Nuestra historia y pasión'),
    ('historia_p1',        'Le damos la bienvenida a <strong>D''Antojitos</strong>, un espacio donde la pasión por la repostería se convierte en experiencias inolvidables.'),
    ('historia_p2',        'En <strong>D''Antojitos</strong> creemos que los momentos más simples pueden convertirse en recuerdos extraordinarios con un toque de dulzura.'),
    ('historia_p3',        'Nuestro compromiso va más allá de ofrecer un producto; buscamos ser parte de tus celebraciones y momentos especiales.'),
    ('explorar_titulo',    'Explorar')
ON CONFLICT (clave) DO NOTHING;