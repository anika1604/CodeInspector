const ML_RISK_SERVICE_URL = process.env.ML_RISK_SERVICE_URL || "http://ml-risk-service:8001";

export interface RiskResult {
  score: number;
  label: "low" | "medium" | "high";
  modelVersion: string;
  features: Record<string, number>;
}

export async function fetchRiskScore(input: {
  filePath: string;
  hunkText: string;
  linesAdded: number;
  linesRemoved: number;
}): Promise<RiskResult> {
  const res = await fetch(`${ML_RISK_SERVICE_URL}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_path: input.filePath,
      hunk_text: input.hunkText,
      lines_added: input.linesAdded,
      lines_removed: input.linesRemoved,
    }),
  });

  if (!res.ok) {
    throw new Error(`ml-risk-service returned ${res.status}`);
  }

  const data = await res.json();
  return {
    score: data.risk_score,
    label: data.risk_label,
    modelVersion: data.model_version,
    features: data.features,
  };
}
