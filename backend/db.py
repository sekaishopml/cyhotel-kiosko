import os
import hashlib
import psycopg2
from psycopg2.extras import RealDictCursor

# RLS multi-tenant real (FORCE): el runtime conecta con el rol de app
# (no-superusuario, creado por init_db) y debe llamar a set_app_hotel() antes de operar.

PG_HOST = os.environ.get("PGHOST", "localhost")
PG_PORT = int(os.environ.get("PGPORT", "5432"))
PG_USER = os.environ.get("PGUSER", "postgres")
PG_PASSWORD = os.environ.get("PGPASSWORD", "postgres")
PG_DATABASE = os.environ.get("PGDATABASE", "cyhotel")

APP_DB_USER = os.environ.get("CYHOTEL_DB_USER", "cyhotel_app")
APP_DB_PASSWORD = os.environ.get("CYHOTEL_DB_PASSWORD", "cyhotel_app")

# Hash PBKDF2-SHA256 compatible con el legacy: salt fijo "cyhotel::<user>", formato "pbkdf2_sha256$<iter>$<hex>".
PBKDF2_ITERATIONS = 100_000
PBKDF2_SALT_PREFIX = "cyhotel::"

SCHEMA_VERSION = "1"

ROOM_TYPES = {
    "estandar": {
        "label": "Habitación Estándar",
        "desc": "A/C, TV Smart, WiFi, agua caliente, sillón, luces LED, bebidas y piqueos",
        "momento": 10,
        "amanecida": 20,
        "hospedaje": 30,
        "extras": {
            "1h": {"label": "1 hora adicional", "price": 5},
            "6h": {"label": "Doble tiempo (6 horas)", "price": 20},
        },
    },
    "matrimonial": {
        "label": "Habitación Matrimonial",
        "desc": "Cama matrimonial, más amplia, nevera, A/C, TV Smart, WiFi, agua caliente, sillón, luces LED, baño con mampara, bebidas y piqueos",
        "momento": 12,
        "amanecida": 20,
        "hospedaje": 30,
        "extras": {
            "1h": {"label": "1 hora adicional", "price": 5},
            "6h": {"label": "Doble tiempo (6 horas)", "price": 24},
        },
    },
    "doble": {
        "label": "Habitación Doble (2 camas)",
        "desc": "2 camas de 2 plazas, TV Smart, A/C, WiFi, agua caliente, baño con mampara",
        "momento": 12,
        "amanecida": 30,
        "hospedaje": 40,
        "extras": {},
        "momento_solo_sin_otras": True,
    },
    "suite": {
        "label": "Suite con Jacuzzi",
        "desc": "Jacuzzi con hidromasaje, nevera, TV Smart, A/C, WiFi, agua caliente, sillón, bebidas y piqueos",
        "momento": 20,
        "amanecida": 35,
        "hospedaje": 50,
        "extras": {
            "1h": {"label": "1 hora adicional", "price": 5},
            "6h": {"label": "Doble tiempo (6 horas)", "price": 40},
        },
    },
}

AMANECIDA_ENTRY = "18:00"
AMANECIDA_EXIT = "09:00"
AMANECIDA_EXIT_NEXT_DAY = True

# Reserva inmediata: hold de 30 minutos sobre el monto definido por recepción.
HOLD_MINUTES = 30

SEED_ROOMS = [
    # 11 habitaciones estándar $10 las 3 horas
    ("1", "estandar"), ("2", "estandar"), ("3", "estandar"),
    ("4", "estandar"), ("5", "estandar"), ("7", "estandar"),
    ("8", "estandar"), ("9", "estandar"), ("11", "estandar"),
    ("12", "estandar"), ("13", "estandar"),
    # 5 matrimoniales $12 las 3 horas
    ("10", "matrimonial"), ("16", "matrimonial"), ("17", "matrimonial"),
    ("18", "matrimonial"), ("19", "matrimonial"),
    # 2 dobles con 2 camas
    ("14", "doble"), ("15", "doble"),
    # 1 suite con jacuzzi (sin número)
    ("Suite", "suite"),
]

