import heapq
import json
import os
import re
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Optional

from fastapi import (
    Depends,
    FastAPI,
    Header,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
    Query,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import auth
import mailer
from db import get_conn, init_db, now_iso

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
ADMIN_KEY = os.environ.get("MEDIQUEUE_ADMIN_KEY", "mediqueue-admin")

app = FastAPI(title="MediQueue API", version="2.1.0")

_origins_env = os.environ.get("ALLOWED_ORIGINS", "").strip()
ALLOWED_ORIGINS = (
    [o.strip() for o in _origins_env.split(",") if o.strip()]
    if _origins_env
    else ["*"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=ALLOWED_ORIGINS != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


init_db()

DEMO_CLINIC_EMAIL = "demo.clinic@mediqueue.app"
DEMO_PATIENT_EMAIL = "demo.patient@mediqueue.app"
DEMO_PASSWORD = "demo1234"


def seed_demo():
    conn = get_conn()
    exists = conn.execute(
        "SELECT id FROM accounts WHERE email=?", (DEMO_CLINIC_EMAIL,)
    ).fetchone()
    if exists:
        conn.close()
        return
    pw = auth.hash_password(DEMO_PASSWORD)
    cur = conn.execute(
        "INSERT INTO accounts (role, name, email, password_hash, verified, license, lat, lng, departments, next_token) "
        "VALUES ('clinic','Demo Clinic',?,?,1,'DEMO-0001',19.076,72.8777,'GP,Dental',4)",
        (DEMO_CLINIC_EMAIL, pw),
    )
    clinic_id = cur.lastrowid
    cur = conn.execute(
        "INSERT INTO accounts (role, name, email, password_hash) VALUES ('patient','Demo Patient',?,?)",
        (DEMO_PATIENT_EMAIL, pw),
    )
    patient_id = cur.lastrowid
    ts = now_iso()
    conn.execute(
        "INSERT INTO tokens (clinic_id, patient_id, name, number, status, room, created_at, served_at) "
        "VALUES (?, NULL, 'Walk-in A', 1, 'serving', 1, ?, ?)",
        (clinic_id, ts, ts),
    )
    conn.execute(
        "INSERT INTO tokens (clinic_id, patient_id, name, number, status, created_at) "
        "VALUES (?, NULL, 'Walk-in B', 2, 'waiting', ?)",
        (clinic_id, ts),
    )
    conn.execute(
        "INSERT INTO tokens (clinic_id, patient_id, name, number, status, created_at) "
        "VALUES (?, ?, 'Demo Patient', 3, 'waiting', ?)",
        (clinic_id, patient_id, ts),
    )
    conn.commit()
    conn.close()


seed_demo()


@app.get("/api/auth/demo")
def auth_demo():
    return {
        "clinic": {"email": DEMO_CLINIC_EMAIL, "password": DEMO_PASSWORD},
        "patient": {"email": DEMO_PATIENT_EMAIL, "password": DEMO_PASSWORD},
    }


def parse_departments(value) -> list:
    if not value:
        return []
    return [d.strip() for d in value.split(",") if d.strip()]


def public_account(row) -> dict:
    keys = row.keys()
    return {
        "id": row["id"],
        "role": row["role"],
        "name": row["name"],
        "email": row["email"],
        "avg_time": row["avg_time"],
        "clinic_id": row["clinic_id"] if "clinic_id" in keys else None,
        "room_count": row["room_count"] if "room_count" in keys else 1,
        "departments": parse_departments(row["departments"] if "departments" in keys else ""),
        "is_open": bool(row["is_open"]) if "is_open" in keys else True,
        "hours": row["hours"] if "hours" in keys else "",
        "verified": bool(row["verified"]) if "verified" in keys else False,
    }


def consult_elapsed_min(served_at: Optional[str]) -> Optional[float]:
    if not served_at:
        return None
    try:
        start = datetime.fromisoformat(served_at)
        if start.tzinfo is None:
            start = start.replace(tzinfo=timezone.utc)
        return max(0.0, (datetime.now(timezone.utc) - start).total_seconds() / 60.0)
    except Exception:
        return None


def clinic_snapshot(clinic_id: int) -> Optional[dict]:
    conn = get_conn()
    clinic = conn.execute(
        "SELECT * FROM accounts WHERE id=? AND role='clinic'", (clinic_id,)
    ).fetchone()
    if not clinic:
        conn.close()
        return None
    rows = conn.execute(
        "SELECT * FROM tokens WHERE clinic_id=? AND status IN ('waiting','serving') "
        "ORDER BY priority DESC, number ASC",
        (clinic_id,),
    ).fetchall()
    served = conn.execute(
        "SELECT COUNT(*) AS c FROM tokens WHERE clinic_id=? AND status='done'",
        (clinic_id,),
    ).fetchone()["c"]
    skipped_rows = conn.execute(
        "SELECT number, name FROM tokens WHERE clinic_id=? AND status='skipped' ORDER BY number",
        (clinic_id,),
    ).fetchall()
    booked_rows = conn.execute(
        "SELECT id, number, name, department, appointment_at, reason "
        "FROM tokens WHERE clinic_id=? AND status='booked' ORDER BY appointment_at",
        (clinic_id,),
    ).fetchall()
    conn.close()

    avg = clinic["avg_time"]
    room_count = max(1, clinic["room_count"])

    servings = []
    for r in rows:
        if r["status"] == "serving":
            elapsed = consult_elapsed_min(r["served_at"])
            remaining = avg if elapsed is None else max(0.0, avg - elapsed)
            servings.append(
                {
                    "token": r["number"],
                    "name": r["name"],
                    "patient_id": r["patient_id"],
                    "reason": r["reason"],
                    "priority": r["priority"],
                    "department": r["department"],
                    "room": r["room"],
                    "remaining": round(remaining),
                }
            )
    servings.sort(key=lambda s: s["room"] or 0)
    busy_rooms = len(servings)

    free_at = [s["remaining"] for s in servings]
    free_at.extend([0.0] * (room_count - busy_rooms))
    heapq.heapify(free_at)

    waiting = []
    idx = 0
    for r in rows:
        if r["status"] == "waiting":
            idx += 1
            ready = heapq.heappop(free_at)
            heapq.heappush(free_at, ready + avg)
            waiting.append(
                {
                    "token": r["number"],
                    "name": r["name"],
                    "patient_id": r["patient_id"],
                    "reason": r["reason"],
                    "priority": r["priority"],
                    "department": r["department"],
                    "position": idx,
                    "estimated_wait": round(ready),
                }
            )

    return {
        "type": "state_update",
        "clinic_id": clinic_id,
        "clinic_name": clinic["name"],
        "paused": bool(clinic["paused"]),
        "is_open": bool(clinic["is_open"]),
        "verified": bool(clinic["verified"]),
        "hours": clinic["hours"],
        "room_count": room_count,
        "departments": parse_departments(clinic["departments"]),
        "current_token": servings[0]["token"] if servings else None,
        "serving": servings[0] if servings else None,
        "servings": servings,
        "waiting": waiting,
        "skipped": [{"token": s["number"], "name": s["name"]} for s in skipped_rows],
        "appointments": [
            {
                "id": b["id"],
                "token": b["number"],
                "name": b["name"],
                "department": b["department"],
                "appointment_at": b["appointment_at"],
                "reason": b["reason"],
            }
            for b in booked_rows
        ],
        "tokens_ahead": len(waiting),
        "avg_consultation_time": avg,
        "stats": {
            "waiting": len(waiting),
            "served": served,
            "total": len(waiting) + served + busy_rooms,
        },
        "timestamp": now_iso(),
    }


def add_token(
    clinic_id: int,
    name: str,
    patient_id: Optional[int] = None,
    priority: int = 0,
    reason: Optional[str] = None,
    department: Optional[str] = None,
    status: str = "waiting",
    appointment_at: Optional[str] = None,
) -> Optional[int]:
    conn = get_conn()
    try:
        conn.execute("BEGIN IMMEDIATE")
        clinic = conn.execute(
            "SELECT next_token FROM accounts WHERE id=? AND role='clinic'", (clinic_id,)
        ).fetchone()
        if not clinic:
            conn.execute("ROLLBACK")
            return None
        number = clinic["next_token"]
        conn.execute(
            "INSERT INTO tokens (clinic_id, patient_id, name, number, status, priority, "
            "reason, department, appointment_at, created_at) "
            "VALUES (?,?,?,?, ?, ?, ?, ?, ?, ?)",
            (
                clinic_id,
                patient_id,
                name,
                number,
                status,
                priority,
                reason,
                department,
                appointment_at,
                now_iso(),
            ),
        )
        conn.execute(
            "UPDATE accounts SET next_token=? WHERE id=?", (number + 1, clinic_id)
        )
        conn.execute("COMMIT")
        return number
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()


def _next_waiting(conn, clinic_id: int, department: Optional[str]):
    if department:
        return conn.execute(
            "SELECT * FROM tokens WHERE clinic_id=? AND status='waiting' AND department=? "
            "ORDER BY priority DESC, number ASC LIMIT 1",
            (clinic_id, department),
        ).fetchone()
    return conn.execute(
        "SELECT * FROM tokens WHERE clinic_id=? AND status='waiting' "
        "ORDER BY priority DESC, number ASC LIMIT 1",
        (clinic_id,),
    ).fetchone()


def _advance_room(
    conn, clinic_id: int, room: int, current_status: str, department: Optional[str]
) -> Optional[int]:
    conn.execute(
        f"UPDATE tokens SET status='{current_status}', room=NULL "
        "WHERE clinic_id=? AND status='serving' AND room=?",
        (clinic_id, room),
    )
    nxt = _next_waiting(conn, clinic_id, department)
    if nxt:
        conn.execute(
            "UPDATE tokens SET status='serving', room=?, served_at=? WHERE id=?",
            (room, now_iso(), nxt["id"]),
        )
        return nxt["number"]
    return None


def do_call_next(clinic_id: int, room: int, department: Optional[str] = None) -> Optional[int]:
    conn = get_conn()
    try:
        conn.execute("BEGIN IMMEDIATE")
        called = _advance_room(conn, clinic_id, room, "done", department)
        conn.execute("COMMIT")
        return called
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()


def do_skip(clinic_id: int, room: int, department: Optional[str] = None) -> Optional[int]:
    conn = get_conn()
    try:
        conn.execute("BEGIN IMMEDIATE")
        called = _advance_room(conn, clinic_id, room, "skipped", department)
        conn.execute("COMMIT")
        return called
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()


def do_recall(clinic_id: int) -> int:
    conn = get_conn()
    try:
        conn.execute("BEGIN IMMEDIATE")
        cur = conn.execute(
            "UPDATE tokens SET status='waiting', priority=1 "
            "WHERE clinic_id=? AND status='skipped'",
            (clinic_id,),
        )
        count = cur.rowcount
        conn.execute("COMMIT")
        return count
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()


def do_call_specific(clinic_id: int, number: int, room: int) -> Optional[int]:
    conn = get_conn()
    try:
        conn.execute("BEGIN IMMEDIATE")
        target = conn.execute(
            "SELECT * FROM tokens WHERE clinic_id=? AND number=? AND status='waiting'",
            (clinic_id, number),
        ).fetchone()
        if not target:
            conn.execute("ROLLBACK")
            return None
        conn.execute(
            "UPDATE tokens SET status='done', room=NULL "
            "WHERE clinic_id=? AND status='serving' AND room=?",
            (clinic_id, room),
        )
        conn.execute(
            "UPDATE tokens SET status='serving', room=?, served_at=? WHERE id=?",
            (room, now_iso(), target["id"]),
        )
        conn.execute("COMMIT")
        return number
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()


def do_admit(clinic_id: int, token_id: int) -> Optional[int]:
    conn = get_conn()
    try:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute(
            "SELECT * FROM tokens WHERE id=? AND clinic_id=? AND status='booked'",
            (token_id, clinic_id),
        ).fetchone()
        if not row:
            conn.execute("ROLLBACK")
            return None
        clinic = conn.execute(
            "SELECT next_token FROM accounts WHERE id=?", (clinic_id,)
        ).fetchone()
        number = clinic["next_token"]
        conn.execute(
            "UPDATE tokens SET status='waiting', number=? WHERE id=?", (number, token_id)
        )
        conn.execute(
            "UPDATE accounts SET next_token=? WHERE id=?", (number + 1, clinic_id)
        )
        conn.execute("COMMIT")
        return number
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()


def do_remove(clinic_id: int, number: int) -> bool:
    conn = get_conn()
    cur = conn.execute(
        "UPDATE tokens SET status='cancelled' WHERE clinic_id=? AND number=? "
        "AND status IN ('waiting','skipped')",
        (clinic_id, number),
    )
    ok = cur.rowcount > 0
    conn.close()
    return ok


def do_prioritize(clinic_id: int, number: int) -> bool:
    conn = get_conn()
    cur = conn.execute(
        "UPDATE tokens SET priority=1 WHERE clinic_id=? AND number=? AND status='waiting'",
        (clinic_id, number),
    )
    ok = cur.rowcount > 0
    conn.close()
    return ok


class ConnectionManager:
    def __init__(self):
        self.rooms: dict[int, list[WebSocket]] = {}

    async def connect(self, clinic_id: int, ws: WebSocket):
        await ws.accept()
        self.rooms.setdefault(clinic_id, []).append(ws)

    def disconnect(self, clinic_id: int, ws: WebSocket):
        room = self.rooms.get(clinic_id, [])
        if ws in room:
            room.remove(ws)

    async def broadcast(self, clinic_id: int, message: dict):
        dead = []
        for ws in self.rooms.get(clinic_id, []):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(clinic_id, ws)


manager = ConnectionManager()


async def broadcast_clinic(clinic_id: int):
    snap = clinic_snapshot(clinic_id)
    if snap:
        await manager.broadcast(clinic_id, snap)


def notify_next_in_line(clinic_id: int) -> None:
    if not mailer.is_configured():
        return
    conn = get_conn()
    try:
        clinic = conn.execute(
            "SELECT name FROM accounts WHERE id=?", (clinic_id,)
        ).fetchone()
        if not clinic:
            return
        nxt = conn.execute(
            "SELECT * FROM tokens WHERE clinic_id=? AND status='waiting' AND notified=0 "
            "ORDER BY priority DESC, number ASC LIMIT 1",
            (clinic_id,),
        ).fetchone()
        if not nxt or nxt["patient_id"] is None:
            return
        conn.execute("UPDATE tokens SET notified=1 WHERE id=?", (nxt["id"],))
        patient = conn.execute(
            "SELECT email FROM accounts WHERE id=? AND role='patient'",
            (nxt["patient_id"],),
        ).fetchone()
        if not patient or not patient["email"]:
            return
        subject, text, html = mailer.you_are_next_email(clinic["name"], nxt["number"])
        mailer.send_email(patient["email"], subject, text, html)
    finally:
        conn.close()


def get_account(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    payload = auth.decode_token(authorization.split(" ", 1)[1])
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    conn = get_conn()
    row = conn.execute("SELECT * FROM accounts WHERE id=?", (payload["id"],)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=401, detail="Account not found")
    return dict(row)


def require_clinic(account=Depends(get_account)) -> dict:
    if account["role"] == "clinic":
        return account
    if account["role"] == "staff" and account["clinic_id"]:
        conn = get_conn()
        clinic = conn.execute(
            "SELECT * FROM accounts WHERE id=? AND role='clinic'", (account["clinic_id"],)
        ).fetchone()
        conn.close()
        if clinic:
            return dict(clinic)
    raise HTTPException(status_code=403, detail="Clinic access required")


def require_patient(account=Depends(get_account)) -> dict:
    if account["role"] != "patient":
        raise HTTPException(status_code=403, detail="Patient account required")
    return account


class SignupBody(BaseModel):
    role: str = Field(pattern="^(clinic|patient|staff)$")
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=4, max_length=128)
    clinic_code: Optional[int] = None
    license: str = Field(default="", max_length=80)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)


class LoginBody(BaseModel):
    email: str
    password: str


class GoogleBody(BaseModel):
    credential: str
    role: Optional[str] = None


class AddPatientBody(BaseModel):
    name: str = Field(default="", max_length=80)
    priority: int = Field(default=0, ge=0, le=1)
    reason: str = Field(default="", max_length=160)
    department: str = Field(default="", max_length=60)
    patient_ref: str = Field(default="", max_length=120)


class AvgTimeBody(BaseModel):
    minutes: int = Field(ge=1, le=180)


class PauseBody(BaseModel):
    paused: bool


class SettingsBody(BaseModel):
    room_count: Optional[int] = Field(default=None, ge=1, le=12)
    departments: Optional[str] = Field(default=None, max_length=400)
    is_open: Optional[bool] = None
    hours: Optional[str] = Field(default=None, max_length=120)
    lat: Optional[float] = Field(default=None, ge=-90, le=90)
    lng: Optional[float] = Field(default=None, ge=-180, le=180)


class CallBody(BaseModel):
    room: int = Field(default=1, ge=1, le=12)
    department: str = Field(default="", max_length=60)


class JoinBody(BaseModel):
    reason: str = Field(default="", max_length=160)
    department: str = Field(default="", max_length=60)


class BookBody(BaseModel):
    appointment_at: str = Field(max_length=40)
    reason: str = Field(default="", max_length=160)
    department: str = Field(default="", max_length=60)


@app.get("/")
def root():
    return {"app": "MediQueue", "status": "ok"}


def valid_email(email: str) -> bool:
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email))


