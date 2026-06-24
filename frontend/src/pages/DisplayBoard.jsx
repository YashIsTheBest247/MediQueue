import { useParams } from "react-router-dom";
import { useQueueSocket } from "../useQueue.js";
import { TopBar } from "../components/Chrome.jsx";
import { useT } from "../i18n.jsx";

export default function DisplayBoard() {
  const { clinicId } = useParams();
  const { state, connected } = useQueueSocket(clinicId);
  const { t } = useT();

  const serving = state?.serving;
  const waiting = state?.waiting ?? [];
  const tokensAhead = state?.tokens_ahead ?? 0;
  const lastWait = waiting.length ? waiting[waiting.length - 1].estimated_wait : 0;

  return (
    <div className="page">
      <TopBar back />

      <div className="wrap">
        <div className="section-title" style={{ textAlign: "center" }}>
          {state?.clinic_name || t("Waiting Room")}
        </div>
        <div className="h1" style={{ textAlign: "center", marginBottom: 24 }}>
          {t("Please watch for")} <span>{t("your token")}</span>
        </div>

        <div className="now-serving">
          <div className="label">{t("Now Serving")}</div>
          <div className="big-token">{serving ? serving.token : "—"}</div>
          <div className="pat-name">
            {serving ? serving.name : t("Waiting to start")}
          </div>
          <div className="pulse">
            {connected ? t("Live · updates automatically") : t("Reconnecting…")}
          </div>
        </div>

        <div className="info-row">
          <div className="info-card">
            <div className="v">{tokensAhead}</div>
            <div className="k">{t("Tokens in queue")}</div>
          </div>
          <div className="info-card">
            <div className="v">{lastWait}</div>
            <div className="k">{t("Est. wait for last token (min)")}</div>
          </div>
        </div>

        <div className="upcoming">
          <div className="head">{t("Up Next")}</div>
          {waiting.length === 0 ? (
            <div className="empty">{t("The queue is empty right now.")}</div>
          ) : (
            <div className="chips">
              {waiting.map((p) => (
                <div key={p.token} className="chip">
                  {t("Token")} {p.token}
                  <small>~{p.estimated_wait} min</small>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
