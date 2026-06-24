import { useEffect, useRef, useState } from "react";
import { API } from "../auth.jsx";
import { useT } from "../i18n.jsx";

function GoogleIcon() {
  return (
    <svg className="g-icon" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.41 5.41 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

export default function GoogleButton({ onCredential, autoPrompt }) {
  const [clientId, setClientId] = useState(null);
  const [ready, setReady] = useState(false);
  const [hint, setHint] = useState("");
  const cbRef = useRef(onCredential);
  cbRef.current = onCredential;
  const { t } = useT();

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
    function init() {
      if (!window.google?.accounts?.id) {
        timer = setTimeout(init, 120);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp) => cbRef.current?.(resp.credential),
        use_fedcm_for_prompt: true,
        itp_support: true,
        auto_select: false,
      });
      setReady(true);
      if (autoPrompt) {
        try {
          window.google.accounts.id.prompt();
        } catch {
          void 0;
        }
      }
    }
    init();
    return () => clearTimeout(timer);
  }, [clientId, autoPrompt]);

  function signIn() {
    setHint("");
    if (!window.google?.accounts?.id) return;
    try {
      window.google.accounts.id.prompt((notification) => {
        try {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setHint(
              t(
                "Google sign-in is blocked. Enable third-party sign-in / pop-ups for this site, then try again."
              )
            );
          }
        } catch {
          void 0;
        }
      });
    } catch {
      setHint(
        t(
          "Google sign-in is blocked. Enable third-party sign-in / pop-ups for this site, then try again."
        )
      );
    }
  }

  if (!clientId) return null;

  return (
    <div className="google-wrap">
      <div className="auth-divider">
        <span>{t("or")}</span>
      </div>
      <button
        type="button"
        className="google-cbtn"
        onClick={signIn}
        disabled={!ready}
      >
        <GoogleIcon />
        <span>{t("Continue with Google")}</span>
      </button>
      {hint && <div className="google-msg">{hint}</div>}
    </div>
  );
}