SEED_USERS = [
    # (username, contraseña, rol) — contraseñas vía env; placeholders por defecto
    ("admin", os.environ.get("CYHOTEL_SEED_ADMIN_PASS", "cambiar_admin_2026"), "gerencia"),
    ("recepcion", os.environ.get("CYHOTEL_SEED_RECEPCION_PASS", "cambiar_recepcion_2026"), "recepcion"),
    ("limpieza", os.environ.get("CYHOTEL_SEED_LIMPIEZA_PASS", "cambiar_limpieza_2026"), "housekeeping"),
]

MASTER_USER = ("master", os.environ.get("CYHOTEL_SEED_MASTER_PASS", "cambiar_master_2026"), "master")

SCHEMA = """
CREATE TABLE IF NOT EXISTS hotels (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    hotel_id INT REFERENCES hotels(id) NULL,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('recepcion', 'housekeeping', 'gerencia', 'master')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hotel_id, username)
);

CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    hotel_id INT NOT NULL REFERENCES hotels(id),
    number TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'libre' CHECK (status IN ('libre', 'ocupado', 'en_limpieza', 'bloqueado')),
    UNIQUE (hotel_id, number)
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    hotel_id INT NOT NULL REFERENCES hotels(id),
    room_id INT NULL REFERENCES rooms(id),
    guest_name TEXT NOT NULL,
    id_document TEXT,
    product TEXT NOT NULL CHECK (product IN ('momento', 'amanecida', 'hospedaje', 'reserva')),
    room_type TEXT,
    hours INT,
    check_in TIMESTAMPTZ NOT NULL,
    check_out TIMESTAMPTZ NOT NULL,
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'por_asignar' CHECK (status IN ('por_asignar', 'pendiente', 'pagado', 'confirmada', 'finalizada', 'vencida', 'anulado')),
    payment_method TEXT NOT NULL DEFAULT 'pendiente' CHECK (payment_method IN ('pendiente', 'efectivo', 'transferencia')),
    payment_reference TEXT,
    client_ref TEXT,
    checked_out_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ,
    paid_by TEXT,
    hold_expires_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    UNIQUE (hotel_id, client_ref)
);

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    hotel_id INT NOT NULL REFERENCES hotels(id),
    order_id INT NOT NULL REFERENCES orders(id),
    amount_cents BIGINT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    method TEXT NOT NULL CHECK (method IN ('efectivo', 'transferencia')),
    reference TEXT,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recorded_by TEXT,
    idempotency_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hotel_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS cleaning_tasks (
    id SERIAL PRIMARY KEY,
    hotel_id INT NOT NULL REFERENCES hotels(id),
    room_id INT NOT NULL REFERENCES rooms(id),
    order_id INT NULL REFERENCES orders(id),
    status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'en_proceso', 'pausada', 'completada', 'incidencia')),
    assigned_to TEXT NULL,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS housekeeping_staff (
    id SERIAL PRIMARY KEY,
    hotel_id INT NOT NULL REFERENCES hotels(id),
    name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (hotel_id, name)
);

CREATE TABLE IF NOT EXISTS incidences (
    id SERIAL PRIMARY KEY,
    hotel_id INT NOT NULL REFERENCES hotels(id),
    task_id INT NOT NULL REFERENCES cleaning_tasks(id),
    room_id INT NOT NULL REFERENCES rooms(id),
    notes TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'abierta' CHECK (status IN ('abierta', 'resuelta')),
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_by TEXT,
    resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS room_status_history (
    id SERIAL PRIMARY KEY,
    hotel_id INT NOT NULL REFERENCES hotels(id),
    room_id INT NOT NULL,
    status TEXT NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    hotel_id INT NULL,
    action TEXT NOT NULL,
    order_id INT NULL,
    room_id INT NULL,
    staff_user TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS schema_meta (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_status_checkout ON orders(hotel_id, status, check_out);
CREATE INDEX IF NOT EXISTS idx_orders_product_status ON orders(hotel_id, product, status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(hotel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_room_status ON orders(hotel_id, room_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(hotel_id, order_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(hotel_id, paid_at);
CREATE INDEX IF NOT EXISTS idx_cleaning_status ON cleaning_tasks(hotel_id, status);
CREATE INDEX IF NOT EXISTS idx_incidences_hotel_status ON incidences (hotel_id, status, id DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(hotel_id, created_at);
"""

