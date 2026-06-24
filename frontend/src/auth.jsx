import { createContext, useContext, useState, useCallback } from "react";

export const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const WS_BASE =
  import.meta.env.VITE_WS_URL || API.replace(/^http/, "ws");

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("mq_token"));
  const [account, setAccount] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("mq_account") || "null");
    } catch {
      return null;
    }
  });

  const save = useCallback((t, a) => {
    setToken(t);
    setAccount(a);
    localStorage.setItem("mq_token", t);
    localStorage.setItem("mq_account", JSON.stringify(a));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setAccount(null);
    localStorage.removeItem("mq_token");
    localStorage.removeItem("mq_account");
  }, []);

  const signup = useCallback(
    async (role, name, email, password) => {
      const r = await fetch(`${API}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, name, email, password }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Signup failed");
      save(d.token, d.account);
      return d.account;
    },
    [save]
  );

  const login = useCallback(
    async (email, password) => {
      const r = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Login failed");
      save(d.token, d.account);
      return d.account;
    },
    [save]
  );

  const google = useCallback(
    async (credential, role) => {
      const r = await fetch(`${API}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential, role }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || "Google sign-in failed");
      save(d.token, d.account);
      return d.account;
    },
    [save]
  );

  const authedFetch = useCallback(
    (path, opts = {}) =>
      fetch(`${API}${path}`, {
        ...opts,
        headers: {
          "Content-Type": "application/json",
          ...(opts.headers || {}),
          Authorization: token ? `Bearer ${token}` : "",
        },
      }),
    [token]
  );

  return (
    <AuthCtx.Provider
      value={{ token, account, signup, login, google, logout, authedFetch }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
