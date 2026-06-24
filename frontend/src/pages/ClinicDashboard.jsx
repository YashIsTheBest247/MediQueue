import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { useQueueSocket } from "../useQueue.js";
import { TopBar } from "../components/Chrome.jsx";
import Select from "../components/Select.jsx";
import { useT } from "../i18n.jsx";

export default function ClinicDashboard() {
  const { account, authedFetch, logout } = useAuth();
  const { t } = useT();
  const clinicId = account.role === "staff" ? account.clinic_id : account.id;
  const { state, connected } = useQueueSocket(clinicId);

  const [name, setName] = useState("");
  const [reason, setReason] = useState("");
  const [dept, setDept] = useState("");
  const [patientRef, setPatientRef] = useState("");
  const [addMsg, setAddMsg] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [callDept, setCallDept] = useState("");
  const [deptText, setDeptText] = useState(null);
  const [hoursText, setHoursText] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [locMsg, setLocMsg] = useState("");

  const avg = state?.avg_consultation_time ?? account.avg_time ?? 10;
  const servings = state?.servings ?? [];
  const waiting = state?.waiting ?? [];
  const skipped = state?.skipped ?? [];
  const appointments = state?.appointments ?? [];
  const stats = state?.stats ?? { waiting: 0, served: 0, total: 0 };
  const paused = state?.paused ?? false;
  const isOpen = state?.is_open ?? true;
  const hours = state?.hours ?? "";
  const roomCount = state?.room_count ?? 1;
  const departments = state?.departments ?? [];
  const clinicName = state?.clinic_name || account.name;

  const post = (path, body) =>
    authedFetch(path, { method: "POST", body: body && JSON.stringify(body) });
  const put = (path, body) =>
    authedFetch(path, { method: "PUT", body: JSON.stringify(body) });

  async function guarded(fn) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  async function addPatient(e) {
    e.preventDefault();
    if (busy || !name.trim()) return;
    await guarded(async () => {
      const r = await post("/api/clinic/patients", {
        name: name.trim(),
        priority: urgent ? 1 : 0,
        reason: reason.trim(),
        department: dept,
        patient_ref: patientRef.trim(),
      });
      const d = await r.json();
      setAddMsg(
        d.added
          ? patientRef.trim()
            ? d.linked
              ? `Token ${d.added.token} added & linked to the patient's app`
              : `Token ${d.added.token} added (no app account matched that code/email)`
            : `Token ${d.added.token} added`
          : ""
      );
      setTimeout(() => setAddMsg(""), 4000);
      setName("");
      setPatientRef("");
      setReason("");
      setUrgent(false);
    });
  }

  const callRoom = (room) =>
    guarded(() => post("/api/clinic/call-next", { room, department: callDept }));
  const skipRoom = (room) =>
    guarded(() => post("/api/clinic/skip", { room, department: callDept }));
  const firstFreeRoom = () => {
    for (let r = 1; r <= roomCount; r++)
      if (!servings.find((s) => s.room === r)) return r;
    return 1;
  };
  const callSpecific = (n) =>
    guarded(() => post(`/api/clinic/call/${n}`, { room: firstFreeRoom() }));
  const prioritize = (n) => guarded(() => post(`/api/clinic/prioritize/${n}`));
  const removeTok = (n) => guarded(() => post(`/api/clinic/remove/${n}`));
  const recall = () => guarded(() => post("/api/clinic/recall"));
  const admit = (id) => guarded(() => post(`/api/clinic/admit/${id}`));
  const togglePause = () => put("/api/clinic/pause", { paused: !paused });
  const toggleOpen = () => put("/api/clinic/settings", { is_open: !isOpen });
  const setRooms = (n) =>
    put("/api/clinic/settings", { room_count: Math.min(12, Math.max(1, n)) });
  const setAvg = (m) =>
    put("/api/clinic/avg-time", { minutes: Math.min(180, Math.max(1, m)) });
  const saveDepartments = () =>
    put("/api/clinic/settings", { departments: deptText ?? "" }).then(() =>
      setDeptText(null)
    );
  const saveHours = () =>
    put("/api/clinic/settings", { hours: hoursText ?? "" }).then(() =>
      setHoursText(null)
    );

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocMsg("Geolocation not supported");
      return;
    }
    setLocMsg("Locating…");
    navigator.geolocation.getCurrentPosition(
      (p) =>
        put("/api/clinic/settings", {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
        }).then(() => setLocMsg("Location saved — you're on the map")),
      () => setLocMsg("Could not get your location"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function reset() {
    if (!window.confirm("Clear the whole queue and reset tokens to 1?")) return;
    await post("/api/clinic/reset");
  }

  const joinUrl = `${window.location.origin}/j/${clinicId}`;
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
              className={"pill ghost" + (!isOpen ? " on" : "")}
              onClick={toggleOpen}
            >
              {isOpen ? t("Open") : t("Closed")}
            </button>
            <button
              className={"pill ghost" + (paused ? " on" : "")}
              onClick={togglePause}
            >
              {paused ? t("Resume") : t("Pause")}
            </button>
            <Link to={`/display/${clinicId}`} className="pill ghost">
              {t("Display")}
            </Link>
            <button className="pill ghost" onClick={reset}>
              {t("Reset")}
            </button>
            <button className="pill ghost" onClick={logout}>
              {t("Log out")}
            </button>
          </>
        }
      />

      <div className="wrap">
        {state && state.verified === false && (
          <div className="verify-banner">
            {t(
              "Your clinic is Pending verification. Patients see a 'Pending' badge until an admin reviews you."
            )}
          </div>
        )}
        {paused && (
          <div className="pause-banner">
            {t("Queue paused — patients can still join, calling is on hold.")}
          </div>
        )}
        <div className="grid-2">
          <div className="card card-pad">
            <div className="section-title">
              {clinicName}
              {account.role === "staff" ? " · Staff" : ""}
            </div>
            <div className="h1">
              {t("Clinic")} <span>{t("Dashboard")}</span>
            </div>

            <form onSubmit={addPatient} className="field">
              <label>{t("Add walk-in patient")}</label>
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("Patient name")}
                />
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  + Add
                </button>
              </div>
              {departments.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <Select
                    block
                    value={dept}
                    onChange={setDept}
                    ariaLabel={t("Department")}
                    options={[
                      { value: "", label: t("General (no department)") },
                      ...departments.map((d) => ({ value: d, label: d })),
                    ]}
                  />
                </div>
              )}
              <input
                className="input"
                value={patientRef}
                onChange={(e) => setPatientRef(e.target.value)}
                placeholder={t("Patient app code / email (to link their app)")}
                style={{ marginTop: 8 }}
              />
              <input
                className="input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("Reason / symptoms (optional)")}
                style={{ marginTop: 8 }}
              />
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={urgent}
                  onChange={(e) => setUrgent(e.target.checked)}
                />
                {t("Mark as urgent (jumps to front)")}
              </label>
              {addMsg && <div className="loc-msg">{addMsg}</div>}
            </form>

            <div className="settings-grid">
              <div className="set-item">
                <label>{t("Rooms / doctors")}</label>
                <div className="stepper sm">
                  <button onClick={() => setRooms(roomCount - 1)}>−</button>
                  <div className="val">{roomCount}</div>
                  <button onClick={() => setRooms(roomCount + 1)}>+</button>
                </div>
              </div>
              <div className="set-item">
                <label>{t("Avg time (min)")}</label>
                <div className="stepper sm">
                  <button onClick={() => setAvg(avg - 1)}>−</button>
                  <div className="val">{avg}</div>
                  <button onClick={() => setAvg(avg + 1)}>+</button>
                </div>
              </div>
            </div>

            <div className="field">
              <label>{t("Departments (comma separated)")}</label>
              <div className="input-row">
                <input
                  value={deptText ?? departments.join(", ")}
                  onChange={(e) => setDeptText(e.target.value)}
                  placeholder="e.g. GP, Dental, Lab"
                />
                <button className="btn btn-ghost" onClick={saveDepartments}>
                  {t("Save")}
                </button>
              </div>
            </div>

            <div className="field">
              <label>{t("Opening hours")}</label>
              <div className="input-row">
                <input
                  value={hoursText ?? hours}
                  onChange={(e) => setHoursText(e.target.value)}
                  placeholder="e.g. Mon–Sat, 9am–6pm"
                />
                <button className="btn btn-ghost" onClick={saveHours}>
                  {t("Save")}
                </button>
              </div>
            </div>

            <div className="field">
              <label>{t("Location (so patients find you on the map)")}</label>
              <button className="btn btn-ghost" onClick={useMyLocation}>
                {t("Use my current location")}
              </button>
              {locMsg && <div className="loc-msg">{locMsg}</div>}
            </div>

            <div className="stat-row">
              <div className="stat">
                <div className="num">{stats.waiting}</div>
                <div className="lbl">{t("Waiting")}</div>
              </div>
              <div className="stat">
                <div className="num">{stats.served}</div>
                <div className="lbl">{t("Served")}</div>
              </div>
              <div className="stat">
                <div className="num">{stats.total}</div>
                <div className="lbl">{t("Total")}</div>
              </div>
            </div>

            <div className="share-box">
              <div className="share-info">
                <div className="section-title">{t("Live status QR")}</div>
                <div className="share-code">#{clinicId}</div>
                <p className="share-sub">
                  {t("Display this so patients can scan to watch this clinic's live queue.")}
                </p>
                <button className="btn btn-ghost share-btn" onClick={copyLink}>
                  {copied ? t("Link copied!") : t("Copy status link")}
                </button>
              </div>
              <img className="share-qr" src={qrSrc} alt="Join queue QR code" />
            </div>
          </div>

          <div className="card card-pad">
            <div className="queue-head">
              <div className="section-title">{t("Rooms · Now serving")}</div>
              {departments.length > 0 && (
                <Select
                  className="dept-filter"
                  value={callDept}
                  onChange={setCallDept}
                  ariaLabel={t("Call from: Any")}
                  options={[
                    { value: "", label: t("Call from: Any") },
                    ...departments.map((d) => ({ value: d, label: d })),
                  ]}
                />
              )}
            </div>

            <div className="rooms-grid">
              {Array.from({ length: roomCount }, (_, i) => i + 1).map((room) => {
                const s = servings.find((x) => x.room === room);
                return (
                  <div key={room} className={"room-card" + (s ? " busy" : "")}>
                    <div className="room-name">
                      {t("Room")} {room}
                    </div>
                    <div className="room-token">{s ? s.token : "—"}</div>
                    <div className="room-who">{s ? s.name : t("Free")}</div>
                    {s && typeof s.remaining === "number" && (
                      <div className="room-left">
                        {s.remaining > 0
                          ? `~${s.remaining} ${t("min left")}`
                          : t("wrapping up")}
                      </div>
                    )}
                    <div className="room-act">
                      <button
                        className="btn btn-call sm"
                        onClick={() => callRoom(room)}
                        disabled={busy || paused}
                      >
                        {t("Call next")}
                      </button>
                      {s && (
                        <button className="q-btn danger" onClick={() => skipRoom(room)}>
                          {t("Skip")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {skipped.length > 0 && (
              <div className="skipped-row">
                <span>
                  {t("Skipped")}: {skipped.map((s) => `#${s.token}`).join(", ")}
                </span>
                <button className="q-btn" onClick={recall}>
                  {t("Recall")}
                </button>
              </div>
            )}

            {appointments.length > 0 && (
              <div className="appts">
                <div className="section-title" style={{ marginTop: 12 }}>
                  {t("Upcoming appointments")} ({appointments.length})
                </div>
                {appointments.map((a) => (
                  <div key={a.id} className="appt-row">
                    <div>
                      <div className="nm">{a.name}</div>
                      <div className="meta">
                        {a.appointment_at}
                        {a.department ? ` · ${a.department}` : ""}
                      </div>
                    </div>
                    <button className="q-btn" onClick={() => admit(a.id)}>
                      {t("Admit")}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="section-title" style={{ marginTop: 12 }}>
              {t("Waiting")} ({waiting.length})
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
                      {p.department ? <span className="dept-tag">{p.department}</span> : null}
                      {p.priority ? <span className="urgent-tag">{t("Urgent")}</span> : null}
                    </div>
                    <div className="meta">
                      {p.reason ? p.reason + " · " : ""}~{p.estimated_wait} min
                    </div>
                  </div>
                  <div className="q-act">
                    <button className="q-btn" onClick={() => callSpecific(p.token)}>
                      {t("Call")}
                    </button>
                    {!p.priority && (
                      <button className="q-btn" onClick={() => prioritize(p.token)}>
                        {t("Urgent")}
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
                  {t("No patients waiting. Add a walk-in or share the join code.")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
