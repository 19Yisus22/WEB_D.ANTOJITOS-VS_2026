-- Tabla de contadores persistentes para el sistema de logros.
-- Almacena visitas únicas por módulo y rachas de días consecutivos por usuario.
-- EJECUTAR UNA SOLA VEZ en el panel SQL de Supabase.

CREATE TABLE IF NOT EXISTS logros_contadores (
    cedula      TEXT    NOT NULL REFERENCES usuarios(cedula) ON DELETE CASCADE,
    clave       TEXT    NOT NULL,
    valor       INTEGER NOT NULL DEFAULT 0,
    actualizado TIMESTAMPTZ     DEFAULT now(),
    PRIMARY KEY (cedula, clave)
);

-- Índice para consultas rápidas por usuario
CREATE INDEX IF NOT EXISTS idx_logros_contadores_cedula ON logros_contadores(cedula);

-- Actualizar timestamp automáticamente en cada upsert
CREATE OR REPLACE FUNCTION _set_logros_actualizado()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizado = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_logros_contadores_actualizado ON logros_contadores;
CREATE TRIGGER trg_logros_contadores_actualizado
    BEFORE INSERT OR UPDATE ON logros_contadores
    FOR EACH ROW EXECUTE FUNCTION _set_logros_actualizado();
