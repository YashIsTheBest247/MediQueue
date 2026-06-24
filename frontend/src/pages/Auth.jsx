import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import { BackButton } from "../components/Chrome.jsx";
import GoogleButton from "../components/GoogleButton.jsx";
import BrandMark from "../components/BrandMark.jsx";

export default function Auth() {
  const { login, signup, google } = useAuth();
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
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [googlePending, setGooglePending] = useState(null);

  function go(account) {
    navigate(account.role === "clinic" ? "/clinic" : "/patient");
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const account =
        mode === "login"
          ? await login(email, password)
          : await signup(role, name, email, password);
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
      const res = await google(credential);
      if (res.needsRole) setGooglePending({ credential, name: res.name });
      else go(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function pickGoogleRole(chosen) {
    setBusy(true);
    try {
      const account = await google(googlePending.credential, chosen);
      go(account);
    } catch (err) {
      setError(err.message);
      setGooglePending(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page auth-page">
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

        <div className="auth-tabs">
          <button
            className={mode === "login" ? "on" : ""}
            onClick={() => setMode("login")}
          >
            Log in
          </button>
          <button
            className={mode === "signup" ? "on" : ""}
            onClick={() => setMode("signup")}
          >
            Sign up
          </button>
        </div>

        {mode === "signup" && (
          <div className="role-toggle">
            <button
              className={role === "clinic" ? "on" : ""}
              onClick={() => setRole("clinic")}
              type="button"
            >
              I'm a Clinic
            </button>
            <button
              className={role === "patient" ? "on" : ""}
              onClick={() => setRole("patient")}
              type="button"
            >
              I'm a Patient
            </button>
          </div>
        )}

        <form onSubmit={submit}>
          {mode === "signup" && (
            <div className="field">
              <label>{role === "clinic" ? "Clinic name" : "Your name"}</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={role === "clinic" ? "Sunrise Clinic" : "Riya Sharma"}
                required
              />
            </div>
          )}
          <div className="field">
            <label>Email</label>
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
            <label>Password</label>
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
              ? "Please wait…"
              : mode === "login"
              ? "Log in"
              : role === "clinic"
              ? "Create clinic account"
              : "Create patient account"}
          </button>
        </form>

        <GoogleButton autoPrompt onCredential={handleGoogle} />

        <div className="auth-foot">
          {mode === "login" ? (
            <span>
              New here?{" "}
              <button className="link" onClick={() => setMode("signup")}>
                Create an account
              </button>
            </span>
          ) : (
            <span>
              Already registered?{" "}
              <button className="link" onClick={() => setMode("login")}>
                Log in
              </button>
            </span>
          )}
        </div>
      </div>

      {googlePending && (
        <div className="role-modal">
          <div className="role-modal-card card">
            <div className="section-title">Almost there</div>
            <h2 className="h1" style={{ fontSize: 23 }}>
              How will you use <span>MediQueue?</span>
            </h2>
            <p className="sub">
              Hi {googlePending.name}, pick your account type to finish signing up.
            </p>
            <div className="role-modal-grid">
              <button
                className="role-choice"
                disabled={busy}
                onClick={() => pickGoogleRole("clinic")}
              >
                <strong>I'm a Clinic</strong>
                <span>Run the queue & dashboard</span>
              </button>
              <button
                className="role-choice"
                disabled={busy}
                onClick={() => pickGoogleRole("patient")}
              >
                <strong>I'm a Patient</strong>
                <span>Join a queue & track my token</span>
              </button>
            </div>
            <button className="link" onClick={() => setGooglePending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
