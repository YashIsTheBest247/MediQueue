import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Footer, navMotion, ThemeToggle, NavBurger } from "../components/Chrome.jsx";
import BrandMark from "../components/BrandMark.jsx";
import { useT, LanguageSwitcher } from "../i18n.jsx";

const ctaHover = { whileHover: { y: -3, scale: 1.03 }, whileTap: { scale: 0.97 } };
const ctaSpring = { type: "spring", stiffness: 380, damping: 22 };

function HeroMedia() {
  return (
    <div className="hero-media">
      <div className="hero-blob" />
      <img
        src={HERO_IMG}
        alt="Doctor reassuring a patient"
        onError={(e) => {
          if (e.currentTarget.src !== HERO_FALLBACK)
            e.currentTarget.src = HERO_FALLBACK;
        }}
      />
      <div className="float-badge fb-top">
        <span className="fb-ic green" />
        <div>
          <strong>Happy Patients</strong>
          <small>Calmer, clearer waits</small>
        </div>
      </div>
      <div className="float-badge fb-bottom">
        <span className="fb-ic teal" />
        <div>
          <strong>Real-time tokens</strong>
          <small>Live across every screen</small>
        </div>
      </div>
    </div>
  );
}

const NAV = [
  { href: "#solution", label: "Our Solution" },
  { href: "#why", label: "Why MediQueue?" },
  { href: "#problem", label: "About Us" },
];

const APP_NOTES_LEFT = [
  "Your wait time is displayed here, and we notify you when it's time to head to the clinic.",
  "A quick button for an emergency call — press it if your condition is critical.",
  "The clinics view shows how crowded queues are at nearby hospitals. Choose wisely.",
];
const APP_NOTE_RIGHT =
  "Tap here to fill in a short health form describing your symptoms. You then get a position in the queue and can monitor your time live.";

const SYS_NOTES = {
  l1: "The clinic can monitor the efficiency of the queue at a glance.",
  l2: "When a patient applies from the app they appear in the system. The request is reviewed and a queue number is assigned automatically based on symptoms.",
  r1: "Reception can monitor and get a clear, real-time view of the whole queue.",
  r2: "Staff manage patients simply, because patients self-register in our own application.",
};

const HERO_IMG =
  "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?auto=format&fit=crop&w=1100&q=80";
const HERO_FALLBACK =
  "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=1100&q=80";

