import json
import os
import re
import urllib.parse
import urllib.request
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
from db import get_conn, init_db, now_iso

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")

app = FastAPI(title="MediQueue API", version="2.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


init_db()


def public_account(row) -> dict:
    return {
        "id": row["id"],
        "role": row["role"],
        "name": row["name"],
        "email": row["email"],
        "avg_time": row["avg_time"],
    }


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
    conn.close()

    avg = clinic["avg_time"]
    serving = None
    for r in rows:
        if r["status"] == "serving":
            serving = {
                "token": r["number"],
                "name": r["name"],
                "patient_id": r["patient_id"],
                "reason": r["reason"],
                "priority": r["priority"],
            }
    serving_block = 1 if serving else 0
    waiting = []
    idx = 0
    for r in rows:
        if r["status"] == "waiting":
            idx += 1
            waiting.append(
                {
                    "token": r["number"],
                    "name": r["name"],
                    "patient_id": r["patient_id"],
                    "reason": r["reason"],
                    "priority": r["priority"],
                    "position": idx,
                    "estimated_wait": (idx - 1 + serving_block) * avg,
                }
            )
    return {
        "type": "state_update",
        "clinic_id": clinic_id,
        "clinic_name": clinic["name"],
        "current_token": clinic["current_token"],
        "paused": bool(clinic["paused"]),
        "serving": serving,
        "waiting": waiting,
        "skipped": [{"token": s["number"], "name": s["name"]} for s in skipped_rows],
        "tokens_ahead": len(waiting),
        "avg_consultation_time": avg,
        "stats": {
            "waiting": len(waiting),
            "served": served,
            "total": len(waiting) + served + (1 if serving else 0),
        },
        "timestamp": now_iso(),
    }


def add_token(
    clinic_id: int,
    name: str,
    patient_id: Optional[int] = None,
    priority: int = 0,
    reason: Optional[str] = None,
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
            "INSERT INTO tokens (clinic_id, patient_id, name, number, status, priority, reason, created_at) "
            "VALUES (?,?,?,?, 'waiting', ?, ?, ?)",
            (clinic_id, patient_id, name, number, priority, reason, now_iso()),
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


def _advance(conn, clinic_id: int, current_status: str) -> Optional[int]:
    conn.execute(
        f"UPDATE tokens SET status='{current_status}' WHERE clinic_id=? AND status='serving'",
        (clinic_id,),
    )
    nxt = conn.execute(
        "SELECT * FROM tokens WHERE clinic_id=? AND status='waiting' "
        "ORDER BY priority DESC, number ASC LIMIT 1",
        (clinic_id,),
    ).fetchone()
    if nxt:
        conn.execute("UPDATE tokens SET status='serving' WHERE id=?", (nxt["id"],))
        conn.execute(
            "UPDATE accounts SET current_token=? WHERE id=?", (nxt["number"], clinic_id)
        )
        return nxt["number"]
    conn.execute("UPDATE accounts SET current_token=NULL WHERE id=?", (clinic_id,))
    return None


def do_call_next(clinic_id: int) -> Optional[int]:
    conn = get_conn()
    try:
        conn.execute("BEGIN IMMEDIATE")
        called = _advance(conn, clinic_id, "done")
        conn.execute("COMMIT")
        return called
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()


def do_skip(clinic_id: int) -> Optional[int]:
    conn = get_conn()
    try:
        conn.execute("BEGIN IMMEDIATE")
        called = _advance(conn, clinic_id, "skipped")
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


def do_call_specific(clinic_id: int, number: int) -> Optional[int]:
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
            "UPDATE tokens SET status='done' WHERE clinic_id=? AND status='serving'",
            (clinic_id,),
        )
        conn.execute("UPDATE tokens SET status='serving' WHERE id=?", (target["id"],))
        conn.execute(
            "UPDATE accounts SET current_token=? WHERE id=?", (number, clinic_id)
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
    if account["role"] != "clinic":
        raise HTTPException(status_code=403, detail="Clinic account required")
    return account


def require_patient(account=Depends(get_account)) -> dict:
    if account["role"] != "patient":
        raise HTTPException(status_code=403, detail="Patient account required")
    return account


class SignupBody(BaseModel):
    role: str = Field(pattern="^(clinic|patient)$")
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=4, max_length=128)


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


class AvgTimeBody(BaseModel):
    minutes: int = Field(ge=1, le=180)


class PauseBody(BaseModel):
    paused: bool


class JoinBody(BaseModel):
    reason: str = Field(default="", max_length=160)


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
    conn = get_conn()
    try:
        cur = conn.execute(
            "INSERT INTO accounts (role, name, email, password_hash) VALUES (?,?,?,?)",
            (body.role, body.name.strip(), email, auth.hash_password(body.password)),
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
        if body.role not in ("clinic", "patient"):
            conn.close()
            return {"needs_role": True, "email": email, "name": info["name"]}
        try:
            cur = conn.execute(
                "INSERT INTO accounts (role, name, email, password_hash, provider) "
                "VALUES (?,?,?,?, 'google')",
                (body.role, info["name"], email, "!google"),
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
    name = body.name.strip() or f"Patient {account['next_token']}"
    number = add_token(
        account["id"],
        name,
        priority=body.priority,
        reason=body.reason.strip() or None,
    )
    await broadcast_clinic(account["id"])
    return {"added": {"token": number, "name": name}, "state": clinic_snapshot(account["id"])}


@app.post("/api/clinic/call-next")
async def clinic_call_next(account=Depends(require_clinic)):
    if account["paused"]:
        raise HTTPException(status_code=409, detail="Queue is paused")
    called = do_call_next(account["id"])
    await broadcast_clinic(account["id"])
    return {"called": called, "state": clinic_snapshot(account["id"])}


@app.post("/api/clinic/skip")
async def clinic_skip(account=Depends(require_clinic)):
    called = do_skip(account["id"])
    await broadcast_clinic(account["id"])
    return {"called": called, "state": clinic_snapshot(account["id"])}


@app.post("/api/clinic/recall")
async def clinic_recall(account=Depends(require_clinic)):
    count = do_recall(account["id"])
    await broadcast_clinic(account["id"])
    return {"recalled": count, "state": clinic_snapshot(account["id"])}


@app.post("/api/clinic/call/{number}")
async def clinic_call_specific(number: int, account=Depends(require_clinic)):
    if account["paused"]:
        raise HTTPException(status_code=409, detail="Queue is paused")
    called = do_call_specific(account["id"], number)
    if called is None:
        raise HTTPException(status_code=404, detail="Token not found in the waiting list")
    await broadcast_clinic(account["id"])
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
        "SELECT id, name FROM accounts WHERE role='clinic' ORDER BY name"
    ).fetchall()
    result = []
    for r in rows:
        waiting = conn.execute(
            "SELECT COUNT(*) AS c FROM tokens WHERE clinic_id=? AND status='waiting'",
            (r["id"],),
        ).fetchone()["c"]
        result.append({"id": r["id"], "name": r["name"], "waiting": waiting})
    conn.close()
    return {"clinics": result}


@app.get("/api/clinics/overview")
def clinics_overview():
    conn = get_conn()
    clinics = conn.execute(
        "SELECT id, name, avg_time, paused FROM accounts WHERE role='clinic' ORDER BY name"
    ).fetchall()
    result = []
    for c in clinics:
        waiting = conn.execute(
            "SELECT COUNT(*) AS n FROM tokens WHERE clinic_id=? AND status='waiting'",
            (c["id"],),
        ).fetchone()["n"]
        serving = conn.execute(
            "SELECT number FROM tokens WHERE clinic_id=? AND status='serving' LIMIT 1",
            (c["id"],),
        ).fetchone()
        serving_flag = 1 if serving else 0
        paused = bool(c["paused"])
        result.append(
            {
                "id": c["id"],
                "name": c["name"],
                "current_token": serving["number"] if serving else None,
                "waiting": waiting,
                "avg_consultation_time": c["avg_time"],
                "estimated_wait": (waiting + serving_flag) * c["avg_time"],
                "paused": paused,
                "is_open": not paused and (serving_flag == 1 or waiting > 0),
            }
        )
    conn.close()
    return {"clinics": result}


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
    if snap["serving"] and snap["serving"]["patient_id"] == patient_id:
        mine = snap["serving"]["token"]
        being_served = True
    else:
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
        "tokens_ahead": ahead,
        "estimated_wait": est,
        "current_token": snap["current_token"],
        "serving": snap["serving"],
        "avg_consultation_time": snap["avg_consultation_time"],
    }


@app.post("/api/clinics/{clinic_id}/join")
async def patient_join(
    clinic_id: int, body: JoinBody = JoinBody(), account=Depends(require_patient)
):
    conn = get_conn()
    created = False
    try:
        conn.execute("BEGIN IMMEDIATE")
        clinic = conn.execute(
            "SELECT next_token FROM accounts WHERE id=? AND role='clinic'", (clinic_id,)
        ).fetchone()
        if not clinic:
            conn.execute("ROLLBACK")
            raise HTTPException(status_code=404, detail="Clinic not found")
        existing = conn.execute(
            "SELECT number FROM tokens WHERE clinic_id=? AND patient_id=? "
            "AND status IN ('waiting','serving')",
            (clinic_id, account["id"]),
        ).fetchone()
        if not existing:
            number = clinic["next_token"]
            conn.execute(
                "INSERT INTO tokens (clinic_id, patient_id, name, number, status, reason, created_at) "
                "VALUES (?,?,?,?, 'waiting', ?, ?)",
                (
                    clinic_id,
                    account["id"],
                    account["name"],
                    number,
                    body.reason.strip() or None,
                    now_iso(),
                ),
            )
            conn.execute(
                "UPDATE accounts SET next_token=? WHERE id=?", (number + 1, clinic_id)
            )
            created = True
        conn.execute("COMMIT")
    except HTTPException:
        raise
    except Exception:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()
    if created:
        await broadcast_clinic(clinic_id)
    return patient_status(clinic_id, account["id"])


@app.post("/api/clinics/{clinic_id}/leave")
async def patient_leave(clinic_id: int, account=Depends(require_patient)):
    conn = get_conn()
    conn.execute(
        "UPDATE tokens SET status='done' WHERE clinic_id=? AND patient_id=? "
        "AND status IN ('waiting','serving')",
        (clinic_id, account["id"]),
    )
    conn.commit()
    conn.close()
    await broadcast_clinic(clinic_id)
    return patient_status(clinic_id, account["id"])


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