# RLS multi-tenant: current_hotel_id() lee 'app.hotel_id' (NULL/'master' ve todo).
# FORCE RLS porque la app conecta como owner; los superusuarios evaden RLS siempre -> el runtime usa el rol de app.

RLS_FUNCTIONS = """
CREATE OR REPLACE FUNCTION current_hotel_id() RETURNS INTEGER
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v TEXT;
BEGIN
    v := current_setting('app.hotel_id', true);
    IF v IS NULL OR v = '' OR v = 'master' THEN
        RETURN NULL;
    END IF;
    BEGIN
        RETURN v::INTEGER;
    EXCEPTION WHEN invalid_text_representation THEN
        RETURN NULL;
    END;
END;
$$;
"""

RLS_POLICIES = """
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_all ON users;
CREATE POLICY users_all ON users FOR ALL TO PUBLIC
    USING (current_hotel_id() IS NULL OR hotel_id = current_hotel_id());

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rooms_all ON rooms;
CREATE POLICY rooms_all ON rooms FOR ALL TO PUBLIC
    USING (current_hotel_id() IS NULL OR hotel_id = current_hotel_id());

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS orders_all ON orders;
CREATE POLICY orders_all ON orders FOR ALL TO PUBLIC
    USING (current_hotel_id() IS NULL OR hotel_id = current_hotel_id());

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payments_all ON payments;
CREATE POLICY payments_all ON payments FOR ALL TO PUBLIC
    USING (current_hotel_id() IS NULL OR hotel_id = current_hotel_id());

ALTER TABLE cleaning_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaning_tasks FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cleaning_tasks_all ON cleaning_tasks;
CREATE POLICY cleaning_tasks_all ON cleaning_tasks FOR ALL TO PUBLIC
    USING (current_hotel_id() IS NULL OR hotel_id = current_hotel_id());

ALTER TABLE housekeeping_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE housekeeping_staff FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS housekeeping_staff_all ON housekeeping_staff;
CREATE POLICY housekeeping_staff_all ON housekeeping_staff FOR ALL TO PUBLIC
    USING (current_hotel_id() IS NULL OR hotel_id = current_hotel_id());

ALTER TABLE incidences ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidences FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS incidences_all ON incidences;
CREATE POLICY incidences_all ON incidences FOR ALL TO PUBLIC
    USING (current_hotel_id() IS NULL OR hotel_id = current_hotel_id());

ALTER TABLE room_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_status_history FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS room_status_history_all ON room_status_history;
CREATE POLICY room_status_history_all ON room_status_history FOR ALL TO PUBLIC
    USING (current_hotel_id() IS NULL OR hotel_id = current_hotel_id());

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_log_all ON audit_log;
CREATE POLICY audit_log_all ON audit_log FOR ALL TO PUBLIC
    USING (current_hotel_id() IS NULL OR hotel_id = current_hotel_id());
"""

# Rol de app: no-superusuario y no owner, así el RLS se aplica de verdad al runtime.
_APP_ROLE_DDL = f"""
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{APP_DB_USER}') THEN
        CREATE ROLE {APP_DB_USER} LOGIN PASSWORD '{APP_DB_PASSWORD}';
    ELSE
        ALTER ROLE {APP_DB_USER} WITH LOGIN PASSWORD '{APP_DB_PASSWORD}';
    END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO {APP_DB_USER};
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {APP_DB_USER};
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {APP_DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {APP_DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO {APP_DB_USER};
"""


def db():
    """Conexión con el rol de aplicación (sujeto a RLS); llamar a set_app_hotel() antes de operar."""
    conn = psycopg2.connect(
        host=PG_HOST,
        port=PG_PORT,
        user=APP_DB_USER,
        password=APP_DB_PASSWORD,
        dbname=PG_DATABASE,
        cursor_factory=RealDictCursor,
    )
    conn.autocommit = False
    return conn


