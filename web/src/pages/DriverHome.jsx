import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import { money, dateTime, VEHICLE_LABELS } from '../format.js';
import { Alert, Empty, StatusBadge } from '../components/ui.jsx';

const ACTIVE = ['assigned', 'en_route_pickup', 'picked_up'];

export default function DriverHome() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const online = !!user.driver?.is_online;
  const pool = useApi('/driver/jobs/available', { pollMs: 5000 });
  const mine = useApi('/driver/jobs', { pollMs: 10000 });
  const earnings = useApi('/driver/earnings');
  const [error, setError] = useState('');

  const toggle = async () => {
    const d = await api('/driver/status', { method: 'POST', body: { online: !online } });
    setUser({ ...user, driver: { ...user.driver, is_online: d.online } });
    pool.reload();
  };

  const claim = async (id) => {
    setError('');
    try {
      await api(`/driver/jobs/${id}/accept`, { method: 'POST' });
      navigate(`/driver/jobs/${id}`);
    } catch (e) {
      setError(e.message);
      pool.reload();
    }
  };

  const jobs = mine.data?.jobs || [];
  const active = jobs.filter((j) => ACTIVE.includes(j.status));
  const done = jobs.filter((j) => !ACTIVE.includes(j.status));
  const e = earnings.data;

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>Hi, {user.name.split(' ')[0]}</h1>
          <p className="muted">{VEHICLE_LABELS[user.driver?.vehicle_type]} · ★ {Number(user.driver?.rating || 5).toFixed(1)}</p>
        </div>
        <button className={`toggle ${online ? 'on' : ''}`} onClick={toggle} aria-pressed={online}>
          <span className="knob" /> {online ? 'Online' : 'Offline'}
        </button>
      </div>
      <div className="stat-row">
        <div className="card stat"><span>This week</span><strong>{money(e?.week.cents)}</strong><small>{e?.week.jobs || 0} jobs</small></div>
        <div className="card stat"><span>All time</span><strong>{money(e?.total.cents)}</strong><small>{e?.total.jobs || 0} jobs · {Math.round(e?.total.miles || 0)} mi</small></div>
        <div className="card stat"><span>Active</span><strong>{active.length}</strong></div>
      </div>

      {active.length > 0 && (
        <section className="card">
          <h2>Your active jobs</h2>
          <ul className="list">
            {active.map((j) => (
              <li key={j.id}>
                <div><strong>{j.pickup_address}</strong> → {j.dropoff_address}<div className="muted small">{j.item_description}</div></div>
                <div className="row"><StatusBadge status={j.status} label={j.status_label} /><Link className="btn btn-primary btn-sm" to={`/driver/jobs/${j.id}`}>Open</Link></div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Job pool</h2>
        <Alert>{error}</Alert>
        {!online && <Empty title="You're offline"><p className="muted">Go online to see jobs that fit your vehicle.</p><button className="btn btn-primary" onClick={toggle}>Go online</button></Empty>}
        {online && pool.data && !pool.data.jobs.length && <Empty title="No open jobs right now"><p className="muted">New jobs appear here automatically.</p></Empty>}
        {online && (
          <div className="job-grid">
            {(pool.data?.jobs || []).map((j) => (
              <div className="card job" key={j.id}>
                <div className="job-head"><strong className="payout">{money(j.driver_payout_cents)}</strong><span className="muted">{j.distance_miles} mi</span></div>
                <div className="stop"><span className="pin pin-a">A</span>{j.pickup_address}</div>
                <div className="stop"><span className="pin pin-b">B</span>{j.dropoff_address}</div>
                <p className="small">{j.item_description}{j.weight_lbs ? ` · ${j.weight_lbs} lbs` : ''}</p>
                <p className="muted small">{VEHICLE_LABELS[j.vehicle_type]}{j.helper ? ' · helper needed' : ''} · {j.scheduled_for ? `Scheduled ${dateTime(j.scheduled_for)}` : 'ASAP'}</p>
                <button className="btn btn-accent btn-block" onClick={() => claim(j.id)}>Claim job</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {done.length > 0 && (
        <section className="card table-card">
          <h2>Completed</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Job</th><th>Route</th><th>Status</th><th>Payout</th><th>Date</th></tr></thead>
              <tbody>
                {done.map((j) => (
                  <tr key={j.id}>
                    <td><Link to={`/driver/jobs/${j.id}`}>{j.tracking_code}</Link></td>
                    <td className="route-cell"><span>{j.pickup_address}</span><span className="muted">→ {j.dropoff_address}</span></td>
                    <td><StatusBadge status={j.status} label={j.status_label} /></td>
                    <td>{j.status === 'delivered' ? money(j.driver_payout_cents) : '—'}</td>
                    <td className="muted">{dateTime(j.delivered_at || j.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