@app.post("/api/auth/signup")
def signup(body: SignupBody):
    email = body.email.strip().lower()
    if not valid_email(email):
        raise HTTPException(status_code=400, detail="Please enter a valid email address")
    clinic_id = None
    if body.role == "staff":
        if not body.clinic_code:
            raise HTTPException(status_code=400, detail="A clinic code is required for staff")
        conn = get_conn()
        clinic = conn.execute(
            "SELECT id FROM accounts WHERE id=? AND role='clinic'", (body.clinic_code,)
        ).fetchone()
        conn.close()
        if not clinic:
            raise HTTPException(status_code=404, detail="No clinic found for that code")
        clinic_id = body.clinic_code
    conn = get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO accounts (role, name, email, password_hash, clinic_id, license, lat, lng) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (
                body.role,
                body.name.strip(),
                email,
                auth.hash_password(body.password),
                clinic_id,
                body.license.strip() if body.role == "clinic" else "",
                body.lat if body.role == "clinic" else None,
                body.lng if body.role == "clinic" else None,
            ),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM accounts WHERE id=?", (cur.lastrowid,)
        ).fetchone()
    except Exception:
        conn.close()
        raise HTTPException(status_code=409, detail="Email already registered")
    conn.close()
    token = auth.create_token(row["id"], row["role"])
    return {"token": token, "account": public_account(row)}


