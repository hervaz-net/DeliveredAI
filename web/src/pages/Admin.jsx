import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useApi } from '../hooks.js';
import { money, dateTime, VEHICLE_LABELS } from '../format.js';
import { Alert, StatusBadge } from '../components/ui.jsx';

const VEHICLE_RANK = ['car', 'suv', 'pickup', 'cargo_van', 'box_truck'];
const fits = (driverVehicle, orderVehicle) => VEHICLE_RANK.indexOf(driverVehicle) >= VEHICLE_RANK.indexOf(orderVehicle);

function Table({ cols, rows, empty = 'Nothing here yet.' }) {
  if (!rows) return <p className="muted">Loading…</p>;
  if (!rows.length) return <p className="muted">{empty}</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{cols.map(([h]) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={r.id ?? i}>{cols.map(([h, fn]) => <td key={h}>{fn(r)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function Overview() {
  const { data: s } = useApi('/admin/stats', { pollMs: 10000 });
  const { data } = useApi('/admin/orders?status=pending', { pollMs: 10000 });
  if (!s) return <p className="muted">Loading…</p>;
  const conv = s.quotes_total ? Math.round((s.quotes_converted / s.quotes_total) * 100) : 0;
  const tiles = [
    ['Orders in driver pool', s.orders_pending], ['Active deliveries', s.orders_active], ['Delivered today', s.delivered_today],
    ['Delivered revenue', money(s.revenue_cents)], ['Customers', s.customers], ['Drivers', `${s.drivers_online} online / ${s.drivers}`],
    ['Signups today', s.signups_today], ['Quotes', `${s.quotes_total} (${conv}% booked)`], ['API calls 24h', `${s.api_calls_24h} (${s.api_errors_24h} errors)`],
  ];
  return (
    <>
      <div className="stat-grid">{tiles.map(([k, v]) => <div className="card stat" key={k}><span>{k}</span><strong>{v}</strong></div>)}</div>
      <section className="card"><h2>Waiting in the driver pool</h2><OrdersTable orders={data?.orders} /></section>
    </>
  );
}

function OrdersTable({ orders, drivers, onAssign }) {
  return (
    <Table
      rows={orders}
      empty="No orders."
      cols={[
        ['Order', (o) => <Link to={`/app/orders/${o.id}`}>{o.tracking_code}</Link>],
        ['Customer', (o) => <>{o.customer_company || o.customer_name}<div className="muted small">{o.customer_email}</div></>],
        ['Route', (o) => <span className="route-cell"><span>{o.pickup_address}</span><span className="muted">→ {o.dropoff_address}</span></span>],
        ['Vehicle', (o) => VEHICLE_LABELS[o.vehicle_type]],
        ['Status', (o) => <StatusBadge status={o.status} label={o.status_label} />],
        ['Driver', (o) => drivers && ['pending', 'assigned'].includes(o.status) ? (
          <select value={o.driver_id || ''} onChange={(e) => e.target.value && onAssign(o.id, e.target.value)} aria-label="Assign driver">
            <option value="">{o.driver_name ? o.driver_name : 'In pool, assign…'}</option>
            {drivers.filter((d) => fits(d.vehicle_type, o.vehicle_type)).map((d) => (
              <option key={d.id} value={d.id}>{d.name} ({VEHICLE_LABELS[d.vehicle_type]}{d.is_online ? ', online' : ''})</option>
            ))}
          </select>
        ) : (o.driver_name || '—')],
        ['Price', (o) => money(o.price_cents)],
        ['Created', (o) => <span className="muted">{dateTime(o.created_at)}</span>],
      ]}
    />
  );
}

function Orders() {
  const [status, setStatus] = useState('');
  const { data, reload } = useApi(`/admin/orders${status ? `?status=${status}` : ''}`, { pollMs: 10000 });
  const drivers = useApi('/admin/drivers').data?.drivers || [];
  const [error, setError] = useState('');
  const assign = async (id, driverId) => {
    setError('');
    try {
      await api(`/admin/orders/${id}/assign`, { method: 'POST', body: { driver_id: Number(driverId) } });
      reload();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <section className="card">
      <div className="page-head">
        <h2>All orders</h2>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="pending">In driver pool</option>
          <option value="assigned">Assigned</option>
          <option value="en_route_pickup">To pickup</option>
          <option value="picked_up">Picked up</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
      <Alert>{error}</Alert>
      <OrdersTable orders={data?.orders} drivers={drivers} onAssign={assign} />
    </section>
  );
}

function Signups() {
  const { data } = useApi('/admin/signups', { pollMs: 15000 });
  return (
    <section className="card"><h2>New signups</h2>
      <Table rows={data?.users} cols={[
        ['Name', (u) => u.name], ['Email', (u) => u.email], ['Type', (u) => <span className={`badge badge-${u.role === 'driver' ? 'picked_up' : 'assigned'}`}>{u.role === 'driver' ? 'Driver' : 'Business'}</span>],
        ['Company / vehicle', (u) => u.company_name || VEHICLE_LABELS[u.vehicle_type] || '—'], ['Phone', (u) => u.phone || '—'],
        ['Joined', (u) => <span className="muted">{dateTime(u.created_at)}</span>],
      ]} />
    </section>
  );
}

function Drivers() {
  const { data } = useApi('/admin/drivers', { pollMs: 15000 });
  return (
    <section className="card"><h2>Drivers</h2>
      <Table rows={data?.drivers} cols={[
        ['Name', (d) => <>{d.name}<div className="muted small">{d.email}</div></>], ['Phone', (d) => d.phone],
        ['Vehicle', (d) => <>{VEHICLE_LABELS[d.vehicle_type]}<div className="muted small">{[d.vehicle_make, d.vehicle_model, d.license_plate].filter(Boolean).join(' · ')}</div></>],
        ['Status', (d) => <span className={`badge ${d.is_online ? 'badge-delivered' : 'badge-cancelled'}`}>{d.is_online ? 'Online' : 'Offline'}</span>],
        ['Active', (d) => d.active], ['Delivered', (d) => d.delivered], ['Rating', (d) => `★ ${Number(d.rating).toFixed(1)}`],
      ]} />
    </section>
  );
}

function Customers() {
  const { data } = useApi('/admin/customers');
  return (
    <section className="card"><h2>Customers</h2>
      <Table rows={data?.customers} cols={[
        ['Company', (c) => c.company_name || '—'], ['Contact', (c) => <>{c.name}<div className="muted small">{c.email}</div></>],
        ['Phone', (c) => c.phone || '—'], ['Orders', (c) => c.orders], ['Spend', (c) => money(c.spent_cents)],
        ['Joined', (c) => <span className="muted">{dateTime(c.created_at)}</span>],
      ]} />
    </section>
  );
}

function Quotes() {
  const { data } = useApi('/admin/quotes', { pollMs: 15000 });
  return (
    <section className="card"><h2>Quotes</h2>
      <Table rows={data?.quotes} cols={[
        ['When', (q) => <span className="muted">{dateTime(q.created_at)}</span>], ['Who', (q) => q.user_email || <span className="muted">Visitor</span>],
        ['Route', (q) => <span className="route-cell"><span>{q.pickup_address}</span><span className="muted">→ {q.dropoff_address}</span></span>],
        ['Vehicle', (q) => VEHICLE_LABELS[q.vehicle_type]], ['Miles', (q) => q.distance_miles], ['Quote', (q) => money(q.total_cents)],
        ['Booked', (q) => q.order_id ? <Link to={`/app/orders/${q.order_id}`}>{q.tracking_code}</Link> : <span className="muted">No</span>],
      ]} />
    </section>
  );
}

function ApiActivity() {
  const [errors, setErrors] = useState(false);
  const { data } = useApi(`/admin/api-logs${errors ? '?errors=1' : ''}`, { pollMs: 10000 });
  return (
    <section className="card">
      <div className="page-head"><h2>API activity</h2>
        <label className="check"><input type="checkbox" checked={errors} onChange={(e) => setErrors(e.target.checked)} /> Errors only</label>
      </div>
      <Table rows={data?.logs} cols={[
        ['Time', (l) => <span className="muted">{dateTime(l.created_at)}</span>], ['Method', (l) => <code>{l.method}</code>], ['Path', (l) => <code>{l.path}</code>],
        ['Status', (l) => <span className={`badge ${l.status >= 400 ? 'badge-cancelled' : 'badge-delivered'}`}>{l.status}</span>],
        ['User', (l) => l.user_email || <span className="muted">anonymous</span>], ['ms', (l) => l.duration_ms], ['IP', (l) => <span className="muted small">{l.ip}</span>],
      ]} />
    </section>
  );
}

function Exports() {
  const tables = [['users', 'All accounts'], ['drivers', 'Drivers & vehicles'], ['orders', 'Orders & deliveries'], ['order_events', 'Delivery status history'], ['quotes', 'Quotes'], ['api_logs', 'API activity']];
  return (
    <section className="card"><h2>Export data</h2>
      <p className="muted">Download any table as CSV for spreadsheets or to import into another CRM. Passwords are never exported.</p>
      <div className="export-grid">{tables.map(([k, label]) => <a key={k} className="btn btn-ghost" href={`/api/admin/export/${k}`}>⬇ {label}</a>)}</div>
    </section>
  );
}

const TABS = [
  ['overview', 'Overview', Overview], ['orders', 'Orders', Orders], ['signups', 'Signups', Signups], ['drivers', 'Drivers', Drivers],
  ['customers', 'Customers', Customers], ['quotes', 'Quotes', Quotes], ['api', 'API activity', ApiActivity], ['export', 'Export', Exports],
];

export default function Admin() {
  const [params, setParams] = useSearchParams();
  const current = TABS.find(([k]) => k === params.get('tab')) || TABS[0];
  const Panel = current[2];
  return (
    <div className="container page wide">
      <div className="page-head"><div><h1>CRM &amp; Dispatch</h1><p className="muted">Every signup, quote, order, delivery and API call, in one place.</p></div></div>
      <div className="tabs" role="tablist">
        {TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={current[0] === k} className={current[0] === k ? 'on' : ''} onClick={() => setParams({ tab: k })}>{label}</button>)}
      </div>
      <div className="stack"><Panel /></div>
    </div>
  );
}
