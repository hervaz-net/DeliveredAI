import crypto from 'node:crypto';

export const STATUSES = ['pending', 'assigned', 'en_route_pickup', 'picked_up', 'delivered', 'cancelled'];
// The next status a driver may move an order to.
export const DRIVER_NEXT = {
  assigned: 'en_route_pickup',
  en_route_pickup: 'picked_up',
  picked_up: 'delivered',
};
export const STATUS_LABELS = {
  pending: 'Finding a driver',
  assigned: 'Driver assigned',
  en_route_pickup: 'Driver heading to pickup',
  picked_up: 'Picked up, on the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export function newTrackingCode() {
  // 10 chars, no ambiguous characters
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(10);
  let out = 'DA';
  for (const b of bytes.subarray(0, 8)) out += alphabet[b % alphabet.length];
  return out;
}

export function addEvent(db, orderId, status, note = null) {
  db.prepare('INSERT INTO order_events (order_id, status, note) VALUES (?, ?, ?)').run(orderId, status, note);
}

export function getEvents(db, orderId) {
  return db.prepare('SELECT status, note, created_at FROM order_events WHERE order_id = ? ORDER BY id').all(orderId);
}

const ORDER_SELECT = `
  SELECT o.*, d.name AS driver_name, d.phone AS driver_phone,
         dp.vehicle_type AS driver_vehicle_type, dp.vehicle_make, dp.vehicle_model, dp.license_plate, dp.rating AS driver_rating,
         c.name AS customer_name, c.company_name AS customer_company, c.email AS customer_email
  FROM orders o
  JOIN users c ON c.id = o.customer_id
  LEFT JOIN users d ON d.id = o.driver_id
  LEFT JOIN driver_profiles dp ON dp.user_id = o.driver_id
`;

export function findOrder(db, where, ...params) {
  return db.prepare(`${ORDER_SELECT} WHERE ${where}`).get(...params);
}

export function listOrders(db, where, ...params) {
  return db.prepare(`${ORDER_SELECT} WHERE ${where} ORDER BY o.id DESC LIMIT 200`).all(...params);
}

export function present(order, { events } = {}) {
  if (!order) return null;
  const out = { ...order, status_label: STATUS_LABELS[order.status], helper: !!order.helper };
  if (events) out.events = events.map((e) => ({ ...e, label: STATUS_LABELS[e.status] }));
  return out;
}

// Fields safe to show anyone holding the tracking code.
export function presentPublic(order, events) {
  return {
    tracking_code: order.tracking_code,
    status: order.status,
    status_label: STATUS_LABELS[order.status],
    vehicle_type: order.vehicle_type,
    pickup_address: order.pickup_address,
    dropoff_address: order.dropoff_address,
    scheduled_for: order.scheduled_for,
    distance_miles: order.distance_miles,
    created_at: order.created_at,
    delivered_at: order.delivered_at,
    proof_recipient: order.proof_recipient,
    driver: order.driver_id
      ? { first_name: String(order.driver_name).split(' ')[0], vehicle: [order.vehicle_make, order.vehicle_model].filter(Boolean).join(' ') || null, rating: order.driver_rating }
      : null,
    events: events.map((e) => ({ status: e.status, label: STATUS_LABELS[e.status], created_at: e.created_at })),
  };
}
