import { Server, Socket } from "socket.io";

interface PresenceInfo {
  userId: string;
  displayName: string;
  color: string;
  cursor?: { hunkId: string; line: number };
}

// In-memory presence map, keyed by PR room. Fine for a single-instance deploy;
// swap for a Redis adapter (see index.ts comment) to scale horizontally.
const roomPresence = new Map<string, Map<string, PresenceInfo>>();

const CURSOR_COLORS = ["#f97316", "#22c55e", "#3b82f6", "#a855f7", "#ec4899", "#14b8a6"];
function colorForSocket(socketId: string): string {
  let hash = 0;
  for (const char of socketId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
}

export function registerPrRoomHandlers(io: Server, socket: Socket) {
  socket.on("join_pr", ({ pullRequestId, userId, displayName }) => {
    const room = `pr:${pullRequestId}`;
    socket.join(room);

    if (!roomPresence.has(room)) roomPresence.set(room, new Map());
    const presence = roomPresence.get(room)!;
    presence.set(socket.id, {
      userId,
      displayName,
      color: colorForSocket(socket.id),
    });

    io.to(room).emit("presence_update", Array.from(presence.values()));
  });

  socket.on("cursor_move", ({ pullRequestId, hunkId, line }) => {
    const room = `pr:${pullRequestId}`;
    const presence = roomPresence.get(room);
    if (!presence?.has(socket.id)) return;

    presence.get(socket.id)!.cursor = { hunkId, line };
    socket.to(room).emit("presence_update", Array.from(presence.values()));
  });

  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      const presence = roomPresence.get(room);
      if (!presence) continue;
      presence.delete(socket.id);
      socket.to(room).emit("presence_update", Array.from(presence.values()));
      if (presence.size === 0) roomPresence.delete(room);
    }
  });
}
