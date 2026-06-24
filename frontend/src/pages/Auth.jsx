import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function Auth() {
  const { login, signup } = useAuth();
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

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const account =
        mode === "login"
          ? await login(email, password)
          : await signup(role, name, email, password);
      navigate(account.role === "clinic" ? "/clinic" : "/patient");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page auth-page">
      <div className="auth-card card">
        <Link to="/" className="brand auth-brand">
          <div className="logo">M</div>
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
    </div>
  );
}
