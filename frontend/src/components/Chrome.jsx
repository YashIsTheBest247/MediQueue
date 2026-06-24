import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import BrandMark from "./BrandMark.jsx";
import { LanguageSwitcher, useT } from "../i18n.jsx";

export function ThemeToggle() {
  const [dark, setDark] = useState(
    () => document.documentElement.dataset.theme === "dark"
  );
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem("mq_theme", next ? "dark" : "light");
    } catch {
      void 0;
    }
  }
  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label="Toggle dark mode"
    >
      {dark ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.3 6.3 0 0 0 10.5 10.5z" />
        </svg>
      )}
    </button>
  );
}

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

export function NavBurger({ open, onClick }) {
  return (
    <button
      className={"nav-burger" + (open ? " open" : "")}
      onClick={onClick}
      aria-label="Menu"
      aria-expanded={open}
    >
      <span />
      <span />
      <span />
    </button>
  );
}

export function TopBar({ connected, right, links, back }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  return (
    <motion.header className="navbar" {...navMotion}>
      <div className="topbar">
        <div className="nav-left">
          {back && <BackButton to={typeof back === "string" ? back : undefined} />}
          <Link to="/" className="brand" onClick={() => setOpen(false)}>
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
          <ThemeToggle />
          <LanguageSwitcher />
          {right}
        </div>

        <NavBurger open={open} onClick={() => setOpen((o) => !o)} />
      </div>

      {open && (
        <div className="nav-mobile">
          {links &&
            links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="nav-mobile-link"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
          <div className="nav-mobile-tools">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
          {right && (
            <div className="nav-mobile-cta" onClick={() => setOpen(false)}>
              {right}
            </div>
          )}
        </div>
      )}
    </motion.header>
  );
}

const SOCIALS = [
  {
    label: "Portfolio",
    href: "https://yash-munshi.vercel.app/",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3c2.6 2.7 2.6 15.3 0 18M12 3c-2.6 2.7-2.6 15.3 0 18" />
      </svg>
    ),
  },
  {
    label: "GitHub",
    href: "https://github.com/YashIsTheBest247",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.5 2.87 8.32 6.84 9.67.5.09.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.46-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.36-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.36 9.36 0 0 1 12 6.84c.85 0 1.71.12 2.51.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.59.69.49A10.02 10.02 0 0 0 22 12.26C22 6.58 17.52 2 12 2z" />
      </svg>
    ),
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/yash-munshi-a0408b337/",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.4c0-1.29-.02-2.95-1.8-2.95-1.8 0-2.08 1.4-2.08 2.85V21H9z" />
      </svg>
    ),
  },
];

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-top">
          <div className="footer-headline">
            <div className="footer-brand">
              <div className="logo">
                <BrandMark />
              </div>
              <div className="fb-name">MediQueue</div>
            </div>
            <h2 className="footer-title">Your Health, It's Our Priority</h2>
            <p className="footer-lead">
              Real-time clinic queues — no paper tokens, no shouting, no guessing.
            </p>
          </div>

          <Link to="/auth?mode=signup" className="footer-cta">
            <span className="fcta-eyebrow">Ready to cut the wait?</span>
            <span className="fcta-action">
              Get started <span className="fcta-arrow">→</span>
            </span>
          </Link>
        </div>

        <div className="footer-divider" />

        <div className="footer-bottom">
          <div className="footer-cols">
            <FooterCol
              head="Product"
              items={["Receptionist View", "Waiting Room", "Live Queues", "Live Sync"]}
            />
            <FooterCol
              head="Clinic"
              items={["Add Patient", "Call Next", "Rooms", "Dashboard"]}
            />
          </div>

          <div className="footer-connect">
            <div className="fc-head">Connect with Developer</div>
            <div className="fc-dev">Built by Yash Munshi</div>
            <div className="socials">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  className="social-link"
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                >
                  {s.icon}
                  <span>{s.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="footer-legal">
          <span>© 2026 MediQueue · All Rights Reserved</span>
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
