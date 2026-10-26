import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import { money, dateTime, VEHICLE_LABELS } from '../format.js';
import { Alert, Empty, StatusBadge } from '../components/ui.jsx';

const ACTIVE = ['pending', 'assigned', 'en_route_pickup', 'picked_up'];

export default function Dashboard() {
  const { user } = useAuth();
  const { data, error } = useApi('/orders', { pollMs: 10000 });
  const orders = data?.orders || [];
  const active = orders.filter((o) => ACTIVE.includes(o.status));
  const past = orders.filter((o) => !ACTIVE.includes(o.status));
  const spent = orders.filter((o) => o.status === 'delivered').reduce((s, o) => s + o.price_cents, 0);

  return (
    <div className="container page">
      <div className="page-head">
        <div>
          <h1>Deliveries</h1>
          <p className="muted">{user.company_name || user.name}</p>
        </div>
        <Link to="/app/new" className="btn btn-primary">+ New delivery</Link>
      </div>
      <Alert>{error}</Alert>
      <div className="stat-row">
        <div className="card stat"><span>Active</span><strong>{active.length}</strong></div>
        <div className="card stat"><span>Delivered</span><strong>{orders.filter((o) => o.status === 'delivered').length}</strong></div>
        <div className="card stat"><span>Total spend</span><strong>{money(spent)}</strong></div>
      </div>
      {data && !orders.length && (
        <Empty title="No deliveries yet">
          <p className="muted">Book your first delivery and it will show up here.</p>
          <Link to="/app/new" className="btn btn-primary">Book a delivery</Link>
        </Empty>
      )}
      {active.length > 0 && <OrderTable title="In progress" orders={active} />}
      {past.length > 0 && <OrderTable title="History" orders={past} />}
    </div>
  );
}

function OrderTable({ title, orders }) {
  return (
    <section className="card table-card">
      <h2>{title}</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Tracking</th><th>Route</th><th>Vehicle</th><th>Status</th><th>Price</th><th>Created</th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td><Link to={`/app/orders/${o.id}`}>{o.tracking_code}</Link></td>
                <td className="route-cell"><span>{o.pickup_address}</span><span className="muted">→ {o.dropoff_address}</span></td>
                <td>{VEHICLE_LABELS[o.vehicle_type]}</td>
                <td><StatusBadge status={o.status} label={o.status_label} /></td>
                <td>{money(o.price_cents)}</td>
                <td className="muted">{dateTime(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
