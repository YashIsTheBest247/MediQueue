import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import BrandMark from "./BrandMark.jsx";
import { LanguageSwitcher, useT } from "../i18n.jsx";

export const navMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.2, ease: "easeOut" },
};

export function BackButton({ to }) {
  const navigate = useNavigate();
  const { t } = useT();
  function goBack() {
    if (to) navigate(to);
    else if (window.history.length > 1) navigate(-1);
    else navigate("/");
  }
  return (
    <button className="back-btn" onClick={goBack} aria-label="Go back">
      {t("Back")}
    </button>
  );
}

export function TopBar({ connected, right, links, back }) {
  const { t } = useT();
  return (
    <motion.header className="navbar" {...navMotion}>
      <div className="topbar">
        <div className="nav-left">
          {back && <BackButton to={typeof back === "string" ? back : undefined} />}
          <Link to="/" className="brand">
            <div className="logo">
              <BrandMark />
            </div>
            <div>
              <div className="name">
                Medi<span>Queue</span>
              </div>
              <div className="tag">{t("Smart Clinic Queue")}</div>
            </div>
          </Link>
        </div>

        {links && (
          <nav className="top-nav">
            {links.map((l) => (
              <Link key={l.to} to={l.to}>
                {l.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="nav-actions">
          <LanguageSwitcher />
          {right}
        </div>
      </div>
    </motion.header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <h2 className="footer-title">Your Health, It's Our Priority</h2>

        <div className="footer-divider" />

        <div className="footer-bottom">
          <div className="footer-brand">
            <div className="logo">
              <BrandMark />
            </div>
            <div>
              <div className="fb-name">MediQueue</div>
              <div className="fb-sub">
                Real-time clinic queues — no paper tokens, no guessing.
              </div>
            </div>
          </div>
          <div className="footer-cols">
            <FooterCol
              head="Product"
              items={["Receptionist View", "Waiting Room", "Live Sync", "Tokens"]}
            />
            <FooterCol
              head="Clinic"
              items={["Add Patient", "Call Next", "Avg Time", "Dashboard"]}
            />
            <FooterCol
              head="About"
              items={["Built by Yash Munshi"]}
            />
          </div>
        </div>

        <div className="footer-legal">
          <span>© 2026 MediQueue</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ head, items }) {
  return (
    <div className="footer-col">
      <div className="fc-head">{head}</div>
      {items.map((i) => (
        <div key={i} className="fc-item">
          {i}
        </div>
      ))}
    </div>
  );
}
