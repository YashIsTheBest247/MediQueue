import { useEffect, useRef, useState, useCallback } from "react";

const HTTP_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const WS_BASE = import.meta.env.VITE_WS_URL || HTTP_BASE.replace(/^http/, "ws");

export function useClinic() {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    let stopped = false;
    let reconnectTimer = null;

    function connect() {
      const ws = new WebSocket(`${WS_BASE}/ws`);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "state_update") setState(data);
        } catch (e) {
          void e;
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!stopped) reconnectTimer = setTimeout(connect, 1500);
      };
      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      stopped = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, []);

  const addPatient = useCallback(async (name) => {
    await fetch(`${HTTP_BASE}/api/patients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
  }, []);

  const callNext = useCallback(async () => {
    await fetch(`${HTTP_BASE}/api/call-next`, { method: "POST" });
  }, []);

  const setAvgTime = useCallback(async (minutes) => {
    await fetch(`${HTTP_BASE}/api/avg-time`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutes }),
    });
  }, []);

  const reset = useCallback(async () => {
    await fetch(`${HTTP_BASE}/api/reset`, { method: "POST" });
  }, []);

  return { state, connected, addPatient, callNext, setAvgTime, reset };
}
