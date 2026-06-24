import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function QuickJoin() {
  const { clinicId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    navigate(`/display/${clinicId}`, { replace: true });
  }, [clinicId, navigate]);

  return (
    <div className="page">
      <div className="wrap" style={{ textAlign: "center", paddingTop: 90 }}>
        <div className="h1">
          Opening <span>live status…</span>
        </div>
      </div>
    </div>
  );
}
