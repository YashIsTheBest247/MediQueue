import { useEffect, useState } from "react";
import { subscribeWake } from "../backend.js";
import BrandMark from "./BrandMark.jsx";
import { useT } from "../i18n.jsx";

const MESSAGES = [
  "Connecting to MediQueue…",
  "Waking up the server…",
  "Spinning up live queues…",
  "Almost there…",
  "Thanks for your patience…",
];

export default function WakeOverlay() {
  const { t } = useT();
  const [show, setShow] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => subscribeWake(setShow), []);

  useEffect(() => {
    if (!show) {
      setI(0);
      return;
    }
    const id = setInterval(() => setI((n) => (n + 1) % MESSAGES.length), 2600);
    return () => clearInterval(id);
  }, [show]);

  if (!show) return null;

  return (
    <div className="wake-overlay" role="status" aria-live="polite">
      <div className="wake-card">
        <div className="wake-logo">
          <div className="wake-ring" />
          <div className="wake-mark">
            <BrandMark />
          </div>
        </div>
        <div className="wake-msg" key={i}>
          {t(MESSAGES[i])}
        </div>
        <div className="wake-sub">
          {t("The server is waking up — this can take up to a minute.")}
        </div>
        <div className="wake-bar">
          <span />
        </div>
      </div>
    </div>
  );
}
