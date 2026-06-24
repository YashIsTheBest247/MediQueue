import os
import sqlite3
from datetime import datetime, timezone

DB_PATH = os.environ.get(
    "MEDIQUEUE_DB", os.path.join(os.path.dirname(__file__), "mediqueue.db")
)


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
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
            avg_time INTEGER NOT NULL DEFAULT 10,
            current_token INTEGER,
            next_token INTEGER NOT NULL DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clinic_id INTEGER NOT NULL,
            patient_id INTEGER,
            name TEXT NOT NULL,
            number INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'waiting',
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_tokens_clinic ON tokens (clinic_id, status);
        """
    )
    conn.commit()
    conn.close()


def now_iso():
    return datetime.now(timezone.utc).isoformat()
