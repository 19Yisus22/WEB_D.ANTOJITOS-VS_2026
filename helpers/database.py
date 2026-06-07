import logging
import os
from dotenv import load_dotenv
from supabase import create_client, ClientOptions

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"), override=True)

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

supabase = None
SUPABASE_REST_URL = ""

if SUPABASE_URL and SUPABASE_KEY:
    SUPABASE_REST_URL = os.getenv("SUPABASE_REST_URL") or f"{SUPABASE_URL.rstrip('/')}/rest/v1/"
    opts = ClientOptions(postgrest_client_timeout=120, storage_client_timeout=120, schema="public")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY, options=opts)

# ── Transaction Pooler (psycopg2 direct SQL) ──────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL")
_pool = None
_logger = logging.getLogger(__name__)


def _get_pool():
    global _pool
    if _pool is not None:
        return _pool
    if not DATABASE_URL:
        return None
    try:
        from psycopg2 import pool as pg_pool
        _pool = pg_pool.ThreadedConnectionPool(minconn=1, maxconn=10, dsn=DATABASE_URL)
        _logger.info("Transaction Pooler conectado: %s", DATABASE_URL.split("@")[-1])
    except Exception as exc:
        _logger.warning("Transaction Pooler no disponible: %s", exc)
    return _pool


def execute_sql(query: str, params=None) -> list[dict]:
    """Ejecuta SQL directo via Transaction Pooler. Devuelve lista de dicts."""
    from psycopg2.extras import RealDictCursor
    pool = _get_pool()
    if not pool:
        raise RuntimeError(
            "DATABASE_URL no configurado. Agrega la variable de entorno con la URL "
            "del Transaction Pooler de Supabase (puerto 6543)."
        )
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params)
            conn.commit()
            try:
                return [dict(row) for row in cur.fetchall()]
            except Exception:
                return []
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)