const BENEFITS = [
  {
    title: "Saves time & money",
    body: "Cut wasted minutes per visit and save staff time on every patient by ending manual, paper-based queue management.",
  },
  {
    title: "Calmer waiting rooms",
    body: "Effortless communication between waiting patients and staff — and patients can wait wherever they're comfortable instead of crowding the room.",
  },
  {
    title: "Reduces wait times",
    body: "Cut wait times to under an hour with a dynamic, live-updated expected waiting time right in the app.",
  },
  {
    title: "Reducing workload & stress",
    body: "Less ineffective admin work — reduce staff workload by ~30% so they can focus on treating people.",
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const { t } = useT();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="page landing">
      <motion.header className="navbar" {...navMotion}>
        <div className="landing-nav">
        <Link
          to="/"
          className="brand"
          onClick={() => {
            setMenuOpen(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        >
          <div className="logo">
            <BrandMark />
          </div>
          <div className="name">
            Medi<span>Queue</span>
          </div>
        </Link>
        <nav className="ln-links">
          {NAV.map((n) => (
            <a key={n.href} href={n.href}>
              {t(n.label)}
            </a>
          ))}
          <Link to="/explore">{t("Live Queues")}</Link>
        </nav>
        <div className="ln-cta">
          <ThemeToggle />
          <LanguageSwitcher />
          <button
            className="btn btn-ghost"
            onClick={() => navigate("/auth?mode=login")}
          >
            {t("Log in")}
          </button>
          <button
            className="btn btn-indigo"
            onClick={() => navigate("/auth?mode=signup")}
          >
            {t("Get started")}
          </button>
        </div>
        <NavBurger open={menuOpen} onClick={() => setMenuOpen((o) => !o)} />
        </div>

        {menuOpen && (
          <div className="nav-mobile">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="nav-mobile-link"
                onClick={() => setMenuOpen(false)}
              >
                {t(n.label)}
              </a>
            ))}
            <Link
              to="/explore"
              className="nav-mobile-link"
              onClick={() => setMenuOpen(false)}
            >
              {t("Live Queues")}
            </Link>
            <div className="nav-mobile-tools">
              <ThemeToggle />
              <LanguageSwitcher />
            </div>
            <div className="nav-mobile-cta">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/auth?mode=login");
                }}
              >
                {t("Log in")}
              </button>
              <button
                className="btn btn-indigo"
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/auth?mode=signup");
                }}
              >
                {t("Get started")}
              </button>
            </div>
          </div>
        )}
      </motion.header>

      <div className="wrap">
        <section className="hero-split">
          <div className="hero-copy">
            <h1 className="hero-title">
              {t("Modern Queues")} <br />
              {t("For")} <span>{t("Modern Clinics")}</span>
            </h1>
            <p className="hero-lead">
              {t(
                "Start your journey to better care. End paper token slips and shouted names — patients see exactly when they'll be called, and clinics run the day from one calm dashboard."
              )}
            </p>
            <div className="hero-ctas">
              <motion.button
                className="btn btn-primary"
                onClick={() => navigate("/auth?mode=signup&role=clinic")}
                {...ctaHover}
                transition={ctaSpring}
              >
                {t("For Clinics")}
              </motion.button>
              <motion.button
                className="btn btn-ghost"
                onClick={() => navigate("/auth?mode=signup&role=patient")}
                {...ctaHover}
                transition={ctaSpring}
              >
                {t("For Patients")}
              </motion.button>
            </div>
            <button
              className="link hero-explore"
              onClick={() => navigate("/explore")}
            >
              {t("or compare live clinic queues →")}
            </button>
          </div>

          <HeroMedia />
        </section>
      </div>

      <section id="solution" className="panel sky">
        <h2 className="panel-title indigo">{t("MediQueue's app")}</h2>
        <p className="panel-sub">{t("A simple app for clinic patients")}</p>

        <div className="callout-row">
          <div className="callout-col">
            {APP_NOTES_LEFT.map((note, i) => (
              <div key={i} className="bubble b-left">
                {t(note)}
              </div>
            ))}
          </div>

          <Phone />

          <div className="callout-col">
            <div className="bubble b-right">{t(APP_NOTE_RIGHT)}</div>
          </div>
        </div>
      </section>

      <section className="panel indigo-bg">
        <h2 className="panel-title light">{t("MediQueue's system")}</h2>
        <p className="panel-sub light">{t("A system built to streamline the clinic")}</p>

        <div className="callout-row">
          <div className="callout-col">
            <div className="bubble b-left">{t(SYS_NOTES.l1)}</div>
            <div className="bubble b-left">{t(SYS_NOTES.l2)}</div>
          </div>

          <Laptop />

          <div className="callout-col">
            <div className="bubble b-right">{t(SYS_NOTES.r1)}</div>
            <div className="bubble b-right">{t(SYS_NOTES.r2)}</div>
          </div>
        </div>
      </section>

      <section id="why" className="panel sky-soft">
        <h2 className="panel-title indigo center">{t("Why MediQueue?")}</h2>
        <div className="why-grid">
          {BENEFITS.map((b) => (
            <div key={b.title} className="why-card">
              <h3>{t(b.title)}</h3>
              <p>{t(b.body)}</p>
            </div>
          ))}
          <div className="why-logo">
            <BrandMark />
          </div>
        </div>
      </section>

      <section id="problem" className="panel">
        <div className="prob-row sky-card">
          <h2 className="prob-head indigo">{t("Paper tokens and shouting")}</h2>
          <p>
            {t(
              "76% of India's 1.5 million clinics still run on paper token slips and shouted names. There's no system — just a slip of paper and a receptionist calling out the next number across a crowded room."
            )}
          </p>
        </div>

        <div className="prob-row white-card reverse">
          <p>
            {t(
              "Patients wait 2–3 hours with zero visibility into when they'll be called. Doctors have no dashboard to see who's next, and receptionists manage the entire queue from memory."
            )}
          </p>
          <h2 className="prob-head indigo">{t("Hours of waiting, zero visibility")}</h2>
        </div>

        <div className="prob-row sky-card">
          <h2 className="prob-head indigo">{t("We're going to fix that")}</h2>
          <p>
            {t(
              'MediQueue replaces the paper and the shouting with live digital tokens. Patients see exactly when they\'re next, receptionists run the day from one screen, and both stay in sync the moment "Call Next" is clicked.'
            )}
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function Phone() {
  return (
    <div className="device-wrap">
      <div className="phone">
        <div className="phone-notch" />
        <div className="phone-screen">
          <div className="ps-logo">
            <span className="ps-logo-m">M</span> MediQueue
          </div>
          <div className="ps-status">You're not in a queue</div>
          <div className="ps-token">112</div>
          <button className="ps-wait">Wait in queue</button>
          <div className="ps-tabs">
            <span>Queue</span>
            <span className="ps-tab-mid">+</span>
            <span>Profile</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Laptop() {
  const rows = [
    ["1", "John Doe", "wait"],
    ["2", "Jane Doe", "wait"],
    ["3", "Alex Roy", "wait"],
    ["4", "Mia Khan", "wait"],
    ["5", "Tom Lee", "ok"],
  ];
  return (
    <div className="device-wrap">
      <div className="laptop">
        <div className="laptop-screen">
          <aside className="lt-side">
            <div className="lt-brand">
              <span className="ps-logo-m sm">M</span> MediQueue
            </div>
            {["Dashboard", "Users", "Queues", "Settings"].map((m, i) => (
              <div key={m} className={"lt-nav" + (i === 0 ? " on" : "")}>
                {m}
              </div>
            ))}
            <div className="lt-nav logout">Log Out</div>
          </aside>
          <main className="lt-main">
            <div className="lt-top">
              <div className="lt-stat">
                <div className="lt-stat-num">25</div>
                <div className="lt-stat-lbl">Patients in queue</div>
              </div>
              <div className="lt-bars">
                {[40, 70, 55, 85, 60, 95, 50, 75].map((h, i) => (
                  <span key={i} style={{ height: h + "%" }} />
                ))}
              </div>
            </div>
            <div className="lt-table">
              <div className="lt-tr lt-th">
                <span>ID</span>
                <span>Patient</span>
                <span>Status</span>
              </div>
              {rows.map((r) => (
                <div key={r[0]} className="lt-tr">
                  <span>{r[0]}</span>
                  <span>{r[1]}</span>
                  <span>
                    <i className={"lt-pill " + r[2]} />
                  </span>
                </div>
              ))}
            </div>
          </main>
        </div>
        <div className="laptop-base" />
      </div>
    </div>
  );
}
