import { Link } from 'react-router-dom';

export default function Logo({ to = '/' }) {
  return (
    <Link to={to} className="logo" aria-label="DeliveredAI home">
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="currentColor" />
        <path d="M8 9h8a7 7 0 0 1 0 14H8z" fill="none" stroke="var(--accent)" strokeWidth="3.5" />
        <circle cx="24" cy="23" r="2.5" fill="var(--accent)" />
      </svg>
      <span>Delivered<b>AI</b></span>
    </Link>
  );
}