def _admin_db():
    """Conexión admin (postgres) solo para init_db/migraciones: el superusuario evade RLS."""
    conn = psycopg2.connect(
        host=PG_HOST,
        port=PG_PORT,
        user=PG_USER,
        password=PG_PASSWORD,
        dbname=PG_DATABASE,
        cursor_factory=RealDictCursor,
    )
    conn.autocommit = False
    return conn


def set_app_hotel(conn, hotel_id):
    """Fija el scope RLS de la conexión (hotel_id o 'master'). Autocommit momentáneo
    para que el setting no se revierta con un ROLLBACK posterior."""
    value = "master" if hotel_id in (None, "", "master") else str(int(hotel_id))
    previous = conn.autocommit
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT set_config('app.hotel_id', %s, false)", (value,))
    finally:
        conn.autocommit = previous


def exec(conn, sql, params=None):
    """Ejecuta SQL con placeholders %s; devuelve filas (SELECT) o None. Sin commit."""
    with conn.cursor() as cur:
        cur.execute(sql, params or ())
        if cur.description is not None:
            return cur.fetchall()
        return None


def fetch_one(conn, sql, params=None):
    rows = exec(conn, sql, params)
    return rows[0] if rows else None


def fetch_all(conn, sql, params=None):
    return exec(conn, sql, params) or []


def hash_password(password, username):
    salt = (PBKDF2_SALT_PREFIX + username).encode()
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS).hex()
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${digest}"


def verify_password(password, username, stored_hash):
    """Valida password contra un hash 'pbkdf2_sha256$<iter>$<hex>'."""
    if not stored_hash:
        return False
    try:
        algo, iterations, expected = stored_hash.split("$")
    except ValueError:
        return False
    if algo != "pbkdf2_sha256":
        return False
    salt = (PBKDF2_SALT_PREFIX + username).encode()
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), salt, int(iterations)
    ).hex()
    return digest == expected


# Si SCHEMA_VERSION sube, _apply_migrations aplica los ALTERs pendientes (nada destructivo).
MIGRATIONS = {
    # "2": [ "ALTER TABLE orders ADD COLUMN IF NOT EXISTS foo TEXT;", ... ],
}

# Cada bloque de FEATURE_MIGRATIONS corre una sola vez y queda registrado en schema_meta.
FEATURE_MIGRATIONS = {
    # PostgreSQL no altera CHECK en sitio: se recrea el constraint añadiendo 'pausada' ('incidencia' se conserva por compatibilidad).
    "cleaning_pausada": [
        "ALTER TABLE cleaning_tasks DROP CONSTRAINT IF EXISTS cleaning_tasks_status_check",
        "ALTER TABLE cleaning_tasks ADD CONSTRAINT cleaning_tasks_status_check "
        "CHECK (status IN ('pendiente', 'en_proceso', 'pausada', 'completada', 'incidencia'))",
    ],
    # Garantiza índice, RLS y política de incidences en bases existentes (idempotente).
    "incidences_tabla": [
        "CREATE INDEX IF NOT EXISTS idx_incidences_hotel_status ON incidences (hotel_id, status, id DESC)",
        "ALTER TABLE incidences ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE incidences FORCE ROW LEVEL SECURITY",
        "DROP POLICY IF EXISTS incidences_all ON incidences",
        "CREATE POLICY incidences_all ON incidences FOR ALL TO PUBLIC "
        "USING (current_hotel_id() IS NULL OR hotel_id = current_hotel_id())",
    ],
    # Garantiza assigned_to, índice, RLS y política de housekeeping_staff en bases existentes (idempotente).
    "cleaning_staff": [
        "ALTER TABLE cleaning_tasks ADD COLUMN IF NOT EXISTS assigned_to TEXT NULL",
        "CREATE INDEX IF NOT EXISTS idx_tasks_staff ON cleaning_tasks(hotel_id, assigned_to, status)",
        "ALTER TABLE housekeeping_staff ENABLE ROW LEVEL SECURITY",
        "ALTER TABLE housekeeping_staff FORCE ROW LEVEL SECURITY",
        "DROP POLICY IF EXISTS housekeeping_staff_all ON housekeeping_staff",
        "CREATE POLICY housekeeping_staff_all ON housekeeping_staff FOR ALL TO PUBLIC "
        "USING (current_hotel_id() IS NULL OR hotel_id = current_hotel_id())",
    ],
}


