import { useClinic } from "../useClinic.js";
import { TopBar, Footer } from "../components/Chrome.jsx";

export default function WaitingRoom() {
  const { state, connected } = useClinic();

  const serving = state?.serving;
  const waiting = state?.waiting ?? [];
  const tokensAhead = state?.tokens_ahead ?? 0;
  const avg = state?.avg_consultation_time ?? 10;
  const estWait = tokensAhead * avg;

  return (
    <div className="page">
      <TopBar connected={connected} />

      <div className="wrap">
        <div className="section-title" style={{ textAlign: "center" }}>
          Waiting Room
        </div>
        <div className="h1" style={{ textAlign: "center", marginBottom: 24 }}>
          Please watch for <span>your token</span>
        </div>

        <div className="now-serving">
          <div className="label">Now Serving</div>
          <div className="big-token">{serving ? serving.token : "—"}</div>
          <div className="pat-name">
            {serving ? serving.name : "Waiting to start"}
          </div>
          <div className="pulse">
            <i />
            {connected ? "Live · updates automatically" : "Reconnecting…"}
          </div>
        </div>

        <div className="info-row">
          <div className="info-card">
            <div className="v">{tokensAhead}</div>
            <div className="k">Tokens in queue</div>
          </div>
          <div className="info-card">
            <div className="v">{estWait}</div>
            <div className="k">Est. wait for last token (min)</div>
          </div>
        </div>

        <div className="upcoming">
          <div className="head">Up Next</div>
          {waiting.length === 0 ? (
            <div className="empty">The queue is empty right now.</div>
          ) : (
            <div className="chips">
              {waiting.map((p) => (
                <div key={p.token} className="chip">
                  Token {p.token}
                  <small>~{p.estimated_wait} min</small>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
