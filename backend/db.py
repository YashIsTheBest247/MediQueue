import os
import sqlite3
from datetime import datetime, timezone

DATABASE_URL = os.environ.get("DATABASE_URL", "")
USE_PG = bool(DATABASE_URL)

DB_PATH = os.environ.get(
    "MEDIQUEUE_DB", os.path.join(os.path.dirname(__file__), "mediqueue.db")
)

if USE_PG:
    import psycopg2
    import psycopg2.extras


def _pg_url(url):
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    return url


def _translate(sql):
    return sql.replace("BEGIN IMMEDIATE", "BEGIN").replace("?", "%s")


class _Noop:
    lastrowid = None
    rowcount = 0

    def fetchone(self):
        return None

    def fetchall(self):
        return []


class _PGResult:
    def __init__(self, cur, lastrowid=None):
        self._cur = cur
        self.lastrowid = lastrowid
        self.rowcount = cur.rowcount

    def fetchone(self):
        return self._cur.fetchone()

    def fetchall(self):
        return self._cur.fetchall()


class PGConn:
    def __init__(self, raw):
        self._raw = raw

    def execute(self, sql, params=()):
        head = sql.lstrip()[:6].upper()
        if head == "PRAGMA":
            return _Noop()
        s = _translate(sql)
        is_insert = head == "INSERT" and "RETURNING" not in s.upper()
        if is_insert:
            s = s.rstrip().rstrip(";") + " RETURNING id"
        cur = self._raw.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(s, params)
        lastrowid = None
        if is_insert:
            row = cur.fetchone()
            lastrowid = row["id"] if row else None
        return _PGResult(cur, lastrowid)

    def executescript(self, script):
        cur = self._raw.cursor()
        cur.execute(script)
        return _Noop()

    def commit(self):
        self._raw.commit()

    def close(self):
        self._raw.close()


def get_conn():
    if USE_PG:
        raw = psycopg2.connect(_pg_url(DATABASE_URL))
        raw.autocommit = True
        return PGConn(raw)
    conn = sqlite3.connect(DB_PATH, timeout=5.0, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout=5000")
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


SQLITE_SCHEMA = """
    CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'local',
        avg_time INTEGER NOT NULL DEFAULT 10,
        current_token INTEGER,
        next_token INTEGER NOT NULL DEFAULT 1,
        paused INTEGER NOT NULL DEFAULT 0,
        clinic_id INTEGER,
        room_count INTEGER NOT NULL DEFAULT 1,
        departments TEXT NOT NULL DEFAULT '',
        is_open INTEGER NOT NULL DEFAULT 1,
        hours TEXT NOT NULL DEFAULT '',
        lat REAL,
        lng REAL,
        verified INTEGER NOT NULL DEFAULT 0,
        license TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clinic_id INTEGER NOT NULL,
        patient_id INTEGER,
        name TEXT NOT NULL,
        number INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'waiting',
        priority INTEGER NOT NULL DEFAULT 0,
        reason TEXT,
        room INTEGER,
        department TEXT,
        appointment_at TEXT,
        created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tokens_clinic ON tokens (clinic_id, status);
"""

PG_SCHEMA = """
    CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        role TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'local',
        avg_time INTEGER NOT NULL DEFAULT 10,
        current_token INTEGER,
        next_token INTEGER NOT NULL DEFAULT 1,
        paused INTEGER NOT NULL DEFAULT 0,
        clinic_id INTEGER,
        room_count INTEGER NOT NULL DEFAULT 1,
        departments TEXT NOT NULL DEFAULT '',
        is_open INTEGER NOT NULL DEFAULT 1,
        hours TEXT NOT NULL DEFAULT '',
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        verified INTEGER NOT NULL DEFAULT 0,
        license TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS tokens (
        id SERIAL PRIMARY KEY,
        clinic_id INTEGER NOT NULL,
        patient_id INTEGER,
        name TEXT NOT NULL,
        number INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'waiting',
        priority INTEGER NOT NULL DEFAULT 0,
        reason TEXT,
        room INTEGER,
        department TEXT,
        appointment_at TEXT,
        created_at TEXT NOT NULL,
        notified INTEGER NOT NULL DEFAULT 0,
        served_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_tokens_clinic ON tokens (clinic_id, status);
"""

PG_COLUMNS = [
    ("accounts", "provider TEXT NOT NULL DEFAULT 'local'"),
    ("accounts", "paused INTEGER NOT NULL DEFAULT 0"),
    ("accounts", "clinic_id INTEGER"),
    ("accounts", "room_count INTEGER NOT NULL DEFAULT 1"),
    ("accounts", "departments TEXT NOT NULL DEFAULT ''"),
    ("accounts", "is_open INTEGER NOT NULL DEFAULT 1"),
    ("accounts", "hours TEXT NOT NULL DEFAULT ''"),
    ("accounts", "lat DOUBLE PRECISION"),
    ("accounts", "lng DOUBLE PRECISION"),
    ("accounts", "verified INTEGER NOT NULL DEFAULT 0"),
    ("accounts", "license TEXT NOT NULL DEFAULT ''"),
    ("tokens", "priority INTEGER NOT NULL DEFAULT 0"),
    ("tokens", "reason TEXT"),
    ("tokens", "room INTEGER"),
    ("tokens", "department TEXT"),
    ("tokens", "appointment_at TEXT"),
    ("tokens", "notified INTEGER NOT NULL DEFAULT 0"),
    ("tokens", "served_at TEXT"),
]


def init_db():
    conn = get_conn()
    if USE_PG:
        conn.executescript(PG_SCHEMA)
        for table, ddl in PG_COLUMNS:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {ddl}")
        conn.close()
        return

    conn.executescript(SQLITE_SCHEMA)

    def ensure(table, col, ddl):
        cols = [r[1] for r in conn.execute(f"PRAGMA table_info({table})").fetchall()]
        if col not in cols:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {ddl}")

    ensure("accounts", "provider", "provider TEXT NOT NULL DEFAULT 'local'")
    ensure("accounts", "paused", "paused INTEGER NOT NULL DEFAULT 0")
    ensure("accounts", "clinic_id", "clinic_id INTEGER")
    ensure("accounts", "room_count", "room_count INTEGER NOT NULL DEFAULT 1")
    ensure("accounts", "departments", "departments TEXT NOT NULL DEFAULT ''")
    ensure("accounts", "is_open", "is_open INTEGER NOT NULL DEFAULT 1")
    ensure("accounts", "hours", "hours TEXT NOT NULL DEFAULT ''")
    ensure("accounts", "lat", "lat REAL")
    ensure("accounts", "lng", "lng REAL")
    ensure("accounts", "verified", "verified INTEGER NOT NULL DEFAULT 0")
    ensure("accounts", "license", "license TEXT NOT NULL DEFAULT ''")
    ensure("tokens", "priority", "priority INTEGER NOT NULL DEFAULT 0")
    ensure("tokens", "reason", "reason TEXT")
    ensure("tokens", "room", "room INTEGER")
    ensure("tokens", "department", "department TEXT")
    ensure("tokens", "appointment_at", "appointment_at TEXT")
    ensure("tokens", "notified", "notified INTEGER NOT NULL DEFAULT 0")
    ensure("tokens", "served_at", "served_at TEXT")
    conn.commit()
    conn.close()


def now_iso():
    return datetime.now(timezone.utc).isoformat()
