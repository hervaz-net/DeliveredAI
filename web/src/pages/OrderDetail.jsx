import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApi } from '../hooks.js';
import { useAuth } from '../auth.jsx';
import { money, dateTime, VEHICLE_LABELS } from '../format.js';
import { Alert, ProgressSteps, StatusBadge, Timeline } from '../components/ui.jsx';

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, error, setData } = useApi(`/orders/${id}`, { pollMs: 5000 });
  const [actionError, setActionError] = useState('');
  const [copied, setCopied] = useState(false);
  const o = data?.order;

  if (error) return <div className="container page"><Alert>{error}</Alert></div>;
  if (!o) return <div className="page-loading">Loading…</div>;

  const trackUrl = `${window.location.origin}/track/${o.tracking_code}`;
  const cancel = async () => {
    if (!window.confirm('Cancel this delivery?')) return;
    try {
      setData(await api(`/orders/${o.id}/cancel`, { method: 'POST' }));
    } catch (e) {
      setActionError(e.message);
    }
  };
  const copy = async () => {
    await navigator.clipboard?.writeText(trackUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="container page">
      <Link to={user.role === 'admin' ? '/admin' : '/app'} className="back">← Back</Link>
      <div className="page-head">
        <div>
          <h1>Delivery {o.tracking_code}</h1>
          <StatusBadge status={o.status} label={o.status_label} />
        </div>
        <div className="row">
          <button className="btn btn-ghost" onClick={copy}>{copied ? 'Copied' : 'Copy tracking link'}</button>
          {['pending', 'assigned'].includes(o.status) && <button className="btn btn-danger" onClick={cancel}>Cancel</button>}
        </div>
      </div>
      <Alert>{actionError}</Alert>
      <ProgressSteps status={o.status} />
      <div className="detail-grid">
        <section className="card">
          <h2>Route</h2>
          <div className="stop"><span className="pin pin-a">A</span><div><strong>{o.pickup_address}</strong>
            <div className="muted small">{[o.pickup_contact_name, o.pickup_contact_phone].filter(Boolean).join(' · ')}</div>
            {o.pickup_notes && <div className="small">{o.pickup_notes}</div>}</div></div>
          <div className="stop"><span className="pin pin-b">B</span><div><strong>{o.dropoff_address}</strong>
            <div className="muted small">{[o.dropoff_contact_name, o.dropoff_contact_phone].filter(Boolean).join(' · ')}</div>
            {o.dropoff_notes && <div className="small">{o.dropoff_notes}</div>}</div></div>
          <dl className="kv">
            <dt>Items</dt><dd>{o.item_description}{o.weight_lbs ? ` · ${o.weight_lbs} lbs` : ''}</dd>
            <dt>Vehicle</dt><dd>{VEHICLE_LABELS[o.vehicle_type]}{o.helper ? ' + helper' : ''}</dd>
            <dt>Distance</dt><dd>{o.distance_miles} mi</dd>
            <dt>When</dt><dd>{o.scheduled_for ? dateTime(o.scheduled_for) : 'ASAP'}</dd>
            <dt>Price</dt><dd><strong>{money(o.price_cents)}</strong></dd>
            {user.role === 'admin' && (<><dt>Customer</dt><dd>{o.customer_name} · {o.customer_email}</dd></>)}
          </dl>
        </section>
        <section className="card">
          <h2>Driver</h2>
          {o.driver_id ? (
            <dl className="kv">
              <dt>Name</dt><dd>{o.driver_name}</dd>
              <dt>Phone</dt><dd>{o.driver_phone}</dd>
              <dt>Vehicle</dt><dd>{[o.vehicle_make, o.vehicle_model].filter(Boolean).join(' ') || VEHICLE_LABELS[o.driver_vehicle_type]}</dd>
              {o.license_plate && (<><dt>Plate</dt><dd>{o.license_plate}</dd></>)}
              <dt>Rating</dt><dd>★ {Number(o.driver_rating).toFixed(1)}</dd>
            </dl>
          ) : (
            <p className="muted">{o.status === 'cancelled' ? 'No driver.' : 'We are matching you with a nearby driver.'}</p>
          )}
          {o.status === 'delivered' && (
            <div className="proof">
              <h3>Proof of delivery</h3>
              <p>Received by <strong>{o.proof_recipient}</strong> at {dateTime(o.delivered_at)}</p>
              {o.proof_note && <p className="muted">"{o.proof_note}"</p>}
            </div>
          )}
          <h2>Activity</h2>
          <Timeline events={o.events} />
        </section>
      </div>
    </div>
  );
}