@app.post("/api/auth/login")
def login(body: LoginBody):
    email = body.email.strip().lower()
    conn = get_conn()
    row = conn.execute("SELECT * FROM accounts WHERE email=?", (email,)).fetchone()
    conn.close()
    if not row or not auth.verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = auth.create_token(row["id"], row["role"])
    return {"token": token, "account": public_account(row)}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/auth/config")
def auth_config():
    return {
        "google_enabled": bool(GOOGLE_CLIENT_ID),
        "google_client_id": GOOGLE_CLIENT_ID,
    }


def verify_google_credential(credential: str) -> dict:
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured")
    url = "https://oauth2.googleapis.com/tokeninfo?" + urllib.parse.urlencode(
        {"id_token": credential}
    )
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            data = json.loads(r.read())
    except Exception:
        raise HTTPException(status_code=401, detail="Could not verify Google token")
    if data.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=401, detail="Google token audience mismatch")
    if data.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(status_code=401, detail="Invalid Google token issuer")
    if str(data.get("email_verified")).lower() != "true":
        raise HTTPException(status_code=401, detail="Google email is not verified")
    email = (data.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=401, detail="Google token missing email")
    name = data.get("name") or data.get("given_name") or email.split("@")[0]
    return {"email": email, "name": name}


@app.post("/api/auth/google")
def google_auth(body: GoogleBody):
    info = verify_google_credential(body.credential)
    email = info["email"]
    conn = get_conn()
    row = conn.execute("SELECT * FROM accounts WHERE email=?", (email,)).fetchone()
    if not row:
        try:
            cur = conn.execute(
                "INSERT INTO accounts (role, name, email, password_hash, provider) "
                "VALUES ('patient',?,?,?, 'google')",
                (info["name"], email, "!google"),
            )
            row = conn.execute(
                "SELECT * FROM accounts WHERE id=?", (cur.lastrowid,)
            ).fetchone()
        except Exception:
            conn.close()
            raise HTTPException(status_code=409, detail="Account creation failed")
    conn.close()
    token = auth.create_token(row["id"], row["role"])
    return {"token": token, "account": public_account(row)}


