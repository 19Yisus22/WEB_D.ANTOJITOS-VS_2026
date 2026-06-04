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
CREATE INDEX idx_chats_leido             ON chats_privados(cedula_para, leido)
    WHERE leido = false;
CREATE INDEX idx_chats_fecha             ON chats_privados(created_at DESC);

CREATE INDEX idx_mp_cedula_de            ON mensajes_privados(cedula_de);
CREATE INDEX idx_mp_cedula_para          ON mensajes_privados(cedula_para);
CREATE INDEX idx_mp_leido                ON mensajes_privados(cedula_para, leido)
    WHERE leido = false;

CREATE INDEX idx_publicidad_tipo_estado  ON publicidad(tipo, estado);
CREATE INDEX idx_publicidad_fecha        ON publicidad(fecha_creacion DESC);

-- ================================================================
--  FUNCIONES Y TRIGGERS
-- ================================================================

CREATE OR REPLACE FUNCTION fn_set_usuario_rol()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF NEW.id_role IS NULL THEN
        SELECT id_role INTO NEW.id_role
        FROM public.roles
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
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_pedido_id   uuid;
    v_nuevo_total numeric;
BEGIN
    v_pedido_id := COALESCE(NEW.id_pedido, OLD.id_pedido);

    SELECT COALESCE(SUM(cantidad * precio_unitario), 0)
    INTO   v_nuevo_total
    FROM   public.pedido_detalle
    WHERE  id_pedido = v_pedido_id;

    UPDATE public.pedidos
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
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_year text;
    v_seq  integer;
BEGIN
    IF NEW.numero_factura IS NOT NULL THEN
        RETURN NEW;
    END IF;

    v_year := to_char(now(), 'YYYY');

    SELECT COALESCE(
        MAX(CAST(split_part(numero_factura, '-', 3) AS integer)), 0) + 1
    INTO v_seq
    FROM public.facturas
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
ALTER TABLE mensajes_privados ENABLE ROW LEVEL SECURITY;
ALTER TABLE publicidad        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inicio_config     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles_select_pub"
    ON roles             FOR SELECT USING (true);

CREATE POLICY "productos_select_pub"
    ON gestion_productos FOR SELECT USING (true);

CREATE POLICY "pagos_select_pub"
    ON metodos_pago      FOR SELECT USING (true);

CREATE POLICY "publicidad_select_pub"
    ON publicidad        FOR SELECT USING (true);

CREATE POLICY "config_select_pub"
    ON inicio_config     FOR SELECT USING (true);

CREATE POLICY "comentarios_select_pub"
    ON comentarios       FOR SELECT USING (true);

CREATE POLICY "roles_all_anon"
    ON roles FOR ALL TO anon
    USING     (CURRENT_USER IS NOT NULL)
    WITH CHECK (CURRENT_USER IS NOT NULL);

CREATE POLICY "usuarios_all_anon"
    ON usuarios FOR ALL TO anon
    USING     (CURRENT_USER IS NOT NULL)
    WITH CHECK (CURRENT_USER IS NOT NULL);

CREATE POLICY "productos_all_anon"
    ON gestion_productos FOR ALL TO anon
    USING     (CURRENT_USER IS NOT NULL)
    WITH CHECK (CURRENT_USER IS NOT NULL);

CREATE POLICY "metodos_pago_all_anon"
    ON metodos_pago FOR ALL TO anon
    USING     (CURRENT_USER IS NOT NULL)
    WITH CHECK (CURRENT_USER IS NOT NULL);

CREATE POLICY "pedidos_all_anon"
    ON pedidos FOR ALL TO anon
    USING     (CURRENT_USER IS NOT NULL)
    WITH CHECK (CURRENT_USER IS NOT NULL);

CREATE POLICY "detalle_all_anon"
    ON pedido_detalle FOR ALL TO anon
    USING     (CURRENT_USER IS NOT NULL)
    WITH CHECK (CURRENT_USER IS NOT NULL);

CREATE POLICY "facturas_all_anon"
    ON facturas FOR ALL TO anon
    USING     (CURRENT_USER IS NOT NULL)
    WITH CHECK (CURRENT_USER IS NOT NULL);

CREATE POLICY "carrito_all_anon"
    ON carrito FOR ALL TO anon
    USING     (CURRENT_USER IS NOT NULL)
    WITH CHECK (CURRENT_USER IS NOT NULL);

CREATE POLICY "comentarios_all_anon"
    ON comentarios FOR ALL TO anon
    USING     (CURRENT_USER IS NOT NULL)
    WITH CHECK (CURRENT_USER IS NOT NULL);

CREATE POLICY "chats_privados_all_anon"
    ON chats_privados FOR ALL TO anon
    USING     (CURRENT_USER IS NOT NULL)
    WITH CHECK (CURRENT_USER IS NOT NULL);

CREATE POLICY "mp_all_anon"
    ON mensajes_privados FOR ALL TO anon
    USING     (CURRENT_USER IS NOT NULL)
    WITH CHECK (CURRENT_USER IS NOT NULL);

CREATE POLICY "publicidad_all_anon"
    ON publicidad FOR ALL TO anon
    USING     (CURRENT_USER IS NOT NULL)
    WITH CHECK (CURRENT_USER IS NOT NULL);

CREATE POLICY "inicio_config_all_anon"
    ON inicio_config FOR ALL TO anon
    USING     (CURRENT_USER IS NOT NULL)
    WITH CHECK (CURRENT_USER IS NOT NULL);

DO $$
DECLARE
    _fn  text;
    _fns text[] := ARRAY[
        'generar_formato_factura',
        'generar_numero_factura',
        'fn_set_updated_at'
    ];
BEGIN
    FOREACH _fn IN ARRAY _fns LOOP
        IF EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = _fn
        ) THEN
            EXECUTE format(
                'ALTER FUNCTION public.%I() SET search_path = public', _fn
            );
        END IF;
    END LOOP;
END;
$$;

DO $$
DECLARE
    _fn  text;
    _fns text[] := ARRAY[
        'actualizar_total_pedido',
        'actualizar_ultima_conexion',
        'asignar_rol_cliente',
        'calcular_subtotal_detalle',
        'calcular_total_carrito',
        'es_admin',
        'gestionar_stock_pedido',
        'handle_user_login',
        'rls_auto_enable'
    ];
BEGIN
    FOREACH _fn IN ARRAY _fns LOOP
        IF EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' AND p.proname = _fn
        ) THEN
            EXECUTE format(
                'ALTER FUNCTION public.%I() SET search_path = public', _fn
            );
            EXECUTE format(
                'REVOKE EXECUTE ON FUNCTION public.%I() FROM anon, authenticated',
                _fn
            );
        END IF;
    END LOOP;
END;
$$;

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