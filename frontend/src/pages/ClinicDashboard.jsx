import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { useQueueSocket } from "../useQueue.js";
import { TopBar } from "../components/Chrome.jsx";

export default function ClinicDashboard() {
  const { account, authedFetch, logout } = useAuth();
  const { state, connected } = useQueueSocket(account.id);
  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const avg = state?.avg_consultation_time ?? account.avg_time ?? 10;
  const serving = state?.serving;
  const waiting = state?.waiting ?? [];
  const skipped = state?.skipped ?? [];
  const stats = state?.stats ?? { waiting: 0, served: 0, total: 0 };
  const paused = state?.paused ?? false;

  const post = (path) => authedFetch(path, { method: "POST" });

  async function addPatient(e) {
    e.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    try {
      await authedFetch("/api/clinic/patients", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          priority: urgent ? 1 : 0,
          reason: reason.trim(),
        }),
      });
      setName("");
      setReason("");
      setUrgent(false);
    } finally {
      setBusy(false);
    }
  }

  async function guarded(fn) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  const callNext = () => guarded(() => post("/api/clinic/call-next"));
  const skip = () => guarded(() => post("/api/clinic/skip"));
  const recall = () => guarded(() => post("/api/clinic/recall"));
  const callSpecific = (n) => guarded(() => post(`/api/clinic/call/${n}`));
  const prioritize = (n) => guarded(() => post(`/api/clinic/prioritize/${n}`));
  const removeTok = (n) => guarded(() => post(`/api/clinic/remove/${n}`));
  const togglePause = () =>
    authedFetch("/api/clinic/pause", {
      method: "PUT",
      body: JSON.stringify({ paused: !paused }),
    });

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
    await post("/api/clinic/reset");
  }

  const joinUrl = `${window.location.origin}/j/${account.id}`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=0&data=${encodeURIComponent(
    joinUrl
  )}`;

  function copyLink() {
    navigator.clipboard?.writeText(joinUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="page">
      <TopBar
        connected={connected}
        right={
          <>
            <button
              className={"pill ghost" + (paused ? " on" : "")}
              onClick={togglePause}
            >
              {paused ? "Resume queue" : "Pause queue"}
            </button>
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
        {paused && (
          <div className="pause-banner">
            Queue is paused — patients can still join, but calling is on hold.
          </div>
        )}
        <div className="grid-2">
          <div className="card card-pad">
            <div className="section-title">{account.name}</div>
            <div className="h1">
              Clinic <span>Dashboard</span>
            </div>

            <form onSubmit={addPatient} className="field">
              <label>Add walk-in patient</label>
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Patient name"
                />
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  + Add
                </button>
              </div>
              <input
                className="input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason / symptoms (optional)"
                style={{ marginTop: 8 }}
              />
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={urgent}
                  onChange={(e) => setUrgent(e.target.checked)}
                />
                Mark as urgent (jumps to front)
              </label>
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
              disabled={busy || paused || (waiting.length === 0 && !serving)}
            >
              {paused ? "Queue paused" : busy ? "Working…" : "Call Next Token"}
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

            <div className="share-box">
              <div className="share-info">
                <div className="section-title">Patient join code</div>
                <div className="share-code">#{account.id}</div>
                <p className="share-sub">
                  Patients scan the QR or open the link to join this queue
                  instantly.
                </p>
                <button className="btn btn-ghost share-btn" onClick={copyLink}>
                  {copied ? "Link copied!" : "Copy join link"}
                </button>
              </div>
              <img className="share-qr" src={qrSrc} alt="Join queue QR code" />
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
              {serving ? (
                <button className="pill solid skip-pill" onClick={skip}>
                  Skip (no-show)
                </button>
              ) : (
                <span className="pill solid">Idle</span>
              )}
            </div>

            {serving?.reason && (
              <div className="serving-reason">Reason: {serving.reason}</div>
            )}

            {skipped.length > 0 && (
              <div className="skipped-row">
                <span>
                  Skipped:{" "}
                  {skipped.map((s) => `#${s.token}`).join(", ")}
                </span>
                <button className="q-btn" onClick={recall}>
                  Recall
                </button>
              </div>
            )}

            <div className="section-title" style={{ marginTop: 12 }}>
              Patients in queue ({waiting.length})
            </div>
            <div className="queue">
              {waiting.map((p) => (
                <div key={p.token} className={"q-item" + (p.priority ? " urgent" : "")}>
                  <div className={"token-chip" + (p.priority ? " urgent" : "")}>
                    {p.token}
                  </div>
                  <div className="who">
                    <div className="nm">
                      {p.name}
                      {p.priority ? <span className="urgent-tag">Urgent</span> : null}
                    </div>
                    <div className="meta">
                      {p.reason ? p.reason + " · " : ""}~{p.estimated_wait} min
                    </div>
                  </div>
                  <div className="q-act">
                    <button className="q-btn" onClick={() => callSpecific(p.token)}>
                      Call
                    </button>
                    {!p.priority && (
                      <button className="q-btn" onClick={() => prioritize(p.token)}>
                        Urgent
                      </button>
                    )}
                    <button
                      className="q-btn danger"
                      onClick={() => removeTok(p.token)}
                      aria-label="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              {waiting.length === 0 && (
                <div className="empty">
                  No patients waiting. Add a walk-in or share the join code.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