@app.get("/api/me")
def me(account=Depends(get_account)):
    return {"account": public_account(account)}


@app.get("/api/clinic/state")
def clinic_state(account=Depends(require_clinic)):
    return clinic_snapshot(account["id"])


@app.post("/api/clinic/patients")
async def clinic_add_patient(body: AddPatientBody, account=Depends(require_clinic)):
    patient_id = None
    linked_name = None
    ref = body.patient_ref.strip()
    if ref:
        conn = get_conn()
        if ref.isdigit():
            row = conn.execute(
                "SELECT id, name FROM accounts WHERE id=? AND role='patient'",
                (int(ref),),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT id, name FROM accounts WHERE email=? AND role='patient'",
                (ref.lower(),),
            ).fetchone()
        conn.close()
        if row:
            patient_id = row["id"]
            linked_name = row["name"]
    name = body.name.strip() or linked_name or f"Patient {account['next_token']}"
    number = add_token(
        account["id"],
        name,
        patient_id=patient_id,
        priority=body.priority,
        reason=body.reason.strip() or None,
        department=body.department.strip() or None,
    )
    await broadcast_clinic(account["id"])
    return {
        "added": {"token": number, "name": name},
        "linked": patient_id is not None,
        "state": clinic_snapshot(account["id"]),
    }


