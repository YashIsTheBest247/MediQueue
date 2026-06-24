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

app = FastAPI(title="MediQueue API", version="2.0.0")

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
        "SELECT * FROM tokens WHERE clinic_id=? AND status IN ('waiting','serving') ORDER BY number",
        (clinic_id,),
    ).fetchall()
    served = conn.execute(
        "SELECT COUNT(*) AS c FROM tokens WHERE clinic_id=? AND status='done'",
        (clinic_id,),
    ).fetchone()["c"]
    conn.close()

    avg = clinic["avg_time"]
    serving = None
    for r in rows:
        if r["status"] == "serving":
            serving = {
                "token": r["number"],
                "name": r["name"],
                "patient_id": r["patient_id"],
            }
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
                    "position": idx,
                    "estimated_wait": idx * avg,
                }
            )
    return {
        "type": "state_update",
        "clinic_id": clinic_id,
        "clinic_name": clinic["name"],
        "current_token": clinic["current_token"],
        "serving": serving,
        "waiting": waiting,
        "tokens_ahead": len(waiting),
        "avg_consultation_time": avg,
        "stats": {
            "waiting": len(waiting),
            "served": served,
            "total": len(waiting) + served + (1 if serving else 0),
        },
        "timestamp": now_iso(),
    }


def add_token(clinic_id: int, name: str, patient_id: Optional[int] = None) -> Optional[int]:
    conn = get_conn()
    clinic = conn.execute(
        "SELECT next_token FROM accounts WHERE id=? AND role='clinic'", (clinic_id,)
    ).fetchone()
    if not clinic:
        conn.close()
        return None
    number = clinic["next_token"]
    conn.execute(
        "INSERT INTO tokens (clinic_id, patient_id, name, number, status, created_at) "
        "VALUES (?,?,?,?, 'waiting', ?)",
        (clinic_id, patient_id, name, number, now_iso()),
    )
    conn.execute(
        "UPDATE accounts SET next_token=? WHERE id=?", (number + 1, clinic_id)
    )
    conn.commit()
    conn.close()
    return number


def do_call_next(clinic_id: int) -> Optional[int]:
    conn = get_conn()
    conn.execute(
        "UPDATE tokens SET status='done' WHERE clinic_id=? AND status='serving'",
        (clinic_id,),
    )
    nxt = conn.execute(
        "SELECT * FROM tokens WHERE clinic_id=? AND status='waiting' ORDER BY number LIMIT 1",
        (clinic_id,),
    ).fetchone()
    if nxt:
        conn.execute("UPDATE tokens SET status='serving' WHERE id=?", (nxt["id"],))
        conn.execute(
            "UPDATE accounts SET current_token=? WHERE id=?", (nxt["number"], clinic_id)
        )
        called = nxt["number"]
    else:
        conn.execute(
            "UPDATE accounts SET current_token=NULL WHERE id=?", (clinic_id,)
        )
        called = None
    conn.commit()
    conn.close()
    return called


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


class AddPatientBody(BaseModel):
    name: str = Field(default="", max_length=80)


class AvgTimeBody(BaseModel):
    minutes: int = Field(ge=1, le=180)


@app.get("/")
def root():
    return {"app": "MediQueue", "status": "ok"}


@app.post("/api/auth/signup")
def signup(body: SignupBody):
    email = body.email.strip().lower()
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


@app.get("/api/me")
def me(account=Depends(get_account)):
    return {"account": public_account(account)}


@app.get("/api/clinic/state")
def clinic_state(account=Depends(require_clinic)):
    return clinic_snapshot(account["id"])


@app.post("/api/clinic/patients")
async def clinic_add_patient(body: AddPatientBody, account=Depends(require_clinic)):
    name = body.name.strip() or f"Patient {account['next_token']}"
    number = add_token(account["id"], name)
    await broadcast_clinic(account["id"])
    return {"added": {"token": number, "name": name}, "state": clinic_snapshot(account["id"])}


@app.post("/api/clinic/call-next")
async def clinic_call_next(account=Depends(require_clinic)):
    called = do_call_next(account["id"])
    await broadcast_clinic(account["id"])
    return {"called": called, "state": clinic_snapshot(account["id"])}


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
    conn.execute("DELETE FROM tokens WHERE clinic_id=?", (account["id"],))
    conn.execute(
        "UPDATE accounts SET next_token=1, current_token=NULL WHERE id=?",
        (account["id"],),
    )
    conn.commit()
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
                est = ahead * snap["avg_consultation_time"]
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
async def patient_join(clinic_id: int, account=Depends(require_patient)):
    conn = get_conn()
    clinic = conn.execute(
        "SELECT id FROM accounts WHERE id=? AND role='clinic'", (clinic_id,)
    ).fetchone()
    if not clinic:
        conn.close()
        raise HTTPException(status_code=404, detail="Clinic not found")
    existing = conn.execute(
        "SELECT number FROM tokens WHERE clinic_id=? AND patient_id=? "
        "AND status IN ('waiting','serving')",
        (clinic_id, account["id"]),
    ).fetchone()
    conn.close()
    if not existing:
        add_token(clinic_id, account["name"], patient_id=account["id"])
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
