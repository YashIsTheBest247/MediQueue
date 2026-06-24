import os
import sqlite3
from datetime import datetime, timezone

DB_PATH = os.environ.get(
    "MEDIQUEUE_DB", os.path.join(os.path.dirname(__file__), "mediqueue.db")
)


def get_conn():
    conn = sqlite3.connect(DB_PATH, timeout=5.0, isolation_level=None)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout=5000")
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    conn = get_conn()
    conn.executescript(
        """
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
    )

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