@app.post("/api/clinic/call-next")
async def clinic_call_next(body: CallBody = CallBody(), account=Depends(require_clinic)):
    if account["paused"]:
        raise HTTPException(status_code=409, detail="Queue is paused")
    called = do_call_next(account["id"], body.room, body.department.strip() or None)
    await broadcast_clinic(account["id"])
    notify_next_in_line(account["id"])
    return {"called": called, "state": clinic_snapshot(account["id"])}


@app.post("/api/clinic/skip")
async def clinic_skip(body: CallBody = CallBody(), account=Depends(require_clinic)):
    called = do_skip(account["id"], body.room, body.department.strip() or None)
    await broadcast_clinic(account["id"])
    notify_next_in_line(account["id"])
    return {"called": called, "state": clinic_snapshot(account["id"])}


@app.post("/api/clinic/recall")
async def clinic_recall(account=Depends(require_clinic)):
    count = do_recall(account["id"])
    await broadcast_clinic(account["id"])
    return {"recalled": count, "state": clinic_snapshot(account["id"])}


@app.post("/api/clinic/call/{number}")
async def clinic_call_specific(
    number: int, body: CallBody = CallBody(), account=Depends(require_clinic)
):
    if account["paused"]:
        raise HTTPException(status_code=409, detail="Queue is paused")
    called = do_call_specific(account["id"], number, body.room)
    if called is None:
        raise HTTPException(status_code=404, detail="Token not found in the waiting list")
    await broadcast_clinic(account["id"])
    notify_next_in_line(account["id"])
    return {"called": called, "state": clinic_snapshot(account["id"])}


