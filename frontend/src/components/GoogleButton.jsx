import { useEffect, useRef, useState } from "react";
import { useAuth, API } from "../auth.jsx";

export default function GoogleButton({ getRole, onSuccess, onError, autoPrompt }) {
  const { google } = useAuth();
  const divRef = useRef(null);
  const [clientId, setClientId] = useState(null);

  const roleRef = useRef(getRole);
  const successRef = useRef(onSuccess);
  const errorRef = useRef(onError);
  roleRef.current = getRole;
  successRef.current = onSuccess;
  errorRef.current = onError;

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/auth/config`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d.google_enabled) setClientId(d.google_client_id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!clientId) return;
    let timer;
    function tryInit() {
      if (!window.google?.accounts?.id || !divRef.current) {
        timer = setTimeout(tryInit, 120);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (resp) => {
          try {
            const account = await google(
              resp.credential,
              roleRef.current ? roleRef.current() : undefined
            );
            successRef.current?.(account);
          } catch (e) {
            errorRef.current?.(e.message);
          }
        },
      });
      divRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(divRef.current, {
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "pill",
        width: 300,
      });
      if (autoPrompt) {
        try {
          window.google.accounts.id.prompt();
        } catch {
          void 0;
        }
      }
    }
    tryInit();
    return () => clearTimeout(timer);
  }, [clientId, google, autoPrompt]);

  if (!clientId) return null;

  return (
    <div className="google-wrap">
      <div className="auth-divider">
        <span>or</span>
      </div>
      <div ref={divRef} className="google-btn" />
    </div>
  );
}
