# MediQueue

**Real-time clinic queue management — no paper tokens, no shouting, no guessing.**

MediQueue replaces the paper token slip and the receptionist shouting "next!" with
live digital tokens. Patients see exactly when they'll be called; clinics run the
whole day from one calm dashboard; every screen stays in sync the moment
**Call Next** is clicked.

Built for **Queue Cure '26**.

---

## The problem

76% of India's ~1.5 million clinics still run on paper token slips and shouted
names. Patients wait 2–3 hours with zero visibility into when they'll be seen,
doctors have no dashboard of who's next, and receptionists manage the entire
queue from memory. MediQueue digitises that flow end to end.

---

## Highlights

- **Live queues over WebSockets** — one mutation rebroadcasts a full snapshot to
  every dashboard, patient phone, and waiting-room display in that clinic's room.
- **Reception-driven flow** — patients **cannot** self-join or leave a queue.
  Reception adds a patient (optionally linking their app by code/email); that
  token then appears live on the patient's phone, counting down as the queue moves.
- **Multiple doctors / rooms** — a shared waiting line feeds several rooms serving
  in parallel, with per-room "now serving" and per-department routing.
- **Smart wait estimates** — the ETA counts only the *remaining* time of the
  in-progress consultation (not a flat average), so the patient countdown is live.
- **Email "you're next" alerts** — when the token ahead of a patient is called,
  they get an email to head over — cutting dead time at the clinic.
- **Explore & map** — a public console to compare clinics by shortest wait, plus a
  Leaflet map of nearby hospitals/clinics (OpenStreetMap) and registered clinics.
- **Clinic registration + verification** — clinics self-register (with license);
  an admin endpoint marks them Verified vs Pending.
- **Queue tools** — priority/emergency tokens, skip & recall no-shows,
  pause/resume, call a specific token, remove, appointments, visit history.
- **Auth** — email/password (PBKDF2 + HMAC bearer tokens) and Google sign-in
  (patients). One-click demo clinic & patient accounts.
- **Polish** — multi-language (English / हिन्दी / தமிழ்), light/dark mode,
  fully responsive with a mobile hamburger nav, QR quick-status links.

---

## Tech stack

| Layer      | Tech |
|------------|------|
| Frontend   | React 18, Vite 6, React Router 6, Framer Motion, React-Leaflet / Leaflet |
| Backend    | FastAPI, Uvicorn, WebSockets |
| Auth       | Standard-library PBKDF2-HMAC-SHA256 hashing + HMAC-signed bearer tokens; Google Identity Services (ID-token verification) |
| Database   | SQLite (local dev) / PostgreSQL (production, auto-selected via `DATABASE_URL`) |
| Realtime   | One WebSocket "room" per clinic; full-snapshot broadcast on every mutation |
| Email      | Standard-library `smtplib` (optional; no-op until SMTP is configured) |
| Deploy     | Render (API + free Postgres via `render.yaml`), Vercel (frontend via `vercel.json`) |

No heavyweight dependencies on the backend — auth, email, and DB access are all
built on the Python standard library plus FastAPI/Uvicorn and a Postgres driver.

---

## Project structure

```
.
├── backend/
│   ├── main.py            # FastAPI app: routes, queue logic, WS broadcast, snapshots
│   ├── db.py              # SQLite/Postgres abstraction + schema + migrations
│   ├── auth.py            # PBKDF2 password hashing + HMAC bearer tokens
│   ├── mailer.py          # Optional SMTP "you're next" notifications
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── pages/         # Landing, Auth, ClinicDashboard, PatientView,
│   │   │                  # ExploreClinics, DisplayBoard, QuickJoin
│   │   ├── components/    # Chrome (nav/footer), ClinicsMap, GoogleButton, Select, BrandMark
│   │   ├── auth.jsx       # Auth context + API/WS base URLs
│   │   ├── useQueue.js    # WebSocket subscription hook
│   │   ├── i18n.jsx       # en / hi / ta dictionary + language switcher
│   │   └── styles.css
│   ├── vercel.json
│   └── .env.example
├── docs/
│   ├── socket-events.md   # Real-time architecture + sequence diagram
│   └── auth-setup.md      # Google OAuth setup
└── render.yaml            # Render Blueprint (API web service + free Postgres)
```

---

## Run locally

### 1. Backend (FastAPI)

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate   |   macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

The API runs at `http://localhost:8000`. With no `DATABASE_URL` set it uses a local
SQLite file (`backend/mediqueue.db`) and seeds demo accounts on first boot.

### 2. Frontend (Vite + React)

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173` and talks to `http://localhost:8000` by
default. Override with `frontend/.env` if needed:

```
VITE_API_URL=http://localhost:8000
# VITE_WS_URL is auto-derived from VITE_API_URL (http→ws, https→wss)
```

### Demo accounts

Click **Try Demo Clinic** / **Try Demo Patient** on the auth page, or sign in with:

| Role    | Email                          | Password   |
|---------|--------------------------------|------------|
| Clinic  | `demo.clinic@mediqueue.app`    | `demo1234` |
| Patient | `demo.patient@mediqueue.app`   | `demo1234` |

---

## Environment variables

### Backend

| Variable | Required | Purpose |
|----------|----------|---------|
| `MEDIQUEUE_SECRET` | recommended | Secret used to sign session tokens (use a long random string in prod) |
| `DATABASE_URL` | prod | Postgres connection string. If unset, SQLite is used |
| `MEDIQUEUE_DB` | optional | SQLite file path (local dev only; default `backend/mediqueue.db`) |
| `ALLOWED_ORIGINS` | prod | Comma-separated allowed frontend origins. Defaults to `*` |
| `GOOGLE_CLIENT_ID` | optional | Enables Google sign-in (see `docs/auth-setup.md`) |
| `MEDIQUEUE_ADMIN_KEY` | recommended | Secret for the admin verify endpoints (sent as `X-Admin-Key`) |
| `MEDIQUEUE_SMTP_HOST` / `_PORT` / `_USER` / `_PASS` / `_SSL` | optional | SMTP server for "you're next" emails. Email is disabled until host/user/pass are set |
| `MEDIQUEUE_MAIL_FROM` | optional | From address for emails (defaults to the SMTP user) |