@app.post("/api/clinic/remove/{number}")
async def clinic_remove(number: int, account=Depends(require_clinic)):
    if not do_remove(account["id"], number):
        raise HTTPException(status_code=404, detail="Token not found")
    await broadcast_clinic(account["id"])
    return {"removed": number, "state": clinic_snapshot(account["id"])}


@app.post("/api/clinic/prioritize/{number}")
async def clinic_prioritize(number: int, account=Depends(require_clinic)):
    if not do_prioritize(account["id"], number):
        raise HTTPException(status_code=404, detail="Token not found in the waiting list")
    await broadcast_clinic(account["id"])
    return {"prioritized": number, "state": clinic_snapshot(account["id"])}


@app.put("/api/clinic/pause")
async def clinic_pause(body: PauseBody, account=Depends(require_clinic)):
    conn = get_conn()
    conn.execute(
        "UPDATE accounts SET paused=? WHERE id=?",
        (1 if body.paused else 0, account["id"]),
    )
    conn.close()
    await broadcast_clinic(account["id"])
    return {"paused": body.paused, "state": clinic_snapshot(account["id"])}


@app.put("/api/clinic/settings")
async def clinic_settings(body: SettingsBody, account=Depends(require_clinic)):
    conn = get_conn()
    if body.room_count is not None:
        conn.execute(
            "UPDATE accounts SET room_count=? WHERE id=?", (body.room_count, account["id"])
        )
    if body.departments is not None:
        cleaned = ",".join(
            d.strip() for d in body.departments.split(",") if d.strip()
        )
        conn.execute(
            "UPDATE accounts SET departments=? WHERE id=?", (cleaned, account["id"])
        )
    if body.is_open is not None:
        conn.execute(
            "UPDATE accounts SET is_open=? WHERE id=?",
            (1 if body.is_open else 0, account["id"]),
        )
    if body.hours is not None:
        conn.execute(
            "UPDATE accounts SET hours=? WHERE id=?", (body.hours.strip(), account["id"])
        )
    if body.lat is not None and body.lng is not None:
        conn.execute(
            "UPDATE accounts SET lat=?, lng=? WHERE id=?",
            (body.lat, body.lng, account["id"]),
        )
    conn.close()
    await broadcast_clinic(account["id"])
    return {"state": clinic_snapshot(account["id"])}


