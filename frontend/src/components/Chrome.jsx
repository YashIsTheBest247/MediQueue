import { Link } from "react-router-dom";

export function TopBar({ connected, right, links }) {
  return (
    <div className="topbar">
      <Link to="/" className="brand">
        <div className="logo">M</div>
        <div>
          <div className="name">
            Medi<span>Queue</span>
          </div>
          <div className="tag">Smart Clinic Queue</div>
        </div>
      </Link>

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
        {right}
        {connected !== undefined && (
          <span className="pill ghost">
            <span className={"dot" + (connected ? " on" : "")} />
            {connected ? "Live" : "Reconnecting"}
          </span>
        )}
      </div>
    </div>
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
            <div className="logo">M</div>
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
