# Socket Event Diagram — MediQueue (Queue Cure '26)

Multi-tenant: every clinic has its own queue and its own WebSocket "room".
Clients subscribe to one clinic via `ws://<host>/ws?clinic_id=<id>`. Any mutation
to that clinic rebroadcasts a full snapshot to everyone in that room only.

## Accounts

- **Clinic / staff** account → owns a queue, runs the dashboard, adds patients,
  calls the next token across one or more rooms.
- **Patient** account → watches an assigned token live. Patients **cannot**
  self-join or leave; reception adds them (optionally linking the patient's app by
  code/email), and the token then appears on the patient's phone.

Auth is an HMAC-signed token (stdlib) returned on signup/login and sent as
`Authorization: Bearer <token>`. Passwords are PBKDF2-HMAC-SHA256 hashed.

## Connection topology (one room per clinic)

```
   Clinic Dashboard            Patient phone(s)            Display board (TV)
   /clinic (clinic auth)       /patient (patient auth)     /display/:clinicId
        │                            │                            │
        │   ws://host/ws?clinic_id=42 (all subscribe to the SAME room)
        └─────────────┬──────────────┴──────────────┬─────────────┘
                      ▼                              ▼
        ┌──────────────────────────────────────────────────────────┐
        │   FastAPI — ConnectionManager.rooms[clinic_id] = [ws...]   │
        │   SQLite: accounts(clinic|patient) + tokens(per clinic)    │
        └──────────────────────────────────────────────────────────┘
```

## Event flow — a clinic clicks "Call Next"

```
CLINIC DASHBOARD          FASTAPI (REST + WS room 42)        PATIENT / DISPLAY
──────────────            ──────────────────────────         ─────────────────
 click "Call Next"
      │ POST /api/clinic/call-next  (Bearer clinic token)
      ├───────────────────────►
      │                  do_call_next(42)
      │                  serving→done, next waiting→serving
      │                  broadcast_clinic(42)
      │                       │
      │   ◄───────────────────┤ send_json(snapshot)  → every ws in room 42
      │   {type:state_update} ├───────────────────────────────────────────►
   re-render queue                              patient recomputes own token,
                                                tokens-ahead, ETA from snapshot
```

## Events

| Direction       | Channel | Endpoint / event                       | Auth     |
|-----------------|---------|----------------------------------------|----------|
| Client → Server | REST    | `POST /api/auth/signup`                | public   |
| Client → Server | REST    | `POST /api/auth/login`                 | public   |
| Client → Server | REST    | `POST /api/clinic/patients` (add)      | clinic   |
| Client → Server | REST    | `POST /api/clinic/call-next` (per room)| clinic   |
| Client → Server | REST    | `POST /api/clinic/skip` / `recall`     | clinic   |
| Client → Server | REST    | `POST /api/clinic/call/{number}`       | clinic   |
| Client → Server | REST    | `PUT  /api/clinic/settings` (rooms/depts/hours) | clinic |
| Client → Server | REST    | `PUT  /api/clinic/avg-time`            | clinic   |
| Client → Server | REST    | `GET  /api/patient/queues`             | patient  |
| Client → Server | REST    | `GET  /api/clinics/overview`           | public   |
| Server → Client | Email   | "you're next" (token ahead was called) | n/a      |
| Server → Client | WS      | `state_update` (per clinic room)       | open     |
| Client ↔ Server | WS      | connect `?clinic_id=` / keep-alive     | open     |

> Patients no longer self-join: there are no `POST /api/clinics/{id}/join|leave`
> endpoints. Reception adds tokens via `POST /api/clinic/patients`, and the patient
> watches the assigned token through `GET /api/patient/queues` + the WS snapshot.

## `state_update` snapshot payload

```json
{
  "type": "state_update",
  "clinic_id": 42,
  "clinic_name": "Sunrise Clinic",
  "paused": false,
  "is_open": true,
  "verified": true,
  "room_count": 2,
  "departments": ["GP", "Dental"],
  "current_token": 3,
  "serving": { "token": 3, "name": "Riya Sharma", "patient_id": 7, "room": 1, "remaining": 4 },
  "servings": [
    { "token": 3, "name": "Riya Sharma", "patient_id": 7, "room": 1, "remaining": 4 },
    { "token": 6, "name": "Amit",        "patient_id": null, "room": 2, "remaining": 8 }
  ],
  "waiting": [
    { "token": 4, "name": "Neha",  "patient_id": 9,    "position": 1, "estimated_wait": 4 },
    { "token": 5, "name": "Karan", "patient_id": null, "position": 2, "estimated_wait": 8 }
  ]
}
```

Notes:
- **`servings[]`** holds one entry per room being served in parallel; `serving` and
  `current_token` mirror the first room for single-room views.
- **`remaining`** is the live minutes left in that consultation — the patient ETA
  counts only the *remaining* time of the in-progress visit, not a flat average.
- **`estimated_wait`** per waiting token is computed by simulating room
  availability (a min-heap over each room's free time), so multi-room clinics show
  correctly shorter waits.

## Why this design

- **One room per clinic.** `clinic_id` namespaces both the SQLite rows and the
  WebSocket subscribers, so clinics never see each other's queues.
- **REST mutates, WebSocket notifies.** Every action mutates SQLite then calls
  `broadcast_clinic(clinic_id)` — one snapshot to every screen in that room.
- **Patients are self-locating.** The snapshot carries `patient_id` on each
  token; a patient's phone finds its own row to show token, tokens-ahead, and ETA
  — no per-patient socket needed.
- **Auth-gated writes, open reads.** Only the owning clinic can call next; the
  read-only display/patient view subscribes to the public snapshot stream.

```mermaid
sequenceDiagram
    participant C as Clinic Dashboard
    participant S as FastAPI + WS room(clinic_id)
    participant P as Patient phone
    participant D as Display board
    C->>S: POST /api/clinic/call-next (Bearer)
    S->>S: do_call_next(clinic_id) + SQLite
    S-->>C: state_update
    S-->>P: state_update
    S-->>D: state_update
    P->>P: recompute my token / ETA
```
