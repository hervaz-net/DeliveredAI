import { dateTime } from '../format.js';

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Alert({ kind = 'error', children }) {
  if (!children) return null;
  return <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function StatusBadge({ status, label }) {
  return <span className={`badge badge-${status}`}>{label || status}</span>;
}

const STEPS = ['pending', 'assigned', 'en_route_pickup', 'picked_up', 'delivered'];
const STEP_LABELS = ['Placed', 'Driver assigned', 'To pickup', 'Picked up', 'Delivered'];

export function ProgressSteps({ status }) {
  if (status === 'cancelled') return <div className="alert alert-error">This delivery was cancelled.</div>;
  const at = STEPS.indexOf(status);
  return (
    <ol className="steps">
      {STEPS.map((s, i) => (
        <li key={s} className={i < at ? 'done' : i === at ? 'current' : ''}>
          <span className="dot" />
          <span>{STEP_LABELS[i]}</span>
        </li>
      ))}
    </ol>
  );
}

export function Timeline({ events }) {
  if (!events?.length) return null;
  return (
    <ul className="timeline">
      {[...events].reverse().map((e, i) => (
        <li key={i}>
          <strong>{e.label}</strong>
          {e.note && <span className="muted"> · {e.note}</span>}
          <div className="muted small">{dateTime(e.created_at)}</div>
        </li>
      ))}
    </ul>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children}
    </div>
  );
}
