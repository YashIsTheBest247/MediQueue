import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "../auth.jsx";
import { TopBar } from "../components/Chrome.jsx";
import { useT } from "../i18n.jsx";

export default function ExploreClinics() {
  const navigate = useNavigate();
  const { t } = useT();
  const [clinics, setClinics] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const r = await fetch(`${API}/api/clinics/overview`);
        const d = await r.json();
        if (active) setClinics(d.clinics || []);
      } catch {
        if (active) setClinics([]);
      }
    }
    load();
    const t = setInterval(load, 4000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  function choose(c) {
    localStorage.setItem(
      "mq_preselect_clinic",
      JSON.stringify({ id: c.id, name: c.name })
    );
    navigate("/auth?mode=login&role=patient");
  }

  const sorted = (clinics || [])
    .slice()
    .sort((a, b) => a.estimated_wait - b.estimated_wait);

  return (
    <div className="page">
      <TopBar back connected />

      <div className="wrap">
        <div className="section-title">{t("Live clinic queues")}</div>
        <div className="h1">
          {t("Find the")} <span>{t("shortest wait")}</span>
        </div>
        <p className="sub">
          {t(
            "Compare clinics in real time — no login needed. Pick the one that suits you, then sign in to grab your token."
          )}
        </p>

        <div className="explore-grid">
          {clinics === null && <div className="empty">{t("Loading clinics…")}</div>}
          {clinics && clinics.length === 0 && (
            <div className="empty">{t("No clinics have registered yet.")}</div>
          )}
          {sorted.map((c, i) => (
            <div key={c.id} className="explore-card card">
              <div className="ex-head">
                <div className="ex-namewrap">
                  <div className="ex-name">{c.name}</div>
                  <div className="ex-spec">
                    {c.departments?.length > 0
                      ? c.departments.join(" · ")
                      : t("General")}
                  </div>
                </div>
                {i === 0 && c.is_open && (
                  <span className="ex-badge">{t("Shortest wait")}</span>
                )}
                <span className={"ex-dot" + (c.is_open ? " open" : "")}>
                  {c.is_open ? t("Open") : t("Idle")}
                </span>
              </div>

              <div className="ex-stats">
                <div className="ex-stat">
                  <div className="ex-v">{c.current_token ?? "—"}</div>
                  <div className="ex-k">{t("Now serving")}</div>
                </div>
                <div className="ex-stat">
                  <div className="ex-v">{c.waiting}</div>
                  <div className="ex-k">{t("Waiting")}</div>
                </div>
                <div className="ex-stat">
                  <div className="ex-v">{c.estimated_wait}</div>
                  <div className="ex-k">{t("Est. wait (min)")}</div>
                </div>
              </div>

              <div className="ex-meta">
                {c.rooms > 1 && (
                  <span>
                    {c.rooms} {t("rooms")}
                  </span>
                )}
                {c.hours && <span>{c.hours}</span>}
              </div>

              <button
                className="btn btn-primary ex-join"
                disabled={!c.is_open}
                onClick={() => choose(c)}
              >
                {c.is_open ? t("Join this clinic") : t("Currently closed")}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
