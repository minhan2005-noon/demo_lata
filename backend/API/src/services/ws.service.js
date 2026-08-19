import { WebSocketServer } from "ws";
import { URL } from "url";

let wss;
const clientsByDeviceId = new Map();

/**
 * Khởi tạo WebSocket server và gắn vào HTTP server
 * @param {http.Server} server - Express HTTP server
 */
export function initWebSocketServer(server) {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Chỉ xử lý /ws/devices/:deviceId/live
    const match = pathname.match(/^\/ws\/devices\/([^\/]+)\/live$/);
    if (!match) {
      ws.close(1008, "Invalid path");
      return;
    }

    const deviceId = match[1];
    console.log(`[WS] Client connected for device: ${deviceId}`);

    // Lưu client vào map theo deviceId
    if (!clientsByDeviceId.has(deviceId)) {
      clientsByDeviceId.set(deviceId, new Set());
    }
    clientsByDeviceId.get(deviceId).add(ws);

    // Gửi handshake
    ws.send(JSON.stringify({
      type: "connected",
      deviceId,
      message: `Connected to device ${deviceId}`,
      timestamp: new Date().toISOString()
    }));

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data);
        console.log(`[WS] Message from ${deviceId}:`, message);
      } catch (err) {
        console.error(`[WS] Invalid message from ${deviceId}:`, err.message);
      }
    });

    ws.on("close", () => {
      console.log(`[WS] Client disconnected for device: ${deviceId}`);
      const clients = clientsByDeviceId.get(deviceId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          clientsByDeviceId.delete(deviceId);
        }
      }
    });

    ws.on("error", (err) => {
      console.error(`[WS] Error from ${deviceId}:`, err.message);
    });
  });

  console.log("[WS] WebSocket server initialized");
  return wss;
}

/**
 * Broadcast dữ liệu cảm biến đến tất cả clients của device
 * @param {string} deviceId - ID thiết bị
 * @param {object} reading - Dữ liệu cảm biến
 */
export function broadcastReading(deviceId, reading) {
  const clients = clientsByDeviceId.get(deviceId);
  if (!clients || clients.size === 0) return;

  const message = JSON.stringify({
    type: "reading",
    deviceId,
    reading,
    timestamp: new Date().toISOString()
  });

  clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  });
}

/**
 * Broadcast cảnh báo đến tất cả clients của device
 * @param {string} deviceId - ID thiết bị
 * @param {object} alert - Dữ liệu alert
 */
export function broadcastAlert(deviceId, alert) {
  const clients = clientsByDeviceId.get(deviceId);
  if (!clients || clients.size === 0) return;

  const message = JSON.stringify({
    type: "alert",
    deviceId,
    alert,
    timestamp: new Date().toISOString()
  });

  clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

/**
 * Broadcast trạng thái kết nối đến tất cả clients của device
 * @param {string} deviceId - ID thiết bị
 * @param {object} status - Trạng thái
 */
export function broadcastStatus(deviceId, status) {
  const clients = clientsByDeviceId.get(deviceId);
  if (!clients || clients.size === 0) return;

  const message = JSON.stringify({
    type: "status",
    deviceId,
    status,
    timestamp: new Date().toISOString()
  });

  clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

/**
 * Lấy số lượng clients đang kết nối cho device
 * @param {string} deviceId - ID thiết bị
 * @returns {number} Số clients
 */
export function getConnectedClients(deviceId) {
  return clientsByDeviceId.get(deviceId)?.size || 0;
}

/**
 * Dừng WebSocket server
 */
export function stopWebSocketServer() {
  if (wss) {
    wss.close();
    clientsByDeviceId.clear();
    console.log("[WS] WebSocket server stopped");
  }
}
