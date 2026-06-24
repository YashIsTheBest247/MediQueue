import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth, API } from "../auth.jsx";
import { wakeFetch } from "../backend.js";
import { BackButton } from "../components/Chrome.jsx";
import GoogleButton from "../components/GoogleButton.jsx";
import BrandMark from "../components/BrandMark.jsx";
import { useT } from "../i18n.jsx";

function useDesktop() {
  const [desktop, setDesktop] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(min-width: 768px)").matches
      : true
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const on = () => setDesktop(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return desktop;
}

export default function Auth() {
  const { login, signup, google } = useAuth();
  const { t } = useT();
  const desktop = useDesktop();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [mode, setMode] = useState(
    params.get("mode") === "login" ? "login" : "signup"
  );
  const [role, setRole] = useState(
    params.get("role") === "patient" ? "patient" : "clinic"
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [license, setLicense] = useState("");
  const [regLoc, setRegLoc] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const pre = localStorage.getItem("mq_register_prefill");
    if (!pre) return;
    localStorage.removeItem("mq_register_prefill");
    try {
      const p = JSON.parse(pre);
      setMode("signup");
      setRole("clinic");
      if (p.name) setName(p.name);
      if (typeof p.lat === "number" && typeof p.lng === "number")
        setRegLoc({ lat: p.lat, lng: p.lng });
    } catch {
      void 0;
    }
  }, []);

  function go(account) {
    navigate(account.role === "patient" ? "/patient" : "/clinic");
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const extra =
        mode === "signup" && role === "clinic"
          ? { license, ...(regLoc || {}) }
          : {};
      const account =
        mode === "login"
          ? await login(email, password)
          : await signup(role, name, email, password, extra);
      go(account);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle(credential) {
    setError("");
    setBusy(true);
    try {
      go(await google(credential));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function tryDemo(which) {
    setError("");
    setBusy(true);
    try {
      const cfg = await wakeFetch(`${API}/api/auth/demo`).then((r) => r.json());
      const creds = cfg[which];
      go(await login(creds.email, creds.password));
    } catch (err) {
      setError(t("Demo accounts are not available."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page auth-page">
      {desktop && (
        <video
          className="auth-bg-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          src="/intro.mp4"
        />
      )}
      <div className="auth-bg-overlay" />

      <div className="auth-card card">
        <div className="auth-top">
          <BackButton />
        </div>
        <Link to="/" className="brand auth-brand">
          <div className="logo">
            <BrandMark />
          </div>
          <div className="name">
            Medi<span>Queue</span>
          </div>
        </Link>

        <div className="demo-box top">
          <div className="demo-head">
            {t("New here? Explore instantly — no sign-up needed")}
          </div>
          <div className="demo-btns">
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() => tryDemo("clinic")}
            >
              {t("Try Demo Clinic")}
            </button>
            <button
              className="btn btn-indigo"
              disabled={busy}
              onClick={() => tryDemo("patient")}
            >
              {t("Try Demo Patient")}
            </button>
          </div>
        </div>

        <div className="auth-divider">
          <span>{t("or sign in")}</span>
        </div>

        <div className="auth-tabs">
          <button
            className={mode === "login" ? "on" : ""}
            onClick={() => setMode("login")}
          >
            {t("Log in")}
          </button>
          <button
            className={mode === "signup" ? "on" : ""}
            onClick={() => setMode("signup")}
          >
            {t("Sign up")}
          </button>
        </div>

        {mode === "signup" && (
          <div className="role-toggle">
            <button
              className={role === "clinic" ? "on" : ""}
              onClick={() => setRole("clinic")}
              type="button"
            >
              {t("I'm a Clinic")}
            </button>
            <button
              className={role === "patient" ? "on" : ""}
              onClick={() => setRole("patient")}
              type="button"
            >
              {t("I'm a Patient")}
            </button>
          </div>
        )}

        <form onSubmit={submit}>
          {mode === "signup" && (
            <div className="field">
              <label>{role === "clinic" ? t("Clinic name") : t("Your name")}</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={role === "clinic" ? "Sunrise Clinic" : "Riya Sharma"}
                required
              />
            </div>
          )}
          {mode === "signup" && role === "clinic" && (
            <div className="field">
              <label>{t("Clinic registration / license number")}</label>
              <input
                className="input"
                value={license}
                onChange={(e) => setLicense(e.target.value)}
                placeholder="e.g. MH-12345"
                required
              />
              {regLoc && (
                <div className="loc-msg">
                  {t("Location captured from the map ✓")}
                </div>
              )}
              <div className="verify-note">
                {t(
                  "New clinics start as Pending and are marked Verified after review."
                )}
              </div>
            </div>
          )}
          <div className="field">
            <label>{t("Email")}</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="field">
            <label>{t("Password")}</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={4}
              required
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button className="btn btn-primary auth-submit" disabled={busy}>
            {busy
              ? t("Please wait…")
              : mode === "login"
              ? t("Log in")
              : role === "clinic"
              ? t("Create clinic account")
              : t("Create patient account")}
          </button>
        </form>

        {(mode === "login" || role === "patient") && (
          <GoogleButton autoPrompt onCredential={handleGoogle} />
        )}

        <div className="auth-foot">
          {mode === "login" ? (
            <span>
              {t("New here?")}{" "}
              <button className="link" onClick={() => setMode("signup")}>
                {t("Create an account")}
              </button>
            </span>
          ) : (
            <span>
              {t("Already registered?")}{" "}
              <button className="link" onClick={() => setMode("login")}>
                {t("Log in")}
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
