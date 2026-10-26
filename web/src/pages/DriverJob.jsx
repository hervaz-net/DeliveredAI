import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApi } from '../hooks.js';
import { money, dateTime, VEHICLE_LABELS } from '../format.js';
import { Alert, Field, ProgressSteps, StatusBadge, Timeline } from '../components/ui.jsx';

const NEXT_ACTION = {
  assigned: 'Start driving to pickup',
  en_route_pickup: 'Confirm pickup',
  picked_up: 'Complete delivery',
};

const mapsLink = (addr) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;

export default function DriverJob() {
  const { id } = useParams();
  const { data, error, setData } = useApi(`/driver/jobs/${id}`);
  const [proof, setProof] = useState({ proof_recipient: '', proof_note: '' });
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const j = data?.job;

  if (error) return <div className="container page"><Alert>{error}</Alert></div>;
  if (!j) return <div className="page-loading">Loading…</div>;

  const advance = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setActionError('');
    try {
      setData(await api(`/driver/jobs/${j.id}/advance`, { method: 'POST', body: j.status === 'picked_up' ? proof : {} }));
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const Stop = ({ pin, label, addr, name, phone, notes }) => (
    <div className="stop big">
      <span className={`pin pin-${pin}`}>{pin.toUpperCase()}</span>
      <div>
        <div className="muted small">{label}</div>
        <strong>{addr}</strong>
        {(name || phone) && (
          <div className="small">{name}{name && phone && ' · '}{phone && <a href={`tel:${phone}`}>{phone}</a>}</div>
        )}
        {notes && <div className="small note">{notes}</div>}
        <a className="small" href={mapsLink(addr)} target="_blank" rel="noreferrer">Open in Maps</a>
      </div>
    </div>
  );

  return (
    <div className="container page narrow">
      <Link to="/driver" className="back">← Jobs</Link>
      <div className="page-head">
        <h1>{j.tracking_code}</h1>
        <StatusBadge status={j.status} label={j.status_label} />
      </div>
      <ProgressSteps status={j.status} />
      <div className="card">
        {Stop({ pin: 'a', label: 'Pickup', addr: j.pickup_address, name: j.pickup_contact_name, phone: j.pickup_contact_phone, notes: j.pickup_notes })}
        {Stop({ pin: 'b', label: 'Drop-off', addr: j.dropoff_address, name: j.dropoff_contact_name, phone: j.dropoff_contact_phone, notes: j.dropoff_notes })}
        <dl className="kv">
          <dt>Items</dt><dd>{j.item_description}{j.weight_lbs ? ` · ${j.weight_lbs} lbs` : ''}</dd>
          <dt>Vehicle</dt><dd>{VEHICLE_LABELS[j.vehicle_type]}{j.helper ? ' · bring a helper' : ''}</dd>
          <dt>When</dt><dd>{j.scheduled_for ? dateTime(j.scheduled_for) : 'ASAP'}</dd>
          <dt>Customer</dt><dd>{j.customer_company || j.customer_name}</dd>
          <dt>Your payout</dt><dd><strong>{money(j.driver_payout_cents)}</strong></dd>
        </dl>
      </div>
      <Alert>{actionError}</Alert>
      {j.status === 'picked_up' ? (
        <form className="card" onSubmit={advance}>
          <h2>Proof of delivery</h2>
          <Field label="Received by"><input required value={proof.proof_recipient} onChange={(e) => setProof({ ...proof, proof_recipient: e.target.value })} /></Field>
          <Field label="Notes (optional)"><input value={proof.proof_note} onChange={(e) => setProof({ ...proof, proof_note: e.target.value })} placeholder="Left at loading dock 3" /></Field>
          <button className="btn btn-accent btn-block" disabled={busy}>{NEXT_ACTION.picked_up}</button>
        </form>
      ) : NEXT_ACTION[j.status] ? (
        <button className="btn btn-accent btn-block btn-lg" onClick={advance} disabled={busy}>{NEXT_ACTION[j.status]}</button>
      ) : null}
      {j.status === 'delivered' && <div className="alert alert-ok">Delivered to {j.proof_recipient}. {money(j.driver_payout_cents)} added to your earnings.</div>}
      <div className="card"><h2>Activity</h2><Timeline events={j.events} /></div>
    </div>
  );
}