def _apply_migrations(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT value FROM schema_meta WHERE key = 'schema_version'")
        row = cur.fetchone()
        current = int(row["value"]) if row else 0
        for version in sorted(MIGRATIONS, key=int):
            if int(version) > current:
                for stmt in MIGRATIONS[version]:
                    cur.execute(stmt)
                cur.execute(
                    "INSERT INTO schema_meta (key, value) VALUES ('schema_version', %s) "
                    "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
                    (str(version),),
                )


def _apply_feature_migrations(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT key FROM schema_meta")
        applied = {r["key"] for r in cur.fetchall()}
        for key, stmts in FEATURE_MIGRATIONS.items():
            if key in applied:
                continue
            for stmt in stmts:
                cur.execute(stmt)
            cur.execute(
                "INSERT INTO schema_meta (key, value) VALUES (%s, '1')",
                (key,),
            )


def init_db(hotel_slug="hoteldelvalle", hotel_nombre="Hotel del Valle", hotel_id=None):
    """Esquema + RLS + rol de app + seeds (idempotente). Retorna el hotel_id."""
    conn = _admin_db()
    try:
        set_app_hotel(conn, "master")
        exec(conn, SCHEMA)
        exec(conn, RLS_FUNCTIONS)
        exec(conn, RLS_POLICIES)
        exec(conn, _APP_ROLE_DDL)

        cur = conn.cursor()
        cur.execute("SELECT value FROM schema_meta WHERE key = 'schema_version'")
        if not cur.fetchone():
            cur.execute(
                "INSERT INTO schema_meta (key, value) VALUES ('schema_version', %s)",
                (SCHEMA_VERSION,),
            )
        _apply_migrations(conn)
        _apply_feature_migrations(conn)

        if hotel_id is not None:
            row = fetch_one(conn, "SELECT id FROM hotels WHERE id = %s", (hotel_id,))
            if row:
                hotel_id = row["id"]
            else:
                row = fetch_one(conn, "SELECT id FROM hotels WHERE slug = %s", (hotel_slug,))
                if row:
                    hotel_id = row["id"]
                else:
                    row = fetch_one(
                        conn,
                        "INSERT INTO hotels (id, slug, nombre) VALUES (%s, %s, %s) RETURNING id",
                        (hotel_id, hotel_slug, hotel_nombre),
                    )
                    hotel_id = row["id"]
        else:
            row = fetch_one(conn, "SELECT id FROM hotels WHERE slug = %s", (hotel_slug,))
            if row:
                hotel_id = row["id"]
        if hotel_id is None:
            row = fetch_one(
                conn,
                "INSERT INTO hotels (slug, nombre) VALUES (%s, %s) RETURNING id",
                (hotel_slug, hotel_nombre),
            )
            hotel_id = row["id"]

        for username, password, role in SEED_USERS:
            cur.execute(
                "INSERT INTO users (hotel_id, username, password_hash, role) "
                "VALUES (%s, %s, %s, %s) "
                "ON CONFLICT (hotel_id, username) DO NOTHING",
                (hotel_id, username, hash_password(password, username), role),
            )

        master_username, master_password, master_role = MASTER_USER
        cur.execute(
            "INSERT INTO users (hotel_id, username, password_hash, role) "
            "SELECT NULL, %s, %s, %s "
            "WHERE NOT EXISTS (SELECT 1 FROM users WHERE hotel_id IS NULL AND username = %s)",
            (master_username, hash_password(master_password, master_username),
             master_role, master_username),
        )

        for number, room_type in SEED_ROOMS:
            cur.execute(
                "INSERT INTO rooms (hotel_id, number, type, status) "
                "VALUES (%s, %s, %s, 'libre') "
                "ON CONFLICT (hotel_id, number) DO NOTHING",
                (hotel_id, number, room_type),
            )

        conn.commit()
        return hotel_id
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    hid = init_db()
    print(f"Base de datos PostgreSQL inicializada. hotel_id={hid}")
