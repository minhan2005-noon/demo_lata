import { useEffect, useRef, useState } from "react";

/**
 * Hook nhận dữ liệu real-time từ WebSocket backend.
 * Tự động reconnect khi mất kết nối.
 *
 * @param {string} deviceId - ID thiết bị LATA
 * @returns {{ data, connected }}
 */
export function useLiveStream(deviceId, apiBase = "") {
  const [data, setData]           = useState(null);
  const [connected, setConnected] = useState(false);
  const wsRef                     = useRef(null);
  const retryRef                  = useRef(null);

  useEffect(() => {
    if (!deviceId) return;

    function connect() {
      const configuredBase = import.meta.env.VITE_WS_BASE_URL || apiBase;
      const base = configuredBase
        ? configuredBase.replace(/^http/, "ws").replace(/\/$/, "")
        : `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
      const ws   = new WebSocket(`${base}/ws/devices/${deviceId}/live`);
      wsRef.current = ws;

      ws.onopen    = () => { setConnected(true); clearTimeout(retryRef.current); };
      ws.onmessage = (e) => { setData(JSON.parse(e.data)); };
      ws.onclose   = () => {
        setConnected(false);
        retryRef.current = setTimeout(connect, 3000);  // reconnect sau 3s
      };
      ws.onerror = () => ws.close();
    }

    connect();
    return () => {
      clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [apiBase, deviceId]);

  return { data, connected };
}
