from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="MediQueue API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Patient:
    def __init__(self, token: int, name: str):
        self.token = token
        self.name = name
        self.status = "waiting"
        self.added_at = datetime.now(timezone.utc).isoformat()

    def to_dict(self):
        return {
            "token": self.token,
            "name": self.name,
            "status": self.status,
            "added_at": self.added_at,
        }


class Clinic:
    def __init__(self):
        self.patients: list[Patient] = []
        self.next_token: int = 1
        self.current_token: Optional[int] = None
        self.avg_consultation_time: int = 10

    def add_patient(self, name: str) -> Patient:
        patient = Patient(self.next_token, name.strip() or f"Patient {self.next_token}")
        self.patients.append(patient)
        self.next_token += 1
        return patient

    def call_next(self) -> Optional[Patient]:
        for p in self.patients:
            if p.status == "serving":
                p.status = "done"
        for p in self.patients:
            if p.status == "waiting":
                p.status = "serving"
                self.current_token = p.token
                return p
        self.current_token = None
        return None

    def set_avg_time(self, minutes: int):
        self.avg_consultation_time = max(1, int(minutes))

    def reset(self):
        self.__init__()

    def snapshot(self) -> dict:
        waiting = [p for p in self.patients if p.status == "waiting"]
        serving = next((p for p in self.patients if p.status == "serving"), None)
        done = [p for p in self.patients if p.status == "done"]

        waiting_view = []
        for idx, p in enumerate(waiting):
            waiting_view.append(
                {
                    **p.to_dict(),
                    "position": idx + 1,
                    "estimated_wait": (idx + 1) * self.avg_consultation_time,
                }
            )

        return {
            "type": "state_update",
            "current_token": self.current_token,
            "serving": serving.to_dict() if serving else None,
            "waiting": waiting_view,
            "tokens_ahead": len(waiting),
            "avg_consultation_time": self.avg_consultation_time,
            "next_token": self.next_token,
            "stats": {
                "waiting": len(waiting),
                "served": len(done),
                "total": len(self.patients),
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


clinic = Clinic()


class ConnectionManager:
    def __init__(self):
        self.connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.connections:
            self.connections.remove(ws)

    async def broadcast(self, message: dict):
        dead = []
        for ws in self.connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


async def broadcast_state():
    await manager.broadcast(clinic.snapshot())


class AddPatientBody(BaseModel):
    name: str = Field(default="", max_length=80)


class AvgTimeBody(BaseModel):
    minutes: int = Field(ge=1, le=180)


@app.get("/")
def root():
    return {"app": "MediQueue", "status": "ok"}


@app.get("/api/state")
def get_state():
    return clinic.snapshot()


@app.post("/api/patients")
async def add_patient(body: AddPatientBody):
    patient = clinic.add_patient(body.name)
    await broadcast_state()
    return {"added": patient.to_dict(), "state": clinic.snapshot()}


@app.post("/api/call-next")
async def call_next():
    called = clinic.call_next()
    await broadcast_state()
    return {"called": called.to_dict() if called else None, "state": clinic.snapshot()}


@app.put("/api/avg-time")
async def set_avg_time(body: AvgTimeBody):
    clinic.set_avg_time(body.minutes)
    await broadcast_state()
    return {"state": clinic.snapshot()}


@app.post("/api/reset")
async def reset():
    clinic.reset()
    await broadcast_state()
    return {"state": clinic.snapshot()}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    await ws.send_json(clinic.snapshot())
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:
        manager.disconnect(ws)
