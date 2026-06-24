import { useEffect, useState } from "react";
import { useAuth } from "../auth.jsx";
import { useQueueSocket } from "../useQueue.js";
import { TopBar } from "../components/Chrome.jsx";

const STORE = "mq_patient_clinic";

export default function PatientView() {
  const { account, authedFetch, logout } = useAuth();
  const [joined, setJoined] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORE) || "null");
    } catch {
      return null;
    }
  });
  const [clinics, setClinics] = useState([]);
  const [busy, setBusy] = useState(false);

  const { state, connected } = useQueueSocket(joined?.id);

  useEffect(() => {
    if (joined) return;
    authedFetch("/api/clinics")
      .then((r) => r.json())
      .then((d) => setClinics(d.clinics || []))
      .catch(() => setClinics([]));
  }, [joined, authedFetch]);

  function persist(j) {
    setJoined(j);
    if (j) localStorage.setItem(STORE, JSON.stringify(j));
    else localStorage.removeItem(STORE);
  }

  async function join(clinic) {
    setBusy(true);
    try {
      const r = await authedFetch(`/api/clinics/${clinic.id}/join`, {
        method: "POST",
      });
      const d = await r.json();
      persist({ id: clinic.id, name: clinic.name, token: d.my_token });
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (joined) await authedFetch(`/api/clinics/${joined.id}/leave`, { method: "POST" });
    persist(null);
  }

  const header = (
    <TopBar
      connected={joined ? connected : undefined}
      right={
        <>
          <span className="pill ghost">{account.name}</span>
          <button className="pill ghost" onClick={logout}>
            Log out
          </button>
        </>
      }
    />
  );

  if (!joined) {
    return (
      <div className="page">
        {header}
        <div className="wrap">
          <div className="section-title">Patient</div>
          <div className="h1">
            Join a <span>clinic queue</span>
          </div>
          <p className="sub">
            Pick your clinic to get a token. You'll see your position and wait
            time update live — no need to crowd the waiting room.
          </p>

          <div className="clinic-list">
            {clinics.length === 0 && (
              <div className="empty">No clinics are open yet.</div>
            )}
            {clinics.map((c) => (
              <div key={c.id} className="clinic-row card">
                <div>
                  <div className="nm">{c.name}</div>
                  <div className="meta">{c.waiting} waiting in queue</div>
                </div>
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => join(c)}
                >
                  Join queue
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  let me = null;
  if (state) {
    if (state.serving && state.serving.patient_id === account.id) {
      me = { token: state.serving.token, ahead: 0, est: 0, served: true };
    } else {
      const w = state.waiting.find((x) => x.patient_id === account.id);
      if (w)
        me = {
          token: w.token,
          ahead: w.position - 1,
          est: w.estimated_wait,
          served: false,
        };
    }
  }
  const done = state && !me;

  return (
    <div className="page">
      {header}
      <div className="wrap">
        <div className="section-title" style={{ textAlign: "center" }}>
          {joined.name}
        </div>
        <div className="h1" style={{ textAlign: "center", marginBottom: 24 }}>
          {me?.served
            ? "It's your turn"
            : done
            ? "Your consultation is complete"
            : "You're in the queue"}
        </div>

        <div className="now-serving">
          <div className="label">Your Token</div>
          <div className="big-token">{joined.token ?? me?.token ?? "—"}</div>
          <div className="pat-name">
            {me?.served
              ? "Please proceed to the doctor"
              : done
              ? "Thanks for visiting"
              : `Now serving token ${state?.current_token ?? "—"}`}
          </div>
          <div className="pulse">
            {connected ? "Live · updates automatically" : "Reconnecting…"}
          </div>
        </div>

        {!done && !me?.served && (
          <div className="info-row">
            <div className="info-card">
              <div className="v">{me?.ahead ?? "—"}</div>
              <div className="k">Patients ahead of you</div>
            </div>
            <div className="info-card">
              <div className="v">{me?.est ?? "—"}</div>
              <div className="k">Estimated wait (min)</div>
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 26 }}>
          <button className="btn btn-ghost" onClick={leave}>
            {done ? "Back to clinics" : "Leave queue"}
          </button>
        </div>
      </div>
    </div>
  );
}
