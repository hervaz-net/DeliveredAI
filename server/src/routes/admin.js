import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { HttpError } from '../validate.js';
import { canCarry } from '../pricing.js';
import { tx } from '../db.js';
import { addEvent, getEvents, findOrder, listOrders, present } from '../orders-lib.js';

export default function adminRoutes(db) {
  const r = Router();
  r.use(requireAuth('admin'));

  r.get('/stats', (_req, res) => {
    const one = (sql) => db.prepare(sql).get();
    res.json({
      orders_total: one('SELECT COUNT(*) AS n FROM orders').n,
      orders_active: one("SELECT COUNT(*) AS n FROM orders WHERE status IN ('pending','assigned','en_route_pickup','picked_up')").n,
      orders_pending: one("SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'").n,
      delivered_today: one("SELECT COUNT(*) AS n FROM orders WHERE status = 'delivered' AND date(delivered_at) = date('now')").n,
      revenue_cents: one("SELECT COALESCE(SUM(price_cents),0) AS n FROM orders WHERE status = 'delivered'").n,
      customers: one("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'").n,
      drivers: one("SELECT COUNT(*) AS n FROM users WHERE role = 'driver'").n,
      drivers_online: one('SELECT COUNT(*) AS n FROM driver_profiles WHERE is_online = 1').n,
      signups_today: one("SELECT COUNT(*) AS n FROM users WHERE role != 'admin' AND date(created_at) = date('now')").n,
      quotes_total: one('SELECT COUNT(*) AS n FROM quotes').n,
      quotes_converted: one('SELECT COUNT(*) AS n FROM quotes WHERE order_id IS NOT NULL').n,
      api_calls_24h: one("SELECT COUNT(*) AS n FROM api_logs WHERE created_at >= datetime('now', '-1 day')").n,
      api_errors_24h: one("SELECT COUNT(*) AS n FROM api_logs WHERE status >= 400 AND created_at >= datetime('now', '-1 day')").n,
    });
  });

  r.get('/orders', (req, res) => {
    const status = req.query.status ? String(req.query.status) : null;
    const rows = status ? listOrders(db, 'o.status = ?', status) : listOrders(db, '1 = 1');
    res.json({ orders: rows.map((o) => present(o)) });
  });

  r.get('/drivers', (_req, res) => {
    const drivers = db.prepare(`
      SELECT u.id, u.name, u.email, u.phone, u.created_at, dp.vehicle_type, dp.vehicle_make, dp.vehicle_model, dp.license_plate, dp.is_online, dp.rating,
        (SELECT COUNT(*) FROM orders o WHERE o.driver_id = u.id AND o.status = 'delivered') AS delivered,
        (SELECT COUNT(*) FROM orders o WHERE o.driver_id = u.id AND o.status IN ('assigned','en_route_pickup','picked_up')) AS active
      FROM users u JOIN driver_profiles dp ON dp.user_id = u.id
      WHERE u.role = 'driver' ORDER BY dp.is_online DESC, u.name`).all();
    res.json({ drivers: drivers.map((d) => ({ ...d, is_online: !!d.is_online })) });
  });

  r.get('/customers', (_req, res) => {
    res.json({ customers: db.prepare(`
      SELECT u.id, u.name, u.email, u.phone, u.company_name, u.created_at,
        (SELECT COUNT(*) FROM orders o WHERE o.customer_id = u.id) AS orders,
        (SELECT COALESCE(SUM(price_cents),0) FROM orders o WHERE o.customer_id = u.id AND o.status = 'delivered') AS spent_cents
      FROM users u WHERE u.role = 'customer' ORDER BY u.id DESC`).all() });
  });

  // Newest accounts of every kind, for the CRM signup feed.
  r.get('/signups', (_req, res) => {
    res.json({ users: db.prepare(`
      SELECT u.id, u.name, u.email, u.phone, u.company_name, u.role, u.created_at, dp.vehicle_type
      FROM users u LEFT JOIN driver_profiles dp ON dp.user_id = u.id
      WHERE u.role != 'admin' ORDER BY u.id DESC LIMIT 200`).all() });
  });

  r.get('/quotes', (_req, res) => {
    res.json({ quotes: db.prepare(`
      SELECT q.*, u.name AS user_name, u.email AS user_email, o.tracking_code
      FROM quotes q LEFT JOIN users u ON u.id = q.user_id LEFT JOIN orders o ON o.id = q.order_id
      ORDER BY q.id DESC LIMIT 200`).all() });
  });

  r.get('/api-logs', (req, res) => {
    const errorsOnly = req.query.errors === '1';
    res.json({ logs: db.prepare(`
      SELECT l.*, u.email AS user_email FROM api_logs l LEFT JOIN users u ON u.id = l.user_id
      ${errorsOnly ? 'WHERE l.status >= 400' : ''} ORDER BY l.id DESC LIMIT 300`).all() });
  });

  r.get('/orders/:id', (req, res) => {
    const o = findOrder(db, 'o.id = ?', Number(req.params.id));
    if (!o) throw new HttpError(404, 'Order not found');
    res.json({ order: present(o, { events: getEvents(db, o.id) }) });
  });

  // CSV export of any core table, for spreadsheets or a CRM import. Never includes password hashes.
  const EXPORTS = {
    users: 'SELECT id, email, name, phone, company_name, role, created_at FROM users',
    drivers: 'SELECT u.id, u.name, u.email, u.phone, dp.vehicle_type, dp.vehicle_make, dp.vehicle_model, dp.license_plate, dp.rating, u.created_at FROM users u JOIN driver_profiles dp ON dp.user_id = u.id',
    orders: 'SELECT o.*, c.email AS customer_email, d.email AS driver_email FROM orders o JOIN users c ON c.id = o.customer_id LEFT JOIN users d ON d.id = o.driver_id',
    quotes: 'SELECT * FROM quotes',
    order_events: 'SELECT * FROM order_events',
    api_logs: 'SELECT * FROM api_logs',
  };
  r.get('/export/:table', (req, res) => {
    const sql = EXPORTS[req.params.table];
    if (!sql) throw new HttpError(404, 'Unknown export');
    const rows = db.prepare(`${sql} ORDER BY 1 DESC LIMIT 50000`).all();
    const cols = rows.length ? Object.keys(rows[0]) : [];
    const cell = (v) => {
      if (v == null) return '';
      let s = String(v);
      if (/^[=+\-@]/.test(s)) s = `'${s}`; // stop spreadsheet formula injection
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n');
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="deliveredai-${req.params.table}.csv"`);
    res.send(csv);
  });

  r.post('/orders/:id/assign', (req, res) => {
    const id = Number(req.params.id);
    const driverId = Number(req.body?.driver_id);
    const o = findOrder(db, 'o.id = ?', id);
    if (!o) throw new HttpError(404, 'Order not found');
    if (!['pending', 'assigned'].includes(o.status)) throw new HttpError(400, 'Only orders that have not been picked up can be reassigned');
    const d = db.prepare("SELECT u.name, dp.vehicle_type FROM users u JOIN driver_profiles dp ON dp.user_id = u.id WHERE u.id = ? AND u.role = 'driver'").get(driverId);
    if (!d) throw new HttpError(400, 'Driver not found');
    if (!canCarry(d.vehicle_type, o.vehicle_type)) throw new HttpError(400, `${d.name}'s vehicle is too small for this order`);
    tx(db, () => {
      db.prepare("UPDATE orders SET driver_id = ?, status = 'assigned', updated_at = datetime('now') WHERE id = ?").run(driverId, id);
      addEvent(db, id, 'assigned', `Dispatched to ${d.name}`);
    });
    res.json({ order: present(findOrder(db, 'o.id = ?', id), { events: getEvents(db, id) }) });
  });

  return r;
}
