import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { useQueueSocket } from "../useQueue.js";
import { TopBar } from "../components/Chrome.jsx";

export default function ClinicDashboard() {
  const { account, authedFetch, logout } = useAuth();
  const { state, connected } = useQueueSocket(account.id);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const avg = state?.avg_consultation_time ?? account.avg_time ?? 10;
  const serving = state?.serving;
  const waiting = state?.waiting ?? [];
  const stats = state?.stats ?? { waiting: 0, served: 0, total: 0 };

  async function addPatient(e) {
    e.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    try {
      await authedFetch("/api/clinic/patients", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      setName("");
    } finally {
      setBusy(false);
    }
  }

  async function callNext() {
    if (busy) return;
    setBusy(true);
    try {
      await authedFetch("/api/clinic/call-next", { method: "POST" });
    } finally {
      setBusy(false);
    }
  }

  const setAvg = (minutes) =>
    authedFetch("/api/clinic/avg-time", {
      method: "PUT",
      body: JSON.stringify({ minutes: Math.min(180, Math.max(1, minutes)) }),
    });

  async function reset() {
    if (
      !window.confirm(
        "Clear the whole queue and reset tokens to 1? This cannot be undone."
      )
    )
      return;
    await authedFetch("/api/clinic/reset", { method: "POST" });
  }

  return (
    <div className="page">
      <TopBar
        connected={connected}
        right={
          <>
            <Link to={`/display/${account.id}`} className="pill ghost">
              Open display
            </Link>
            <button className="pill ghost" onClick={reset}>
              Reset Day
            </button>
            <button className="pill ghost" onClick={logout}>
              Log out
            </button>
          </>
        }
      />

      <div className="wrap">
        <div className="grid-2">
          <div className="card card-pad">
            <div className="section-title">{account.name}</div>
            <div className="h1">
              Clinic <span>Dashboard</span>
            </div>
            <p className="sub">
              Register walk-ins and call the next patient. Your waiting room and
              every patient's phone update instantly.
            </p>

            <form onSubmit={addPatient} className="field">
              <label>Add walk-in patient</label>
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Riya Sharma"
                />
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  + Add
                </button>
              </div>
            </form>

            <div className="field">
              <label>Average consultation time</label>
              <div className="stepper">
                <button onClick={() => setAvg(Math.max(1, avg - 1))} aria-label="decrease">
                  −
                </button>
                <div className="val">{avg}</div>
                <button onClick={() => setAvg(avg + 1)} aria-label="increase">
                  +
                </button>
                <span className="unit">minutes / patient</span>
              </div>
            </div>

            <button
              className="btn btn-call"
              onClick={callNext}
              disabled={busy || (waiting.length === 0 && !serving)}
            >
              {busy ? "Working…" : "Call Next Token"}
            </button>

            <div className="stat-row">
              <div className="stat">
                <div className="num">{stats.waiting}</div>
                <div className="lbl">Waiting</div>
              </div>
              <div className="stat">
                <div className="num">{stats.served}</div>
                <div className="lbl">Served</div>
              </div>
              <div className="stat">
                <div className="num">{stats.total}</div>
                <div className="lbl">Total</div>
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <div className="queue-head">
              <div>
                <div className="section-title">Now Serving</div>
                <div className="h1" style={{ fontSize: 24 }}>
                  {serving ? `Token ${serving.token}` : "—"}
                </div>
              </div>
              <span className="pill solid">{serving ? serving.name : "Idle"}</span>
            </div>

            <div className="section-title" style={{ marginTop: 8 }}>
              Patients in queue ({waiting.length})
            </div>
            <div className="queue">
              {serving && (
                <div className="q-item serving">
                  <div className="token-chip serving">{serving.token}</div>
                  <div className="who">
                    <div className="nm">{serving.name}</div>
                    <div className="meta">In consultation now</div>
                  </div>
                  <span className="eta">Serving</span>
                </div>
              )}
              {waiting.map((p) => (
                <div key={p.token} className="q-item">
                  <div className="token-chip">{p.token}</div>
                  <div className="who">
                    <div className="nm">{p.name}</div>
                    <div className="meta">Position {p.position} in line</div>
                  </div>
                  <span className="eta">~{p.estimated_wait} min</span>
                </div>
              ))}
              {!serving && waiting.length === 0 && (
                <div className="empty">
                  No patients yet. Add a walk-in or wait for patients to join.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
