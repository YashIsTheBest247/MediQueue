import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth.jsx";
import { useQueueSocket } from "../useQueue.js";
import { TopBar } from "../components/Chrome.jsx";
import { chime, notify, requestNotifyPermission } from "../notify.js";
import { useT } from "../i18n.jsx";

const STORE = "mq_patient_clinic";

function clockTime(mins) {
  const d = new Date(Date.now() + mins * 60000);
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, "0")} ${ap}`;
}

export default function PatientView() {
  const { account, authedFetch, logout } = useAuth();
  const { t } = useT();
  const [joined, setJoined] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORE) || "null");
    } catch {
      return null;
    }
  });
  const [clinics, setClinics] = useState([]);
  const [queues, setQueues] = useState([]);
  const [reason, setReason] = useState("");
  const [apptTime, setApptTime] = useState("");
  const [deptByClinic, setDeptByClinic] = useState({});
  const [busy, setBusy] = useState(false);
  const stageRef = useRef(null);

  const { state, connected } = useQueueSocket(joined?.id);

  function loadLists() {
    authedFetch("/api/clinics")
      .then((r) => r.json())
      .then((d) => setClinics(d.clinics || []))
      .catch(() => setClinics([]));
    authedFetch("/api/patient/queues")
      .then((r) => r.json())
      .then((d) => setQueues(d.queues || []))
      .catch(() => setQueues([]));
  }

  useEffect(() => {
    if (joined) return;
    const pre = localStorage.getItem("mq_preselect_clinic");
    if (pre) {
      localStorage.removeItem("mq_preselect_clinic");
      try {
        join(JSON.parse(pre));
        return;
      } catch {
        void 0;
      }
    }
    loadLists();
  }, [joined, authedFetch]);

  function persist(j) {
    setJoined(j);
    if (j) localStorage.setItem(STORE, JSON.stringify(j));
    else localStorage.removeItem(STORE);
  }

  async function join(clinic) {
    setBusy(true);
    requestNotifyPermission();
    try {
      const r = await authedFetch(`/api/clinics/${clinic.id}/join`, {
        method: "POST",
        body: JSON.stringify({
          reason: reason.trim(),
          department: deptByClinic[clinic.id] || "",
        }),
      });
      const d = await r.json();
      stageRef.current = null;
      persist({ id: clinic.id, name: clinic.name, token: d.my_token });
    } finally {
      setBusy(false);
    }
  }

  async function book(clinic) {
    if (!apptTime) {
      alert("Pick an appointment time first.");
      return;
    }
    setBusy(true);
    try {
      await authedFetch(`/api/clinics/${clinic.id}/book`, {
        method: "POST",
        body: JSON.stringify({
          appointment_at: apptTime,
          reason: reason.trim(),
          department: deptByClinic[clinic.id] || "",
        }),
      });
      loadLists();
      alert(`Booked at ${clinic.name} for ${apptTime}.`);
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (joined)
      await authedFetch(`/api/clinics/${joined.id}/leave`, { method: "POST" });
    persist(null);
  }

  let me = null;
  if (state) {
    const s = (state.servings || []).find((x) => x.patient_id === account.id);
    if (s) {
      me = { token: s.token, ahead: 0, est: 0, served: true, room: s.room };
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
  const done = state && joined && !me;
  const stage = me?.served
    ? "turn"
    : me && me.ahead <= 1
    ? "soon"
    : me
    ? "waiting"
    : done
    ? "done"
    : null;

  useEffect(() => {
    if (!stage || !joined) return;
    const prev = stageRef.current;
    stageRef.current = stage;
    if (prev === null) return;
    if (stage === "soon" && prev !== "soon" && prev !== "turn") {
      chime();
      notify("You're almost up", `${joined.name}: only ${me?.ahead ?? 0} ahead.`);
    } else if (stage === "turn" && prev !== "turn") {
      chime();
      notify(
        "It's your turn!",
        `${joined.name}: token ${me?.token}${
          me?.room ? ` — go to Room ${me.room}` : ""
        }.`
      );
    }
  }, [stage, joined, me]);

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
          <div className="section-title">{t("Patient")}</div>
          <div className="h1">
            {t("Join a")} <span>{t("clinic queue")}</span>
          </div>
          <p className="sub">
            {t(
              "Pick a clinic to get a token, or book a time for later. You can be in more than one queue at once."
            )}
          </p>

          {queues.length > 0 && (
            <div className="my-queues">
              <div className="section-title">{t("Your active queues")}</div>
              {queues.map((q) => (
                <div key={`${q.clinic_id}-${q.token}`} className="clinic-row card">
                  <div>
                    <div className="nm">{q.clinic_name}</div>
                    <div className="meta">
                      {q.status === "booked"
                        ? `${t("Booked")} · ${q.appointment_at}`
                        : `${t("Token")} ${q.token ?? "—"} · ${q.status}`}
                    </div>
                  </div>
                  {q.status !== "booked" && (
                    <button
                      className="btn btn-ghost"
                      onClick={() =>
                        persist({
                          id: q.clinic_id,
                          name: q.clinic_name,
                          token: q.token,
                        })
                      }
                    >
                      {t("View")}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <input
            className="input reason-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("Reason for visit / symptoms (optional)")}
          />
          <div className="field">
            <label>{t("Book for later (optional)")}</label>
            <input
              className="input"
              type="datetime-local"
              value={apptTime}
              onChange={(e) => setApptTime(e.target.value)}
            />
          </div>

          <div className="clinic-list">
            {clinics.length === 0 && (
              <div className="empty">{t("No clinics are open yet.")}</div>
            )}
            {clinics.map((c) => (
              <div key={c.id} className="clinic-row card">
                <div className="cr-main">
                  <div className="nm">
                    {c.name}
                    {!c.is_open && <span className="closed-tag">{t("Closed")}</span>}
                  </div>
                  <div className="meta">
                    {c.waiting} {t("Waiting")}
                  </div>
                  {c.departments?.length > 0 && (
                    <select
                      className="input dept-select"
                      value={deptByClinic[c.id] || ""}
                      onChange={(e) =>
                        setDeptByClinic({ ...deptByClinic, [c.id]: e.target.value })
                      }
                    >
                      <option value="">{t("Any department")}</option>
                      {c.departments.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="cr-act">
                  <button
                    className="btn btn-primary"
                    disabled={busy || !c.is_open}
                    onClick={() => join(c)}
                  >
                    {t("Join now")}
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={() => book(c)}
                  >
                    {t("Book")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {header}
      <div className="wrap">
        <div className="section-title" style={{ textAlign: "center" }}>
          {joined.name}
        </div>
        <div className="h1" style={{ textAlign: "center", marginBottom: 20 }}>
          {stage === "turn"
            ? t("It's your turn")
            : stage === "soon"
            ? t("You're almost up")
            : done
            ? t("Your consultation is complete")
            : t("You're in the queue")}
        </div>

        <div className={"now-serving" + (stage === "turn" ? " is-turn" : "")}>
          <div className="label">{t("Your Token")}</div>
          <div className="big-token">{joined.token ?? me?.token ?? "—"}</div>
          <div className="pat-name">
            {stage === "turn"
              ? me?.room
                ? `${t("Please proceed to Room")} ${me.room}`
                : t("Please proceed to the doctor")
              : done
              ? t("Thanks for visiting")
              : `${t("Now serving token")} ${state?.current_token ?? "—"}`}
          </div>
          <div className="pulse">
            {connected ? t("Live · updates automatically") : t("Reconnecting…")}
          </div>
        </div>

        {!done && stage !== "turn" && (
          <div className="info-row">
            <div className="info-card">
              <div className="v">{me?.ahead ?? "—"}</div>
              <div className="k">{t("Patients ahead of you")}</div>
            </div>
            <div className="info-card">
              <div className="v">{me?.est ?? "—"}</div>
              <div className="k">
                {t("Est. wait · seen ~")}
                {me ? clockTime(me.est) : "—"}
              </div>
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 26 }}>
          <button className="btn btn-ghost" onClick={() => persist(null)}>
            ← {t("My queues")}
          </button>{" "}
          <button className="btn btn-ghost" onClick={leave}>
            {done ? t("Done") : t("Leave queue")}
          </button>
        </div>
      </div>
    </div>
  );
}