@app.post("/api/clinic/admit/{token_id}")
async def clinic_admit(token_id: int, account=Depends(require_clinic)):
    number = do_admit(account["id"], token_id)
    if number is None:
        raise HTTPException(status_code=404, detail="Appointment not found")
    await broadcast_clinic(account["id"])
    return {"admitted": number, "state": clinic_snapshot(account["id"])}


@app.put("/api/clinic/avg-time")
async def clinic_avg_time(body: AvgTimeBody, account=Depends(require_clinic)):
    conn = get_conn()
    conn.execute(
        "UPDATE accounts SET avg_time=? WHERE id=?", (body.minutes, account["id"])
    )
    conn.commit()
    conn.close()
    await broadcast_clinic(account["id"])
    return {"state": clinic_snapshot(account["id"])}


@app.post("/api/clinic/reset")
async def clinic_reset(account=Depends(require_clinic)):
    conn = get_conn()
    try:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute("DELETE FROM tokens WHERE clinic_id=?", (account["id"],))
        conn.execute(
            "UPDATE accounts SET next_token=1, current_token=NULL WHERE id=?",
            (account["id"],),
        )
        conn.execute("COMMIT")
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()
    await broadcast_clinic(account["id"])
    return {"state": clinic_snapshot(account["id"])}


@app.get("/api/clinics")
def list_clinics():
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, name, departments, is_open FROM accounts WHERE role='clinic' ORDER BY name"
    ).fetchall()
    result = []
    for r in rows:
        waiting = conn.execute(
            "SELECT COUNT(*) AS c FROM tokens WHERE clinic_id=? AND status='waiting'",
            (r["id"],),
        ).fetchone()["c"]
        result.append(
            {
                "id": r["id"],
                "name": r["name"],
                "waiting": waiting,
                "departments": parse_departments(r["departments"]),
                "is_open": bool(r["is_open"]),
            }
        )
    conn.close()
    return {"clinics": result}


@app.get("/api/clinics/overview")
def clinics_overview():
    conn = get_conn()
    clinics = conn.execute(
        "SELECT id, name, avg_time, paused, is_open, hours, room_count, departments, lat, lng, verified "
        "FROM accounts WHERE role='clinic' ORDER BY name"
    ).fetchall()
    result = []
    for c in clinics:
        waiting = conn.execute(
            "SELECT COUNT(*) AS n FROM tokens WHERE clinic_id=? AND status='waiting'",
            (c["id"],),
        ).fetchone()["n"]
        serving = conn.execute(
            "SELECT number FROM tokens WHERE clinic_id=? AND status='serving' "
            "ORDER BY room LIMIT 1",
            (c["id"],),
        ).fetchone()
        serving_count = conn.execute(
            "SELECT COUNT(*) AS n FROM tokens WHERE clinic_id=? AND status='serving'",
            (c["id"],),
        ).fetchone()["n"]
        paused = bool(c["paused"])
        manually_open = bool(c["is_open"])
        rooms = c["room_count"]
        est = (waiting // max(1, rooms) + (1 if serving_count else 0)) * c["avg_time"]
        result.append(
            {
                "id": c["id"],
                "name": c["name"],
                "current_token": serving["number"] if serving else None,
                "waiting": waiting,
                "rooms": rooms,
                "departments": parse_departments(c["departments"]),
                "hours": c["hours"],
                "avg_consultation_time": c["avg_time"],
                "estimated_wait": est,
                "paused": paused,
                "is_open": manually_open and not paused,
                "verified": bool(c["verified"]),
                "lat": c["lat"],
                "lng": c["lng"],
            }
        )
    conn.close()
    return {"clinics": result}


def require_admin(x_admin_key: Optional[str] = Header(None)):
    if not x_admin_key or x_admin_key != ADMIN_KEY:
        raise HTTPException(status_code=403, detail="Admin key required")
    return True


@app.get("/api/admin/pending")
def admin_pending(_=Depends(require_admin)):
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, name, email, license, lat, lng FROM accounts "
        "WHERE role='clinic' AND verified=0 ORDER BY id DESC"
    ).fetchall()
    conn.close()
    return {"pending": [dict(r) for r in rows]}


