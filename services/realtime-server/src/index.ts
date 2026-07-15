import "dotenv/config";

import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

import { authRouter } from "./routes/auth";
import { pullRequestsRouter } from "./routes/pullRequests";
import { registerPrRoomHandlers } from "./socket/prRoom";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" })); // diffs can be large

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRouter);
app.use("/api/pull-requests", pullRequestsRouter);

const httpServer = createServer(app);

export const io = new Server(httpServer, {
  cors: { origin: process.env.WEB_ORIGIN || "*" },
});

// NOTE on scaling: for multiple realtime-server replicas behind a load
// balancer, attach the Redis adapter here (@socket.io/redis-adapter) so
// room broadcasts fan out across instances. Left single-instance for the
// MVP deploy to keep infra cost/complexity down.

io.on("connection", (socket) => {
  registerPrRoomHandlers(io, socket);
});

const PORT = process.env.PORT || 8000;
httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`realtime-server listening on :${PORT}`);
});

// Safety net: an unhandled promise rejection anywhere in the app (a route
// missing a try/catch, for instance) would otherwise crash the entire
// server for every connected client. Log it and keep running instead —
// the real fix is still proper error handling per-route (see pullRequests.ts),
// but this keeps one bad request from taking down everyone else's session.
process.on("unhandledRejection", (reason) => {
  // eslint-disable-next-line no-console
  console.error("Unhandled rejection (server stayed up):", reason);
});
