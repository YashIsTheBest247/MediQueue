import { useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth, API } from "../auth.jsx";

export default function QuickJoin() {
  const { clinicId } = useParams();
  const { account } = useAuth();
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    async function run() {
      let name = `Clinic #${clinicId}`;
      try {
        const s = await fetch(`${API}/api/clinics/${clinicId}/state`).then((r) =>
          r.json()
        );
        if (s.clinic_name) name = s.clinic_name;
      } catch {
        void 0;
      }

      if (account?.role === "clinic") {
        navigate("/explore", { replace: true });
        return;
      }

      localStorage.removeItem("mq_patient_clinic");
      localStorage.setItem(
        "mq_preselect_clinic",
        JSON.stringify({ id: Number(clinicId), name })
      );

      if (account?.role === "patient") navigate("/patient", { replace: true });
      else navigate("/auth?mode=login&role=patient", { replace: true });
    }
    run();
  }, [account, clinicId, navigate]);

  return (
    <div className="page">
      <div className="wrap" style={{ textAlign: "center", paddingTop: 90 }}>
        <div className="h1">
          Joining the <span>queue…</span>
        </div>
        <p className="sub">One moment while we add you.</p>
      </div>
    </div>
  );
}
