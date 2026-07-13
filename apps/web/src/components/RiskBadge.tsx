import { RiskUpdate } from "../hooks/useCollabSocket";

const LABEL_STYLES: Record<string, { bg: string; fg: string; text: string }> = {
  low: { bg: "#12351f", fg: "#4ade80", text: "Low risk" },
  medium: { bg: "#3a2c10", fg: "#facc15", text: "Medium risk" },
  high: { bg: "#3a1414", fg: "#f87171", text: "High risk" },
};

export function RiskBadge({ risk }: { risk?: RiskUpdate }) {
  if (!risk) {
    return (
      <span className="risk-badge risk-badge--pending">
        <span className="risk-badge__dot" /> scoring…
      </span>
    );
  }

  const style = LABEL_STYLES[risk.label] ?? LABEL_STYLES.low;

  return (
    <span
      className="risk-badge"
      style={{ backgroundColor: style.bg, color: style.fg }}
      title={`ML risk score: ${risk.score.toFixed(2)}`}
    >
      {style.text} · {(risk.score * 100).toFixed(0)}%
    </span>
  );
}