### Frontend

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Backend base URL (e.g. `https://mediqueue-api.onrender.com`) |
| `VITE_WS_URL` | Optional — WebSocket base, auto-derived from `VITE_API_URL` if omitted |

---

## Deployment (Render + Vercel)

The repo ships ready-to-deploy configs. Full step-by-step lives below; the short
version:

### Backend → Render (Blueprint)
1. Push the repo to GitHub.
2. Render → **New → Blueprint** → select the repo. `render.yaml` creates a
   **free PostgreSQL** database (`mediqueue-db`) and the **API** web service,
   auto-wiring `DATABASE_URL` and generating `MEDIQUEUE_SECRET`.
3. Fill the remaining secrets (`ALLOWED_ORIGINS`, `MEDIQUEUE_ADMIN_KEY`,
   optional `GOOGLE_CLIENT_ID` / SMTP).
4. Verify `https://<api>.onrender.com/api/health` → `{"status":"ok"}`.

### Frontend → Vercel
1. Vercel → **Add New → Project** → import the repo.
2. Set **Root Directory = `frontend`** (Vite is auto-detected; `vercel.json`
   handles SPA rewrites).
3. Add `VITE_API_URL = https://<api>.onrender.com` → Deploy.

### Connect them
- On Render set `ALLOWED_ORIGINS` to your Vercel URL.
- If using Google sign-in, add the Vercel URL to **Authorized JavaScript origins**
  in the Google Cloud console.

> **Free-tier notes:** the Render API cold-starts after ~15 min idle (first request
> is slow, then fine), and Render's free Postgres expires ~30 days after creation
> (data persists until then). Switching the database to SQLite locally or a paid
> Postgres in prod needs no code changes — the backend auto-selects via `DATABASE_URL`.

---

## How the real-time layer works

```
 Clinic Dashboard         Patient phone(s)         Display board (TV)
   /clinic (auth)           /patient (auth)          /display/:clinicId
        │                        │                         │
        │   ws://host/ws?clinic_id=42  (all subscribe to the SAME room)
        └───────────┬────────────┴────────────┬────────────┘
                    ▼                          ▼
        ┌──────────────────────────────────────────────────────┐
        │  FastAPI — ConnectionManager.rooms[clinic_id]=[ws...]  │
        │  DB: accounts(clinic|patient) + tokens(per clinic)     │
        └──────────────────────────────────────────────────────┘
```

Every action is **REST mutates → WebSocket notifies**: the endpoint writes to the
database, then `broadcast_clinic(clinic_id)` pushes one fresh snapshot to every
screen in that clinic's room. Each token in the snapshot carries its `patient_id`,
so a patient's phone simply finds its own row to render the token, people-ahead,
and ETA — no per-patient socket required.

See **[docs/socket-events.md](docs/socket-events.md)** for the full event table,
snapshot schema, and a Mermaid sequence diagram.

---

## API reference (summary)

**Auth & account** — `POST /api/auth/signup`, `POST /api/auth/login`,
`POST /api/auth/google`, `GET /api/auth/config`, `GET /api/auth/demo`, `GET /api/me`

**Clinic (clinic/staff auth)** — `GET /api/clinic/state`,
`POST /api/clinic/patients`, `POST /api/clinic/call-next`, `POST /api/clinic/skip`,
`POST /api/clinic/recall`, `POST /api/clinic/call/{number}`,
`POST /api/clinic/remove/{number}`, `POST /api/clinic/prioritize/{number}`,
`PUT /api/clinic/pause`, `PUT /api/clinic/settings`, `PUT /api/clinic/avg-time`,
`POST /api/clinic/admit/{token_id}`, `POST /api/clinic/reset`

**Patient (patient auth)** — `GET /api/patient/queues`, `GET /api/patient/history`,
`GET /api/clinics/{id}/me`

**Public / explore** — `GET /api/clinics`, `GET /api/clinics/overview`,
`GET /api/clinics/{id}/state`, `GET /api/health`

**Admin (`X-Admin-Key`)** — `GET /api/admin/pending`,
`POST /api/admin/clinics/{id}/verify`

**WebSocket** — `GET /ws?clinic_id=<id>` → streams `state_update` snapshots

---

## Security notes

- Passwords are hashed with **PBKDF2-HMAC-SHA256** (per-user salt) — never stored
  in plaintext. Sessions are **HMAC-signed bearer tokens** with a 7-day expiry.
- Google sign-in verifies the **ID token** against Google's official endpoint and
  checks the audience, issuer, and email-verified claim.
- Queue writes are auth-gated to the owning clinic; reads (display/explore) use a
  public snapshot stream. Clinic verification is gated behind `MEDIQUEUE_ADMIN_KEY`.
- CORS is locked to `ALLOWED_ORIGINS` in production.
- Concurrency-safe: SQLite uses WAL + `BEGIN IMMEDIATE` critical sections;
  Postgres uses explicit transactions — verified with concurrent "Call Next"
  bursts producing unique, non-double-served tokens.

---

## Documentation

- **[docs/socket-events.md](docs/socket-events.md)** — real-time architecture, event
  table, snapshot payload, sequence diagram.
- **[docs/auth-setup.md](docs/auth-setup.md)** — enabling Google sign-in.

---

## License

Released under the [MIT License](LICENSE).
