import os
from dotenv import load_dotenv
from supabase import create_client, ClientOptions

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = (
    os.getenv("SUPABASE_ANON_KEY")
    or os.getenv("SUPABASE_SERVICE_KEY")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Faltan credenciales de Supabase en .env (SUPABASE_URL y SUPABASE_ANON_KEY)")

SUPABASE_REST_URL = os.getenv("SUPABASE_REST_URL") or f"{SUPABASE_URL.rstrip('/')}/rest/v1/"

opts = ClientOptions(postgrest_client_timeout=120, storage_client_timeout=120, schema="public")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY, options=opts)
