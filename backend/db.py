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
            paused INTEGER NOT NULL DEFAULT 0
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
            created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_tokens_clinic ON tokens (clinic_id, status);
        """
    )
    acc_cols = [r[1] for r in conn.execute("PRAGMA table_info(accounts)").fetchall()]
    if "provider" not in acc_cols:
        conn.execute("ALTER TABLE accounts ADD COLUMN provider TEXT NOT NULL DEFAULT 'local'")
    if "paused" not in acc_cols:
        conn.execute("ALTER TABLE accounts ADD COLUMN paused INTEGER NOT NULL DEFAULT 0")
    tok_cols = [r[1] for r in conn.execute("PRAGMA table_info(tokens)").fetchall()]
    if "priority" not in tok_cols:
        conn.execute("ALTER TABLE tokens ADD COLUMN priority INTEGER NOT NULL DEFAULT 0")
    if "reason" not in tok_cols:
        conn.execute("ALTER TABLE tokens ADD COLUMN reason TEXT")
    conn.commit()
    conn.close()


def now_iso():
    return datetime.now(timezone.utc).isoformat()
