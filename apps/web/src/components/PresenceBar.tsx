import { Presence } from "../hooks/useCollabSocket";

export function PresenceBar({ presence }: { presence: Presence[] }) {
  return (
    <div className="presence-bar">
      {presence.map((p) => (
        <div key={p.userId} className="presence-avatar" style={{ backgroundColor: p.color }}>
          <span>{p.displayName.slice(0, 2).toUpperCase()}</span>
          <div className="presence-tooltip">{p.displayName}</div>
        </div>
      ))}
      {presence.length === 0 && <span className="presence-empty">No one else is here</span>}
    </div>
  );
}
