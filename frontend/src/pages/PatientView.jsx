import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, API } from "../auth.jsx";
import { useQueueSocket } from "../useQueue.js";
import { TopBar } from "../components/Chrome.jsx";
import { chime, notify, requestNotifyPermission } from "../notify.js";
import { useT } from "../i18n.jsx";

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
  const navigate = useNavigate();
  const [queues, setQueues] = useState([]);
  const [clinics, setClinics] = useState([]);
  const stageRef = useRef(null);

  const active =
    queues.find((q) => q.status === "waiting" || q.status === "serving") || null;
  const { state, connected } = useQueueSocket(active?.clinic_id);

  useEffect(() => {
    requestNotifyPermission();
    let on = true;
    async function load() {
      try {
        const [q, c] = await Promise.all([
          authedFetch("/api/patient/queues").then((r) => r.json()),
          fetch(`${API}/api/clinics/overview`).then((r) => r.json()),
        ]);
        if (on) {
          setQueues(q.queues || []);
          setClinics(c.clinics || []);
        }
      } catch {
        void 0;
      }
    }
    load();
    const id = setInterval(load, 5000);
    return () => {
      on = false;
      clearInterval(id);
    };
  }, [authedFetch]);

  let me = null;
  if (state && active) {
    const s = (state.servings || []).find((x) => x.patient_id === account.id);
    if (s) me = { token: s.token, ahead: 0, est: 0, served: true, room: s.room };
    else {
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
  const stage = me?.served
    ? "turn"
    : me && me.ahead <= 1
    ? "soon"
    : me
    ? "waiting"
    : null;

  useEffect(() => {
    if (!stage || !active) return;
    const prev = stageRef.current;
    stageRef.current = stage;
    if (prev === null) return;
    if (stage === "soon" && prev !== "soon" && prev !== "turn") {
      chime();
      notify(t("You're almost up"), `${active.clinic_name}: ${me?.ahead ?? 0} ahead`);
    } else if (stage === "turn" && prev !== "turn") {
      chime();
      notify(
        t("It's your turn!"),
        `${active.clinic_name}: token ${me?.token}${
          me?.room ? ` — Room ${me.room}` : ""
        }`
      );
    }
  }, [stage, active, me, t]);

  const sortedClinics = [...clinics].sort(
    (a, b) => a.estimated_wait - b.estimated_wait
  );

  const header = (
    <TopBar
      connected={active ? connected : undefined}
      right={
        <>
          <span className="pill ghost">{account.name}</span>
          <button className="pill ghost" onClick={logout}>
            {t("Log out")}
          </button>
        </>
      }
    />
  );

  return (
    <div className="page">
      {header}
      <div className="wrap">
        {active ? (
          <>
            <div className="section-title" style={{ textAlign: "center" }}>
              {active.clinic_name}
            </div>
            <div className="h1" style={{ textAlign: "center", marginBottom: 20 }}>
              {stage === "turn"
                ? t("It's your turn")
                : stage === "soon"
                ? t("You're almost up")
                : t("You're in the queue")}
            </div>

            <div className={"now-serving" + (stage === "turn" ? " is-turn" : "")}>
              <div className="label">{t("Your Token")}</div>
              <div className="big-token">{me?.token ?? active.token ?? "—"}</div>
              <div className="pat-name">
                {stage === "turn"
                  ? me?.room
                    ? `${t("Please proceed to Room")} ${me.room}`
                    : t("Please proceed to the doctor")
                  : t("We'll notify you when it's your turn")}
              </div>
              <div className="pulse">
                {connected ? t("Live · updates automatically") : t("Reconnecting…")}
              </div>
            </div>

            {stage !== "turn" && (
              <div className="info-row three">
                <div className="info-card highlight">
                  <div className="v">{state?.current_token ?? "—"}</div>
                  <div className="k">{t("Now serving")}</div>
                </div>
                <div className="info-card">
                  <div className="v">{me?.ahead ?? "—"}</div>
                  <div className="k">{t("Patients ahead of you")}</div>
                </div>
                <div className="info-card">
                  <div className="v">{me?.est ?? "—"}</div>
                  <div className="k">
                    {t("Est. wait")} · ~{me ? clockTime(me.est) : "—"}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="section-title">{t("Patient")}</div>
            <div className="h1">
              {t("Compare clinics &")} <span>{t("get your token")}</span>
            </div>
            <p className="sub">
              {t(
                "You don't join queues from the app — that keeps it fair. Compare clinics below, walk in, and reception adds you. Your token then appears here, live, with a notification when it's your turn."
              )}
            </p>

            <div className="patient-code card">
              <div>
                <div className="section-title">{t("Show this at reception")}</div>
                <div className="pc-code">#{account.id}</div>
                <div className="pc-email">{account.email}</div>
              </div>
              <div className="pc-note">
                {t(
                  "Reception enters your code or email to link your token to this app."
                )}
              </div>
            </div>
          </>
        )}

        <div
          className="section-title"
          style={{ marginTop: active ? 34 : 26, marginBottom: 14 }}
        >
          {t("Live clinic queues")}
        </div>
        <div className="compare-list">
          {sortedClinics.length === 0 && (
            <div className="empty">{t("No clinics are open yet.")}</div>
          )}
          {sortedClinics.map((c, i) => (
            <div key={c.id} className="clinic-row card">
              <div className="cr-main">
                <div className="nm">
                  {c.name}
                  {!c.is_open && <span className="closed-tag">{t("Closed")}</span>}
                  {i === 0 && c.is_open && (
                    <span className="dept-tag">{t("Shortest wait")}</span>
                  )}
                </div>
                <div className="meta">
                  {t("Now serving")} {c.current_token ?? "—"} · {c.waiting}{" "}
                  {t("Waiting")} · ~{c.estimated_wait} {t("min")}
                </div>
              </div>
              <button className="btn btn-ghost" onClick={() => navigate("/explore")}>
                {t("Map")}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
