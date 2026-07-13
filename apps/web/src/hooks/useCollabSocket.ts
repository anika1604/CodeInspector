import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { API_URL } from "../lib/api";

export interface Presence {
  userId: string;
  displayName: string;
  color: string;
  cursor?: { hunkId: string; line: number };
}

export interface RiskUpdate {
  hunkId: string;
  score: number;
  label: "low" | "medium" | "high";
}

export interface SuggestionUpdate {
  hunkId: string;
  summary: string;
  suggestion: string;
  severity: "info" | "warning" | "critical";
}

export function useCollabSocket(pullRequestId: string, userId: string, displayName: string) {
  const socketRef = useRef<Socket | null>(null);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [riskUpdates, setRiskUpdates] = useState<Record<string, RiskUpdate>>({});
  const [suggestions, setSuggestions] = useState<Record<string, SuggestionUpdate>>({});
  const [comments, setComments] = useState<any[]>([]);
  const [analysisComplete, setAnalysisComplete] = useState(false);

  useEffect(() => {
    if (!pullRequestId) return;

    const socket = io(API_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.emit("join_pr", { pullRequestId, userId, displayName });

    socket.on("presence_update", (list: Presence[]) => setPresence(list));

    socket.on("risk_score", (update: RiskUpdate) => {
      setRiskUpdates((prev) => ({ ...prev, [update.hunkId]: update }));
    });

    socket.on("ai_suggestion", (update: SuggestionUpdate) => {
      setSuggestions((prev) => ({ ...prev, [update.hunkId]: update }));
    });

    socket.on("new_comment", (comment: any) => {
      setComments((prev) => [...prev, comment]);
    });

    socket.on("analysis_complete", () => setAnalysisComplete(true));

    return () => {
      socket.disconnect();
    };
  }, [pullRequestId, userId, displayName]);

  function moveCursor(hunkId: string, line: number) {
    socketRef.current?.emit("cursor_move", { pullRequestId, hunkId, line });
  }

  return { presence, riskUpdates, suggestions, comments, analysisComplete, moveCursor };
}
