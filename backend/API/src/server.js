import app from "./app.js";
import { startMqttService, stopMqttService } from "./services/mqtt.service.js";
import { initWebSocketServer, stopWebSocketServer } from "./services/ws.service.js";

const port = Number(process.env.PORT || 3000);

const server = app.listen(port, () => {
  console.log(`LATA API listening on http://localhost:${port}`);
  startMqttService();
  initWebSocketServer(server);
});

const shutdown = async () => {
  stopWebSocketServer();
  await stopMqttService();
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
