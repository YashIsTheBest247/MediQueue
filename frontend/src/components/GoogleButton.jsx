import { useEffect, useRef, useState } from "react";
import { API } from "../auth.jsx";

export default function GoogleButton({ onCredential, autoPrompt }) {
  const divRef = useRef(null);
  const [clientId, setClientId] = useState(null);
  const cbRef = useRef(onCredential);
  cbRef.current = onCredential;

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
        callback: (resp) => cbRef.current?.(resp.credential),
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
  }, [clientId, autoPrompt]);

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
