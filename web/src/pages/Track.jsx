import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useApi } from '../hooks.js';
import { dateTime, VEHICLE_LABELS } from '../format.js';
import { Alert, ProgressSteps, StatusBadge, Timeline } from '../components/ui.jsx';

export default function Track() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [input, setInput] = useState(code || '');
  const { data, error } = useApi(code ? `/track/${encodeURIComponent(code)}` : null, { pollMs: 8000 });
  const o = data?.order;

  return (
    <div className="container page narrow">
      <h1>Track a delivery</h1>
      <form className="track-form" onSubmit={(e) => { e.preventDefault(); if (input.trim()) navigate(`/track/${input.trim().toUpperCase()}`); }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Tracking code, e.g. DA7KQ2M9XP" aria-label="Tracking code" />
        <button className="btn btn-primary">Track</button>
      </form>
      {code && error && <Alert>{error}</Alert>}
      {o && (
        <div className="card">
          <div className="page-head">
            <h2>{o.tracking_code}</h2>
            <StatusBadge status={o.status} label={o.status_label} />
          </div>
          <ProgressSteps status={o.status} />
          <div className="stop"><span className="pin pin-a">A</span><strong>{o.pickup_address}</strong></div>
          <div className="stop"><span className="pin pin-b">B</span><strong>{o.dropoff_address}</strong></div>
          <dl className="kv">
            <dt>Vehicle</dt><dd>{VEHICLE_LABELS[o.vehicle_type]}</dd>
            <dt>When</dt><dd>{o.scheduled_for ? dateTime(o.scheduled_for) : 'ASAP'}</dd>
            {o.driver && (<><dt>Driver</dt><dd>{o.driver.first_name}{o.driver.vehicle ? ` · ${o.driver.vehicle}` : ''} · ★ {Number(o.driver.rating).toFixed(1)}</dd></>)}
            {o.delivered_at && (<><dt>Delivered</dt><dd>{dateTime(o.delivered_at)} to {o.proof_recipient}</dd></>)}
          </dl>
          <Timeline events={o.events} />
        </div>
      )}
    </div>
  );
}