@app.post("/api/admin/clinics/{clinic_id}/verify")
def admin_verify(clinic_id: int, _=Depends(require_admin)):
    conn = get_conn()
    cur = conn.execute(
        "UPDATE accounts SET verified=1 WHERE id=? AND role='clinic'", (clinic_id,)
    )
    conn.close()
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return {"verified": True, "clinic_id": clinic_id}


@app.get("/api/clinics/{clinic_id}/state")
def public_clinic_state(clinic_id: int):
    snap = clinic_snapshot(clinic_id)
    if not snap:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return snap


def patient_status(clinic_id: int, patient_id: int) -> dict:
    snap = clinic_snapshot(clinic_id)
    if not snap:
        raise HTTPException(status_code=404, detail="Clinic not found")
    mine = None
    being_served = False
    my_room = None
    for s in snap["servings"]:
        if s["patient_id"] == patient_id:
            mine = s["token"]
            being_served = True
            my_room = s["room"]
            break
    if not being_served:
        for w in snap["waiting"]:
            if w["patient_id"] == patient_id:
                mine = w["token"]
                break
    ahead = 0
    est = 0
    if mine is not None and not being_served:
        for w in snap["waiting"]:
            if w["token"] == mine:
                ahead = w["position"] - 1
                est = w["estimated_wait"]
                break
    return {
        "clinic_id": clinic_id,
        "clinic_name": snap["clinic_name"],
        "in_queue": mine is not None,
        "my_token": mine,
        "being_served": being_served,
        "my_room": my_room,
        "tokens_ahead": ahead,
        "estimated_wait": est,
        "current_token": snap["current_token"],
        "serving": snap["serving"],
        "avg_consultation_time": snap["avg_consultation_time"],
    }


@app.get("/api/patient/queues")
def patient_queues(account=Depends(require_patient)):
    conn = get_conn()
    rows = conn.execute(
        "SELECT t.clinic_id, t.number, t.status, t.department, t.appointment_at, "
        "a.name AS clinic_name "
        "FROM tokens t JOIN accounts a ON a.id = t.clinic_id "
        "WHERE t.patient_id=? AND t.status IN ('waiting','serving','booked') "
        "ORDER BY t.id DESC",
        (account["id"],),
    ).fetchall()
    conn.close()
    return {
        "queues": [
            {
                "clinic_id": r["clinic_id"],
                "clinic_name": r["clinic_name"],
                "token": r["number"],
                "status": r["status"],
                "department": r["department"],
                "appointment_at": r["appointment_at"],
            }
            for r in rows
        ]
    }


@app.get("/api/clinics/{clinic_id}/me")
def patient_me(clinic_id: int, account=Depends(require_patient)):
    return patient_status(clinic_id, account["id"])


@app.get("/api/patient/history")
def patient_history(account=Depends(require_patient)):
    conn = get_conn()
    rows = conn.execute(
        "SELECT t.number, t.status, t.created_at, a.name AS clinic_name "
        "FROM tokens t JOIN accounts a ON a.id = t.clinic_id "
        "WHERE t.patient_id=? AND t.status IN ('done','skipped','cancelled') "
        "ORDER BY t.id DESC LIMIT 30",
        (account["id"],),
    ).fetchall()
    conn.close()
    return {
        "history": [
            {
                "token": r["number"],
                "status": r["status"],
                "clinic_name": r["clinic_name"],
                "at": r["created_at"],
            }
            for r in rows
        ]
    }


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, clinic_id: int = Query(...)):
    await manager.connect(clinic_id, ws)
    snap = clinic_snapshot(clinic_id)
    if snap:
        await ws.send_json(snap)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(clinic_id, ws)
    except Exception:
        manager.disconnect(clinic_id, ws)
