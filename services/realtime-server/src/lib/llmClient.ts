const LLM_AGENT_SERVICE_URL = process.env.LLM_AGENT_SERVICE_URL || "http://llm-agent-service:8002";

export interface SuggestionResult {
  summary: string;
  suggestion: string;
  severity: "info" | "warning" | "critical";
}

export async function fetchAiSuggestion(input: {
  filePath: string;
  hunkText: string;
  riskScore: number;
}): Promise<SuggestionResult> {
  const res = await fetch(`${LLM_AGENT_SERVICE_URL}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_path: input.filePath,
      hunk_text: input.hunkText,
      risk_score: input.riskScore,
    }),
  });

  if (!res.ok) {
    throw new Error(`llm-agent-service returned ${res.status}`);
  }

  return res.json();
}
