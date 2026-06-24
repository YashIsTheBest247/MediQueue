import { useEffect, useRef, useState } from "react";
import { WS_BASE } from "./auth.jsx";

export function useQueueSocket(clinicId) {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!clinicId) {
      setState(null);
      setConnected(false);
      return;
    }
    let stopped = false;
    let timer = null;

    function connect() {
      const ws = new WebSocket(`${WS_BASE}/ws?clinic_id=${clinicId}`);
      wsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "state_update") setState(data);
        } catch {
          void 0;
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!stopped) timer = setTimeout(connect, 1500);
      };
      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      wsRef.current?.close();
    };
  }, [clinicId]);

  return { state, connected };
}
