import { useState } from "react";
import { useClinic } from "../useClinic.js";
import { TopBar, Footer } from "../components/Chrome.jsx";

export default function Receptionist() {
  const { state, connected, addPatient, callNext, setAvgTime, reset } =
    useClinic();
  const [name, setName] = useState("");

  const avg = state?.avg_consultation_time ?? 10;
  const serving = state?.serving;
  const waiting = state?.waiting ?? [];
  const stats = state?.stats ?? { waiting: 0, served: 0, total: 0 };

  async function handleAdd(e) {
    e.preventDefault();
    await addPatient(name);
    setName("");
  }

  return (
    <div className="page">
      <TopBar
        connected={connected}
        right={
          <button className="pill ghost" onClick={reset}>
            Reset Day
          </button>
        }
      />

      <div className="wrap">
        <div className="grid-2">
          <div className="card card-pad">
            <div className="section-title">Reception Desk</div>
            <div className="h1">
              Manage the <span>Queue</span>
            </div>
            <p className="sub">
              Register walk-ins and call the next patient. Both the desk and the
              waiting room update instantly.
            </p>

            <form onSubmit={handleAdd} className="field">
              <label>Patient name</label>
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Riya Sharma"
                />
                <button type="submit" className="btn btn-primary">
                  + Add
                </button>
              </div>
            </form>

            <div className="field">
              <label>Average consultation time</label>
              <div className="stepper">
                <button
                  onClick={() => setAvgTime(Math.max(1, avg - 1))}
                  aria-label="decrease"
                >
                  −
                </button>
                <div className="val">{avg}</div>
                <button onClick={() => setAvgTime(avg + 1)} aria-label="increase">
                  +
                </button>
                <span className="unit">minutes / patient</span>
              </div>
            </div>

            <button
              className="btn btn-call"
              onClick={callNext}
              disabled={waiting.length === 0 && !serving}
            >
              Call Next Token
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
              <span className="pill solid">
                {serving ? serving.name : "Idle"}
              </span>
            </div>

            <div className="section-title" style={{ marginTop: 8 }}>
              Up Next ({waiting.length})
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
                  No patients yet. Add a walk-in to start the queue.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
