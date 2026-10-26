import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { HttpError, str } from '../validate.js';
import { quote, VEHICLES, HELPER_FEE_CENTS } from '../pricing.js';
import { tx } from '../db.js';
import { addEvent, getEvents, findOrder, listOrders, present, presentPublic, newTrackingCode } from '../orders-lib.js';

function quoteInput(b) {
  return {
    pickup_address: str(b, 'pickup_address', { required: true, max: 300, label: 'Pickup address' }),
    dropoff_address: str(b, 'dropoff_address', { required: true, max: 300, label: 'Drop-off address' }),
    vehicle_type: str(b, 'vehicle_type', { required: true, label: 'Vehicle type' }),
    helper: !!b?.helper,
  };
}

export function publicRoutes(db) {
  const r = Router();

  r.get('/vehicles', (_req, res) => {
    res.json({ vehicles: Object.entries(VEHICLES).map(([id, v]) => ({ id, ...v })), helper_fee_cents: HELPER_FEE_CENTS });
  });

  // Every quote is recorded so the CRM can see demand and quote-to-order conversion.
  r.post('/quotes', (req, res) => {
    const input = quoteInput(req.body);
    const q = quote(input);
    db.prepare('INSERT INTO quotes (user_id, pickup_address, dropoff_address, vehicle_type, helper, distance_miles, total_cents, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(req.user?.id ?? null, input.pickup_address, input.dropoff_address, q.vehicle_type, input.helper ? 1 : 0, q.distance_miles, q.total_cents, req.ip);
    res.json({ quote: q });
  });

  r.get('/track/:code', (req, res) => {
    const order = findOrder(db, 'o.tracking_code = ?', String(req.params.code).toUpperCase());
    if (!order) throw new HttpError(404, 'No delivery found with that tracking code');
    res.json({ order: presentPublic(order, getEvents(db, order.id)) });
  });

  return r;
}

export default function orderRoutes(db) {
  const r = Router();
  r.use(requireAuth('customer', 'admin'));

  r.get('/', (req, res) => {
    const orders = req.user.role === 'admin' ? listOrders(db, '1 = 1') : listOrders(db, 'o.customer_id = ?', req.user.id);
    res.json({ orders: orders.map((o) => present(o)) });
  });

  r.post('/', requireAuth('customer'), (req, res) => {
    const b = req.body || {};
    const input = quoteInput(b);
    const q = quote(input);
    const item = str(b, 'item_description', { required: true, max: 500, label: 'What are we delivering' });
    const weight = b.weight_lbs ? Math.max(0, Math.round(Number(b.weight_lbs))) : null;
    if (weight && weight > VEHICLES[q.vehicle_type].maxLbs) {
      throw new HttpError(400, `${VEHICLES[q.vehicle_type].label} carries up to ${VEHICLES[q.vehicle_type].maxLbs} lbs. Pick a larger vehicle.`);
    }
    let scheduled = null;
    if (b.scheduled_for) {
      const d = new Date(b.scheduled_for);
      if (Number.isNaN(d.getTime())) throw new HttpError(400, 'Scheduled time is not valid');
      if (d.getTime() < Date.now() - 5 * 60 * 1000) throw new HttpError(400, 'Scheduled time must be in the future');
      scheduled = d.toISOString();
    }
    const pm = b.payment_method_id
      ? db.prepare('SELECT id FROM payment_methods WHERE id = ? AND user_id = ?').get(Number(b.payment_method_id), req.user.id)
      : db.prepare('SELECT id FROM payment_methods WHERE user_id = ? ORDER BY is_default DESC, id LIMIT 1').get(req.user.id);
    if (!pm) throw new HttpError(400, 'Add a payment method before booking a delivery');

    const id = tx(db, () => {
      const { lastInsertRowid } = db.prepare(`
        INSERT INTO orders (tracking_code, customer_id, payment_method_id, status, vehicle_type, helper,
          pickup_address, pickup_contact_name, pickup_contact_phone, pickup_notes,
          dropoff_address, dropoff_contact_name, dropoff_contact_phone, dropoff_notes,
          item_description, weight_lbs, scheduled_for, distance_miles, price_cents, driver_payout_cents)
        VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        newTrackingCode(), req.user.id, pm.id, q.vehicle_type, q.helper_cents ? 1 : 0,
        input.pickup_address, str(b, 'pickup_contact_name', { max: 120 }), str(b, 'pickup_contact_phone', { max: 40 }), str(b, 'pickup_notes', { max: 500 }),
        input.dropoff_address, str(b, 'dropoff_contact_name', { max: 120 }), str(b, 'dropoff_contact_phone', { max: 40 }), str(b, 'dropoff_notes', { max: 500 }),
        item, weight, scheduled, q.distance_miles, q.total_cents, q.driver_payout_cents,
      );
      addEvent(db, lastInsertRowid, 'pending', scheduled ? `Scheduled for ${scheduled}` : 'Order placed');
      db.prepare(`UPDATE quotes SET order_id = ? WHERE id = (
        SELECT id FROM quotes WHERE user_id = ? AND order_id IS NULL AND pickup_address = ? AND dropoff_address = ? AND vehicle_type = ?
        ORDER BY id DESC LIMIT 1)`).run(lastInsertRowid, req.user.id, input.pickup_address, input.dropoff_address, q.vehicle_type);
      return lastInsertRowid;
    });
    const order = findOrder(db, 'o.id = ?', id);
    res.status(201).json({ order: present(order, { events: getEvents(db, id) }) });
  });

  r.get('/:id', (req, res) => {
    const order = findOrder(db, 'o.id = ?', Number(req.params.id));
    if (!order || (req.user.role !== 'admin' && order.customer_id !== req.user.id)) throw new HttpError(404, 'Order not found');
    res.json({ order: present(order, { events: getEvents(db, order.id) }) });
  });

  r.post('/:id/cancel', (req, res) => {
    const order = findOrder(db, 'o.id = ?', Number(req.params.id));
    if (!order || (req.user.role !== 'admin' && order.customer_id !== req.user.id)) throw new HttpError(404, 'Order not found');
    if (!['pending', 'assigned'].includes(order.status)) throw new HttpError(400, 'This delivery can no longer be cancelled');
    tx(db, () => {
      db.prepare("UPDATE orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?").run(order.id);
      addEvent(db, order.id, 'cancelled', str(req.body, 'reason', { max: 300 }) || 'Cancelled by customer');
    });
    res.json({ order: present(findOrder(db, 'o.id = ?', order.id), { events: getEvents(db, order.id) }) });
  });

  return r;
}

